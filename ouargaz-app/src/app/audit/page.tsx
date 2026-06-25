'use client'
import { useState, useEffect } from 'react'

interface AuditEntry {
  id: number
  username: string
  role: string
  action: string
  module: string
  details?: string
  motif?: string
  createdAt: string
}

const MODULES = ['AUTH', 'JAUGEAGE', 'VENTES', 'STOCK_BOUTEILLES', 'APPROVISIONNEMENTS', 'CLÔTURE', 'RÉFÉRENTIELS', 'ADMINISTRATION']
const ACTION_COLORS: Record<string, string> = {
  CONNEXION: '#00D97E', DÉCONNEXION: '#64748B',
  SAUVEGARDE: '#0066CC', CRÉATION: '#00D97E',
  SUPPRESSION: '#FF3B3B', CLÔTURE: '#FFAA00',
  RÉOUVERTURE: '#FF6B00', MODIFICATION: '#9B59B6',
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [moduleFilter, setModuleFilter] = useState('')
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (moduleFilter) params.set('module', moduleFilter)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/audit?${params}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items || [])
        setTotal(d.total || 0)
        setTotalPages(d.totalPages || 1)
        setLoading(false)
      })
  }

  useEffect(() => { fetchData() }, [page, moduleFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          Journal d'<span className="gradient-text">Audit</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Traçabilité complète des actions — {total} enregistrement(s)
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Module</label>
          <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1) }} className="form-input w-48">
            <option value="">Tous les modules</option>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input w-40" />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input w-40" />
        </div>
        <button onClick={() => { setPage(1); fetchData() }} className="btn-primary text-sm py-2 px-4">🔍 Filtrer</button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucun enregistrement d'audit
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Date/Heure</th>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('fr-MA')}
                    </td>
                    <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.username}</td>
                    <td>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: item.role === 'CHEF_CENTRE' ? 'rgba(218,26,26,0.1)' : 'rgba(0,102,204,0.1)',
                          color: item.role === 'CHEF_CENTRE' ? '#DA1A1A' : '#0066CC',
                          border: `1px solid ${item.role === 'CHEF_CENTRE' ? 'rgba(218,26,26,0.2)' : 'rgba(0,102,204,0.2)'}`,
                        }}>
                        {item.role}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          background: `${ACTION_COLORS[item.action] || '#64748B'}15`,
                          color: ACTION_COLORS[item.action] || '#64748B',
                        }}>
                        {item.action}
                      </span>
                    </td>
                    <td>
                      <span className="badge-orange text-xs">{item.module}</span>
                    </td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--text-secondary)' }} title={item.details || ''}>
                      {item.details}
                      {item.motif && <span className="ml-2 italic" style={{ color: '#FFAA00' }}>({item.motif})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 px-4">
            ← Précédent
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Page {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-sm py-1.5 px-4">
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
