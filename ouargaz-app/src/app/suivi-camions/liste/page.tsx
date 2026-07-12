'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNotifications } from '@/context/NotificationContext'
import Link from 'next/link'
import { Eye, Calendar, Clock, Truck, FileText, User, RefreshCw, X, Search, ChevronDown } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  entreeAt: string | null
  debutEmplissageAt: string | null
  finChargementAt: string | null
  sortieAt: string | null
  charge_12kg: number
  charge_6kg: number
  charge_3kg: number
  createdAt: string
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; step: number; icon: string }> = {
  EN_ROUTE:             { label: 'En route',             color: '#A855F7', bg: '#A855F71A', step: 1, icon: '🚛' },
  EN_ATTENTE:           { label: 'En attente',           color: '#F97316', bg: '#F973161A', step: 2, icon: '⏳' },
  EN_COURS_TRAITEMENT:  { label: 'Traitement',           color: '#0284C7', bg: '#0284C71A', step: 3, icon: '⚙️' },
  DEMARRAGE_EMPLISSAGE: { label: 'Emplissage',           color: '#8B5CF6', bg: '#8B5CF61A', step: 4, icon: '🔥' },
  PRET_A_SORTIR:        { label: 'Empl. terminé',        color: '#10B981', bg: '#10B9811A', step: 5, icon: '📦' },
  SORTI:                { label: 'Sorti',                color: '#3B82F6', bg: '#3B82F61A', step: 6, icon: '✓' },
  ANNULE:               { label: 'Annulé',               color: '#EF4444', bg: '#EF44441A', step: -1, icon: '✕' },
}

const MARQUE_COLORS: Record<string, { bg: string; text: string }> = {
  TOTAL:      { bg: 'bg-blue-50 dark:bg-blue-950/30',       text: 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' },
  SAADA:      { bg: 'bg-sky-50 dark:bg-sky-950/30',         text: 'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/50' },
  AFRIQUIA:   { bg: 'bg-rose-50 dark:bg-rose-950/30',       text: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' },
  TISSIR:     { bg: 'bg-purple-50 dark:bg-purple-950/30',   text: 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' },
  VIVOENERGY: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' },
  VIVO_ENERGY: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' },
  PRIMAGAZ:   { bg: 'bg-pink-50 dark:bg-pink-950/30',       text: 'text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800/50' },
  DIMAGAZ:    { bg: 'bg-amber-50 dark:bg-amber-950/30',     text: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' },
  SUD_DIR:    { bg: 'bg-teal-50 dark:bg-teal-950/30',       text: 'text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/50' },
}

const getMarqueStyle = (marque: string) => {
  const key = marque?.toUpperCase().replace(/\s+/g, '_') || ''
  return MARQUE_COLORS[key] || { bg: 'bg-slate-50 dark:bg-slate-900/30', text: 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-805/50' }
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function elapsed(from: string | null, to: string | null = null): string {
  if (!from) return '—'
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  const mins = Math.floor((end - start) / 60000)
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}` : ''}`
}


export default function SuiviCamionsTablePage() {
  const [camions, setCamions] = useState<Camion[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [selected, setSelected] = useState<Camion | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'range' | 'all'>('today')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const prevCamionsRef = useRef<Camion[]>([])
  const { initSession } = useNotifications()

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

  const matchesDateFilter = (c: Camion) => {
    if (dateFilter === 'all') return true
    if (dateFilter === 'today') {
      return c.date === getLocalDateString()
    }
    if (dateFilter === 'week') {
      return isDateInCurrentWeek(c.date)
    }
    if (dateFilter === 'month') {
      return isDateInCurrentMonth(c.date)
    }
    if (dateFilter === 'range') {
      if (startDate && c.date < startDate) return false
      if (endDate && c.date > endDate) return false
      return true
    }
    return true
  }

  const fetchData = useCallback(async () => {
    try {
      const [sess, data] = await Promise.all([
        fetch('/api/auth/session').then(r => r.json()),
        fetch('/api/mouvements-camions?all=1').then(r => r.json()),
      ])
      const newUser = sess.user
      if (newUser) {
        setUserRole(newUser.role || '')
        initSession(newUser)
      }
      const newCamions: Camion[] = data.camions || []

      // Dispatch status changed events for alerts if active in background
      if (prevCamionsRef.current.length > 0) {
        for (const nc of newCamions) {
          const old = prevCamionsRef.current.find(c => c.id === nc.id)
          if (old && old.statut !== nc.statut) {
            const cfg = STATUT_CONFIG[nc.statut]
            if (cfg) {
              window.dispatchEvent(new CustomEvent('ouargaz-status-changed', {
                detail: { matricule: nc.matricule, oldStatut: old.statut, newStatut: nc.statut, label: cfg.label }
              }))
            }
          }
        }
      }

      prevCamionsRef.current = newCamions
      setCamions(newCamions)
      setLastRefresh(new Date())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [initSession])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('ouargaz-camions-updated', handler)
    window.addEventListener('ouargaz-notifications-updated', handler)
    return () => {
      window.removeEventListener('ouargaz-camions-updated', handler)
      window.removeEventListener('ouargaz-notifications-updated', handler)
    }
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

  // Filter list based on search, status selection and date filter
  const filtered = camions.filter(c => {
    // Date filter
    if (!matchesDateFilter(c)) return false

    // Status filter
    if (statusFilter !== 'ALL' && c.statut !== statusFilter) return false

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchMatricule = c.matricule?.toLowerCase().includes(q)
      const matchChauffeur = c.chauffeur?.toLowerCase().includes(q)
      const matchBc = c.numero_bc?.toLowerCase().includes(q)
      if (!matchMatricule && !matchChauffeur && !matchBc) return false
    }

    return true
  })

  return (
    <div className="space-y-6">
      {/* ─── Header Section ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Passages du jour
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            {filtered.length} {filtered.length > 1 ? 'passages enregistrés' : 'passage enregistré'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Actualiser
          </button>
        </div>
      </div>

      {/* ─── Filter Control Panel ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 glass-card border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 rounded-2xl">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Chercher matricule, chauffeur, BC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-800 dark:text-slate-100 appearance-none cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>

        {/* Date Dropdown */}
        <div className="relative">
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            className="w-full text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-800 dark:text-slate-100 appearance-none cursor-pointer"
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois-ci</option>
            <option value="range">Période personnalisée</option>
            <option value="all">Toutes les dates</option>
          </select>
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
      </div>

      {dateFilter === 'range' && (
        <div className="flex flex-wrap items-center gap-4 p-3 glass-card border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 rounded-xl text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Du</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="px-2 py-1.5 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 rounded-lg focus:outline-none text-slate-850 dark:text-slate-200 font-bold"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider text-[9px]">Au</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="px-2 py-1.5 border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 rounded-lg focus:outline-none text-slate-850 dark:text-slate-200 font-bold"
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

      {/* ─── Table Passages ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="glass-card flex items-center justify-center h-48"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-48 gap-3 border border-slate-200 dark:border-slate-800/80">
          <div className="text-4xl opacity-35">📋</div>
          <p className="text-sm font-semibold text-slate-500">Aucun passage enregistré pour cette recherche</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-slate-200 dark:border-slate-800/80 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Matricule</th>
                  <th className="py-4 px-4">Chauffeur</th>
                  <th className="py-4 px-4">Marque</th>
                  <th className="py-4 px-4 text-center">12 kg</th>
                  <th className="py-4 px-4 text-center">6 kg</th>
                  <th className="py-4 px-4 text-center">3 kg</th>
                  <th className="py-4 px-4 text-center">Statut</th>
                  <th className="py-4 px-4 text-center">Arrivée</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800/60 text-xs">
                {filtered.map(c => {
                  const cfg = STATUT_CONFIG[c.statut] || { label: c.statut, color: '#6B7280', bg: '#6B72801A', icon: '⏱' }
                  const mStyle = getMarqueStyle(c.marque)
                  const isHighVolume = c.charge_12kg >= 400 || c.charge_6kg >= 400 || c.charge_3kg >= 400 || ((c as any).vides_12kg >= 400)

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors duration-150 cursor-pointer group"
                    >
                      {/* Matricule */}
                      <td className="py-3.5 px-5 font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                        <span>{c.matricule}</span>
                        {isHighVolume && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                            ★ Priorité
                          </span>
                        )}
                      </td>

                      {/* Chauffeur */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-350">
                        {c.chauffeur}
                      </td>

                      {/* Marque */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${mStyle.bg} ${mStyle.text}`}>
                          {c.marque}
                        </span>
                      </td>

                      {/* 12 kg Pleines */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {c.charge_12kg || '—'}
                      </td>

                      {/* 6 kg Pleines */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {c.charge_6kg || '—'}
                      </td>

                      {/* 3 kg Pleines */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {c.charge_3kg || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] uppercase font-black px-2.5 py-1 rounded-xl border"
                          style={{
                            background: cfg.bg,
                            color: cfg.color,
                            borderColor: `${cfg.color}25`
                          }}
                        >
                          <span className="text-xs">{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Arrivée */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                        {c.statut === 'EN_ROUTE' ? '—' : fmtTime(c.arriveeAt)}
                      </td>



                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(c)
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/40 hover:bg-gradient-to-r hover:from-red-650 hover:to-orange-500 hover:text-white transition-all duration-300 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 group-hover:border-transparent inline-flex items-center justify-center"
                          title="Détails du passage"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Truck Detail Modal popup ────────────────────────────────────── */}
      {selected && (
        <TruckDetailModal camion={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Modal view component ─────────────────────────────────────────────────────
function TruckDetailModal({ camion, onClose }: { camion: Camion; onClose: () => void }) {
  const cfg = STATUT_CONFIG[camion.statut] || { label: camion.statut, color: '#6B7280', bg: '#6B72801A', step: 0 }

  const steps = [
    { label: 'En route',             time: camion.createdAt || (camion.date ? `${camion.date}T00:00:00Z` : null), icon: '🚛', desc: 'Déclaré par le dépositaire' },
    { label: 'Arrivée au centre',    time: camion.statut === 'EN_ROUTE' ? null : camion.arriveeAt, icon: '📍', desc: 'Validation de l\'arrivée par le garde' },
    { label: 'Entrée en traitement', time: camion.entreeAt,           icon: '⚙️', desc: 'Camion admis dans le centre' },
    { label: 'Début emplissage',     time: camion.debutEmplissageAt,  icon: '🔧', desc: 'Remplissage bouteilles démarré' },
    { label: 'Fin chargement',       time: camion.finChargementAt,    icon: '📦', desc: 'Chargement complété, prêt à sortir' },
    { label: 'Sortie',               time: camion.sortieAt,           icon: '✅', desc: 'Sortie validée avec bon livraison' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div 
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800/80 animate-in fade-in zoom-in-95 duration-200 rounded-2xl"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/60 sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-red-650/10 border border-red-500/20 text-red-500">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white tracking-wide">
                Détails du Camion {camion.matricule}
              </h3>
              <p className="text-[10px] text-slate-405 dark:text-slate-400 mt-0.5">
                Enregistré par le dépositaire • {fmtDate(camion.date)}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700/50 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Status Alert Banner */}
          <div 
            className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
            style={{ 
              background: `${cfg.bg}`, 
              borderColor: `${cfg.color}25` 
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🚛</span>
              <div>
                <div className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">Statut Actuel</div>
                <div className="font-extrabold text-sm mt-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
              </div>
            </div>
            
            {camion.statut === 'SORTI' && camion.arriveeAt && camion.sortieAt && (
              <div className="text-right">
                <div className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">
                  Transit
                </div>
                <div className="text-xs font-bold text-slate-950 dark:text-white mt-0.5">
                  ⏱ {elapsed(camion.arriveeAt, camion.sortieAt)}
                </div>
              </div>
            )}
          </div>

          {/* If Cancelled, show motif */}
          {camion.statut === 'ANNULE' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase tracking-wider">Motif d'annulation</div>
              <p className="text-xs text-slate-850 dark:text-slate-300 font-bold mt-1">{(camion as any).motif_annulation || 'Non spécifié'}</p>
            </div>
          )}

          {/* General Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-505 font-semibold uppercase text-[9px] block leading-none mb-1">Chauffeur</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.chauffeur}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-550 font-semibold uppercase text-[9px] block leading-none mb-1">Matricule</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.matricule}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-550 font-semibold uppercase text-[9px] block leading-none mb-1">N° Bon Commande</span>
              <span className="font-mono font-bold text-slate-805 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/30">{camion.numero_bc}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-550 font-semibold uppercase text-[9px] block leading-none mb-1">Marque</span>
              <span className="font-bold text-slate-850 dark:text-slate-200">{camion.marque}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 dark:text-slate-555 font-semibold uppercase text-[9px] block leading-none mb-1">Client</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.client}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Timeline Column */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                ⏱ Chronologie du Suivi
              </h4>
              
              <div className="relative pl-6 space-y-5">
                {steps.map((s, i) => {
                  const isDone = !!s.time
                  const isActive = isDone && (i === steps.length - 1 || !steps[i+1]?.time) && camion.statut !== 'ANNULE'
                  const displayTime = s.time && s.time.includes('T00:00:00Z') ? null : (s.time ? fmtTime(s.time) : null)
                  const displayDay = s.time ? fmtDate(s.time) : null

                  return (
                    <div key={s.label} className="relative flex gap-3.5 items-start">
                      {/* Vertical line segment */}
                      {i < steps.length - 1 && (
                        <div 
                          className={`absolute left-2 top-5 bottom-[-20px] w-0.5 transition-all duration-300 ${
                            steps[i+1]?.time 
                              ? 'bg-gradient-to-b' 
                              : 'border-l border-dashed border-slate-200 dark:border-slate-800'
                          }`}
                          style={{
                            background: steps[i+1]?.time 
                              ? `linear-gradient(to bottom, ${cfg.color}, ${cfg.color}30)` 
                              : undefined
                          }}
                        />
                      )}

                      {/* Node Icon/Circle */}
                      <div className="relative z-10 w-4.5 h-4.5 flex items-center justify-center">
                        {isActive ? (
                          <div className="relative flex items-center justify-center w-4 h-4">
                            <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full opacity-75" style={{ backgroundColor: cfg.color }}></span>
                            <div className="relative w-4.5 h-4.5 rounded-full border-2 bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg" style={{ borderColor: cfg.color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                            </div>
                          </div>
                        ) : isDone ? (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-sm" style={{ backgroundColor: cfg.color }}>
                            ✓
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-[9px] font-bold text-slate-400 dark:text-slate-600 flex items-center justify-center">
                            {i + 1}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p 
                          className={`text-xs leading-none ${
                            isActive ? 'font-extrabold text-slate-905 dark:text-white' : (isDone ? 'font-bold text-slate-700 dark:text-slate-350' : 'text-slate-400 dark:text-slate-500')
                          }`}
                        >
                          {s.label}
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{s.desc}</p>
                        {isDone && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border ${
                              isActive ? 'bg-orange-500/10 border-orange-500/20 text-orange-655 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/30 text-slate-600 dark:text-slate-405'
                            }`}>
                              <Clock className="w-2.5 h-2.5 opacity-70" />
                              {displayTime || '00:00'}
                            </span>
                            {displayDay && (
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                                le {displayDay}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Loading Column */}
            <div className="space-y-4">
              {/* Quantités Bouteilles */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-805 pb-1.5">
                  📦 Détail du Chargement
                </h4>
                
                {((camion as any).vides_12kg || (camion as any).vides_6kg || (camion as any).vides_3kg || 
                  camion.charge_12kg || camion.charge_6kg || camion.charge_3kg) ? (
                  <div className="space-y-3">
                    {/* Pleines (Chargées) */}
                    {(camion.charge_12kg || camion.charge_6kg || camion.charge_3kg) ? (
                      <div className="space-y-2">
                        <div className="text-[9px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-green-500" />
                          Chargées (Pleines)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: '12 kg', val: camion.charge_12kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' },
                            { label: '6 kg', val: camion.charge_6kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' },
                            { label: '3 kg', val: camion.charge_3kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' },
                          ].map(b => (
                            <div key={b.label} className={`py-1.5 px-2 rounded-xl border text-center ${b.bg}`}>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-semibold">{b.label}</span>
                              <span className="text-sm font-extrabold mt-0.5 block">{b.val || 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Vides et Défectueuses ramenées */}
                    {((camion as any).vides_12kg || (camion as any).vides_6kg || (camion as any).vides_3kg) ? (
                      <div className="space-y-2">
                        <div className="text-[9px] text-orange-605 dark:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-orange-500" />
                          Vides Ramenées
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: '12 kg', val: (camion as any).vides_12kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-605 dark:text-orange-400' },
                            { label: '6 kg', val: (camion as any).vides_6kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-605 dark:text-orange-400' },
                            { label: '3 kg', val: (camion as any).vides_3kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-655 dark:text-orange-400' },
                          ].map(b => (
                            <div key={b.label} className={`py-1.5 px-2 rounded-xl border text-center ${b.bg}`}>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-semibold">{b.label}</span>
                              <span className="text-sm font-extrabold mt-0.5 block">{b.val || 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center py-4">Aucune bouteille déclarée</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/60 flex justify-end">
          <button 
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2 font-bold hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
