'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNotifications } from '@/context/NotificationContext'
import Link from 'next/link'
import { Eye, Calendar, Clock, Truck, FileText, User, Plus, RefreshCw, X } from 'lucide-react'

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
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  EN_ROUTE:             { label: 'En route',             color: '#A855F7', bg: '#A855F71A', step: 1 },
  EN_ATTENTE:           { label: 'File d\'attente',      color: '#F97316', bg: '#F973161A', step: 2 },
  EN_COURS_TRAITEMENT:  { label: 'En cours traitement',  color: '#0284C7', bg: '#0284C71A', step: 3 },
  DEMARRAGE_EMPLISSAGE: { label: 'Emplissage démarré',   color: '#8B5CF6', bg: '#8B5CF61A', step: 4 },
  PRET_A_SORTIR:        { label: 'Prêt à sortir',        color: '#10B981', bg: '#10B9811A', step: 5 },
  SORTI:                { label: 'Sorti',                color: '#3B82F6', bg: '#3B82F61A', step: 6 },
  ANNULE:               { label: 'Annulé',               color: '#EF4444', bg: '#EF44441A', step: -1 },
}

const TIMELINE_STEPS = [
  { step: 1, key: 'depart',     label: 'Départ',              icon: '🚛' },
  { step: 2, key: 'arrivee',    label: 'Arrivée centre',      icon: '📍' },
  { step: 3, key: 'attente',    label: 'File d\'attente',      icon: '⏳' },
  { step: 4, key: 'traitement', label: 'Traitement',          icon: '⚙️' },
  { step: 5, key: 'emplissage', label: 'Emplissage',          icon: '🔧' },
  { step: 6, key: 'sortie',     label: 'Sortie',              icon: '✅' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function elapsed(from: string | null, to: string | null = null): string {
  if (!from) return ''
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  const mins = Math.floor((end - start) / 60000)
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ''}`
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SuiviCamionsPage() {
  const [camions, setCamions] = useState<Camion[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [selected, setSelected] = useState<Camion | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'range' | 'all'>('today')
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

  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(() => ({
    date: new Date().toISOString().slice(0, 10),
    chauffeur: '',
    matricule: '',
    numero_bc: '',
    vides_12kg: 0, vides_6kg: 0, vides_3kg: 0,
    def_rendues_12kg: 0, def_rendues_6kg: 0, def_rendues_3kg: 0,
  }))
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const saveNew = async () => {
    setFormError('')
    setFormSuccess('')
    if (!form.chauffeur.trim() || !form.matricule.trim() || !form.numero_bc.trim()) {
      setFormError('Chauffeur, matricule et N° BC sont obligatoires.')
      return
    }
    try {
      const r = await fetch('/api/mouvements-camions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const j = await r.json()
      if (!r.ok) {
        setFormError(j.error || 'Erreur lors de l\'enregistrement')
      } else {
        setForm({
          date: new Date().toISOString().slice(0, 10),
          chauffeur: '',
          matricule: '',
          numero_bc: '',
          vides_12kg: 0, vides_6kg: 0, vides_3kg: 0,
          def_rendues_12kg: 0, def_rendues_6kg: 0, def_rendues_3kg: 0,
        })
        setShowAddForm(false)
        setFormSuccess('✅ Camion déclaré avec succès')
        setTimeout(() => setFormSuccess(''), 5000)
        fetchData()
      }
    } catch {
      setFormError('Erreur de connexion au serveur')
    }
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

      // Detect status changes and show browser toasts via custom event
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

  // Initial load + periodic fallback refresh (30s)
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Real-time WS-driven instant refresh
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

  const filteredCamions = camions.filter(matchesFilter)
  const enRoute = filteredCamions.filter(c => c.statut === 'EN_ROUTE')
  const active = filteredCamions.filter(c => c.statut !== 'SORTI' && c.statut !== 'ANNULE' && c.statut !== 'EN_ROUTE')
  const done   = filteredCamions.filter(c => c.statut === 'SORTI')
  const cancelled = filteredCamions.filter(c => c.statut === 'ANNULE')

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 py-1">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Suivi <span className="gradient-text">Camions en direct</span>
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Mise à jour WebSocket en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/suivi-camions/dashboard" className="btn-secondary text-[11px] px-3 py-1.5 flex items-center gap-1.5">
            📊 Tableau de bord
          </Link>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-[11px] px-3 py-1.5">
            {showAddForm ? '✕ Fermer' : '➕ Déclarer Camion'}
          </button>
          <button onClick={fetchData} className="btn-secondary text-[11px] px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin-slow" /> Actualiser
          </button>
        </div>
      </div>

      {formSuccess && (
        <div className="glass-card p-3 font-bold text-green-500 bg-green-500/10 border-green-500/20">
          {formSuccess}
        </div>
      )}

      {showAddForm && (
        <NouvelleArriveeDepositaire
          form={form}
          setForm={setForm}
          saveNew={saveNew}
          error={formError}
          onClose={() => setShowAddForm(false)}
        />
      )}

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
              <span className="text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider text-[9px]">Au</span>
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

      {/* ─── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: filter === 'today' ? "Total aujourd'hui" : filter === 'week' ? "Total cette semaine" : filter === 'month' ? "Ce mois-ci" : "Total camions", val: filteredCamions.length, color: '#3B82F6' },
          { label: 'En cours',          val: active.length + enRoute.length,  color: '#F97316' },
          { label: 'Sortis',            val: done.length,    color: '#10B981' },
          { label: 'Annulés',           val: cancelled.length, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} className="glass-card px-3 py-2 flex items-center justify-between border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/30 rounded-xl">
            <div className="text-left">
              <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider leading-tight">{s.label}</div>
              <div className="text-lg font-black mt-0.5 leading-none" style={{ color: s.color }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : filteredCamions.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-48 gap-3 border border-slate-800/80">
          <div className="text-4xl opacity-35">🚛</div>
          <p className="text-sm font-semibold text-slate-400">Aucun camion enregistré pour cette période</p>
          <p className="text-xs text-slate-500">Essayez de changer le filtre ou de déclarer un nouveau camion.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {enRoute.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                Camions en route ({enRoute.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-350">
                {enRoute.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}

          {active.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Camions en cours ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-350">
                {active.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Camions sortis ({done.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-350">
                {done.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}

          {cancelled.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Camions annulés ({cancelled.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-350">
                {cancelled.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selected && (
        <TruckDetailModal camion={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Camion card ───────────────────────────────────────────────────────────────
function CamionCard({ camion, onSelect, isSelected }: { camion: Camion; onSelect: () => void; isSelected: boolean }) {
  const cfg = STATUT_CONFIG[camion.statut] || { label: camion.statut, color: '#6B7280', bg: '#6B72801A', step: 0 }
  
  return (
    <div
      onClick={onSelect}
      className="glass-card p-3.5 cursor-pointer relative overflow-hidden hover:-translate-y-1 transition-all duration-300 group select-none border-l-4"
      style={{
        borderTop: isSelected ? `1px solid ${cfg.color}` : '1px solid var(--border-color)',
        borderRight: isSelected ? `1px solid ${cfg.color}` : '1px solid var(--border-color)',
        borderBottom: isSelected ? `1px solid ${cfg.color}` : '1px solid var(--border-color)',
        borderLeft: `4px solid ${cfg.color}`,
        boxShadow: isSelected ? `0 0 12px ${cfg.color}12` : undefined,
      }}
    >
      {/* Subtle hover background glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" 
        style={{
          background: `linear-gradient(90deg, ${cfg.color}05, transparent)`
        }}
      />

      <div className="flex items-start justify-between gap-2.5 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              {camion.matricule}
            </span>
            <span 
              className="text-[9px] uppercase font-black px-2 py-0.5 rounded-md border" 
              style={{ 
                background: cfg.bg, 
                color: cfg.color,
                borderColor: `${cfg.color}20` 
              }}
            >
              {cfg.label}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5 truncate">{camion.client} ({camion.marque})</p>
        </div>

        {/* Primary Action Button - More discoverable and styled */}
        <button 
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 hover:bg-gradient-to-r hover:from-red-650 hover:to-orange-500 hover:text-white hover:border-transparent transition-all duration-300 text-slate-550 dark:text-slate-400 hover:scale-105 shadow-sm inline-flex items-center justify-center animate-in fade-in duration-200"
          title="Détails du camion"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-150 dark:border-slate-850/60 pt-2 text-[11px] text-slate-650 dark:text-slate-405">
        <div>
          <span className="font-semibold text-slate-400">Driver:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{camion.chauffeur}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-400">N° BC:</span> <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{camion.numero_bc}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 mt-1 border-t border-slate-150 dark:border-slate-850/30">
          <span>{fmtDate(camion.arriveeAt || camion.date)}</span>
          
          {camion.statut === 'SORTI' && camion.arriveeAt && camion.sortieAt && (
            <div className="font-bold text-green-600 dark:text-green-400">
              ⏱ {elapsed(camion.arriveeAt, camion.sortieAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Truck detail modal popup ──────────────────────────────────────────────────
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
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      <div 
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800/80 animate-in fade-in zoom-in-95 duration-200 rounded-2xl"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/60 sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-red-600/10 border border-red-500/20 text-red-500">
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

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div 
            className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
            style={{ background: `${cfg.bg}`, borderColor: `${cfg.color}25` }}
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
                <div className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider leading-none">Transit</div>
                <div className="text-xs font-bold text-slate-950 dark:text-white mt-0.5">⏱ {elapsed(camion.arriveeAt, camion.sortieAt)}</div>
              </div>
            )}
          </div>

          {camion.statut === 'ANNULE' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase tracking-wider">Motif d'annulation</div>
              <p className="text-xs text-slate-850 dark:text-slate-300 font-bold mt-1">{(camion as any).motif_annulation || 'Non spécifié'}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[9px] block leading-none mb-1">Chauffeur</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.chauffeur}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[9px] block leading-none mb-1">Matricule</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.matricule}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[9px] block leading-none mb-1">N° Bon Commande</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/30">{camion.numero_bc}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[9px] block leading-none mb-1">Marque</span>
              <span className="font-bold text-slate-850 dark:text-slate-200">{camion.marque}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[9px] block leading-none mb-1">Client</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{camion.client}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">⏱ Chronologie du Suivi</h4>
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
                              isActive ? 'bg-orange-500/10 border-orange-500/20 text-orange-655 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/30 text-slate-600 dark:text-slate-400'
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

            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">📦 Détail du Chargement</h4>
                {((camion as any).vides_12kg || (camion as any).vides_6kg || (camion as any).vides_3kg || camion.charge_12kg || camion.charge_6kg || camion.charge_3kg) ? (
                  <div className="space-y-3">
                    {(camion.charge_12kg || camion.charge_6kg || camion.charge_3kg) ? (
                      <div className="space-y-2">
                        <div className="text-[9px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-green-500" />Chargées (Pleines)</div>
                        <div className="grid grid-cols-3 gap-2">
                          {[ { label: '12 kg', val: camion.charge_12kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' }, { label: '6 kg', val: camion.charge_6kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' }, { label: '3 kg', val: camion.charge_3kg, bg: 'bg-green-500/5 border-green-500/10 dark:border-green-500/20 text-green-600 dark:text-green-400' } ].map(b => (
                            <div key={b.label} className={`py-1.5 px-2 rounded-xl border text-center ${b.bg}`}>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-semibold">{b.label}</span>
                              <span className="text-sm font-extrabold mt-0.5 block">{b.val || 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {((camion as any).vides_12kg || (camion as any).vides_6kg || (camion as any).vides_3kg) ? (
                      <div className="space-y-2">
                        <div className="text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-500" />Vides Ramenées</div>
                        <div className="grid grid-cols-3 gap-2">
                          {[ { label: '12 kg', val: (camion as any).vides_12kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-600 dark:text-orange-400' }, { label: '6 kg', val: (camion as any).vides_6kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-600 dark:text-orange-400' }, { label: '3 kg', val: (camion as any).vides_3kg, bg: 'bg-orange-500/5 border-orange-500/10 dark:border-orange-500/20 text-orange-600 dark:text-orange-400' } ].map(b => (
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

        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/60 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-2 font-bold hover:bg-slate-800">Fermer</button>
        </div>
      </div>
    </div>
  )
}

const int = (v: any) => Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0

const Field = ({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: any) => void; type?: string }) => {
  const displayValue = type === 'number' && (value === 0 || value === null || value === undefined) ? '' : (value ?? '')
  const handleBlur = (e: any) => {
    if (type === 'number' && e.target.value === '') {
      onChange(0)
    }
  }
  return (
    <label className="block space-y-1">
      <span className="form-label text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <input className="form-input text-xs font-semibold py-2" type={type} value={displayValue} onChange={e => onChange(type === 'number' ? int(e.target.value) : e.target.value)} onBlur={handleBlur} />
    </label>
  )
}

function NouvelleArriveeDepositaire({ form, setForm, saveNew, error, onClose }: { form: any; setForm: any; saveNew: () => void; error: string; onClose: () => void }) {
  const qkeys = ['12kg', '6kg', '3kg'] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      <div 
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800/80 animate-in fade-in zoom-in-95 duration-200 rounded-2xl animate-duration-200"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800/60 sticky top-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500">
              <Truck className="w-6 h-6" />
            </span>
            <div>
              <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-wide">
                Déclarer un Nouveau Camion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Enregistrement de l'arrivée dans la file d'attente
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-200 dark:border-slate-700/50 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-sm font-bold bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Date" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
            <Field label="Chauffeur" value={form.chauffeur} onChange={v => setForm({ ...form, chauffeur: v })} />
            <Field label="Matricule" value={form.matricule} onChange={v => setForm({ ...form, matricule: v })} />
            <Field label="N° BC" value={form.numero_bc} onChange={v => setForm({ ...form, numero_bc: v })} />
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800/60">
            <div className="space-y-3">
              <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: '#00A8E8' }}>Bouteilles Vides</h3>
              <div className="space-y-2">
                {qkeys.map(q => (
                  <Field key={q} label={`Vide ${q.replace('kg', ' kg')}`} type="number" value={form[`vides_${q}`]} onChange={v => setForm({ ...form, [`vides_${q}`]: v })} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: '#FF6B00' }}>Bouteilles Défectueuses</h3>
              <div className="space-y-2">
                {qkeys.map(q => (
                  <Field key={q} label={`Défect. ${q.replace('kg', ' kg')}`} type="number" value={form[`def_rendues_${q}`]} onChange={v => setForm({ ...form, [`def_rendues_${q}`]: v })} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/60 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2 font-bold hover:bg-slate-850"
          >
            Annuler
          </button>
          <button 
            className="btn-primary text-xs px-4 py-2 font-bold" 
            onClick={saveNew}
          >
            Déclarer l'Arrivée
          </button>
        </div>
      </div>
    </div>
  )
}

