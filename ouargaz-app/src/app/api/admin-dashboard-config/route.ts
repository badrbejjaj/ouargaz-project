import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { ALL_ROLES, isAdmin } from '@/lib/roles'

export async function GET() {
  const configs = await Promise.all(ALL_ROLES.map(async role => {
    const row = await prisma.profileDashboardConfig.upsert({ where: { role }, update: {}, create: { role, kpis: '[]', menus: '[]', charts: '[]' } })
    return row
  }))
  return NextResponse.json({ configs })
}
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !isAdmin(session.role)) return NextResponse.json({ error: 'Réservé administrateur' }, { status: 403 })
  const body = await req.json()
  const role = String(body.role)
  const cfg = await prisma.profileDashboardConfig.upsert({
    where: { role },
    update: { kpis: JSON.stringify(body.kpis || []), menus: JSON.stringify(body.menus || []), charts: JSON.stringify(body.charts || []) },
    create: { role, kpis: JSON.stringify(body.kpis || []), menus: JSON.stringify(body.menus || []), charts: JSON.stringify(body.charts || []) }
  })
  return NextResponse.json({ config: cfg })
}
