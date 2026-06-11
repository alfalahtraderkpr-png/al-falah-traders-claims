export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const entity = searchParams.get('entity');
    const action = searchParams.get('action');
    
    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, userName, action, entity, entityId, details } = await request.json();
    
    const log = await db.auditLog.create({
      data: { userId, userName, action, entity, entityId, details },
    });
    
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Create audit log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
