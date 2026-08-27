export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * GET /api/settings — app settings (company profile).
 * Available to any logged-in user (profile shows on receipts).
 */
export async function GET() {
  try {
    let settings = await db.appSetting.findUnique({ where: { id: 'main' } });
    if (!settings) {
      settings = await db.appSetting.create({
        data: {
          id: 'main',
          companyName: 'Al-Falah Traders',
          address: '',
          phone: '',
          email: '',
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/settings — update company profile (admin only).
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { companyName, address, phone, email } = await request.json();
    if (!companyName || !String(companyName).trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const settings = await db.appSetting.upsert({
      where: { id: 'main' },
      update: {
        companyName: String(companyName).trim(),
        address: String(address || '').trim(),
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
      },
      create: {
        id: 'main',
        companyName: String(companyName).trim(),
        address: String(address || '').trim(),
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
