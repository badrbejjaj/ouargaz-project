import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canEdit } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const mois = searchParams.get('mois')

  let where: Record<string, unknown> = {}
  if (date) where = { date_br: date }
  else if (from && to) where = { date_br: { gte: from, lte: to } }
  else if (mois) {
    const start = `${mois}-01`
    const endDate = new Date(mois + '-01')
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)
    const end = endDate.toISOString().split('T')[0]
    where = { date_br: { gte: start, lte: end } }
  }

  const items = await prisma.approvisionnement.findMany({
    where,
    orderBy: [{ date_br: 'asc' }, { createdAt: 'asc' }],
  })
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

  // Delete existing entries for this date_br
  await prisma.approvisionnement.deleteMany({ where: { date_br: date } })

  const validRows = rows.filter((r: Record<string, string>) => r.q_net && parseFloat(r.q_net) > 0)
  let count = 0

  for (const row of validRows) {
    const q_net = parseFloat(row.q_net) || 0
    const q_bl = parseFloat(row.q_bl) || 0
    if (q_net < 0 || q_bl < 0) return NextResponse.json({ error: 'Quantités négatives interdites' }, { status: 400 })
    const ecart = q_net - q_bl

    await prisma.approvisionnement.create({
      data: {
        mois: row.mois || date.slice(0, 7),
        quinzaine: row.quinzaine || '1',
        camion: row.camion || null,
        transporteur: row.transporteur || null,
        numero_bc: row.numero_bc || null,
        date_bc: row.date_bc || null,
        produit: row.produit || 'Butane',
        provenance: row.provenance || null,
        numero_bl: row.numero_bl || null,
        date_bl: row.date_bl || null,
        numero_br: row.numero_br || null,
        date_br: row.date_br || date,
        q_net,
        q_bl,
        ecart,
      },
    })
    count++
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id, username: session.username, role: session.role,
      action: 'SAUVEGARDE', module: 'APPROVISIONNEMENTS',
      details: `${count} citerne(s) sauvegardée(s) pour ${date}`,
    },
  })

  return NextResponse.json({ ok: true, count })
}
