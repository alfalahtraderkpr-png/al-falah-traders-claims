export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Manually resolve orderBooker names for orderbooker users
    const obIds = users.filter(u => u.orderBookerId).map(u => u.orderBookerId!);
    let obMap: Record<string, { id: string; name: string }> = {};

    if (obIds.length > 0) {
      const orderBookers = await db.orderBooker.findMany({
        where: { id: { in: obIds } },
        select: { id: true, name: true },
      });
      orderBookers.forEach(ob => { obMap[ob.id] = ob; });
    }

    // Don't return passwords, add orderBooker info manually
    const safeUsers = users.map(({ password, orderBookerId, ...user }) => ({
      ...user,
      orderBookerId,
      orderBooker: orderBookerId ? (obMap[orderBookerId] || null) : null,
    }));

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role, orderBookerId } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password, and role are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: `Email "${email}" already exists. Delete the existing user first, or use a different email.` }, { status: 400 });
    }

    // If orderbooker role, validate orderBookerId
    if (role === 'orderbooker' && !orderBookerId) {
      return NextResponse.json({ error: 'Order Booker must be selected for orderbooker role' }, { status: 400 });
    }

    // Check if this orderbooker already has a login
    if (orderBookerId) {
      const existingOBUser = await db.user.findFirst({ where: { orderBookerId } });
      if (existingOBUser) {
        return NextResponse.json({ error: `This order booker already has a login (${existingOBUser.email}). Delete it first from Users tab.` }, { status: 400 });
      }
    }

    const hashedPassword = hashSync(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        orderBookerId: role === 'orderbooker' ? orderBookerId : null,
      },
    });

    // Manually resolve orderBooker info
    let orderBookerInfo: { id: string; name: string } | null = null;
    if (user.orderBookerId) {
      const ob = await db.orderBooker.findUnique({
        where: { id: user.orderBookerId },
        select: { id: true, name: true },
      });
      orderBookerInfo = ob;
    }

    const { password: _, ...safeUser } = user;
    return NextResponse.json({ ...safeUser, orderBooker: orderBookerInfo }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Failed to create user: ${errMsg}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Bulk delete all order booker users
    if (action === 'delete_all_ob') {
      const result = await db.user.deleteMany({
        where: { role: 'orderbooker' },
      });
      return NextResponse.json({ message: `Deleted ${result.count} order booker login(s)`, deleted: result.count });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
