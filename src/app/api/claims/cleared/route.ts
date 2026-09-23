export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * GET /api/claims/cleared
 *
 * Claims cleared on a given day (default: today, Pakistan time UTC+5),
 * with full "who cleared which shop's claim" detail for the admin
 * dashboard page. Order bookers only ever see their own clears.
 *
 * Query params:
 *  - date            YYYY-MM-DD in PKT (default: today PKT)
 *  - orderBookerId   optional — admin can filter by one order booker
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ── Resolve the PKT day window ──────────────────────────────
    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Karachi = UTC+5
    const dateParam = searchParams.get('date');
    let dayStr: string;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      dayStr = dateParam;
    } else {
      // Today in Pakistan
      dayStr = new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
    }
    // 00:00 PKT of that day, expressed in UTC
    const startUtc = new Date(`${dayStr}T00:00:00.000Z`).getTime() - PKT_OFFSET_MS;
    const endUtc = startUtc + 24 * 60 * 60 * 1000;
    if (isNaN(startUtc)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    // ── Security: order bookers are locked to their own claims ──
    let orderBookerFilter: string | null = null;
    if (auth.role !== 'admin') {
      orderBookerFilter = auth.orderBookerId ?? '__none__';
    } else {
      orderBookerFilter = searchParams.get('orderBookerId');
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      status: 'cleared',
      clearedDate: { gte: new Date(startUtc), lt: new Date(endUtc) },
    };
    if (orderBookerFilter) where.orderBookerId = orderBookerFilter;

    const claims = await db.claim.findMany({
      where,
      orderBy: { clearedDate: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true, address: true } },
        supplier: { select: { id: true, name: true } },
        orderBooker: { select: { id: true, name: true } },
        claimItems: { select: { id: true } },
      },
    });

    // ── Summary + per-order-booker breakdown ────────────────────
    const totalNet = claims.reduce((sum, c) => sum + (c.netAmount || c.totalAmount || 0), 0);
    const byOrderBookerMap = new Map<string, { id: string | null; name: string; count: number; amount: number }>();
    for (const c of claims) {
      const key = c.orderBooker?.id ?? '__none__';
      const entry = byOrderBookerMap.get(key) ?? {
        id: c.orderBooker?.id ?? null,
        name: c.orderBooker?.name ?? 'Unassigned',
        count: 0,
        amount: 0,
      };
      entry.count += 1;
      entry.amount += c.netAmount || c.totalAmount || 0;
      byOrderBookerMap.set(key, entry);
    }
    const byOrderBooker = Array.from(byOrderBookerMap.values()).sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      date: dayStr,
      summary: {
        count: claims.length,
        totalNet,
        byOrderBooker,
      },
      claims,
    });
  } catch (error) {
    console.error('Get cleared claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
