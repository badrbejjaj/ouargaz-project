'use client'
import { useState, useEffect } from 'react'

type Tab = 'clients' | 'transporteurs' | 'provenances' | 'marques'

interface RefItem { id: number; name: string; marque?: string; active: boolean }

const MARQUES = ['AFRIQUIA GAZ', 'VIVO ENERGY', 'TISSIR', 'TOTAL GAZ', 'SAADA', 'DIMAGAZ']

export default function ReferentielsPage() {
  const [tab, setTab] = useState<Tab>('clients')
  const [data, setData] = useState<{ clients: RefItem[]; marques: RefItem[]; transporteurs: RefItem[]; provenances: RefItem[] }>({ clients: [], marques: [], transporteurs: [], provenances: [] })
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [addMode, setAddMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMarque, setNewMarque] = useState('AFRIQUIA GAZ')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/auth/session').then(r => r.json()),
      fetch('/api/referentiels').then(r => r.json()),
    ]).then(([sess, refs]) => {
      setUserRole(sess.user?.role || '')
      setData({ clients: refs.clients || [], marques: refs.marques || [], transporteurs: refs.transporteurs || [], provenances: refs.provenances || [] })
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/referentiels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: tab === 'clients' ? 'client' : tab === 'transporteurs' ? 'transporteur' : tab === 'provenances' ? 'provenance' : 'marque', name: newName, marque: newMarque }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) {
      setToast('Élément ajouté avec succès')
      setNewName('')
      setAddMode(false)
      fetchAll()
    } else {
      setToast(`Erreur: ${d.error}`)
    }
    setTimeout(() => setToast(''), 4000)
  }

  const handleDelete = async (type: string, id: number, name: string) => {
    if (!confirm(`Désactiver "${name}" ?`)) return
    const res = await fetch(`/api/referentiels?type=${type}&id=${id}`, { method: 'DELETE' })
    if (res.ok) { setToast('Élément désactivé'); fetchAll() } else setToast('Erreur')
    setTimeout(() => setToast(''), 3000)
  }

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'clients', label: 'Clients', count: data.clients.length, color: '#DA1A1A' },
    { key: 'marques', label: 'Marques', count: data.marques.length, color: '#FF6B00' },
    { key: 'transporteurs', label: 'Transporteurs', count: data.transporteurs.length, color: '#0066CC' },
    { key: 'provenances', label: 'Provenances', count: data.provenances.length, color: '#00D97E' },
  ]

  const currentItems = tab === 'clients' ? data.clients : tab === 'marques' ? data.marques : tab === 'transporteurs' ? data.transporteurs : data.provenances
  const canEdit = userRole !== 'CONSULTATION'
  const canDel = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(userRole)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Référentiels <span className="gradient-text">Maîtres</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestion des tables de référence OUARGAZ</p>
        </div>
        {canEdit && (
          <button onClick={() => setAddMode(v => !v)} className="btn-primary text-sm">
            {addMode ? '✕ Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {toast && (
        <div className="p-3 rounded-lg text-sm font-semibold"
          style={{ background: toast.startsWith('Erreur') ? 'rgba(255,59,59,0.1)' : 'rgba(0,217,126,0.1)', color: toast.startsWith('Erreur') ? '#FF3B3B' : '#00D97E', border: `1px solid ${toast.startsWith('Erreur') ? 'rgba(255,59,59,0.2)' : 'rgba(0,217,126,0.2)'}` }}>
          {toast}
        </div>
      )}

      {/* Add form */}
      {addMode && canEdit && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Nouveau {tab === 'clients' ? 'client' : tab === 'transporteurs' ? 'transporteur' : tab === 'provenances' ? 'provenance' : 'marque'}</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="form-label">Nom</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="form-input w-64" placeholder="Nom..." onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            {tab === 'clients' && (
              <div>
                <label className="form-label">Marque associée</label>
                <select value={newMarque} onChange={e => setNewMarque(e.target.value)} className="form-input w-44">
                  {MARQUES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="btn-primary text-sm py-2 px-4">
              {saving ? '...' : '✓ Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
            style={{
              background: tab === t.key ? `${t.color}18` : 'var(--bg-card)',
              color: tab === t.key ? t.color : 'var(--text-secondary)',
              border: tab === t.key ? `1px solid ${t.color}40` : '1px solid var(--border-color)',
            }}>
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${t.color}25`, color: t.color }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="spinner" /></div>
        ) : currentItems.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucun enregistrement
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                {tab === 'clients' && <th>Marque</th>}
                <th>Statut</th>
                {canDel && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentItems.map(item => (
                <tr key={item.id}>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                  <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                  {tab === 'clients' && (
                    <td><span className="badge-orange">{item.marque}</span></td>
                  )}
                  <td>
                    <span className={item.active ? 'badge-green' : 'badge-red'}>
                      {item.active ? '● Actif' : '● Inactif'}
                    </span>
                  </td>
                  {canDel && (
                    <td>
                      <button
                        onClick={() => handleDelete(tab === 'clients' ? 'client' : tab === 'transporteurs' ? 'transporteur' : tab === 'provenances' ? 'provenance' : 'marque', item.id, item.name)}
                        className="text-xs px-2 py-1 rounded-md transition-all hover:scale-105"
                        style={{ background: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.2)' }}
                      >
                        Désactiver
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
