export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, password, role, orderBookerId, action } = body;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't allow deleting the last admin
    if (role && role !== 'admin' && existing.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
      }
    }

    // Handle password change action
    if (action === 'change_password') {
      if (!password) {
        return NextResponse.json({ error: 'New password is required' }, { status: 400 });
      }
      const hashedPassword = hashSync(password, 10);
      await db.user.update({
        where: { id },
        data: { password: hashedPassword },
      });
      return NextResponse.json({ message: 'Password updated successfully' });
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email } });
      if (emailExists) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    // Check orderBookerId uniqueness if changing
    if (orderBookerId && orderBookerId !== existing.orderBookerId) {
      const obUserExists = await db.user.findFirst({ where: { orderBookerId, NOT: { id } } });
      if (obUserExists) {
        return NextResponse.json({ error: 'This order booker already has a login account' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = hashSync(password, 10);
    if (role) updateData.role = role;
    updateData.orderBookerId = role === 'orderbooker' ? (orderBookerId || null) : null;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        orderBooker: {
          select: { id: true, name: true },
        },
      },
    });

    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't allow deleting the last admin
    if (existing.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last admin account' }, { status: 400 });
      }
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
