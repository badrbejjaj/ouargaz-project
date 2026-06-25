import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, canEdit } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateVentePoids } from '@/lib/calculations'

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

  const items = await prisma.venteClient.findMany({
    where,
    orderBy: [{ date: 'asc' }, { client: 'asc' }],
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

  // Delete existing entries for this date
  await prisma.venteClient.deleteMany({ where: { date } })

  const validRows = rows.filter((r: Record<string, string>) => r.client && r.client.trim())
  let count = 0

  for (const row of validRows) {
    const q12 = parseFloat(row.qte_12kg) || 0
    const q3 = parseFloat(row.qte_3kg) || 0
    const q6 = parseFloat(row.qte_6kg) || 0
    const q34 = parseFloat(row.qte_34kg) || 0

    if (q12 < 0 || q3 < 0 || q6 < 0 || q34 < 0) {
      return NextResponse.json({ error: 'Les quantités ne peuvent pas être négatives' }, { status: 400 })
    }

    const { poids_kg, poids_t } = calculateVentePoids(q12, q3, q6, q34)

    // Find marque from client
    const client = await prisma.client.findUnique({ where: { name: row.client } })

    await prisma.venteClient.create({
      data: {
        date,
        client: row.client,
        marque: row.marque || client?.marque || '',
        numero_bc: row.numero_bc || null,
        numero_bl: row.numero_bl || null,
        qte_12kg: q12,
        qte_3kg: q3,
        qte_6kg: q6,
        qte_34kg: q34,
        poids_kg,
        poids_t,
      },
    })
    count++
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id,
      username: session.username,
      role: session.role,
      action: 'SAUVEGARDE',
      module: 'VENTES',
      details: `${count} ligne(s) de vente sauvegardées pour ${date}`,
    },
  })

  return NextResponse.json({ ok: true, count })
}
