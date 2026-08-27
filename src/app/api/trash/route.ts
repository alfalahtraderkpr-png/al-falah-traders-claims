export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/trash — list all soft-deleted records (admin only).
 * Auto-purges records older than 30 days on each load.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Auto-purge: permanently delete records sitting in trash for 30+ days
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    await db.claim.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await db.product.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await db.supplier.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await db.shop.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await db.company.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    await db.orderBooker.deleteMany({ where: { deletedAt: { lt: cutoff } } });

    const [claims, products, suppliers, shops, companies, orderBookers] = await Promise.all([
      db.claim.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { company: true, shop: true, supplier: true, orderBooker: true },
      }),
      db.product.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { company: true },
      }),
      db.supplier.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { company: true },
      }),
      db.shop.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { companyOrderBookers: { include: { company: true } } },
      }),
      db.company.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
      db.orderBooker.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      claims,
      products,
      suppliers,
      shops,
      companies,
      orderBookers,
    });
  } catch (error) {
    console.error('Trash list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/trash — actions (admin only):
 *   { action: 'restore', type: 'claim'|'product'|..., id }
 *   { action: 'purge',   type, id }   — permanently delete one record
 *   { action: 'purge_all' }           — empty the entire trash
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, type, id } = await request.json();

    if (action === 'restore') {
      if (!type || !id) {
        return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
      }
      const models: Record<string, 'claim' | 'product' | 'supplier' | 'shop' | 'company' | 'orderBooker'> = {
        claim: 'claim',
        product: 'product',
        supplier: 'supplier',
        shop: 'shop',
        company: 'company',
        orderBooker: 'orderBooker',
      };
      const model = models[type];
      if (!model) {
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      // @ts-expect-error — dynamic model access with identical shape
      await db[model].update({
        where: { id },
        data: { deletedAt: null },
      });
      return NextResponse.json({ success: true, restored: type });
    }

    if (action === 'purge') {
      if (!type || !id) {
        return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
      }
      if (type === 'claim') {
        const claim = await db.claim.findUnique({ where: { id } });
        if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        await db.claimItem.deleteMany({ where: { claimId: id } });
        await db.claimAttachment.deleteMany({ where: { claimId: id } });
        await db.claim.delete({ where: { id } });
      } else if (type === 'product') {
        const product = await db.product.findUnique({ where: { id }, include: { claimItems: { take: 1 } } });
        if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (product.claimItems.length > 0) {
          return NextResponse.json({ error: 'Product is used in claims — cannot permanently delete' }, { status: 400 });
        }
        await db.productPriceHistory.deleteMany({ where: { productId: id } });
        await db.product.delete({ where: { id } });
      } else if (type === 'supplier') {
        const supplier = await db.supplier.findUnique({ where: { id }, include: { claims: { take: 1 } } });
        if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (supplier.claims.length > 0) {
          return NextResponse.json({ error: 'Supplier is used in claims — cannot permanently delete' }, { status: 400 });
        }
        await db.supplier.delete({ where: { id } });
      } else if (type === 'shop') {
        const shop = await db.shop.findUnique({ where: { id }, include: { claims: { take: 1 } } });
        if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (shop.claims.length > 0) {
          return NextResponse.json({ error: 'Shop is used in claims — cannot permanently delete' }, { status: 400 });
        }
        await db.shopCompanyOrderBooker.deleteMany({ where: { shopId: id } });
        await db.shopCreditLimit.deleteMany({ where: { shopId: id } });
        await db.shop.delete({ where: { id } });
      } else if (type === 'company') {
        const company = await db.company.findUnique({
          where: { id },
          include: { claims: { take: 1 }, products: { take: 1 }, suppliers: { take: 1 } },
        });
        if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (company.claims.length > 0 || company.products.length > 0 || company.suppliers.length > 0) {
          return NextResponse.json({ error: 'Company has claims/products/suppliers — cannot permanently delete' }, { status: 400 });
        }
        await db.shopCompanyOrderBooker.deleteMany({ where: { companyId: id } });
        await db.shopCreditLimit.deleteMany({ where: { companyId: id } });
        await db.userCompany.deleteMany({ where: { companyId: id } });
        await db.company.delete({ where: { id } });
      } else if (type === 'orderBooker') {
        const ob = await db.orderBooker.findUnique({
          where: { id },
          include: { claims: { take: 1 }, user: true },
        });
        if (!ob) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (ob.claims.length > 0) {
          return NextResponse.json({ error: 'Order booker has claims — cannot permanently delete' }, { status: 400 });
        }
        if (ob.user) {
          return NextResponse.json({ error: 'Order booker has a login user — delete the user first' }, { status: 400 });
        }
        await db.shopCompanyOrderBooker.deleteMany({ where: { orderBookerId: id } });
        await db.orderBooker.delete({ where: { id } });
      } else {
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
      }
      return NextResponse.json({ success: true, purged: type });
    }

    if (action === 'purge_all') {
      // Permanently delete everything in trash that is safe to remove.
      // Records still referenced by claims are kept (data integrity first).
      const inTrash = { deletedAt: { not: null } };
      await db.claim.deleteMany({ where: inTrash });
      await db.productPriceHistory.deleteMany({ where: { product: { deletedAt: { not: null } } } });
      await db.product.deleteMany({ where: { AND: [{ deletedAt: { not: null } }, { claimItems: { none: {} } }] } });
      await db.supplier.deleteMany({ where: { AND: [{ deletedAt: { not: null } }, { claims: { none: {} } }] } });
      await db.shopCompanyOrderBooker.deleteMany({ where: { shop: { deletedAt: { not: null } } } });
      await db.shopCreditLimit.deleteMany({ where: { shop: { deletedAt: { not: null } } } });
      await db.shop.deleteMany({ where: { AND: [{ deletedAt: { not: null } }, { claims: { none: {} } }] } });
      await db.shopCompanyOrderBooker.deleteMany({ where: { company: { deletedAt: { not: null } } } });
      await db.shopCreditLimit.deleteMany({ where: { company: { deletedAt: { not: null } } } });
      await db.userCompany.deleteMany({ where: { company: { deletedAt: { not: null } } } });
      await db.company.deleteMany({
        where: { AND: [{ deletedAt: { not: null } }, { claims: { none: {} } }, { products: { none: {} } }, { suppliers: { none: {} } }] },
      });
      await db.shopCompanyOrderBooker.deleteMany({ where: { orderBooker: { deletedAt: { not: null } } } });
      await db.orderBooker.deleteMany({
        where: { AND: [{ deletedAt: { not: null } }, { claims: { none: {} } }, { user: null }] },
      });
      return NextResponse.json({ success: true, purged: 'all' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Trash action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
