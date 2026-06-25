export const ROLE_LABELS: Record<string, string> = {
  CHEF_CENTRE: 'Chef de Centre',
  ADJOINT_CHEF_CENTRE: 'Adjoint Chef de Centre',
  ADMINISTRATIF: 'Agent Administratif',
  AGENT_SAISIE: 'Agent de saisie / garde',
  CHEF_EQUIPE: 'Chef d’équipe',
  CONSULTATION: 'Consultation',
}

export const ROLE_COLORS: Record<string, string> = {
  CHEF_CENTRE: '#DA1A1A',
  ADJOINT_CHEF_CENTRE: '#B00020',
  ADMINISTRATIF: '#0066CC',
  AGENT_SAISIE: '#FF6B00',
  CHEF_EQUIPE: '#00A8E8',
  CONSULTATION: '#00D97E',
}

export const ALL_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','ADMINISTRATIF','AGENT_SAISIE','CHEF_EQUIPE','CONSULTATION']
export const ADMIN_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE']
export const MOVEMENT_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','AGENT_SAISIE','CHEF_EQUIPE','CONSULTATION']
export const AGENT_SAISIE_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','AGENT_SAISIE']
export const CHEF_EQUIPE_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','CHEF_EQUIPE']
export const SORTIE_ROLES = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','AGENT_SAISIE']

export function canManageQueue(role?: string) { return !!role && AGENT_SAISIE_ROLES.includes(role) }
export function canProcessInternal(role?: string) { return !!role && CHEF_EQUIPE_ROLES.includes(role) }
export function canValidateExit(role?: string) { return !!role && SORTIE_ROLES.includes(role) }
export function isAdmin(role?: string) { return !!role && ADMIN_ROLES.includes(role) }

export function loginRedirect(role: string) {
  if (role === 'AGENT_SAISIE' || role === 'CHEF_EQUIPE') return '/mouvements-camions'
  if (role === 'CONSULTATION') return '/mouvements-camions'
  if (role === 'ADMINISTRATIF') return '/dashboard'
  return '/dashboard'
}
