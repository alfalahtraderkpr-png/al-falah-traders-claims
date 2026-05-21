export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';

export async function POST() {
  try {
    // Create admin user
    const adminPassword = hashSync('admin123', 10);
    await db.user.upsert({
      where: { email: 'admin@alfalah.com' },
      update: {},
      create: {
        name: 'Admin',
        email: 'admin@alfalah.com',
        password: adminPassword,
        role: 'admin',
      },
    });

    // Create companies
    const cbl = await db.company.upsert({
      where: { id: 'company-cbl' },
      update: {},
      create: { id: 'company-cbl', name: 'CBL' },
    });

    await db.company.upsert({
      where: { id: 'company-cadbury' },
      update: { multiTierPricing: true },
      create: { id: 'company-cadbury', name: 'Cadbury', multiTierPricing: true },
    });

    await db.company.upsert({
      where: { id: 'company-shan' },
      update: {},
      create: { id: 'company-shan', name: 'Shan Foods' },
    });

    // Create order bookers
    const obData = [
      { id: 'ob-anas', name: 'Anas' },
      { id: 'ob-murtaza', name: 'Murtaza' },
      { id: 'ob-kashif', name: 'Kashif Khan' },
      { id: 'ob-ali', name: 'Ali' },
      { id: 'ob-danish', name: 'Danish Ramzan' },
    ];

    for (const ob of obData) {
      await db.orderBooker.upsert({
        where: { id: ob.id },
        update: {},
        create: ob,
      });
    }

    // Create order booker users
    const obPassword = hashSync('password123', 10);
    const obUsers = [
      { name: 'Anas', email: 'anas@alfalah.com', orderBookerId: 'ob-anas' },
      { name: 'Murtaza', email: 'murtaza@alfalah.com', orderBookerId: 'ob-murtaza' },
      { name: 'Kashif Khan', email: 'kashifkhan@alfalah.com', orderBookerId: 'ob-kashif' },
      { name: 'Ali', email: 'ali@alfalah.com', orderBookerId: 'ob-ali' },
      { name: 'Danish Ramzan', email: 'danishramzan@alfalah.com', orderBookerId: 'ob-danish' },
    ];

    for (const obUser of obUsers) {
      await db.user.upsert({
        where: { email: obUser.email },
        update: {},
        create: {
          name: obUser.name,
          email: obUser.email,
          password: obPassword,
          role: 'orderbooker',
          orderBookerId: obUser.orderBookerId,
        },
      });
    }

    // Create suppliers
    const supData = [
      { id: 'sup-ayub', name: 'Ayub' },
      { id: 'sup-aqib', name: 'Aqib' },
      { id: 'sup-awais', name: 'Awais' },
      { id: 'sup-saad', name: 'Saad' },
      { id: 'sup-sami', name: 'Sami' },
      { id: 'sup-ikram', name: 'Ikram' },
    ];

    for (const s of supData) {
      await db.supplier.upsert({
        where: { id: s.id },
        update: {},
        create: s,
      });
    }

    // Create shops
    const shopData = [
      { id: 'shop-chks', name: 'CH Ks', address: 'Pakistan Chowk', shopType: 'retail' },
      { id: 'shop-apna', name: 'Apna Easy Load', address: 'Pakistan Chowk', shopType: 'retail' },
      { id: 'shop-usama', name: 'Usama SS', address: 'Feroza', shopType: 'retail' },
      { id: 'shop-kanwal', name: 'Kanwal Pan Shop', address: 'Din Pur Chowk', shopType: 'retail' },
      { id: 'shop-punjab', name: 'Punjab Gs', address: 'Trunk Bazar', shopType: 'wholesale' },
      { id: 'shop-alian', name: 'Alian Sweets', address: 'Kotla Pathan', shopType: 'retail' },
    ];

    for (const s of shopData) {
      await db.shop.upsert({
        where: { id: s.id },
        update: {},
        create: s,
      });
    }

    // Create sample products for CBL
    const sampleProducts = [
      { name: 'SP Coconut', price: 50, unit: 'pcs' },
      { name: 'BP Zeera', price: 20, unit: 'pcs' },
      { name: 'NanKhatai', price: 20, unit: 'pcs' },
      { name: 'Tuc', price: 20, unit: 'pcs' },
      { name: 'Gala', price: 10, unit: 'pcs' },
    ];

    for (const p of sampleProducts) {
      await db.product.upsert({
        where: { name_price_companyId: { name: p.name, price: p.price, companyId: cbl.id } },
        update: {},
        create: { ...p, companyId: cbl.id },
      });
    }

    return NextResponse.json({ success: true, message: 'Seed data created/updated' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
