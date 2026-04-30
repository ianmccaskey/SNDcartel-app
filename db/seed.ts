import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, groupBuys, products, acceptedPayments } from './schema'

async function seedAdmin() {
  const adminEmail = 'admin@sndcartel.com'
  const adminPassword = 'admin123'

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1)

  if (existing) {
    console.log('Admin user already exists, skipping.')
    return existing.id
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10)

  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      passwordHash,
      fullName: 'Admin',
      role: 'admin',
    })
    .returning({ id: users.id, email: users.email })

  console.log(`Admin user created: ${admin.email} (id: ${admin.id})`)
  return admin.id
}

async function seedGroupBuys(adminId: string) {
  // Check if group buys already exist
  const existing = await db.select({ id: groupBuys.id }).from(groupBuys).limit(1)
  if (existing.length > 0) {
    console.log('Group buys already seeded, skipping.')
    return
  }

  console.log('Seeding group buys...')

  // ── Active Group Buy ──────────────────────────────────────────────────────────
  const [activeGB] = await db
    .insert(groupBuys)
    .values({
      name: 'SND NEVER DIE Inaugural Group Buy',
      description: 'Please read buy info in SND Discord #GB-General-Info. High quality peptides at group pricing.',
      vendor: 'SND Verified Vendor',
      status: 'active',
      endDate: new Date('2026-06-01T23:59:59Z'),
      startDate: new Date('2026-03-01T00:00:00Z'),
      totalMoqGoal: 985,
      totalKitsOrdered: 847,
      adminFeeUsd: '5.00',
      shippingFeeUsd: '12.00',
      paymentTolerancePct: '5.00',
      createdBy: adminId,
      creatorDisplayName: 'SND Admin',
    })
    .returning({ id: groupBuys.id })

  // Active GB products
  await db.insert(products).values([
    {
      groupBuyId: activeGB.id,
      name: 'Tirzepatide 30',
      peptideName: 'Tirzepatide',
      massDosage: '30mg',
      description: 'High-purity Tirzepatide 30mg vial. GLP-1/GIP dual agonist.',
      priceUsd: '85.00',
      regularPriceUsd: '120.00',
      moq: 100,
      kitsOrdered: 80,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: true,
      sortOrder: 1,
    },
    {
      groupBuyId: activeGB.id,
      name: 'SS-31 (Elamipretide) 50',
      peptideName: 'SS-31',
      massDosage: '50mg',
      description: 'Mitochondrial-targeting peptide 50mg. Cardioprotective properties.',
      priceUsd: '95.00',
      regularPriceUsd: '140.00',
      moq: 80,
      kitsOrdered: 50,
      manualAdjustment: 0,
      maxPerUser: 5,
      inStock: true,
      sortOrder: 2,
    },
    {
      groupBuyId: activeGB.id,
      name: 'Retatrutide 20',
      peptideName: 'Retatrutide',
      massDosage: '20mg',
      description: 'Triple agonist (GLP-1/GIP/Glucagon) peptide 20mg.',
      priceUsd: '75.00',
      regularPriceUsd: '110.00',
      moq: 80,
      kitsOrdered: 38,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: true,
      sortOrder: 3,
    },
    {
      groupBuyId: activeGB.id,
      name: 'Retatrutide 30',
      peptideName: 'Retatrutide',
      massDosage: '30mg',
      description: 'Triple agonist (GLP-1/GIP/Glucagon) peptide 30mg.',
      priceUsd: '95.00',
      regularPriceUsd: '135.00',
      moq: 150,
      kitsOrdered: 339,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: true,
      sortOrder: 4,
    },
    {
      groupBuyId: activeGB.id,
      name: 'Retatrutide 60',
      peptideName: 'Retatrutide',
      massDosage: '60mg',
      description: 'Triple agonist (GLP-1/GIP/Glucagon) peptide 60mg.',
      priceUsd: '165.00',
      regularPriceUsd: '220.00',
      moq: 50,
      kitsOrdered: 13,
      manualAdjustment: 0,
      maxPerUser: 5,
      inStock: true,
      sortOrder: 5,
    },
    {
      groupBuyId: activeGB.id,
      name: 'BPC-157 (5mg)',
      peptideName: 'BPC-157',
      massDosage: '5mg',
      description: 'Body protective compound. Tissue repair and gut healing peptide.',
      priceUsd: '32.00',
      regularPriceUsd: '45.00',
      moq: 200,
      kitsOrdered: 120,
      manualAdjustment: 0,
      maxPerUser: 20,
      inStock: true,
      sortOrder: 6,
    },
  ])

  // Active GB accepted payments
  await db.insert(acceptedPayments).values([
    {
      groupBuyId: activeGB.id,
      token: 'USDC (Ethereum)',
      network: 'Ethereum',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
    },
    {
      groupBuyId: activeGB.id,
      token: 'USDC (Polygon)',
      network: 'Polygon',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
    },
  ])

  console.log(`Active group buy created: ${activeGB.id}`)

  // ── Draft Group Buy ───────────────────────────────────────────────────────────
  const [draftGB] = await db
    .insert(groupBuys)
    .values({
      name: 'SND GB2 — Metabolic & Recovery Stack',
      description: 'Coming soon. Upcoming group buy focused on metabolic health and recovery peptides.',
      vendor: 'SND Verified Vendor',
      status: 'draft',
      startDate: new Date('2026-07-01T00:00:00Z'),
      endDate: new Date('2026-09-01T23:59:59Z'),
      totalMoqGoal: 500,
      totalKitsOrdered: 0,
      adminFeeUsd: '5.00',
      shippingFeeUsd: '12.00',
      paymentTolerancePct: '5.00',
      createdBy: adminId,
      creatorDisplayName: 'SND Admin',
    })
    .returning({ id: groupBuys.id })

  await db.insert(products).values([
    {
      groupBuyId: draftGB.id,
      name: 'Semaglutide 5mg',
      peptideName: 'Semaglutide',
      massDosage: '5mg',
      description: 'GLP-1 receptor agonist. Blood sugar control and weight management.',
      priceUsd: '55.00',
      regularPriceUsd: '85.00',
      moq: 150,
      kitsOrdered: 0,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: true,
      sortOrder: 1,
    },
    {
      groupBuyId: draftGB.id,
      name: 'TB-500 (10mg)',
      peptideName: 'TB-500',
      massDosage: '10mg',
      description: 'Thymosin Beta-4. Tissue repair, recovery, and anti-inflammatory.',
      priceUsd: '65.00',
      regularPriceUsd: '95.00',
      moq: 100,
      kitsOrdered: 0,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: true,
      sortOrder: 2,
    },
    {
      groupBuyId: draftGB.id,
      name: 'Epitalon 10mg',
      peptideName: 'Epitalon',
      massDosage: '10mg',
      description: 'Telomere-extending tetrapeptide. Anti-aging and longevity research.',
      priceUsd: '70.00',
      regularPriceUsd: '100.00',
      moq: 80,
      kitsOrdered: 0,
      manualAdjustment: 0,
      maxPerUser: 5,
      inStock: true,
      sortOrder: 3,
    },
  ])

  console.log(`Draft group buy created: ${draftGB.id}`)

  // ── Closed Group Buy ──────────────────────────────────────────────────────────
  const [closedGB] = await db
    .insert(groupBuys)
    .values({
      name: 'SND Founding Member GB — Closed',
      description: 'The inaugural founding member group buy. Closed and fulfilled.',
      vendor: 'SND Verified Vendor',
      status: 'fulfilled',
      startDate: new Date('2025-09-01T00:00:00Z'),
      endDate: new Date('2025-11-01T23:59:59Z'),
      totalMoqGoal: 300,
      totalKitsOrdered: 312,
      adminFeeUsd: '5.00',
      shippingFeeUsd: '12.00',
      paymentTolerancePct: '5.00',
      createdBy: adminId,
      creatorDisplayName: 'SND Admin',
    })
    .returning({ id: groupBuys.id })

  await db.insert(products).values([
    {
      groupBuyId: closedGB.id,
      name: 'BPC-157 (5mg) — Founding',
      peptideName: 'BPC-157',
      massDosage: '5mg',
      description: 'Founding member pricing on BPC-157.',
      priceUsd: '28.00',
      regularPriceUsd: '45.00',
      moq: 150,
      kitsOrdered: 162,
      manualAdjustment: 0,
      maxPerUser: 20,
      inStock: false,
      sortOrder: 1,
    },
    {
      groupBuyId: closedGB.id,
      name: 'GHK-Cu 50mg — Founding',
      peptideName: 'GHK-Cu',
      massDosage: '50mg',
      description: 'Copper peptide for skin and wound healing.',
      priceUsd: '42.00',
      regularPriceUsd: '65.00',
      moq: 100,
      kitsOrdered: 95,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: false,
      sortOrder: 2,
    },
    {
      groupBuyId: closedGB.id,
      name: 'Selank 5mg — Founding',
      peptideName: 'Selank',
      massDosage: '5mg',
      description: 'Anxiolytic heptapeptide. Cognitive enhancement and stress reduction.',
      priceUsd: '38.00',
      regularPriceUsd: '58.00',
      moq: 80,
      kitsOrdered: 55,
      manualAdjustment: 0,
      maxPerUser: 10,
      inStock: false,
      sortOrder: 3,
    },
  ])

  console.log(`Closed group buy created: ${closedGB.id}`)
  console.log('Group buy seeding complete.')
}

async function seed() {
  try {
    const adminId = await seedAdmin()
    await seedGroupBuys(adminId)
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  }
}

seed()
