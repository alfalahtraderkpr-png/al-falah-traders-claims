export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * GET /api/backup/attachments?offset=0&limit=3
 * Returns attachment blobs (base64 photos) in small pages. The client calls
 * this repeatedly while building a full backup file so no single response
 * ever exceeds the serverless body limit.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    // Keep the page small on purpose: each photo can be up to ~2.7MB as base64
    const limit = Math.min(5, Math.max(1, parseInt(searchParams.get('limit') || '3', 10) || 3));

    const [rows, total] = await Promise.all([
      db.claimAttachment.findMany({
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
      db.claimAttachment.count(),
    ]);

    return NextResponse.json({
      attachments: rows,
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
    });
  } catch (error) {
    console.error('Backup attachments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
