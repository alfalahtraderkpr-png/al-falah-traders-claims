export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { claimId, attachments } = await request.json();
    
    if (!claimId || !attachments || !Array.isArray(attachments)) {
      return NextResponse.json({ error: 'Claim ID and attachments required' }, { status: 400 });
    }
    
    const created = await Promise.all(
      attachments.map((url: string) =>
        db.claimAttachment.create({
          data: { claimId, url, type: 'image' },
        })
      )
    );
    
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Attachment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
