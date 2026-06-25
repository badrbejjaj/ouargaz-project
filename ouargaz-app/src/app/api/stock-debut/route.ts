import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canEdit } from '@/lib/auth'
import { getStockDebut } from '@/lib/business'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  const debut = await getStockDebut(date)
  const condParMarque = debut.condRows.map(st => ({
    marque: st.marque,
    pleines_12kg: st.pleines_12kg,
    pleines_6kg: st.pleines_6kg,
    pleines_3kg: st.pleines_3kg,
    defectueuses_12kg: st.defectueuses_12kg,
    defectueuses_6kg: st.defectueuses_6kg,
    defectueuses_3kg: st.defectueuses_3kg,
    stock_cond_t: st.stock_cond_t,
  }))

  return NextResponse.json({
    prevDate: debut.vracDate || debut.conditionneDate,
    vracDate: debut.vracDate,
    conditionneDate: debut.conditionneDate,
    disponible: !!(debut.vracDate || debut.conditionneDate),
    vracDebutT: Math.round(debut.vracDebutT * 1000) / 1000,
    condDebutT: Math.round(debut.condDebutT * 1000) / 1000,
    stockDebutTotalT: Math.round(debut.stockDebutTotalT * 1000) / 1000,
    condParMarque,
  })
}


export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canEdit(session.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const date = String(body.date || '')
  if (!date) return NextResponse.json({ error: 'Date de stock initial requise' }, { status: 400 })

  const n12 = Number(body.n12 || 0)
  const n3 = Number(body.n3 || 0)
  const n6 = Number(body.n6 || 0)
  const d12 = Number(body.defectueuses_12kg || body.d12 || 0)
  const d3 = Number(body.defectueuses_3kg || body.d3 || 0)
  const d6 = Number(body.defectueuses_6kg || body.d6 || 0)
  const vracKg = Number(body.vracKg || 0)
  if ([n12, n3, n6, d12, d3, d6, vracKg].some(v => v < 0 || Number.isNaN(v))) {
    return NextResponse.json({ error: 'Valeurs invalides' }, { status: 400 })
  }

  const stockPleinesKg = n12 * 12 + n3 * 3 + n6 * 6
  const stockDefKg = d12 * 10 + d3 * 2 + d6 * 5
  const stockCondKg = stockPleinesKg + stockDefKg
  await prisma.stockBouteilles.upsert({
    where: { date_marque: { date, marque: 'INITIAL_STOCK' } },
    update: {
      pleines_12kg: n12,
      pleines_3kg: n3,
      pleines_6kg: n6,
      defectueuses_12kg: d12,
      defectueuses_3kg: d3,
      defectueuses_6kg: d6,
      stock_pleines_kg: stockPleinesKg,
      stock_def_kg: stockDefKg,
      stock_cond_kg: stockCondKg,
      stock_cond_t: stockCondKg / 1000,
      updatedAt: new Date(),
    },
    create: {
      date,
      marque: 'INITIAL_STOCK',
      pleines_12kg: n12,
      pleines_3kg: n3,
      pleines_6kg: n6,
      defectueuses_12kg: d12,
      defectueuses_3kg: d3,
      defectueuses_6kg: d6,
      stock_pleines_kg: stockPleinesKg,
      stock_def_kg: stockDefKg,
      stock_cond_kg: stockCondKg,
      stock_cond_t: stockCondKg / 1000,
    },
  })

  await prisma.jaugeage.upsert({
    where: { date_reservoir: { date, reservoir: 'INITIAL_VRAC' } },
    update: { tonnage_total: vracKg / 1000, updatedAt: new Date() },
    create: {
      date,
      reservoir: 'INITIAL_VRAC',
      niveau_mm: 0,
      temperature: 0,
      pression: 0,
      volume_obs: 0,
      vcf: 1,
      gsv: 0,
      masse_liquide_t: vracKg / 1000,
      volume_vapeur: 0,
      pression_abs: 0,
      densite_vapeur: 0,
      masse_vapeur_t: 0,
      tonnage_total: vracKg / 1000,
      remplissage_pct: 0,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      username: session.username,
      role: session.role,
      action: 'INITIALISATION',
      module: 'STOCK_DEBUT',
      details: `Stock initial saisi pour ${date} — Cond: ${stockCondKg} kg, VRAC: ${vracKg} kg`,
    },
  })

  return NextResponse.json({ ok: true, date, stockCondKg, vracKg })
}
