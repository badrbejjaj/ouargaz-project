import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionFromRequest, canAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAdmin(session.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, email: true, active: true },
    orderBy: { username: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAdmin(session.role)) return NextResponse.json({ error: 'Accès réservé au Chef de Centre / Adjoint' }, { status: 403 })

  const { username, name, password, role, email } = await req.json()
  if (!username || !name || !password || !role) return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })

  const validRoles = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','ADMINISTRATIF','AGENT_SAISIE','CHEF_EQUIPE','CONSULTATION']
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

  if (password.length < 6) return NextResponse.json({ error: 'Mot de passe trop court (6 caractères minimum)' }, { status: 400 })

  try {
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username: username.trim(), name: name.trim(), password: hashed, role, email: email || null },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.id, username: session.username, role: session.role,
        action: 'CRÉATION', module: 'ADMINISTRATION',
        details: `Utilisateur créé: ${username} (${role})`,
      },
    })

    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } })
  } catch {
    return NextResponse.json({ error: 'Cet identifiant existe déjà' }, { status: 409 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canAdmin(session.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id, active, password, username, name, role, email } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const validRoles = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','ADMINISTRATIF','AGENT_SAISIE','CHEF_EQUIPE','CONSULTATION']
  const updateData: Record<string, unknown> = {}
  if (typeof active === 'boolean') updateData.active = active
  if (typeof username === 'string' && username.trim()) updateData.username = username.trim()
  if (typeof name === 'string' && name.trim()) updateData.name = name.trim()
  if (typeof email === 'string') updateData.email = email.trim() || null
  if (typeof role === 'string') {
    if (!validRoles.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updateData.role = role
  }
  if (password) {
    if (password.length < 6) return NextResponse.json({ error: 'Mot de passe trop court (6 caractères minimum)' }, { status: 400 })
    updateData.password = await bcrypt.hash(password, 10)
  }

  try {
    await prisma.user.update({ where: { id }, data: updateData })
  } catch {
    return NextResponse.json({ error: 'Identifiant déjà utilisé ou utilisateur introuvable' }, { status: 409 })
  }

  await prisma.auditLog.create({
    data: {
      userId: session.id, username: session.username, role: session.role,
      action: 'MODIFICATION', module: 'ADMINISTRATION',
      details: `Utilisateur ID:${id} modifié — champs: ${Object.keys(updateData).join(', ')}`,
    },
  })

  return NextResponse.json({ ok: true })
}
