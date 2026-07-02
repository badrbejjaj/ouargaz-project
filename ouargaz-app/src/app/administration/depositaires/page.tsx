'use client'
import { useState, useEffect } from 'react'

interface DepositaireRecord {
  id: number
  username: string
  name: string
  role: string
  email: string | null
  active: boolean
  clientId: number | null
}

interface ClientRecord {
  id: number
  name: string
  marque: string
}

type DepForm = {
  username: string
  name: string
  password: string
  email: string
  clientId: string
}

const EMPTY_FORM: DepForm = { username: '', name: '', password: '', email: '', clientId: '' }

export default function DepositairesPage() {
  const [users, setUsers] = useState<DepositaireRecord[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [form, setForm] = useState<DepForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<DepositaireRecord | null>(null)
  const [editForm, setEditForm] = useState<DepForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/auth/session').then(r => r.json()),
      fetch('/api/administration').then(r => r.json()),
      fetch('/api/referentiels/clients').then(r => r.json()),
    ]).then(([sess, usersData, clientsData]) => {
      setUserRole(sess.user?.role || '')
      const allUsers: DepositaireRecord[] = usersData.users || []
      setUsers(allUsers.filter((u: DepositaireRecord) => u.role === 'DEPOSITAIRE'))
      setClients(clientsData.clients || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 4000)
  }

  const apiJson = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string,string> || {}) } })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.error || 'Erreur')
    return d
  }

  if (userRole && !['CHEF_CENTRE', 'ADJOINT_CHEF_CENTRE'].includes(userRole)) {
    return (
      <div className="glass-card p-8 text-center max-w-lg mx-auto mt-16">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Accès Restreint</h2>
        <p style={{ color: 'var(--text-muted)' }}>Cette section est réservée au Chef de Centre.</p>
      </div>
    )
  }

  const handleAdd = async () => {
    if (!form.username || !form.name || !form.password) { showToast('Identifiant, nom et mot de passe obligatoires', 'error'); return }
    setSaving(true)
    try {
      await apiJson('/api/administration', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: 'DEPOSITAIRE', clientId: form.clientId ? Number(form.clientId) : null }),
      })
      showToast('Dépositaire créé avec succès')
      setAddMode(false)
      setForm(EMPTY_FORM)
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
    finally { setSaving(false) }
  }

  const startEdit = (user: DepositaireRecord) => {
    setEditing(user)
    setEditForm({ username: user.username, name: user.name, email: user.email || '', password: '', clientId: user.clientId ? String(user.clientId) : '' })
  }

  const handleEdit = async () => {
    if (!editing) return
    if (!editForm.username || !editForm.name) { showToast('Identifiant et nom obligatoires', 'error'); return }
    setSaving(true)
    try {
      await apiJson('/api/administration', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editing.id,
          username: editForm.username,
          name: editForm.name,
          email: editForm.email || undefined,
          password: editForm.password || undefined,
          clientId: editForm.clientId ? Number(editForm.clientId) : null,
        }),
      })
      showToast('Dépositaire modifié avec succès')
      setEditing(null)
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
    finally { setSaving(false) }
  }

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await apiJson('/api/administration', { method: 'PATCH', body: JSON.stringify({ id, active: !active }) })
      showToast(active ? 'Dépositaire désactivé' : 'Dépositaire réactivé')
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
  }

  const getClientName = (clientId: number | null) => {
    if (!clientId) return '—'
    return clients.find(c => c.id === clientId)?.name || `#${clientId}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Gestion des <span className="gradient-text">Dépositaires</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Création et gestion des comptes dépositaires — liaison avec le client associé.
          </p>
        </div>
        <button onClick={() => setAddMode(v => !v)} className="btn-primary text-sm">
          {addMode ? '✕ Annuler' : '+ Nouveau dépositaire'}
        </button>
      </div>

      {toast.msg && (
        <div className="p-3 rounded-lg text-sm font-semibold"
          style={{
            background: toast.type === 'error' ? 'rgba(255,59,59,0.1)' : 'rgba(0,217,126,0.1)',
            color: toast.type === 'error' ? '#FF3B3B' : '#00D97E',
            border: `1px solid ${toast.type === 'error' ? 'rgba(255,59,59,0.2)' : 'rgba(0,217,126,0.2)'}`,
          }}>
          {toast.msg}
        </div>
      )}

      {addMode && (
        <DepositaireFormCard
          title="Nouveau dépositaire"
          form={form}
          setForm={setForm}
          clients={clients}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setAddMode(false)}
          saveLabel="✓ Créer le dépositaire"
        />
      )}

      {editing && (
        <DepositaireFormCard
          title={`Modifier ${editing.username}`}
          form={editForm}
          setForm={setEditForm}
          clients={clients}
          saving={saving}
          onSave={handleEdit}
          onCancel={() => setEditing(null)}
          saveLabel="✓ Enregistrer les modifications"
          passwordOptional
        />
      )}

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="text-4xl opacity-30">🏪</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Aucun dépositaire enregistré</p>
            <button onClick={() => setAddMode(true)} className="btn-primary text-xs px-4 py-2">+ Créer le premier dépositaire</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Nom complet</th>
                <th>Client associé</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</td>
                  <td>{user.name}</td>
                  <td>
                    {user.clientId ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{ background: 'rgba(0,102,204,0.1)', color: '#0088FF', border: '1px solid rgba(0,102,204,0.2)' }}>
                        🏪 {getClientName(user.clientId)}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'rgba(255,59,59,0.08)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.15)' }}>
                        ⚠ Non associé
                      </span>
                    )}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email || '—'}</td>
                  <td><span className={user.active ? 'badge-green' : 'badge-red'}>{user.active ? '● Actif' : '● Inactif'}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => startEdit(user)} className="text-xs px-2 py-1 rounded-md transition-all"
                        style={{ background: 'rgba(0,102,204,0.08)', color: '#0088FF', border: '1px solid rgba(0,102,204,0.2)' }}>
                        Modifier
                      </button>
                      <button onClick={() => handleToggle(user.id, user.active)} className="text-xs px-2 py-1 rounded-md transition-all"
                        style={{
                          background: user.active ? 'rgba(255,59,59,0.08)' : 'rgba(0,217,126,0.08)',
                          color: user.active ? '#FF3B3B' : '#00D97E',
                          border: `1px solid ${user.active ? 'rgba(255,59,59,0.2)' : 'rgba(0,217,126,0.2)'}`,
                        }}>
                        {user.active ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DepositaireFormCard({ title, form, setForm, clients, saving, onSave, onCancel, saveLabel, passwordOptional = false }: {
  title: string
  form: DepForm
  setForm: React.Dispatch<React.SetStateAction<DepForm>>
  clients: ClientRecord[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  passwordOptional?: boolean
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Identifiant *</label>
          <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="form-input" placeholder="ex: depot_martin" />
        </div>
        <div>
          <label className="form-label">Nom complet *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="ex: Martin Dupont" />
        </div>
        <div>
          <label className="form-label">
            Mot de passe {passwordOptional ? '(laisser vide pour ne pas changer)' : '*'}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="form-input"
            placeholder={passwordOptional ? 'Nouveau mot de passe optionnel' : '••••••••'}
          />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="form-input" placeholder="email@example.com" />
        </div>
        <div className="md:col-span-2">
          <label className="form-label">Client associé</label>
          <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="form-input">
            <option value="">— Aucun client sélectionné —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.marque})</option>
            ))}
          </select>
          {!form.clientId && (
            <p className="text-xs mt-1" style={{ color: '#FF8C00' }}>
              ⚠ Sans client associé, le dépositaire ne verra aucun camion dans l&apos;application mobile.
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={saving} className="btn-primary text-sm py-2 px-5">
          {saving ? '...' : saveLabel}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm py-2 px-4">Annuler</button>
      </div>
    </div>
  )
}
