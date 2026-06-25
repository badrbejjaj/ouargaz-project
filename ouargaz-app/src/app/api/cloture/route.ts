import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ cloturee: false })

  const status = await prisma.journeeStatus.findUnique({ where: { date } })
  return NextResponse.json({ cloturee: status?.cloturee || false, closedBy: status?.closedBy, closedAt: status?.closedAt })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { date, action, motif } = await req.json()
  if (!date) return NextResponse.json({ error: 'Date requise' }, { status: 400 })

  if (action === 'reopen') {
    if (!canAdmin(session.role)) return NextResponse.json({ error: 'Seul le Chef de Centre peut rouvrir une journée' }, { status: 403 })
    await prisma.journeeStatus.update({
      where: { date },
      data: { cloturee: false, reopenedBy: session.username, reopenedAt: new Date(), updatedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: { userId: session.id, username: session.username, role: session.role, action: 'RÉOUVERTURE', module: 'CLÔTURE', details: `Journée ${date} réouverte`, motif },
    })
    return NextResponse.json({ ok: true, message: `Journée ${date} réouverte` })
  }

  // Close the day — check all 4 modules have data
  const checks = await Promise.all([
    prisma.jaugeage.count({ where: { date } }),
    prisma.venteClient.count({ where: { date } }),
    prisma.stockBouteilles.count({ where: { date } }),
  ])

  const [jaugeageCount, ventesCount, stockCount] = checks
  const warnings: string[] = []
  if (jaugeageCount === 0) warnings.push('Jaugeage réservoirs manquant')
  if (ventesCount === 0) warnings.push('Ventes clients manquantes')
  if (stockCount === 0) warnings.push('Stock bouteilles manquant')

  await prisma.journeeStatus.upsert({
    where: { date },
    update: { cloturee: true, closedBy: session.username, closedAt: new Date(), updatedAt: new Date() },
    create: { date, cloturee: true, closedBy: session.username, closedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.id, username: session.username, role: session.role,
      action: 'CLÔTURE', module: 'CLÔTURE',
      details: `Journée ${date} clôturée${warnings.length ? ` (AVERTISSEMENTS: ${warnings.join(', ')})` : ''}`,
    },
  })

  return NextResponse.json({ ok: true, warnings, message: `Journée ${date} clôturée avec succès` })
}
