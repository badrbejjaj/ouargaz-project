import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const [clients, marques, transporteurs, provenances] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.marque.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.transporteur.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.provenance.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ clients, marques, transporteurs, provenances })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.role === 'CONSULTATION') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { type, name, marque } = await req.json()
  if (!type || !name) return NextResponse.json({ error: 'Type et nom requis' }, { status: 400 })

  let item
  try {
    if (type === 'client') {
      if (!marque) return NextResponse.json({ error: 'Marque requise pour un client' }, { status: 400 })
      item = await prisma.client.create({ data: { name: name.trim(), marque } })
    } else if (type === 'transporteur') {
      item = await prisma.transporteur.create({ data: { name: name.trim() } })
    } else if (type === 'provenance') {
      item = await prisma.provenance.create({ data: { name: name.trim() } })
    } else if (type === 'marque') {
      item = await prisma.marque.create({ data: { name: name.trim() } })
    } else {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Cet élément existe déjà' }, { status: 409 })
  }

  await prisma.auditLog.create({
    data: { userId: session.id, username: session.username, role: session.role, action: 'CRÉATION', module: 'RÉFÉRENTIELS', details: `${type}: ${name}` },
  })

  return NextResponse.json({ ok: true, item })
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(session.role)) return NextResponse.json({ error: 'Seul le Chef de Centre / Adjoint peut supprimer' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id = parseInt(searchParams.get('id') || '0')

  if (!type || !id) return NextResponse.json({ error: 'Type et ID requis' }, { status: 400 })

  if (type === 'client') await prisma.client.update({ where: { id }, data: { active: false } })
  else if (type === 'transporteur') await prisma.transporteur.update({ where: { id }, data: { active: false } })
  else if (type === 'provenance') await prisma.provenance.update({ where: { id }, data: { active: false } })
  else if (type === 'marque') await prisma.marque.update({ where: { id }, data: { active: false } })

  await prisma.auditLog.create({
    data: { userId: session.id, username: session.username, role: session.role, action: 'SUPPRESSION', module: 'RÉFÉRENTIELS', details: `${type} ID:${id} désactivé` },
  })

  return NextResponse.json({ ok: true })
}
