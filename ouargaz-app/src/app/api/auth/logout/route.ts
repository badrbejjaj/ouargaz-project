import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (session) {
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        username: session.username,
        role: session.role,
        action: 'DÉCONNEXION',
        module: 'AUTH',
        details: 'Déconnexion',
      },
    })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('ouargaz-session')
  return response
}
