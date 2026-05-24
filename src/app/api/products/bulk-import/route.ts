export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('companyId') as string;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Support multiple column name formats
      const name = String(row['Name'] || row['name'] || row['Product Name'] || row['product_name'] || row['Product'] || row['product'] || '').trim();
      const priceVal = row['Price'] || row['price'] || row['Rate'] || row['rate'] || row['Amount'] || row['amount'] || 0;
      const claimPriceVal = row['ClaimPrice'] || row['claimPrice'] || row['Claim Price'] || row['claim_price'] || row['ClaimRate'] || row['claimRate'] || row['Claim Rate'] || row['claim_rate'] || '';
      const unit = String(row['Unit'] || row['unit'] || row['UOM'] || row['uom'] || 'pcs').trim();

      if (!name) {
        errors.push(`Row ${i + 2}: Missing product name`);
        skipped++;
        continue;
      }

      const price = Number(priceVal);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${i + 2}: Invalid price "${priceVal}" for "${name}"`);
        skipped++;
        continue;
      }

      try {
        const claimPriceNum = claimPriceVal !== '' ? Number(claimPriceVal) : price;
        await db.product.create({
          data: {
            name,
            price,
            claimPrice: isNaN(claimPriceNum) ? price : claimPriceNum,
            unit: unit || 'pcs',
            companyId,
          },
        });
        imported++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        if (errMsg.includes('Unique constraint')) {
          skipped++;
          // Duplicates silently skipped
        } else {
          errors.push(`Row ${i + 2}: Failed to import "${name}" - ${errMsg}`);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
