import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { triggerBroadcast } from '@/lib/broadcast'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ notifications: [], unread: 0 })
  // Supprimer les notifications de plus de 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
  await prisma.notification.deleteMany({ where: { role: session.role, createdAt: { lt: thirtyMinAgo } } }).catch(()=>{})
  const notifications = await prisma.notification.findMany({ where: { role: session.role }, orderBy: { createdAt: 'desc' }, take: 25 })
  return NextResponse.json({ notifications, unread: notifications.filter(n => !n.read).length })
}

// Marquer une notification spécifique comme lue
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  if (body.id) {
    await prisma.notification.updateMany({ where: { id: Number(body.id), role: session.role }, data: { read: true } })
  } else {
    await prisma.notification.updateMany({ where: { role: session.role, read: false }, data: { read: true } })
  }
  await triggerBroadcast('NOTIFICATION_UPDATE', null, session.role)
  return NextResponse.json({ ok: true })
}

// Marquer toutes comme lues (compatibilité ancienne)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await prisma.notification.updateMany({ where: { role: session.role, read: false }, data: { read: true } })
  await triggerBroadcast('NOTIFICATION_UPDATE', null, session.role)
  return NextResponse.json({ ok: true })
}
