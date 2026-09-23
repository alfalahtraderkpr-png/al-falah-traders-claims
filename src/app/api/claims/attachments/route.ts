export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function POST(request: NextRequest) {
  try {
    // Login required — app apne requests mein auth cookies bhejta hai
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

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
