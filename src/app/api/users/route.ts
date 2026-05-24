export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orderBooker: {
          select: { id: true, name: true },
        },
      },
    });

    // Don't return passwords
    const safeUsers = users.map(({ password, ...user }) => user);

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
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // If orderbooker role, validate orderBookerId
    if (role === 'orderbooker' && !orderBookerId) {
      return NextResponse.json({ error: 'Order Booker must be selected for orderbooker role' }, { status: 400 });
    }

    // Check if this orderbooker already has a login
    if (orderBookerId) {
      const existingOBUser = await db.user.findFirst({ where: { orderBookerId } });
      if (existingOBUser) {
        return NextResponse.json({ error: 'This order booker already has a login account' }, { status: 400 });
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
      include: {
        orderBooker: {
          select: { id: true, name: true },
        },
      },
    });

    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
