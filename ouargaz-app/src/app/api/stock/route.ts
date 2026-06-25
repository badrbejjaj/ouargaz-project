import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canEdit } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateStockCond } from '@/lib/calculations'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let where: Record<string, unknown> = {}
  if (date) where = { date }
  else if (from && to) where = { date: { gte: from, lte: to } }

  const items = await prisma.stockBouteilles.findMany({ where, orderBy: [{ date: 'asc' }, { marque: 'asc' }] })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canEdit(session.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { date, rows } = await req.json()
  if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  const dayStatus = await prisma.journeeStatus.findUnique({ where: { date } })
  if (dayStatus?.cloturee) return NextResponse.json({ error: 'Journée clôturée' }, { status: 403 })

  for (const row of rows) {
    const data = {
      pleines_12kg: parseFloat(row.pleines_12kg) || 0,
      pleines_6kg: parseFloat(row.pleines_6kg) || 0,
      pleines_3kg: parseFloat(row.pleines_3kg) || 0,
      defectueuses_12kg: parseFloat(row.defectueuses_12kg) || 0,
      defectueuses_6kg: parseFloat(row.defectueuses_6kg) || 0,
      defectueuses_3kg: parseFloat(row.defectueuses_3kg) || 0,
    }
    const { stock_pleines_kg, stock_def_kg, stock_cond_kg, stock_cond_t } = calculateStockCond(data)

    await prisma.stockBouteilles.upsert({
      where: { date_marque: { date, marque: row.marque } },
      update: { ...data, stock_pleines_kg, stock_def_kg, stock_cond_kg, stock_cond_t, updatedAt: new Date() },
      create: { date, marque: row.marque, ...data, stock_pleines_kg, stock_def_kg, stock_cond_kg, stock_cond_t },
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id, username: session.username, role: session.role,
      action: 'SAUVEGARDE', module: 'STOCK_BOUTEILLES',
      details: `Stock bouteilles sauvegardé pour ${date}`,
    },
  })

  return NextResponse.json({ ok: true })
}
