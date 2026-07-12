'use client'
import { useState, useEffect, useCallback } from 'react'
import { useNotifications } from '@/context/NotificationContext'
import Link from 'next/link'
import { Clock, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react'

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
  EN_ROUTE:             { label: 'En route',             color: '#A855F7', bg: '#A855F71A' },
  EN_ATTENTE:           { label: 'En attente',           color: '#F97316', bg: '#F973161A' },
  EN_COURS_TRAITEMENT:  { label: 'Traitement',           color: '#0284C7', bg: '#0284C71A' },
  DEMARRAGE_EMPLISSAGE: { label: 'Emplissage',           color: '#8B5CF6', bg: '#8B5CF61A' },
  PRET_A_SORTIR:        { label: 'Empl. terminé',        color: '#10B981', bg: '#10B9811A' },
  SORTI:                { label: 'Sorti',                color: '#3B82F6', bg: '#3B82F61A' },
  ANNULE:               { label: 'Annulé',               color: '#EF4444', bg: '#EF44441A' },
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
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'range' | 'all'>('today')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
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
      setLastRefresh(new Date())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [initSession])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const h = () => fetchData()
    window.addEventListener('ouargaz-camions-updated', h)
    return () => window.removeEventListener('ouargaz-camions-updated', h)
  }, [fetchData])

  // Date utilities
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const isDateInCurrentWeek = (dateStr: string) => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    monday.setDate(diffToMonday)
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    
    const [y, m, d] = dateStr.split('-').map(Number)
    const truckDate = new Date(y, m - 1, d, 12, 0, 0)
    return truckDate >= monday && truckDate <= sunday
  }

  const isDateInCurrentMonth = (dateStr: string) => {
    const today = new Date()
    const [y, m] = dateStr.split('-').map(Number)
    return y === today.getFullYear() && m === (today.getMonth() + 1)
  }

  const matchesFilter = (c: Camion) => {
    if (filter === 'all') return true
    if (filter === 'today') {
      return c.date === getLocalDateString()
    }
    if (filter === 'week') {
      return isDateInCurrentWeek(c.date)
    }
    if (filter === 'month') {
      return isDateInCurrentMonth(c.date)
    }
    if (filter === 'range') {
      if (startDate && c.date < startDate) return false
      if (endDate && c.date > endDate) return false
      return true
    }
    return true
  }

  if (userRole && userRole !== 'DEPOSITAIRE') {
    return (
      <div className="glass-card p-8 text-center max-w-lg mx-auto mt-16">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Accès Restreint</h2>
        <p style={{ color: 'var(--text-muted)' }}>Cette page est réservée aux dépositaires.</p>
      </div>
    )
  }

  const filteredCamions = camions.filter(matchesFilter)

  // ─── Computed stats ────────────────────────────────────────────────────────
  const total   = filteredCamions.length
  const active  = filteredCamions.filter(c => !['SORTI','ANNULE'].includes(c.statut)).length
  const done    = filteredCamions.filter(c => c.statut === 'SORTI').length
  const annules = filteredCamions.filter(c => c.statut === 'ANNULE').length

  // Bottles loaded in filtered period
  const bottles12 = filteredCamions.reduce((s, c) => s + (c.charge_12kg || 0), 0)
  const bottles6  = filteredCamions.reduce((s, c) => s + (c.charge_6kg  || 0), 0)
  const bottles3  = filteredCamions.reduce((s, c) => s + (c.charge_3kg  || 0), 0)

  // Empty bottles returned in filtered period
  const vides12 = filteredCamions.reduce((s, c) => s + ((c as any).vides_12kg || 0), 0)
  const vides6  = filteredCamions.reduce((s, c) => s + ((c as any).vides_6kg  || 0), 0)
  const vides3  = filteredCamions.reduce((s, c) => s + ((c as any).vides_3kg  || 0), 0)

  // Defective bottles returned
  const def12 = filteredCamions.reduce((s, c) => s + ((c as any).def_rendues_12kg || 0), 0)
  const def6  = filteredCamions.reduce((s, c) => s + ((c as any).def_rendues_6kg  || 0), 0)
  const def3  = filteredCamions.reduce((s, c) => s + ((c as any).def_rendues_3kg  || 0), 0)

  // Status distribution for bar chart
  const statuses = Object.entries(STATUT_CONFIG).map(([key, cfg]) => ({
    key, cfg, count: filteredCamions.filter(c => c.statut === key).length
  })).filter(x => x.count > 0)

  // Recent history (last 10 sorted)
  const recent = [...filteredCamions].sort((a, b) =>
    new Date(b.arriveeAt || b.date || 0).getTime() - new Date(a.arriveeAt || a.date || 0).getTime()
  ).slice(0, 10)

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black animate-fade-in" style={{ color: 'var(--text-primary)' }}>
            Tableau de bord <span className="gradient-text">Dépositaire</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Vue d'ensemble de vos camions — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/suivi-camions" className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5">
            ← Suivi en direct
          </Link>
          <button onClick={fetchData} className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <>
          {/* ─── Filters & Live Indicator ────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 glass-card border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 rounded-2xl">
              <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-250 dark:border-slate-800/80">
                {[
                  { id: 'today', label: "Aujourd'hui" },
                  { id: 'week', label: "Semaine" },
                  { id: 'month', label: "Mois" },
                  { id: 'range', label: "Période" },
                  { id: 'all', label: "Tous" },
                ].map(opt => {
                  const isActive = filter === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setFilter(opt.id as any)}
                      className={`text-[11px] font-black px-3.5 py-1.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-800/40'
                          : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-green-500/5 border border-green-500/10 text-green-600 dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="font-extrabold uppercase tracking-wider text-[9px]">Temps Réel</span>
                </div>
                <span>MàJ: {lastRefresh.toLocaleTimeString('fr-FR')}</span>
              </div>
            </div>

            {filter === 'range' && (
              <div className="flex flex-wrap items-center gap-4 p-3 glass-card border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 rounded-2xl text-xs animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Du</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="px-2 py-1.5 border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 rounded-lg focus:outline-none text-slate-805 dark:text-slate-200 font-bold font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider text-[9px]">Au</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="px-2 py-1.5 border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 rounded-lg focus:outline-none text-slate-805 dark:text-slate-200 font-bold font-mono"
                  />
                </div>
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }} 
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold ml-auto"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ─── KPI Grid ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🚛', label: 'Total camions',  val: total,   color: '#3B82F6', sub: filter === 'today' ? "aujourd'hui" : filter === 'week' ? "cette semaine" : filter === 'month' ? "ce mois-ci" : filter === 'range' ? "période" : "historique" },
              { icon: '⏳', label: 'En cours',        val: active,  color: '#F97316', sub: 'en traitement' },
              { icon: '✅', label: 'Sortis',           val: done,    color: '#10B981', sub: 'complétés' },
              { icon: '❌', label: 'Annulés',          val: annules, color: '#EF4444', sub: 'annulés' },
            ].map(kpi => (
              <div 
                key={kpi.label} 
                className="glass-card relative overflow-hidden p-4 md:p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-slate-200 dark:border-slate-800/80"
              >
                {/* Top colored line */}
                <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${kpi.color}, transparent)` }} />
                
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {kpi.label}
                  </span>
                  <span className="text-lg p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-sm leading-none">
                    {kpi.icon}
                  </span>
                </div>

                {/* Value */}
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none" style={{ color: kpi.color }}>
                  {kpi.val.toLocaleString('fr-FR')}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold ml-1">
                    mvt.
                  </span>
                </div>

                {/* Sub-label */}
                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-3 border-t border-slate-100 dark:border-slate-800/40 pt-2 flex items-center justify-between">
                  <span>Statut</span>
                  <span className="text-slate-650 dark:text-slate-350 uppercase tracking-wider">{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ─── Row 2: Performance & Repartition ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Taux de remplacement */}
            <div className="glass-card p-5 flex flex-col justify-between lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Performance Remplacement</h3>
              
              <div className="border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 bg-white dark:bg-slate-900/40">
                <div className="space-y-0">
                  {[
                    { label: 'Bouteilles 12 kg', rendues: vides12, rempl: bottles12, refus: def12 },
                    { label: 'Bouteilles 6 kg',  rendues: vides6,  rempl: bottles6,  refus: def6 },
                    { label: 'Bouteilles 3 kg',  rendues: vides3,  rempl: bottles3,  refus: def3 },
                  ].map((row, i) => (
                    <div key={row.label} className={`flex items-center justify-between py-3.5 ${i !== 2 ? 'border-b border-slate-100 dark:border-slate-800/60' : ''}`}>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs w-[110px]">{row.label}</span>
                      
                      <div className="flex justify-between flex-1 pl-2">
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rendues</div>
                          <div className="text-xs font-black text-slate-800 dark:text-slate-200">{row.rendues}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Rempl.</div>
                          <div className="text-xs font-black text-emerald-500">{row.rempl}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-1">Refus.</div>
                          <div className="text-xs font-black text-red-500">{row.refus}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status distribution */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">📊 Répartition par statut</h3>
              {statuses.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-8 text-slate-400 dark:text-slate-500">Aucun camion pour cette période</p>
              ) : (
                <div className="space-y-3">
                  {statuses.map(({ key, cfg, count }) => (
                    <div key={key} className="flex items-center gap-3 py-0.5">
                      {/* Left: Status Pill */}
                      <div 
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black border min-w-[95px] justify-center text-center shadow-sm"
                        style={{ 
                          backgroundColor: `${cfg.color}15`, 
                          borderColor: `${cfg.color}25`,
                          color: cfg.color
                        }}
                      >
                        <span>{cfg.label}</span>
                      </div>

                      {/* Middle: Progress bar */}
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200/40 dark:border-slate-800/30">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${total ? (count / total) * 100 : 0}%`, 
                            backgroundColor: cfg.color,
                            boxShadow: `0 0 8px ${cfg.color}50`
                          }} 
                        />
                      </div>

                      {/* Right: Percent & Count */}
                      <div className="text-right min-w-[65px] text-xs">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {total ? Math.round((count / total) * 100) : 0}%
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold ml-1.5">
                          ({count})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Row 3: Bottles & Flux ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottles */}
            <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">📦 Bouteilles chargées</h3>
                <div className="grid grid-cols-3 gap-3 text-center py-2.5 mt-2">
                  <div className="p-2 bg-blue-500/5 rounded-xl border border-blue-500/10 dark:border-blue-500/25">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">12 kg</div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">{bottles12.toLocaleString('fr-FR')}</div>
                  </div>
                  <div className="p-2 bg-orange-500/5 rounded-xl border border-orange-500/10 dark:border-orange-500/25">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">6 kg</div>
                    <div className="text-lg font-black text-orange-500 dark:text-orange-400 mt-1">{bottles6.toLocaleString('fr-FR')}</div>
                  </div>
                  <div className="p-2 bg-green-500/5 rounded-xl border border-green-500/10 dark:border-green-500/25">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">3 kg</div>
                    <div className="text-lg font-black text-green-500 dark:text-green-400 mt-1">{bottles3.toLocaleString('fr-FR')}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                {[
                  { label: 'Bouteilles 12 kg chargées', val: bottles12, color: '#3B82F6' },
                  { label: 'Bouteilles 6 kg chargées',  val: bottles6,  color: '#F97316' },
                  { label: 'Bouteilles 3 kg chargées',  val: bottles3,  color: '#10B981' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100/50 dark:border-slate-800/20 last:border-b-0">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">{row.label}</span>
                    <span className="font-bold" style={{ color: row.color }}>{row.val.toLocaleString('fr-FR')} u.</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flux de bouteilles */}
            <div className="glass-card p-5 flex flex-col justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Flux Bouteilles</h3>
              
              <div className="space-y-4">
                {[
                  { label: 'Bouteilles 12 kg', vides: vides12, pleines: bottles12 },
                  { label: 'Bouteilles 6 kg',  vides: vides6,  pleines: bottles6 },
                  { label: 'Bouteilles 3 kg',  vides: vides3,  pleines: bottles3 },
                ].map((item) => {
                  const ecart = item.pleines - item.vides;
                  const isPositive = ecart > 0;
                  const isNegative = ecart < 0;
                  const pillBg = isNegative
                    ? 'bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
                    : isPositive
                      ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/50';
                  
                  const valColor = isNegative
                    ? 'text-red-600 dark:text-red-400'
                    : isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400';
                      
                  const sign = isPositive ? '+' : '';

                  return (
                    <div key={item.label} className="border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 bg-white dark:bg-slate-900/40">
                      <div className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-4">{item.label}</div>
                      <div className="flex items-center justify-between mb-4">
                        {/* Entrées */}
                        <div className="flex items-center gap-3 w-1/2 pr-2 border-r border-slate-100 dark:border-slate-800/60">
                          <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
                            <ArrowDown className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">{item.vides}</div>
                            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Entrées (Vides)</div>
                          </div>
                        </div>
                        {/* Sorties */}
                        <div className="flex items-center gap-3 w-1/2 pl-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                            <ArrowUp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">{item.pleines}</div>
                            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Sorties (Pleines)</div>
                          </div>
                        </div>
                      </div>

                      {/* Écart Pill */}
                      <div className={`flex justify-between items-center px-4 py-2.5 rounded-xl border ${pillBg}`}>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Écart Entrée/Sortie</span>
                        <span className={`font-black text-xs ${valColor}`}>{sign}{ecart}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ─── Recent movements table ────────────────────────────────────── */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/60" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                        <td className="text-sm">{fmtDate(c.arriveeAt || c.date)}</td>
                        <td>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded border"
                            style={{ background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}25` }}>
                            {cfg.label}
                          </span>
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
