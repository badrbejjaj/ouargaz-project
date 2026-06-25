'use client'
import { useState, useEffect } from 'react'

interface UserRecord { id: number; username: string; name: string; role: string; email: string | null; active: boolean }

type UserForm = { username: string; name: string; password: string; role: string; email: string }

const ROLE_LABELS: Record<string, string> = {
  CHEF_CENTRE: 'Chef de Centre', ADJOINT_CHEF_CENTRE: 'Adjoint Chef de Centre', ADMINISTRATIF: 'Agent Administratif', AGENT_SAISIE: 'Agent de saisie / garde', CHEF_EQUIPE: 'Chef d’équipe', CONSULTATION: 'Consultation',
}
const ROLE_COLORS: Record<string, string> = { CHEF_CENTRE: '#DA1A1A', ADJOINT_CHEF_CENTRE: '#B00020', ADMINISTRATIF: '#0066CC', AGENT_SAISIE: '#FF6B00', CHEF_EQUIPE: '#00A8E8', CONSULTATION: '#00D97E' }
const EMPTY_FORM: UserForm = { username: '', name: '', password: '', role: 'ADMINISTRATIF', email: '' }

export default function AdministrationPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/auth/session').then(r => r.json()),
      fetch('/api/administration').then(r => r.json()),
    ]).then(([sess, usersData]) => {
      setUserRole(sess.user?.role || '')
      setUsers(usersData.users || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'success' }), 4000)
  }

  const apiJson = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.error || 'Erreur')
    return d
  }

  if (userRole && !['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(userRole)) {
    return (
      <div className="glass-card p-8 text-center max-w-lg mx-auto mt-16">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Accès Restreint</h2>
        <p style={{ color: 'var(--text-muted)' }}>Cette section est réservée au Chef de Centre.</p>
      </div>
    )
  }

  const handleAdd = async () => {
    if (!form.username || !form.name || !form.password) { showToast('Tous les champs obligatoires', 'error'); return }
    setSaving(true)
    try {
      await apiJson('/api/administration', { method: 'POST', body: JSON.stringify(form) })
      showToast('Utilisateur créé avec succès')
      setAddMode(false)
      setForm(EMPTY_FORM)
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
    finally { setSaving(false) }
  }

  const startEdit = (user: UserRecord) => {
    setEditing(user)
    setEditForm({ username: user.username, name: user.name, email: user.email || '', role: user.role, password: '' })
  }

  const handleEdit = async () => {
    if (!editing) return
    if (!editForm.username || !editForm.name || !editForm.role) { showToast('Identifiant, nom et rôle obligatoires', 'error'); return }
    setSaving(true)
    try {
      await apiJson('/api/administration', { method: 'PATCH', body: JSON.stringify({ id: editing.id, ...editForm, password: editForm.password || undefined }) })
      showToast('Utilisateur modifié avec succès')
      setEditing(null)
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
    finally { setSaving(false) }
  }

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await apiJson('/api/administration', { method: 'PATCH', body: JSON.stringify({ id, active: !active }) })
      showToast(active ? 'Utilisateur désactivé' : 'Utilisateur réactivé')
      fetchAll()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur', 'error') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Administration <span className="gradient-text">Utilisateurs</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestion des accès — création, modification, rôle, email et mot de passe.</p>
        </div>
        <button onClick={() => setAddMode(v => !v)} className="btn-primary text-sm">
          {addMode ? '✕ Annuler' : '+ Nouvel utilisateur'}
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
        <UserFormCard title="Nouvel utilisateur" form={form} setForm={setForm} saving={saving} onSave={handleAdd} onCancel={() => setAddMode(false)} saveLabel="✓ Créer l'utilisateur" />
      )}

      {editing && (
        <UserFormCard
          title={`Modifier ${editing.username}`}
          form={editForm}
          setForm={setEditForm}
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
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Email</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</td>
                  <td>{user.name}</td>
                  <td><span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${ROLE_COLORS[user.role]}15`, color: ROLE_COLORS[user.role] }}>{ROLE_LABELS[user.role] || user.role}</span></td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email || '—'}</td>
                  <td><span className={user.active ? 'badge-green' : 'badge-red'}>{user.active ? '● Actif' : '● Inactif'}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => startEdit(user)} className="text-xs px-2 py-1 rounded-md transition-all" style={{ background: 'rgba(0,102,204,0.08)', color: '#0088FF', border: '1px solid rgba(0,102,204,0.2)' }}>Modifier</button>
                      <button onClick={() => handleToggle(user.id, user.active)} className="text-xs px-2 py-1 rounded-md transition-all" style={{ background: user.active ? 'rgba(255,59,59,0.08)' : 'rgba(0,217,126,0.08)', color: user.active ? '#FF3B3B' : '#00D97E', border: `1px solid ${user.active ? 'rgba(255,59,59,0.2)' : 'rgba(0,217,126,0.2)'}` }}>{user.active ? 'Désactiver' : 'Réactiver'}</button>
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

function UserFormCard({ title, form, setForm, saving, onSave, onCancel, saveLabel, passwordOptional = false }: {
  title: string
  form: UserForm
  setForm: React.Dispatch<React.SetStateAction<UserForm>>
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
        <div><label className="form-label">Identifiant *</label><input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="form-input" /></div>
        <div><label className="form-label">Nom complet *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" /></div>
        <div><label className="form-label">Mot de passe {passwordOptional ? '(laisser vide pour ne pas changer)' : '*'}</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="form-input" placeholder={passwordOptional ? 'Nouveau mot de passe optionnel' : '••••••••'} /></div>
        <div><label className="form-label">Rôle *</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="form-input"><option value="ADMINISTRATIF">Agent Administratif</option><option value="AGENT_SAISIE">Agent de saisie / garde</option><option value="CHEF_EQUIPE">Chef d’équipe</option><option value="CONSULTATION">Consultation</option><option value="CHEF_CENTRE">Chef de Centre</option><option value="ADJOINT_CHEF_CENTRE">Adjoint Chef de Centre</option></select></div>
        <div><label className="form-label">Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="form-input" placeholder="email@example.com" /></div>
      </div>
      <div className="flex gap-3 pt-2"><button onClick={onSave} disabled={saving} className="btn-primary text-sm py-2 px-5">{saving ? '...' : saveLabel}</button><button onClick={onCancel} className="btn-secondary text-sm py-2 px-4">Annuler</button></div>
    </div>
  )
}
