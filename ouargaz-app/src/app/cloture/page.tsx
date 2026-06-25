'use client'
import { useState, useEffect } from 'react'

export default function CloturePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<{cloturee:boolean;closedBy?:string;closedAt?:string}|null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    fetch('/api/auth/session').then(r=>r.json()).then(d=>setUserRole(d.user?.role||''))
  },[])

  useEffect(() => {
    fetch(`/api/cloture?date=${date}`).then(r=>r.json()).then(setStatus)
  },[date])

  const handleCloture = async () => {
    if(!confirm(`Clôturer la journée du ${date} ? Cette action est réversible uniquement par le Chef de Centre.`)) return
    setLoading(true); setMsg(''); setWarnings([])
    const res = await fetch('/api/cloture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,action:'close'})})
    const d = await res.json()
    setMsg(d.message||d.error||'')
    if(d.warnings) setWarnings(d.warnings)
    if(res.ok) fetch(`/api/cloture?date=${date}`).then(r=>r.json()).then(setStatus)
    setLoading(false)
  }

  const handleReopen = async () => {
    const motif = prompt('Motif de réouverture (obligatoire):')
    if(!motif) return
    setLoading(true)
    const res = await fetch('/api/cloture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,action:'reopen',motif})})
    const d = await res.json()
    setMsg(d.message||d.error||'')
    if(res.ok) fetch(`/api/cloture?date=${date}`).then(r=>r.json()).then(setStatus)
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black" style={{color:'var(--text-primary)'}}>
          Clôture <span className="gradient-text">Journalière</span>
        </h1>
        <p className="text-sm" style={{color:'var(--text-muted)'}}>Verrouillage des données journalières</p>
      </div>
      <div className="glass-card p-6 space-y-4">
        <div>
          <label className="form-label">Sélectionner la journée</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-input w-48"/>
        </div>
        {status && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${status.cloturee ? 'badge-red' : 'badge-green'}`}
            style={{fontSize:'14px',padding:'12px 16px', display:'flex'}}>
            {status.cloturee ? '🔒' : '✎'}
            <div>
              <div className="font-bold">{status.cloturee ? 'Journée CLÔTURÉE' : 'Journée OUVERTE'}</div>
              {status.cloturee && status.closedBy && (
                <div className="text-xs mt-0.5">Clôturée par {status.closedBy} le {status.closedAt ? new Date(status.closedAt).toLocaleString('fr-MA') : ''}</div>
              )}
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="p-3 rounded-lg text-sm" style={{background:'rgba(255,170,0,0.1)',border:'1px solid rgba(255,170,0,0.2)',color:'#FFAA00'}}>
            ⚠️ Avertissements:<br/>
            {warnings.map((w,i)=><div key={i}>• {w}</div>)}
          </div>
        )}
        {msg && (
          <div className="p-3 rounded-lg text-sm" style={{background:'rgba(0,217,126,0.1)',border:'1px solid rgba(0,217,126,0.2)',color:'#00D97E'}}>
            ✓ {msg}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          {!status?.cloturee ? (
            <button onClick={handleCloture} disabled={loading} className="btn-primary">
              {loading ? '...' : '🔒 Clôturer la journée'}
            </button>
          ) : ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(userRole) ? (
            <button onClick={handleReopen} disabled={loading}
              className="btn-secondary" style={{borderColor:'rgba(255,170,0,0.3)',color:'#FFAA00'}}>
              {loading ? '...' : '🔓 Rouvrir (Chef de Centre)'}
            </button>
          ) : (
            <div className="text-sm" style={{color:'var(--text-muted)'}}>Seul le Chef de Centre peut rouvrir cette journée.</div>
          )}
        </div>
      </div>
    </div>
  )
}
