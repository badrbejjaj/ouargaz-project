import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const module = searchParams.get('module') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (module) where.module = module
  if (from || to) {
    where.createdAt = {}
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      ;(where.createdAt as Record<string, unknown>).lte = toDate
    }
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) })
}
