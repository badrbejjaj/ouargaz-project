'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  ClipboardList,
  History,
  FileText,
  Download,
  Database,
  ShieldCheck,
  LockKeyhole,
  Settings,
  Truck,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface SidebarProps {
  user: { username: string; role: string; name: string }
  collapsed: boolean
  onCollapseToggle: () => void
  currentPath: string
}

type IconType = typeof BarChart3

type NavItem = {
  href: string
  icon: IconType
  label: string
  roles: string[]
}

const navGroups: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'OPÉRATIONS',
    items: [
      { href: '/dashboard', icon: BarChart3, label: 'Dashboard', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
      { href: '/saisie', icon: ClipboardList, label: 'Saisie Journalière', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF'] },
      { href: '/historique', icon: History, label: 'Historique', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
      { href: '/mouvements-camions', icon: Truck, label: 'Mouvements Camions', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'AGENT_SAISIE', 'CHEF_EQUIPE', 'CONSULTATION'] },
    ],
  },
  {
    group: 'RAPPORTS & EXPORTS',
    items: [
      { href: '/rapports', icon: FileText, label: 'Rapports', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
      { href: '/exports', icon: Download, label: 'Exports Excel', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
    ],
  },
  {
    group: 'ADMINISTRATION',
    items: [
      { href: '/referentiels', icon: Database, label: 'Référentiels', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
      { href: '/cloture', icon: LockKeyhole, label: 'Clôture', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF'] },
      { href: '/audit', icon: ShieldCheck, label: 'Audit', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE', 'ADMINISTRATIF', 'CONSULTATION'] },
      { href: '/administration', icon: Settings, label: 'Administration', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE'] },
      { href: '/administration/kpi-profils', icon: SlidersHorizontal, label: 'KPI par profil', roles: ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE'] },
    ],
  },
]

const roleColors: Record<string, string> = {
  CHEF_CENTRE: '#DA1A1A',
  ADJOINT_CHEF_CENTRE: '#B00020',
  ADMINISTRATIF: '#0066CC',
  CONSULTATION: '#00D97E',
  AGENT_SAISIE: '#FF6B00',
  CHEF_EQUIPE: '#0066CC',
}

const roleLabels: Record<string, string> = {
  CHEF_CENTRE: 'Chef de Centre',
  ADJOINT_CHEF_CENTRE: 'Adjoint Chef de Centre',
  ADMINISTRATIF: 'Agent Administratif',
  CONSULTATION: 'Consultation',
  AGENT_SAISIE: 'Agent de saisie / garde',
  CHEF_EQUIPE: 'Chef d’équipe',
}

export default function Sidebar({ user, collapsed, onCollapseToggle, currentPath }: SidebarProps) {
  const [unread, setUnread] = useState(0)
  const [menuConfig, setMenuConfig] = useState<string[] | null>(null)
  useEffect(() => {
    const loadNotif = () => fetch('/api/notifications').then(r => r.json()).then(j => setUnread(j.unread || 0)).catch(() => {})
    const loadMenuConfig = () => fetch('/api/admin-dashboard-config', { cache: 'no-store' }).then(r => r.json()).then(j => {
      const cfg = (j.configs || []).find((c: any) => c.role === user.role)
      if (cfg) { try { const m = JSON.parse(cfg.menus || '[]'); setMenuConfig(Array.isArray(m) ? m : null) } catch { setMenuConfig(null) } }
    }).catch(() => {})
    loadNotif(); loadMenuConfig()
    const t = setInterval(loadNotif, 30000)
    const t2 = setInterval(loadMenuConfig, 3000)
    const listener = () => loadMenuConfig()
    window.addEventListener('ouargaz-profile-config-updated', listener)
    window.addEventListener('storage', listener)
    return () => { clearInterval(t); clearInterval(t2); window.removeEventListener('ouargaz-profile-config-updated', listener); window.removeEventListener('storage', listener) }
  }, [user.role])
  const isActive = (href: string) => currentPath === href || currentPath.startsWith(href + '/')
  const isFullAccess = ['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE'].includes(user.role)

  // Mapping href → clé de config menu (page kpi-profils)
  const menuKey: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/saisie': 'saisie_journaliere',
    '/historique': 'historique_camions',
    '/mouvements-camions': 'mouvements_camions',
    '/rapports': 'rapport_journalier',
    '/exports': 'exports',
    '/referentiels': 'referentiels',
    '/cloture': 'cloture',
    '/audit': 'audit',
    '/administration': 'administration',
    '/administration/kpi-profils': 'kpi_profils',
  }
  // Un menu est visible si : rôle autorisé ET (pas de config OU config vide OU clé présente dans config)
  const menuVisible = (item: NavItem) => {
    // Accès complet obligatoire pour Chef de Centre et Adjoint Chef de Centre
    // On ignore volontairement la configuration KPI/menus pour ces deux profils
    // afin qu'ils voient toujours toutes les fenêtres.
    if (isFullAccess) return true

    if (!item.roles.includes(user.role)) return false
    if (!menuConfig || menuConfig.length === 0) return true // pas de restriction définie
    const key = menuKey[item.href]
    return key ? menuConfig.includes(key) : true
  }

  return (
    <aside
      className="sidebar fixed left-0 top-0 h-full z-40 flex flex-col sidebar-premium"
      style={{
        width: collapsed ? '76px' : '276px',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-color)', minHeight: '70px' }}>
        <div className="w-10 h-10 flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center logo-orb">
          <img src="/images/totalenergies-logo.png" alt="TotalEnergies" className="w-8 h-8 object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-black text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>OUARGAZ APP</div>
            <div className="text-[11px] truncate uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Supervision GPL</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map(group => {
          const visibleItems = group.items.filter(item => menuVisible(item))
          if (visibleItems.length === 0) return null
          return (
            <div key={group.group} className="mb-5">
              {!collapsed && <div className="px-3 mb-2 text-[10px] font-black tracking-[0.18em]" style={{ color: 'var(--text-muted)', opacity: 0.65 }}>{group.group}</div>}
              {visibleItems.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="premium-nav-item flex items-center gap-3 px-3 py-3 rounded-2xl mb-1 transition-all duration-300 group relative"
                    style={{
                      background: active ? 'linear-gradient(135deg, rgba(218,26,26,0.18), rgba(255,107,0,0.08))' : 'transparent',
                      color: active ? '#DA1A1A' : 'var(--text-secondary)',
                      fontWeight: active ? 800 : 600,
                      boxShadow: active ? 'inset 0 0 0 1px rgba(218,26,26,.22)' : 'none',
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl nav-icon-shell">
                      <Icon size={18} strokeWidth={active ? 2.8 : 2.2} />
                    </span>
                    {!collapsed && <span className="text-sm truncate">{item.label}</span>}
                    {item.href === '/mouvements-camions' && unread > 0 && <span className="absolute right-2 top-2 min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white" style={{background:'#DA1A1A'}}>{unread}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-3 py-2 rounded-xl text-xs font-bold bg-gray-950 text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10 shadow-2xl">
                        {item.label}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-3 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,.035)' }}>
          <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: roleColors[user.role] || '#DA1A1A' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
              <div className="text-[11px] truncate" style={{ color: roleColors[user.role], opacity: 0.9 }}>{roleLabels[user.role] || user.role}</div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onCollapseToggle}
        className="absolute top-1/2 -right-4 w-8 h-8 rounded-full flex items-center justify-center border transition-all hover:scale-110 shadow-xl"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)', transform: 'translateY(-50%)' }}
        title={collapsed ? 'Agrandir menu' : 'Réduire menu'}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
    </aside>
  )
}
