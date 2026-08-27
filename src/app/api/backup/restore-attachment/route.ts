export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/backup/restore-attachment
 * Upserts photo attachments one (or a few) at a time after the main restore.
 * Used when the backup file is too large for a single request, so photos are
 * streamed in sequentially. Idempotent: re-uploading the same attachment
 * updates it instead of failing, which makes interrupted restores retryable.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const rows: Array<Record<string, unknown>> = Array.isArray(body?.attachments) ? body.attachments : [];

    let saved = 0;
    for (const r of rows) {
      if (!r || typeof r !== 'object' || !r.id || !r.claimId || !r.url) continue;
      const data = {
        id: String(r.id),
        claimId: String(r.claimId),
        url: String(r.url),
        type: r.type ? String(r.type) : 'image',
        ...(r.createdAt ? { createdAt: new Date(String(r.createdAt)) } : {}),
      };
      await db.claimAttachment.upsert({
        where: { id: data.id },
        create: data,
        update: { url: data.url, claimId: data.claimId, type: data.type },
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved });
  } catch (error) {
    console.error('Restore attachment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
