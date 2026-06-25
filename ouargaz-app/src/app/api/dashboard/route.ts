import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, format, parseISO } from 'date-fns'
import { getDailyMatterBalance } from '@/lib/business'

function round(n: number, d = 3) {
  const p = Math.pow(10, d)
  return Math.round((n || 0) * p) / p
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const monthStart = format(startOfMonth(parseISO(date)), 'yyyy-MM-dd')

  try {
    const balance = await getDailyMatterBalance(date)

    const reservoirs = balance.jaugeages.map(j => ({
      name: j.reservoir,
      remplissage: j.remplissage_pct,
      tonnage: j.tonnage_total,
      niveau: j.niveau_mm,
      temperature: j.temperature,
      pression: j.pression,
    }))

    const ventesMoisData = await prisma.venteClient.findMany({
      where: { date: { gte: monthStart, lte: date } },
    })
    const ventesMois = ventesMoisData.reduce((s, v) => s + v.poids_t, 0)

    const approMoisData = await prisma.approvisionnement.findMany({
      where: { date_br: { gte: monthStart, lte: date } },
    })
    const approMois = approMoisData.reduce((s, a) => s + a.q_bl, 0) / 1000

    const thirtyDaysAgo = new Date(date)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const ventesChartRaw = await prisma.venteClient.groupBy({
      by: ['date'],
      _sum: { poids_t: true },
      where: { date: { gte: thirtyDaysAgo.toISOString().split('T')[0], lte: date } },
      orderBy: { date: 'asc' },
    })
    const ventesChart = ventesChartRaw.map(v => ({ date: v.date.slice(5), ventes: round(v._sum.poids_t || 0, 2) }))

    const stockSeriesDates = await prisma.jaugeage.groupBy({
      by: ['date'],
      _sum: { tonnage_total: true },
      where: { date: { gte: thirtyDaysAgo.toISOString().split('T')[0], lte: date } },
      orderBy: { date: 'asc' },
    })
    const stockVracChart = stockSeriesDates.map(r => ({ date: r.date.slice(5), stock: round(r._sum.tonnage_total || 0, 2) }))

    const topClientsRaw = await prisma.venteClient.groupBy({
      by: ['client', 'marque'],
      _sum: { poids_t: true },
      where: { date: { gte: monthStart, lte: date } },
      orderBy: { _sum: { poids_t: 'desc' } },
      take: 10,
    })
    const topClients = topClientsRaw.map(c => ({
      client: c.client,
      marque: c.marque,
      total: round(c._sum.poids_t || 0, 3),
    }))

    const ventesMarqueRaw = await prisma.venteClient.groupBy({
      by: ['marque'],
      _sum: { poids_t: true },
      where: { date: { gte: monthStart, lte: date } },
      orderBy: { _sum: { poids_t: 'desc' } },
    })
    const ventesParMarque = ventesMarqueRaw.map(v => ({ marque: v.marque, total: round(v._sum.poids_t || 0, 2) }))

    const meilleurClientJourRaw = await prisma.venteClient.groupBy({
      by: ['client', 'marque'],
      _sum: { poids_t: true },
      where: { date },
      orderBy: { _sum: { poids_t: 'desc' } },
      take: 1,
    })

    const tauxRemplissageMoyen = reservoirs.length ? reservoirs.reduce((s, r) => s + r.remplissage, 0) / reservoirs.length : 0
    const reservoirPlusPlein = reservoirs.length ? [...reservoirs].sort((a, b) => b.remplissage - a.remplissage)[0] : null
    const reservoirPlusBas = reservoirs.length ? [...reservoirs].sort((a, b) => a.remplissage - b.remplissage)[0] : null
    const autonomieJours = balance.ventesT > 0 ? balance.stockTotalT / balance.ventesT : 0

    return NextResponse.json({
      stockVrac: round(balance.stockVracT, 2),
      stockCond: round(balance.stockCondT, 2),
      stockTotal: round(balance.stockTotalT, 2),
      stockDebut: round(balance.stockDebutTotalT, 2),
      stockComptable: round(balance.stockComptableT, 2),
      ventesJour: round(balance.ventesT, 3),
      ventesMois: round(ventesMois, 2),
      approJour: round(balance.approT, 2),
      approMois: round(approMois, 2),
      nbreCiternes: balance.nbreCiternes,
      ecartAppro: round(balance.ecartApproT, 3),
      boniMaliKg: round(balance.boniMaliKg, 1),
      boniMaliT: round(balance.boniMaliT, 3),
      boniMaliPct: round(balance.boniMaliPct, 3),
      emplissageJour: round(balance.ventesT, 3),
      autonomieJours: round(autonomieJours, 1),
      tauxRemplissageMoyen: round(tauxRemplissageMoyen, 1),
      reservoirPlusPlein,
      reservoirPlusBas,
      meilleurClientJour: meilleurClientJourRaw[0] ? {
        client: meilleurClientJourRaw[0].client,
        marque: meilleurClientJourRaw[0].marque,
        total: round(meilleurClientJourRaw[0]._sum.poids_t || 0, 3),
      } : null,
      reservoirs,
      ventesChart,
      stockVracChart,
      topClients,
      ventesParMarque,
      lastUpdate: new Date().toLocaleString('fr-MA'),
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
