'use client'
import { useState, useEffect, useCallback } from 'react'
import { useNotifications } from '@/context/NotificationContext'
import Link from 'next/link'

type Camion = {
  id: number
  matricule: string
  chauffeur: string
  client: string
  marque: string
  numero_bc: string
  statut: string
  date: string
  arriveeAt: string | null
  sortieAt: string | null
  entreeAt: string | null
  debutEmplissageAt: string | null
  finChargementAt: string | null
  charge_12kg: number
  charge_6kg: number
  charge_3kg: number
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EN_ATTENTE:           { label: 'File d\'attente',      color: '#FF8C00', bg: '#FF8C001A' },
  EN_COURS_TRAITEMENT:  { label: 'En cours traitement',  color: '#0066CC', bg: '#0066CC1A' },
  DEMARRAGE_EMPLISSAGE: { label: 'Emplissage',           color: '#8B5CF6', bg: '#8B5CF61A' },
  PRET_A_SORTIR:        { label: 'Prêt à sortir',        color: '#00D97E', bg: '#00D97E1A' },
  SORTI:                { label: 'Sorti',                color: '#6B7280', bg: '#6B72801A' },
  ANNULE:               { label: 'Annulé',               color: '#FF3B3B', bg: '#FF3B3B1A' },
}

function elapsed(from: string | null, to: string | null = null): number {
  if (!from) return 0
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  return Math.floor((end - start) / 60000)
}
function fmtMins(mins: number): string {
  if (!mins) return '—'
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function DepositaireDashboard() {
  const [camions, setCamions] = useState<Camion[]>([])
  const [history, setHistory] = useState<Camion[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today')
  const { initSession } = useNotifications()

  const fetchData = useCallback(async () => {
    try {
      const [sess, todayData, histData] = await Promise.all([
        fetch('/api/auth/session').then(r => r.json()),
        fetch('/api/mouvements-camions?all=1').then(r => r.json()),
        fetch('/api/mouvements-camions?all=1').then(r => r.json()),
      ])
      if (sess.user) {
        setUserRole(sess.user.role || '')
        initSession(sess.user)
      }
      setCamions(todayData.camions || [])
      setHistory(histData.camions || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [initSession])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const h = () => fetchData()
    window.addEventListener('ouargaz-camions-updated', h)
    return () => window.removeEventListener('ouargaz-camions-updated', h)
  }, [fetchData])

  if (userRole && userRole !== 'DEPOSITAIRE') {
    return (
      <div className="glass-card p-8 text-center max-w-lg mx-auto mt-16">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Accès Restreint</h2>
        <p style={{ color: 'var(--text-muted)' }}>Cette page est réservée aux dépositaires.</p>
      </div>
    )
  }

  // ─── Computed stats ────────────────────────────────────────────────────────
  const total   = camions.length
  const active  = camions.filter(c => !['SORTI','ANNULE'].includes(c.statut)).length
  const done    = camions.filter(c => c.statut === 'SORTI').length
  const annules = camions.filter(c => c.statut === 'ANNULE').length

  const sortis = camions.filter(c => c.statut === 'SORTI' && c.arriveeAt && c.sortieAt)
  const avgTotal = sortis.length
    ? Math.round(sortis.reduce((s, c) => s + elapsed(c.arriveeAt, c.sortieAt), 0) / sortis.length)
    : 0
  const avgAttente = camions.filter(c => c.entreeAt && c.arriveeAt).length
    ? Math.round(camions.filter(c => c.entreeAt && c.arriveeAt).reduce((s, c) => s + elapsed(c.arriveeAt, c.entreeAt), 0) / camions.filter(c => c.entreeAt && c.arriveeAt).length)
    : 0
  const avgTraitement = camions.filter(c => c.finChargementAt && c.entreeAt).length
    ? Math.round(camions.filter(c => c.finChargementAt && c.entreeAt).reduce((s, c) => s + elapsed(c.entreeAt, c.finChargementAt), 0) / camions.filter(c => c.finChargementAt && c.entreeAt).length)
    : 0

  // Bottles loaded today
  const bottles12 = camions.reduce((s, c) => s + (c.charge_12kg || 0), 0)
  const bottles6  = camions.reduce((s, c) => s + (c.charge_6kg  || 0), 0)
  const bottles3  = camions.reduce((s, c) => s + (c.charge_3kg  || 0), 0)
  const bottlesTotal = bottles12 + bottles6 + bottles3

  // Status distribution for bar chart
  const statuses = Object.entries(STATUT_CONFIG).map(([key, cfg]) => ({
    key, cfg, count: camions.filter(c => c.statut === key).length
  })).filter(x => x.count > 0)

  // Recent history (last 10 sorted)
  const recent = [...camions].sort((a, b) =>
    new Date(b.arriveeAt || 0).getTime() - new Date(a.arriveeAt || 0).getTime()
  ).slice(0, 10)

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Tableau de bord <span className="gradient-text">Dépositaire</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Vue d'ensemble de vos camions — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/suivi-camions" className="btn-secondary text-xs px-3 py-1.5">← Suivi en direct</Link>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <>
          {/* ─── KPI Grid ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🚛', label: 'Total camions',  val: total,   color: '#0066CC', sub: 'aujourd\'hui' },
              { icon: '⏳', label: 'En cours',        val: active,  color: '#FF8C00', sub: 'en traitement' },
              { icon: '✅', label: 'Sortis',           val: done,    color: '#00D97E', sub: 'complétés' },
              { icon: '❌', label: 'Annulés',          val: annules, color: '#FF3B3B', sub: 'annulés' },
            ].map(kpi => (
              <div key={kpi.label} className="glass-card p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{kpi.icon}</span>
                  <span className="text-3xl font-black" style={{ color: kpi.color }}>{kpi.val}</span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Row 2: Timing + Bottles ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timing stats */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>⏱ Durées moyennes</h3>
              {[
                { label: 'Attente en file',         val: avgAttente,    color: '#FF8C00' },
                { label: 'Traitement interne',       val: avgTraitement, color: '#0066CC' },
                { label: 'Durée totale (arrivée → sortie)', val: avgTotal, color: '#00D97E' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span className="text-base font-black" style={{ color: row.color }}>{fmtMins(row.val)}</span>
                </div>
              ))}
            </div>

            {/* Bottles */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>📦 Bouteilles chargées</h3>
              <div className="text-3xl font-black text-center" style={{ color: '#8B5CF6' }}>
                {bottlesTotal.toLocaleString('fr-FR')} <span className="text-base font-normal">unités</span>
              </div>
              {[
                { label: '12 kg', val: bottles12, color: '#0066CC' },
                { label: '6 kg',  val: bottles6,  color: '#FF8C00' },
                { label: '3 kg',  val: bottles3,  color: '#00D97E' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className="font-bold" style={{ color: row.color }}>{row.val} u.</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${bottlesTotal ? (row.val / bottlesTotal) * 100 : 0}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Status distribution ───────────────────────────────────────── */}
          {statuses.length > 0 && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>📊 Répartition par statut</h3>
              <div className="space-y-2">
                {statuses.map(({ key, cfg, count }) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{count} / {total}</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${total ? (count / total) * 100 : 0}%`, background: cfg.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Recent movements table ────────────────────────────────────── */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                📋 Mouvements récents
              </h3>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <span className="text-3xl opacity-30">🚛</span>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun mouvement enregistré</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Chauffeur</th>
                    <th>BC</th>
                    <th>Arrivée</th>
                    <th>Statut</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(c => {
                    const cfg = STATUT_CONFIG[c.statut] || { label: c.statut, color: '#6B7280', bg: '#6B72801A' }
                    return (
                      <tr key={c.id}>
                        <td className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>🚛 {c.matricule}</td>
                        <td className="text-sm">{c.chauffeur}</td>
                        <td className="text-sm font-mono">{c.numero_bc}</td>
                        <td className="text-sm">{fmtDate(c.arriveeAt)}</td>
                        <td>
                          <span className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {c.statut === 'SORTI'
                            ? fmtMins(elapsed(c.arriveeAt, c.sortieAt))
                            : c.arriveeAt ? `${fmtMins(elapsed(c.arriveeAt))} (en cours)` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
