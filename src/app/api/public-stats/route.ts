export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/public-stats
// Read-only aggregate counts used by the login screen hero tiles.
// Returns ONLY public-safe totals (no amounts, no names, no records).
export async function GET() {
  try {
    const [claims, companies, shops, orderBookers] = await Promise.all([
      db.claim.count(),
      db.company.count(),
      db.shop.count(),
      db.orderBooker.count(),
    ]);
    return NextResponse.json({ claims, companies, shops, orderBookers });
  } catch (error) {
    console.error('Public stats error:', error);
    // Never break the login screen — return zeros on failure
    return NextResponse.json({ claims: 0, companies: 0, shops: 0, orderBookers: 0 });
  }
}
