'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/context/NotificationContext'

interface HeaderProps {
  user: { username: string; role: string; name: string }
  onMenuToggle: () => void
  sidebarMode?: 'full' | 'mini' | 'hidden'
}

const roleLabels: Record<string, string> = {
  CHEF_CENTRE: 'Chef de Centre',
  ADJOINT_CHEF_CENTRE: 'Adjoint Chef de Centre',
  ADMINISTRATIF: 'Agent Administratif',
  CONSULTATION: 'Consultation',
  AGENT_SAISIE: 'Agent de saisie / garde',
  CHEF_EQUIPE: 'Chef d\'équipe',
  DEPOSITAIRE: 'Dépositaire',
}

export default function Header({ user, onMenuToggle, sidebarMode = 'full' }: HeaderProps) {
  const router = useRouter()
  const [dark, setDark] = useState(true)
  const [date, setDate] = useState('')
  const { notifications, unreadCount, markRead, initSession } = useNotifications()
  const [showNotif, setShowNotif] = useState(false)

  useEffect(() => {
    if (user) {
      initSession(user)
    }
  }, [user, initSession])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const isDark = saved ? saved === 'dark' : true
    setDark(isDark)
    const update = () => {
      const now = new Date()
      setDate(now.toLocaleDateString('fr-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    }
    update()
    const timer = setInterval(update, 60000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.add('theme-cinematic')
    document.documentElement.classList.toggle('dark', next)
    window.setTimeout(() => document.documentElement.classList.remove('theme-cinematic'), 1200)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    initSession(null)
    router.push('/login')
    router.refresh()
  }

  const unread = unreadCount

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border-color)', backdropFilter: 'blur(12px)', minHeight: '64px' }}>
      <div className="flex items-center gap-4">
        {sidebarMode === 'hidden' && (
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl logo-orb flex items-center justify-center overflow-hidden">
              <img src="/images/totalenergies-logo.png" alt="TotalEnergies" className="h-7 w-7 object-contain" />
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>OUARGAZ APP</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>GPL Control</div>
            </div>
          </div>
        )}
        <button onClick={onMenuToggle} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div><div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{date}</div></div>
      </div>

      <div className="hidden md:flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>OUARGAZ S.A — Centre Emplisseur GPL</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotif(v => !v)}
            className="relative h-10 w-10 rounded-2xl border flex items-center justify-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            title="Notifications">
            🔔
            {unread > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] font-black text-white bg-red-600">{unread}</span>}
          </button>
          {showNotif && (
            <div className="absolute right-0 mt-3 w-80 rounded-2xl border p-3 shadow-2xl z-50" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between mb-2">
                <b style={{ color: 'var(--text-primary)' }}>Notifications</b>
                <button className="text-xs" onClick={() => markRead()}>Tout marquer lu</button>
              </div>
              {notifications.length === 0 && <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>Aucune notification.</div>}
              {notifications.map(n => (
                <div key={n.id} onClick={() => markRead(n.id)} className="block p-3 rounded-xl mb-2 cursor-pointer"
                  style={{ background: n.read ? 'rgba(255,255,255,.03)' : 'rgba(218,26,26,.10)', color: 'var(--text-secondary)' }}>
                  <div className="font-bold text-sm">{n.title}</div>
                  <div className="text-xs mt-1">{n.message}</div>
                  {!n.read && <div className="text-[10px] mt-1" style={{ color: '#DA1A1A' }}>● Cliquer pour marquer comme lu</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={toggleTheme} className="premium-theme-toggle" title={dark ? 'Mode clair' : 'Mode sombre'}>
          <span className="toggle-sun">☀️</span>
          <span className="toggle-moon">🌙</span>
          <span className="toggle-knob" style={{ transform: dark ? 'translateX(38px)' : 'translateX(2px)' }} />
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#DA1A1A' }}>{user.name.charAt(0)}</div>
          <div className="text-xs">
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
            <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>({roleLabels[user.role] || user.role})</span>
          </div>
        </div>

        <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
          style={{ background: 'rgba(218,26,26,0.08)', border: '1px solid rgba(218,26,26,0.15)', color: '#DA1A1A' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="hidden sm:inline">Quitter</span>
        </button>
      </div>
    </header>
  )
}
