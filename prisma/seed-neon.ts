import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import { hashSync } from 'bcryptjs'

neonConfig.poolQueryViaFetch = true

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding Neon database (fast version)...')

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@alfalah.com' } })
  if (existingAdmin) {
    console.log('Database already seeded, skipping...')
    return
  }

  // Create admin user
  const adminPassword = hashSync('admin123', 10)
  await prisma.user.create({
    data: { name: 'Admin', email: 'admin@alfalah.com', password: adminPassword, role: 'admin' },
  })
  console.log('Created admin user')

  // Create companies
  await prisma.company.createMany({ data: [
    { id: 'company-cbl', name: 'CBL' },
    { id: 'company-cadbury', name: 'Cadbury', multiTierPricing: true },
    { id: 'company-shan', name: 'Shan Foods', claimDeductionPercent: 22 },
  ], skipDuplicates: true })
  console.log('Created companies')

  // Create order bookers
  await prisma.orderBooker.createMany({ data: [
    { id: 'ob-anas', name: 'Anas' },
    { id: 'ob-murtaza', name: 'Murtaza' },
    { id: 'ob-kashif', name: 'Kashif Khan' },
    { id: 'ob-ali', name: 'Ali' },
    { id: 'ob-danish', name: 'Danish Ramzan' },
  ], skipDuplicates: true })
  console.log('Created order bookers')

  // Create suppliers
  await prisma.supplier.createMany({ data: [
    { id: 'sup-ayub', name: 'Ayub' },
    { id: 'sup-aqib', name: 'Aqib' },
    { id: 'sup-awais', name: 'Awais' },
    { id: 'sup-saad', name: 'Saad' },
    { id: 'sup-sami', name: 'Sami' },
    { id: 'sup-ikram', name: 'Ikram' },
  ], skipDuplicates: true })
  console.log('Created suppliers')

  // Create shops
  await prisma.shop.createMany({ data: [
    { id: 'shop-chks', name: 'CH Ks', address: 'Pakistan Chowk' },
    { id: 'shop-apna', name: 'Apna Easy Load', address: 'Pakistan Chowk' },
    { id: 'shop-usama', name: 'Usama SS', address: 'Feroza' },
    { id: 'shop-kanwal', name: 'Kanwal Pan Shop', address: 'Din Pur Chowk' },
    { id: 'shop-punjab', name: 'Punjab Gs', address: 'Trunk Bazar' },
    { id: 'shop-alian', name: 'Alian Sweets', address: 'Kotla Pathan' },
  ], skipDuplicates: true })
  console.log('Created shops')

  // Create CBL products (batch)
  const cblProducts = [
    { name: 'SP Coconut', price: 50, unit: 'pcs' },
    { name: 'BP Zeera', price: 20, unit: 'pcs' },
    { name: 'SP NanKhatai', price: 320, unit: 'Box' },
    { name: 'SP Bistiks', price: 320, unit: 'Box' },
    { name: 'BP Bistiks', price: 300, unit: 'Box' },
    { name: 'TP Candi', price: 240, unit: 'Ctn' },
    { name: 'SP Oreo Choc', price: 320, unit: 'Box' },
    { name: 'BP Oreo Choc', price: 320, unit: 'Box' },
    { name: 'TP NanKhatai', price: 240, unit: 'Ctn' },
    { name: 'NanKhatai', price: 20, unit: 'pcs' },
    { name: 'SP Tiger', price: 300, unit: 'Box' },
    { name: 'Mini Oreo', price: 240, unit: 'Ctn' },
    { name: 'Jumbo Prince', price: 40, unit: 'pcs' },
    { name: 'Choco Jammies', price: 360, unit: 'Box' },
    { name: 'Prince', price: 40, unit: 'pcs' },
    { name: 'MilcoLu', price: 30, unit: 'pcs' },
    { name: 'Enrob', price: 25, unit: 'pcs' },
    { name: 'Candi', price: 10, unit: 'pcs' },
    { name: 'Tuc', price: 20, unit: 'pcs' },
    { name: 'HR Candi', price: 30, unit: 'pcs' },
    { name: 'SP Butter', price: 40, unit: 'pcs' },
    { name: 'SP Zeera', price: 40, unit: 'pcs' },
    { name: 'BP Zeera', price: 10, unit: 'pcs' },
    { name: 'TP Classic', price: 10, unit: 'pcs' },
    { name: 'BP Gala', price: 10, unit: 'pcs' },
    { name: 'BP Gala', price: 20, unit: 'pcs' },
    { name: 'HR Gala', price: 20, unit: 'pcs' },
    { name: 'VP Gala', price: 40, unit: 'pcs' },
    { name: 'Gala', price: 10, unit: 'pcs' },
    { name: 'Gala', price: 30, unit: 'pcs' },
    { name: 'Gala', price: 40, unit: 'pcs' },
    { name: 'HF', price: 50, unit: 'pcs' },
    { name: 'SP HF', price: 50, unit: 'pcs' },
    { name: 'TP HF', price: 20, unit: 'pcs' },
    { name: 'Zeera', price: 10, unit: 'pcs' },
    { name: 'Zeera', price: 20, unit: 'pcs' },
    { name: 'Zeera', price: 30, unit: 'pcs' },
    { name: 'Zeera', price: 40, unit: 'pcs' },
    { name: 'VP Zeera', price: 50, unit: 'pcs' },
    { name: 'TUC', price: 10, unit: 'pcs' },
    { name: 'TUC', price: 20, unit: 'pcs' },
    { name: 'TUC', price: 30, unit: 'pcs' },
    { name: 'TUC', price: 40, unit: 'pcs' },
    { name: 'BP Tiger', price: 10, unit: 'pcs' },
    { name: 'Tiger', price: 5, unit: 'pcs' },
    { name: 'Tiger', price: 10, unit: 'pcs' },
    { name: 'Classic', price: 10, unit: 'pcs' },
    { name: 'Classic', price: 20, unit: 'pcs' },
    { name: 'Bistiks', price: 20, unit: 'pcs' },
    { name: 'Bistiks', price: 30, unit: 'pcs' },
    { name: 'Bistiks', price: 40, unit: 'pcs' },
    { name: 'Oreo Mini', price: 10, unit: 'pcs' },
    { name: 'Oreo', price: 20, unit: 'pcs' },
    { name: 'Oreo', price: 40, unit: 'pcs' },
    { name: 'Belvita', price: 50, unit: 'pcs' },
    { name: 'MilcoLu', price: 10, unit: 'pcs' },
    { name: 'MilcoLu', price: 15, unit: 'pcs' },
    { name: 'MilcoLu', price: 20, unit: 'pcs' },
    { name: 'MilcoLu', price: 40, unit: 'pcs' },
    { name: 'Coconut', price: 15, unit: 'pcs' },
    { name: 'Coconut', price: 50, unit: 'pcs' },
    { name: 'SP Butter', price: 50, unit: 'pcs' },
    { name: 'Butter', price: 50, unit: 'pcs' },
    { name: 'Oreo Crispy', price: 300, unit: 'Box' },
    { name: 'Prince', price: 25, unit: 'pcs' },
    { name: 'Prince', price: 30, unit: 'pcs' },
    { name: 'SP Prince', price: 40, unit: 'pcs' },
    { name: 'SP Prince', price: 50, unit: 'pcs' },
    { name: 'HR Prince', price: 30, unit: 'pcs' },
    { name: 'HR Prince', price: 40, unit: 'pcs' },
    { name: 'SF', price: 20, unit: 'pcs' },
    { name: 'SF', price: 50, unit: 'pcs' },
    { name: 'Sugar Free', price: 20, unit: 'pcs' },
    { name: 'Crispy', price: 10, unit: 'pcs' },
    { name: 'Candi', price: 30, unit: 'pcs' },
    { name: 'Candi', price: 40, unit: 'pcs' },
    { name: 'SP Oreo', price: 30, unit: 'pcs' },
    { name: 'Mini Oreo Choc', price: 20, unit: 'pcs' },
    { name: 'Oreo Mini Choc', price: 10, unit: 'pcs' },
    { name: 'NanKhatai', price: 10, unit: 'pcs' },
    { name: 'NanKhatai', price: 15, unit: 'pcs' },
    { name: 'NanKhatai', price: 40, unit: 'pcs' },
    { name: 'SP NanKhatai', price: 40, unit: 'pcs' },
    { name: 'TP NanKhatai', price: 10, unit: 'pcs' },
    { name: 'Jammies', price: 30, unit: 'pcs' },
    { name: 'SP MilcoLu', price: 40, unit: 'pcs' },
    { name: 'TP Zeera', price: 10, unit: 'pcs' },
    { name: 'BP Oero', price: 15, unit: 'pcs' },
    { name: 'SP Butter/Coconut', price: 50, unit: 'pcs' },
    { name: 'Belvita Kleja', price: 50, unit: 'pcs' },
  ].map(p => ({ ...p, companyId: 'company-cbl' }))

  // Insert products in small batches
  const batchSize = 10
  for (let i = 0; i < cblProducts.length; i += batchSize) {
    const batch = cblProducts.slice(i, i + batchSize)
    for (const p of batch) {
      try {
        await prisma.product.create({ data: p })
      } catch { /* skip duplicates */ }
    }
  }
  console.log(`Created ${cblProducts.length} CBL products`)

  // Create shop-company-orderbooker mappings
  const mappings = [
    { shopId: 'shop-chks', companyId: 'company-cbl', orderBookerId: 'ob-anas' },
    { shopId: 'shop-chks', companyId: 'company-shan', orderBookerId: 'ob-anas' },
    { shopId: 'shop-chks', companyId: 'company-cadbury', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-apna', companyId: 'company-cbl', orderBookerId: 'ob-anas' },
    { shopId: 'shop-apna', companyId: 'company-shan', orderBookerId: 'ob-anas' },
    { shopId: 'shop-apna', companyId: 'company-cadbury', orderBookerId: 'ob-anas' },
    { shopId: 'shop-usama', companyId: 'company-cbl', orderBookerId: 'ob-danish' },
    { shopId: 'shop-usama', companyId: 'company-shan', orderBookerId: 'ob-ali' },
    { shopId: 'shop-usama', companyId: 'company-cadbury', orderBookerId: 'ob-ali' },
    { shopId: 'shop-kanwal', companyId: 'company-cbl', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-kanwal', companyId: 'company-shan', orderBookerId: 'ob-kashif' },
    { shopId: 'shop-kanwal', companyId: 'company-cadbury', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-punjab', companyId: 'company-cbl', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-punjab', companyId: 'company-shan', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-punjab', companyId: 'company-cadbury', orderBookerId: 'ob-murtaza' },
    { shopId: 'shop-alian', companyId: 'company-cbl', orderBookerId: 'ob-kashif' },
    { shopId: 'shop-alian', companyId: 'company-shan', orderBookerId: 'ob-kashif' },
    { shopId: 'shop-alian', companyId: 'company-cadbury', orderBookerId: 'ob-kashif' },
  ]
  for (const m of mappings) {
    try {
      await prisma.shopCompanyOrderBooker.create({ data: m })
    } catch { /* skip duplicates */ }
  }
  console.log('Created shop-company-orderbooker mappings')

  // Create order booker users
  const obUsers = [
    { name: 'Anas', email: 'anas@alfalah.com', obId: 'ob-anas' },
    { name: 'Murtaza', email: 'murtaza@alfalah.com', obId: 'ob-murtaza' },
    { name: 'Kashif Khan', email: 'kashifkhan@alfalah.com', obId: 'ob-kashif' },
    { name: 'Ali', email: 'ali@alfalah.com', obId: 'ob-ali' },
    { name: 'Danish Ramzan', email: 'danishramzan@alfalah.com', obId: 'ob-danish' },
  ]
  for (const ob of obUsers) {
    try {
      await prisma.user.create({
        data: {
          name: ob.name,
          email: ob.email,
          password: hashSync('password123', 10),
          role: 'orderbooker',
          orderBookerId: ob.obId,
        },
      })
    } catch { /* skip duplicates */ }
  }
  console.log('Created order booker users')

  console.log('Seeding complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
