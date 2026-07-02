'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNotifications } from '@/context/NotificationContext'
import Link from 'next/link'

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
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  EN_ATTENTE:           { label: 'File d\'attente',      color: '#FF8C00', bg: '#FF8C001A', step: 2 },
  EN_COURS_TRAITEMENT:  { label: 'En cours traitement',  color: '#0066CC', bg: '#0066CC1A', step: 3 },
  DEMARRAGE_EMPLISSAGE: { label: 'Emplissage démarré',   color: '#8B5CF6', bg: '#8B5CF61A', step: 4 },
  PRET_A_SORTIR:        { label: 'Prêt à sortir',        color: '#00D97E', bg: '#00D97E1A', step: 5 },
  SORTI:                { label: 'Sorti',                color: '#6B7280', bg: '#6B72801A', step: 6 },
  ANNULE:               { label: 'Annulé',               color: '#FF3B3B', bg: '#FF3B3B1A', step: -1 },
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
  const prevCamionsRef = useRef<Camion[]>([])
  const { initSession } = useNotifications()

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

  const active = camions.filter(c => c.statut !== 'SORTI' && c.statut !== 'ANNULE')
  const done   = camions.filter(c => c.statut === 'SORTI')

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Suivi <span className="gradient-text">Camions en direct</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Mise à jour instantanée via WebSocket • Fallback toutes les 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/suivi-camions/dashboard" className="btn-secondary text-xs px-3 py-1.5">
            📊 Tableau de bord
          </Link>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button onClick={fetchData} className="btn-primary text-xs px-3 py-1.5">↻ Actualiser</button>
        </div>
      </div>

      {/* ─── Live indicator ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold" style={{ color: '#00D97E' }}>Connexion en direct active</span>
      </div>

      {/* ─── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total aujourd\'hui', val: camions.length, color: '#0066CC' },
          { label: 'En cours',          val: active.length,  color: '#FF8C00' },
          { label: 'Sortis',            val: done.length,    color: '#00D97E' },
          { label: 'Annulés',           val: camions.filter(c => c.statut === 'ANNULE').length, color: '#FF3B3B' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : camions.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-40 gap-3">
          <div className="text-4xl opacity-30">🚛</div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Aucun camion enregistré aujourd'hui</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                🔴 Camions en cours ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c === selected ? null : c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                ✅ Camions sortis ({done.length})
              </h2>
              <div className="space-y-3">
                {done.map(c => (
                  <CamionCard key={c.id} camion={c} onSelect={() => setSelected(c === selected ? null : c)} isSelected={selected?.id === c.id} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected && (
        <TruckDetailPanel camion={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Camion card ───────────────────────────────────────────────────────────────
function CamionCard({ camion, onSelect, isSelected }: { camion: Camion; onSelect: () => void; isSelected: boolean }) {
  const cfg = STATUT_CONFIG[camion.statut] || { label: camion.statut, color: '#6B7280', bg: '#6B72801A', step: 0 }
  const currentStep = cfg.step

  return (
    <div
      onClick={onSelect}
      className="glass-card p-4 cursor-pointer transition-all"
      style={{
        border: isSelected ? `2px solid ${cfg.color}` : '1px solid var(--border)',
        boxShadow: isSelected ? `0 0 0 3px ${cfg.color}20` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black text-base" style={{ color: 'var(--text-primary)' }}>🚛 {camion.matricule}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {camion.chauffeur} • BC: {camion.numero_bc} • {fmtDate(camion.arriveeAt)}
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
          {camion.statut !== 'SORTI' && camion.arriveeAt && (
            <span>⏱ {elapsed(camion.arriveeAt)} en cours</span>
          )}
          {camion.statut === 'SORTI' && camion.arriveeAt && camion.sortieAt && (
            <span>Durée totale : {elapsed(camion.arriveeAt, camion.sortieAt)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0">
        {TIMELINE_STEPS.map((step, i) => {
          const done = camion.statut !== 'ANNULE' && currentStep >= step.step
          const active = currentStep === step.step && camion.statut !== 'ANNULE'
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all"
                  style={{
                    background: done ? cfg.color : 'transparent',
                    borderColor: done ? cfg.color : 'var(--border)',
                    color: done ? '#fff' : 'var(--text-muted)',
                    boxShadow: active ? `0 0 0 4px ${cfg.color}30` : undefined,
                  }}
                >
                  {done ? '✓' : step.step}
                </div>
                <span className="text-center mt-1 hidden sm:block" style={{ fontSize: 9, color: done ? cfg.color : 'var(--text-muted)', fontWeight: done ? 700 : 400, lineHeight: 1.2, maxWidth: 56 }}>
                  {step.label}
                </span>
              </div>
              {i < TIMELINE_STEPS.length - 1 && (
                <div className="h-0.5 flex-1 mx-1 mb-4 rounded"
                  style={{ background: done && currentStep > step.step ? cfg.color : 'var(--border)', transition: 'background 0.3s' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Truck detail panel ────────────────────────────────────────────────────────
function TruckDetailPanel({ camion, onClose }: { camion: Camion; onClose: () => void }) {
  const cfg = STATUT_CONFIG[camion.statut] || { label: camion.statut, color: '#6B7280', bg: '#6B72801A', step: 0 }

  const steps: { label: string; time: string | null; icon: string }[] = [
    { label: 'Arrivée au centre',    time: camion.arriveeAt,          icon: '📍' },
    { label: 'Entrée en traitement', time: camion.entreeAt,           icon: '⚙️' },
    { label: 'Début emplissage',     time: camion.debutEmplissageAt,  icon: '🔧' },
    { label: 'Fin chargement',       time: camion.finChargementAt,    icon: '📦' },
    { label: 'Sortie',               time: camion.sortieAt,           icon: '✅' },
  ]

  return (
    <div className="glass-card p-5 border-l-4 space-y-5" style={{ borderLeftColor: cfg.color }}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
            🚛 Camion {camion.matricule}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {camion.chauffeur} • {camion.client} ({camion.marque})
          </p>
        </div>
        <button onClick={onClose} className="text-lg font-bold px-3 py-1 rounded-lg hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Chronologie</h4>
          <div className="space-y-0">
            {steps.map((s, i) => {
              const isDone = !!s.time
              return (
                <div key={s.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2"
                      style={{
                        background: isDone ? cfg.color : 'transparent',
                        borderColor: isDone ? cfg.color : 'var(--border)',
                        color: isDone ? '#fff' : 'var(--text-muted)',
                      }}>
                      {isDone ? s.icon : '○'}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-0.5 h-8" style={{ background: isDone && steps[i+1]?.time ? cfg.color : 'var(--border)' }} />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-semibold" style={{ color: isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</p>
                    {isDone && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(s.time)} à {fmtTime(s.time)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Informations</h4>
            <div className="space-y-2">
              {[
                { label: 'N° BC',   val: camion.numero_bc },
                { label: 'Marque',  val: camion.marque },
                { label: 'Date',    val: fmtDate(camion.arriveeAt) },
                { label: 'Statut',  val: cfg.label, color: cfg.color },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span className="text-xs font-bold" style={{ color: row.color || 'var(--text-primary)' }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          {(camion.charge_12kg || camion.charge_6kg || camion.charge_3kg) ? (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Chargement</h4>
              <div className="space-y-1">
                {[
                  { label: '12 kg', val: camion.charge_12kg },
                  { label: '6 kg',  val: camion.charge_6kg },
                  { label: '3 kg',  val: camion.charge_3kg },
                ].filter(r => r.val > 0).map(r => (
                  <div key={r.label} className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Bouteilles {r.label}</span>
                    <span className="text-xs font-black" style={{ color: cfg.color }}>{r.val} u.</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {camion.arriveeAt && (
            <div className="rounded-lg p-3 text-center" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
              <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>
                {camion.statut === 'SORTI' ? 'Durée totale' : 'Temps écoulé'}
              </div>
              <div className="text-xl font-black" style={{ color: cfg.color }}>
                ⏱ {elapsed(camion.arriveeAt, camion.sortieAt)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
