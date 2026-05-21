import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import { hashSync } from 'bcryptjs'

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db'
  const libsql = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_DB_TOKEN || undefined,
  })
  const adapter = new PrismaLibSql(libsql)
  return new PrismaClient({ adapter })
}

const prisma = createPrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = hashSync('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@alfalah.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@alfalah.com',
      password: adminPassword,
      role: 'admin',
    },
  })
  console.log('Created admin user:', admin.email)

  // Create companies
  const cbl = await prisma.company.upsert({
    where: { id: 'company-cbl' },
    update: {},
    create: { id: 'company-cbl', name: 'CBL' },
  })

  const cadbury = await prisma.company.upsert({
    where: { id: 'company-cadbury' },
    update: {},
    create: { id: 'company-cadbury', name: 'Cadbury' },
  })

  const shan = await prisma.company.upsert({
    where: { id: 'company-shan' },
    update: {},
    create: { id: 'company-shan', name: 'Shan Foods' },
  })
  console.log('Created companies:', cbl.name, cadbury.name, shan.name)

  // Create order bookers
  const orderBookerData = [
    { id: 'ob-anas', name: 'Anas' },
    { id: 'ob-murtaza', name: 'Murtaza' },
    { id: 'ob-kashif', name: 'Kashif Khan' },
    { id: 'ob-ali', name: 'Ali' },
    { id: 'ob-danish', name: 'Danish Ramzan' },
  ]

  const orderBookers: Record<string, typeof orderBookerData[0]> = {}
  for (const ob of orderBookerData) {
    orderBookers[ob.name] = await prisma.orderBooker.upsert({
      where: { id: ob.id },
      update: {},
      create: ob,
    })
  }
  console.log('Created order bookers')

  // Create suppliers
  const supplierData = [
    { id: 'sup-ayub', name: 'Ayub' },
    { id: 'sup-aqib', name: 'Aqib' },
    { id: 'sup-awais', name: 'Awais' },
    { id: 'sup-saad', name: 'Saad' },
    { id: 'sup-sami', name: 'Sami' },
    { id: 'sup-ikram', name: 'Ikram' },
  ]

  const suppliers: Record<string, typeof supplierData[0]> = {}
  for (const s of supplierData) {
    suppliers[s.name] = await prisma.supplier.upsert({
      where: { id: s.id },
      update: {},
      create: s,
    })
  }
  console.log('Created suppliers')

  // Create products for CBL
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
    { name: 'Choco Jammies', price: 30, unit: 'pcs' },
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
    { name: 'SP S.F', price: 50, unit: 'pcs' },
    { name: 'TP S.F', price: 20, unit: 'pcs' },
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
    { name: 'FP Butter', price: 90, unit: 'pcs' },
    { name: 'FP TUC', price: 90, unit: 'pcs' },
    { name: 'FP SF', price: 100, unit: 'pcs' },
    { name: 'MilcoLu', price: 10, unit: 'pcs' },
    { name: 'MilcoLu', price: 15, unit: 'pcs' },
    { name: 'MilcoLu', price: 20, unit: 'pcs' },
    { name: 'MilcoLu', price: 40, unit: 'pcs' },
    { name: 'Cardemom', price: 20, unit: 'pcs' },
    { name: 'Coconut', price: 15, unit: 'pcs' },
    { name: 'Coconut', price: 50, unit: 'pcs' },
    { name: 'SP Butter', price: 50, unit: 'pcs' },
    { name: 'Butter', price: 50, unit: 'pcs' },
    { name: 'Oreo Crispy', price: 300, unit: 'Box' },
    { name: 'Mini Fingure', price: 10, unit: 'pcs' },
    { name: 'Mini Fingure', price: 20, unit: 'pcs' },
    { name: 'Coco Choc', price: 30, unit: 'pcs' },
    { name: 'Prince Junior', price: 10, unit: 'pcs' },
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
    { name: 'Cripsy Oreo', price: 10, unit: 'pcs' },
    { name: 'Wheatable', price: 20, unit: 'pcs' },
    { name: 'SP Candi', price: 40, unit: 'pcs' },
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
    { name: 'BP Gala 1x73', price: 10, unit: 'pcs' },
    { name: 'TP Zeera', price: 10, unit: 'pcs' },
    { name: 'BP Oero', price: 15, unit: 'pcs' },
    { name: 'SP Butter/Coconut', price: 50, unit: 'pcs' },
    { name: 'Belvita Kleja', price: 50, unit: 'pcs' },
  ]

  for (const p of cblProducts) {
    await prisma.product.upsert({
      where: {
        name_price_companyId: {
          name: p.name,
          price: p.price,
          companyId: cbl.id,
        },
      },
      update: {},
      create: {
        name: p.name,
        price: p.price,
        unit: p.unit,
        companyId: cbl.id,
      },
    })
  }
  console.log(`Created ${cblProducts.length} CBL products`)

  // Create sample shops
  const shopData = [
    { id: 'shop-chks', name: 'CH Ks', address: 'Pakistan Chowk' },
    { id: 'shop-apna', name: 'Apna Easy Load', address: 'Pakistan Chowk' },
    { id: 'shop-usama', name: 'Usama SS', address: 'Feroza' },
    { id: 'shop-kanwal', name: 'Kanwal Pan Shop', address: 'Din Pur Chowk' },
    { id: 'shop-punjab', name: 'Punjab Gs', address: 'Trunk Bazar' },
    { id: 'shop-alian', name: 'Alian Sweets', address: 'Kotla Pathan' },
  ]

  for (const s of shopData) {
    await prisma.shop.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, name: s.name, address: s.address },
    })
  }
  console.log('Created shops')

  // Create Shop-Company-OrderBooker mappings
  const shopCompanyOBData = [
    { shopId: 'shop-chks', companyId: cbl.id, orderBookerId: orderBookers['Anas'].id },
    { shopId: 'shop-chks', companyId: shan.id, orderBookerId: orderBookers['Anas'].id },
    { shopId: 'shop-chks', companyId: cadbury.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-apna', companyId: cbl.id, orderBookerId: orderBookers['Anas'].id },
    { shopId: 'shop-apna', companyId: shan.id, orderBookerId: orderBookers['Anas'].id },
    { shopId: 'shop-apna', companyId: cadbury.id, orderBookerId: orderBookers['Anas'].id },
    { shopId: 'shop-usama', companyId: cbl.id, orderBookerId: orderBookers['Danish Ramzan'].id },
    { shopId: 'shop-usama', companyId: shan.id, orderBookerId: orderBookers['Ali'].id },
    { shopId: 'shop-usama', companyId: cadbury.id, orderBookerId: orderBookers['Ali'].id },
    { shopId: 'shop-kanwal', companyId: cbl.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-kanwal', companyId: shan.id, orderBookerId: orderBookers['Kashif Khan'].id },
    { shopId: 'shop-kanwal', companyId: cadbury.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-punjab', companyId: cbl.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-punjab', companyId: shan.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-punjab', companyId: cadbury.id, orderBookerId: orderBookers['Murtaza'].id },
    { shopId: 'shop-alian', companyId: cbl.id, orderBookerId: orderBookers['Kashif Khan'].id },
    { shopId: 'shop-alian', companyId: shan.id, orderBookerId: orderBookers['Kashif Khan'].id },
    { shopId: 'shop-alian', companyId: cadbury.id, orderBookerId: orderBookers['Kashif Khan'].id },
  ]

  for (const mapping of shopCompanyOBData) {
    await prisma.shopCompanyOrderBooker.upsert({
      where: {
        shopId_companyId: {
          shopId: mapping.shopId,
          companyId: mapping.companyId,
        },
      },
      update: { orderBookerId: mapping.orderBookerId },
      create: mapping,
    })
  }
  console.log('Created shop-company-orderbooker mappings')

  // Create order booker users
  for (const ob of orderBookerData) {
    const obPassword = hashSync('password123', 10)
    await prisma.user.upsert({
      where: { email: `${ob.name.toLowerCase().replace(/\s+/g, '')}@alfalah.com` },
      update: {},
      create: {
        name: ob.name,
        email: `${ob.name.toLowerCase().replace(/\s+/g, '')}@alfalah.com`,
        password: obPassword,
        role: 'orderbooker',
        orderBookerId: ob.id,
      },
    })
  }
  console.log('Created order booker users')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
