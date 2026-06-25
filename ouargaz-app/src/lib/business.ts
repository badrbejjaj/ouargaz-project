import { prisma } from './prisma'

export async function getLastVracBefore(date: string) {
  const last = await prisma.jaugeage.findFirst({
    where: { date: { lt: date } },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  if (!last) return { date: null as string | null, tonnageT: 0, kg: 0 }
  const rows = await prisma.jaugeage.findMany({ where: { date: last.date } })
  const tonnageT = rows.reduce((s, r) => s + (r.tonnage_total || 0), 0)
  return { date: last.date, tonnageT, kg: tonnageT * 1000 }
}

export async function getLastConditionneBefore(date: string) {
  const last = await prisma.stockBouteilles.findFirst({
    where: { date: { lt: date } },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  if (!last) return { date: null as string | null, tonnageT: 0, kg: 0, rows: [] as any[] }
  const rows = await prisma.stockBouteilles.findMany({ where: { date: last.date } })
  const tonnageT = rows.reduce((s, r) => s + (r.stock_cond_t || 0), 0)
  const kg = rows.reduce((s, r) => s + (r.stock_cond_kg || 0), 0)
  return { date: last.date, tonnageT, kg, rows }
}

export async function getStockDebut(date: string) {
  const [vrac, conditionne] = await Promise.all([
    getLastVracBefore(date),
    getLastConditionneBefore(date),
  ])
  return {
    vracDate: vrac.date,
    conditionneDate: conditionne.date,
    vracDebutT: vrac.tonnageT,
    vracDebutKg: vrac.kg,
    condDebutT: conditionne.tonnageT,
    condDebutKg: conditionne.kg,
    condRows: conditionne.rows,
    stockDebutTotalT: vrac.tonnageT + conditionne.tonnageT,
    stockDebutTotalKg: vrac.kg + conditionne.kg,
  }
}

export async function getDailyMatterBalance(date: string) {
  const [debut, jaugeages, stocks, ventes, appros] = await Promise.all([
    getStockDebut(date),
    prisma.jaugeage.findMany({ where: { date } }),
    prisma.stockBouteilles.findMany({ where: { date } }),
    prisma.venteClient.findMany({ where: { date } }),
    prisma.approvisionnement.findMany({ where: { date_br: date } }),
  ])
  const stockVracT = jaugeages.reduce((s, r) => s + (r.tonnage_total || 0), 0)
  const stockCondT = stocks.reduce((s, r) => s + (r.stock_cond_t || 0), 0)
  const stockPhysiqueT = stockVracT + stockCondT
  const ventesT = ventes.reduce((s, r) => s + (r.poids_t || 0), 0)
  const ventesKg = ventes.reduce((s, r) => s + (r.poids_kg || 0), 0)
  const approKg = appros.reduce((s, r) => s + (r.q_bl || 0), 0)
  const approT = approKg / 1000
  const ecartApproKg = appros.reduce((s, r) => s + (r.ecart || 0), 0)
  const stockComptableT = debut.stockDebutTotalT + approT - ventesT
  const boniMaliT = stockPhysiqueT - stockComptableT
  const boniMaliKg = boniMaliT * 1000
  const debutNbre12 = debut.condRows.reduce((s, r) => s + (r.pleines_12kg || 0), 0)
  const debutNbre3 = debut.condRows.reduce((s, r) => s + (r.pleines_3kg || 0), 0)
  const debutNbre6 = debut.condRows.reduce((s, r) => s + (r.pleines_6kg || 0), 0)
  const finNbre12 = stocks.reduce((s, r) => s + (r.pleines_12kg || 0), 0)
  const finNbre3 = stocks.reduce((s, r) => s + (r.pleines_3kg || 0), 0)
  const finNbre6 = stocks.reduce((s, r) => s + (r.pleines_6kg || 0), 0)
  const ventesNbre12 = ventes.reduce((s, r) => s + (r.qte_12kg || 0), 0)
  const ventesNbre3 = ventes.reduce((s, r) => s + (r.qte_3kg || 0), 0)
  const ventesNbre6 = ventes.reduce((s, r) => s + (r.qte_6kg || 0), 0)
  const emplissageKg = (finNbre12 + ventesNbre12 - debutNbre12) * 12 + (finNbre3 + ventesNbre3 - debutNbre3) * 3 + (finNbre6 + ventesNbre6 - debutNbre6) * 6
  const emplissageT = emplissageKg / 1000
  // Règle OUARGAZ validée : Boni/Mali % = Emplissage conditionné / Boni-Mali × 100.
  const boniMaliPct = emplissageT !== 0 ? (boniMaliT / emplissageT) * 100 : 0
  return {
    ...debut,
    jaugeages,
    stocks,
    ventes,
    appros,
    stockVracT,
    stockCondT,
    stockTotalT: stockPhysiqueT,
    ventesT,
    ventesKg,
    approKg,
    approT,
    ecartApproKg,
    ecartApproT: ecartApproKg / 1000,
    nbreCiternes: appros.length,
    stockComptableT,
    boniMaliT,
    boniMaliKg,
    boniMaliPct,
    emplissageKg,
    emplissageT,
  }
}
