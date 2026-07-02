import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 ~ POST ~ req:", req)
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    console.log("🚀 ~ POST ~ user:", user)

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 })
    }

    const token = await createToken({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    })

    // Log the login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        username: user.username,
        role: user.role,
        action: 'CONNEXION',
        module: 'AUTH',
        details: `Connexion réussie`,
      },
    })

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role, name: user.name },
    })

    response.cookies.set('ouargaz-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
