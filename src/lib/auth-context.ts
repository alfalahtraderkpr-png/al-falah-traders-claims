import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  role: string; // "admin" | "orderbooker"
  orderBookerId: string | null;
  assignedCompanyIds: string[]; // empty for admin (admin sees all)
}

/**
 * Reads the auth cookies from the request and resolves the current user,
 * including their assigned companies (empty array for admins).
 *
 * Returns null if the user is not authenticated or no longer exists.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const userData = request.cookies.get('user-data')?.value;
  if (!userData) return null;

  try {
    const parsed = JSON.parse(userData);
    if (!parsed?.id) return null;

    // Re-fetch from DB to get fresh assignedCompanyIds (the cookie does
    // NOT contain them on purpose — they may change mid-session)
    const dbUser = await db.user.findUnique({
      where: { id: parsed.id },
      include: { userCompanies: { select: { companyId: true } } },
    });

    if (!dbUser) return null;

    return {
      userId: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      orderBookerId: dbUser.orderBookerId,
      assignedCompanyIds: dbUser.userCompanies.map((uc) => uc.companyId),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the company-filter Prisma `where` clause for the current user.
 * - For admins: returns `{}` (no filter — see all companies).
 * - For order bookers: returns `{ companyId: { in: [...] } }` filtered to
 *   their assigned companies. If they have no assignments, returns
 *   `{ companyId: { in: ['__none__'] } }` so they see nothing.
 */
export function companyFilterForUser(auth: AuthContext | null) {
  if (!auth || auth.role === 'admin') return {};
  if (auth.assignedCompanyIds.length === 0) {
    // No companies assigned — return a clause that matches nothing
    return { companyId: { in: ['__none__'] } };
  }
  return { companyId: { in: auth.assignedCompanyIds } };
}

/**
 * Returns the order booker filter for the current user.
 * - Admin: `{}` (no filter)
 * - Order Booker: `{ orderBookerId: auth.orderBookerId }` (only their own)
 */
export function orderBookerFilterForUser(auth: AuthContext | null) {
  if (!auth || auth.role === 'admin') return {};
  if (!auth.orderBookerId) return { orderBookerId: '__none__' };
  return { orderBookerId: auth.orderBookerId };
}
