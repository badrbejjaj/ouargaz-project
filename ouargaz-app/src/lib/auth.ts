import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ouargaz-secret-key-fallback'
)

export interface SessionUser {
  id: number
  username: string
  role: string
  name: string
}

export async function createToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('ouargaz-session')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('ouargaz-session')?.value
  if (!token) return null
  return verifyToken(token)
}

export function canEdit(role: string): boolean {
  return ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','ADMINISTRATIF'].includes(role)
}

export function canAdmin(role: string): boolean {
  return ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(role)
}

export function canDelete(role: string): boolean {
  return ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(role)
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    CHEF_CENTRE: 'Chef de Centre',
    ADJOINT_CHEF_CENTRE: 'Adjoint Chef de Centre',
    ADMINISTRATIF: 'Agent Administratif',
    AGENT_SAISIE: 'Agent de saisie / garde',
    CHEF_EQUIPE: 'Chef d’équipe',
    CONSULTATION: 'Consultation',
  }
  return labels[role] || role
}
