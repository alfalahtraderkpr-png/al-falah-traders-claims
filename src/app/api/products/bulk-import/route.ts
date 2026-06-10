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

    const isMultiTier = company.multiTierPricing || false;

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
      const wholesalePriceVal = row['WholesalePrice'] || row['wholesalePrice'] || row['Wholesale Price'] || row['wholesale_price'] || row['WsPrice'] || row['wsPrice'] || '';
      const lmtPriceVal = row['LMTPrice'] || row['lmtPrice'] || row['LMT Price'] || row['lmt_price'] || row['LmtPrice'] || row['lmtprice'] || '';
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
        const wholesalePriceNum = isMultiTier && wholesalePriceVal !== '' ? Number(wholesalePriceVal) : null;
        const lmtPriceNum = isMultiTier && lmtPriceVal !== '' ? Number(lmtPriceVal) : null;

        // Validate multi-tier prices
        if (wholesalePriceNum !== null && (isNaN(wholesalePriceNum) || wholesalePriceNum < 0)) {
          errors.push(`Row ${i + 2}: Invalid wholesale price "${wholesalePriceVal}" for "${name}"`);
          skipped++;
          continue;
        }
        if (lmtPriceNum !== null && (isNaN(lmtPriceNum) || lmtPriceNum < 0)) {
          errors.push(`Row ${i + 2}: Invalid LMT price "${lmtPriceVal}" for "${name}"`);
          skipped++;
          continue;
        }

        await db.product.create({
          data: {
            name,
            price,
            claimPrice: isNaN(claimPriceNum) ? price : claimPriceNum,
            wholesalePrice: wholesalePriceNum,
            lmtPrice: lmtPriceNum,
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
