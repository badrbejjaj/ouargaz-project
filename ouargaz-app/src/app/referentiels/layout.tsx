'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import AgentOuarGaz from '@/components/agent/AgentOuarGaz'

type SidebarMode = 'full' | 'mini' | 'hidden'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<SidebarMode>('full')

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        if (!data.user) router.push('/login')
        else setUser(data.user)
        setLoading(false)
      })
      .catch(() => { router.push('/login'); setLoading(false) })
  }, [router])

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-mode') as SidebarMode | null
    if (saved === 'full' || saved === 'mini' || saved === 'hidden') setMode(saved)
  }, [])

  // Cycle complet → réduit → masqué → complet
  const cycleMode = () => {
    setMode(prev => {
      const next: SidebarMode = prev === 'full' ? 'mini' : prev === 'mini' ? 'hidden' : 'full'
      localStorage.setItem('sidebar-mode', next)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080F' }}>
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full border-2 border-red-600/20 border-t-red-600 animate-spin" />
          <p className="text-slate-500 text-sm">Chargement OUARGAZ APP...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const marginLeft = mode === 'hidden' ? '0px' : mode === 'mini' ? '72px' : '260px'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {mode !== 'hidden' && (
        <Sidebar user={user} collapsed={mode === 'mini'} onCollapseToggle={cycleMode} currentPath={pathname} />
      )}
      <div className="flex-1 flex flex-col transition-all duration-300" style={{ marginLeft }}>
        <Header user={user} onMenuToggle={cycleMode} sidebarMode={mode} />
        <main className="flex-1 p-6 page-enter" style={{ overflowY: 'auto' }}>
          {children}
        </main>
        <AgentOuarGaz />
      </div>
    </div>
  )
}
