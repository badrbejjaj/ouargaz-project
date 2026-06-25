import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canEdit } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateReservoir } from '@/lib/calculations'

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
  else return NextResponse.json({ error: 'Date ou période requise' }, { status: 400 })

  const items = await prisma.jaugeage.findMany({
    where,
    orderBy: [{ date: 'asc' }, { reservoir: 'asc' }],
  })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canEdit(session.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { date, rows } = await req.json()
  if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  // Check if day is closed
  const dayStatus = await prisma.journeeStatus.findUnique({ where: { date } })
  if (dayStatus?.cloturee) return NextResponse.json({ error: 'Journée clôturée' }, { status: 403 })

  const results: Record<string, Record<string, number>> = {}

  // Sauvegarde fiable : on remplace la journée complète pour éviter les anciennes valeurs fantômes.
  const validRows = (rows || []).filter((row: Record<string, unknown>) => {
    return row.reservoir && row.niveau_mm !== '' && row.temperature !== '' && row.pression !== ''
  })

  await prisma.jaugeage.deleteMany({ where: { date } })

  for (const row of validRows) {
    const { reservoir, niveau_mm, temperature, pression } = row
    if (!reservoir) continue

    const n = parseFloat(String(niveau_mm))
    const t = parseFloat(String(temperature))
    const p = parseFloat(String(pression))

    if (isNaN(n) || isNaN(t) || isNaN(p)) {
      // Skip incomplete rows
      continue
    }

    if (n < 0 || n > 2974) return NextResponse.json({ error: `Niveau invalide pour ${reservoir}: doit être entre 0 et 2974 mm` }, { status: 400 })
    if (t < -20 || t > 80) return NextResponse.json({ error: `Température invalide pour ${reservoir}` }, { status: 400 })
    if (p < 0 || p > 30) return NextResponse.json({ error: `Pression invalide pour ${reservoir}` }, { status: 400 })

    const calc = calculateReservoir(n, t, p)

    await prisma.jaugeage.create({
      data: { date, reservoir, niveau_mm: n, temperature: t, pression: p, ...calc },
    })

    results[reservoir] = { niveau_mm: n, temperature: t, pression: p, ...calc }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.id,
      username: session.username,
      role: session.role,
      action: 'SAUVEGARDE',
      module: 'JAUGEAGE',
      details: `Jaugeage sauvegardé pour le ${date}`,
    },
  })

  return NextResponse.json({ ok: true, results })
}
