import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { BAREME_DATA } from '../src/lib/bareme-data'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create users
  const users = [
    {
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      role: 'CHEF_CENTRE',
      name: 'Chef de Centre OUARGAZ',
      email: 'admin@ouargaz.ma',
    },

    {
      username: 'adjoint',
      password: await bcrypt.hash('adjoint123', 10),
      role: 'ADJOINT_CHEF_CENTRE',
      name: 'Adjoint Chef de Centre',
      email: 'adjoint@ouargaz.ma',
    },
    {
      username: 'administratif',
      password: await bcrypt.hash('admin456', 10),
      role: 'ADMINISTRATIF',
      name: 'Agent Administratif',
      email: 'administratif@ouargaz.ma',
    },
    {
      username: 'lecture',
      password: await bcrypt.hash('lecture123', 10),
      role: 'CONSULTATION',
      name: 'Utilisateur Consultation',
      email: 'lecture@ouargaz.ma',
    },
    {
      username: 'agent_saisie',
      password: await bcrypt.hash('saisie123', 10),
      role: 'AGENT_SAISIE',
      name: 'Agent de Saisie / Garde',
      email: 'agent.saisie@ouargaz.ma',
    },
    {
      username: 'chef_equipe',
      password: await bcrypt.hash('equipe123', 10),
      role: 'CHEF_EQUIPE',
      name: 'Chef d’Équipe',
      email: 'chef.equipe@ouargaz.ma',
    },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    })
  }
  console.log('✅ Users created')

  // Create clients with their marques
  const clients = [
    // TOTAL / TotalEnergies
    { name: 'WESALSAT', marque: 'TOTAL GAZ' },
    { name: 'EL MEZOUARI TTG', marque: 'TOTAL GAZ' },
    { name: 'SOBADEGAZ', marque: 'TOTAL GAZ' },
    { name: 'LWAZIZ', marque: 'TOTAL GAZ' },
    { name: 'BASSAINE', marque: 'TOTAL GAZ' },
    { name: 'AIT CHOUT', marque: 'TOTAL GAZ' },
    // SAADA
    { name: 'TAMONT', marque: 'SAADA' },
    // DIMAGAZ
    { name: 'FRIDI', marque: 'DIMAGAZ' },
    // AFRIQUIA
    { name: 'SUD DIR', marque: 'AFRIQUIA GAZ' },
    { name: 'ABOUDRAR', marque: 'AFRIQUIA GAZ' },
    { name: 'OUFRIGAZ', marque: 'AFRIQUIA GAZ' },
    { name: 'CHARAF GAZ', marque: 'AFRIQUIA GAZ' },
    { name: 'ZAMOU ABDELLAH', marque: 'AFRIQUIA GAZ' },
    // TISSIR
    { name: 'SDBG', marque: 'TISSIR' },
    { name: 'AIT ZAMOU', marque: 'TISSIR' },
    { name: 'ZAMZAMGAZ', marque: 'TISSIR' },
    { name: 'OUBELLA', marque: 'TISSIR' },
    // VIVO ENERGY
    { name: 'BOUHALBA', marque: 'VIVO ENERGY' },
  ]

  for (const client of clients) {
    await prisma.client.upsert({
      where: { name: client.name },
      update: {},
      create: client,
    })
  }
  console.log('✅ Clients created')

  // Create marques
  const marques = [
    'TOTAL GAZ',
    'AFRIQUIA GAZ',
    'VIVO ENERGY',
    'TISSIR',
    'SAADA',
    'DIMAGAZ',
  ]

  for (const name of marques) {
    await prisma.marque.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('✅ Marques created')

  // Create transporteurs
  const transporteurs = [
    'MEHARIS',
    'SOTRAGAZ',
    'STMF',
    'STG',
    'ELIJHADIA',
    'SAHARA',
  ]

  for (const name of transporteurs) {
    await prisma.transporteur.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('✅ Transporteurs created')

  // Create provenances
  const provenances = ['SOMAS', 'GAZBER', 'DEGAZA', 'SAMIR']

  for (const name of provenances) {
    await prisma.provenance.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('✅ Provenances created')

  // Seed barème reservoir data (batch insert for performance)
  const existing = await prisma.baremeReservoir.count()
  if (existing === 0) {
    console.log(`📊 Seeding ${BAREME_DATA.length} barème entries...`)
    // Insert in batches of 500
    const batchSize = 500
    for (let i = 0; i < BAREME_DATA.length; i += batchSize) {
      const batch = BAREME_DATA.slice(i, i + batchSize)
      await prisma.baremeReservoir.createMany({
        data: batch.map(([niveau_mm, volume_l]) => ({ niveau_mm, volume_l })),
      })
      process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, BAREME_DATA.length)}/${BAREME_DATA.length}`)
    }
    console.log('\n✅ Barème data seeded')
  } else {
    console.log(`⏭️  Barème already seeded (${existing} entries)`)
  }



  const profileConfigs = [
    { role: 'CHEF_CENTRE', kpis: ['camions_arrives','camions_entres','camions_internes','camions_prets_sortir','camions_sortis','tonnage_jour_total','def_rendues_total','def_remplacees_total','taux_remplacement_global','ecart_ventes'], menus: ['dashboard','saisie','rapports','exports','referentiels','mouvements_camions','administration'] },
    { role: 'ADMINISTRATIF', kpis: ['ventesJour','ventesMois','stockVrac','approJour'], menus: ['dashboard','saisie','historique','rapports','exports'] },
    { role: 'AGENT_SAISIE', kpis: ['camions_arrives','camions_entres','camions_prets_sortir','camions_sortis','tonnage_jour_total','ecart_ventes'], menus: ['dashboard','mouvements_camions','historique_camions'] },
    { role: 'CHEF_EQUIPE', kpis: ['camions_internes','camions_emplissage','def_rendues_total','def_remplacees_total','taux_remplacement_global'], menus: ['dashboard','mouvements_camions','historique_camions'] },
    { role: 'CONSULTATION', kpis: ['camions_sortis','tonnage_jour_total'], menus: ['dashboard','historique','mouvements_camions'] },
  ]
  for (const cfg of profileConfigs) {
    await prisma.profileDashboardConfig.upsert({
      where: { role: cfg.role },
      update: { kpis: JSON.stringify(cfg.kpis), menus: JSON.stringify(cfg.menus) },
      create: { role: cfg.role, kpis: JSON.stringify(cfg.kpis), menus: JSON.stringify(cfg.menus) },
    })
  }
  console.log('✅ Profile dashboard configs created')

  // Create initial audit log
  await prisma.auditLog.create({
    data: {
      username: 'system',
      role: 'SYSTEM',
      action: 'INITIALISATION',
      module: 'SYSTÈME',
      details: 'Base de données initialisée avec succès',
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log('')
  console.log('📋 Comptes de test:')
  console.log('   admin / admin123          → Chef de Centre')
  console.log('   administratif / admin456  → Agent Administratif')
  console.log('   lecture / lecture123       → Consultation')
  console.log('   agent_saisie / saisie123   → Agent de saisie')
  console.log("   chef_equipe / equipe123    → Chef d'équipe")
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
