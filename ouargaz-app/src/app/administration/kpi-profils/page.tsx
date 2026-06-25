'use client'
import { useEffect, useState } from 'react'

const roles = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE','ADMINISTRATIF','AGENT_SAISIE','CHEF_EQUIPE','CONSULTATION']
const roleLabels: Record<string,string> = { CHEF_CENTRE:'Chef de Centre', ADJOINT_CHEF_CENTRE:'Adjoint Chef de Centre', ADMINISTRATIF:'Agent Administratif', AGENT_SAISIE:'Agent de saisie / garde', CHEF_EQUIPE:'Chef d\'équipe', CONSULTATION:'Consultation' }

const groups: Record<string,string[]> = {
  'Camions': ['camions_arrives','camions_attente','camions_traitement','camions_emplissage','camions_prets_sortir','camions_sortis','camions_annules'],
  'Bouteilles': ['bouteilles_entrees','bouteilles_sorties','ecart_bouteilles','etrangeres_entrees','etrangeres_sorties'],
  'Tonnages': ['tonnage_jour_12','tonnage_jour_6','tonnage_jour_3','tonnage_sorti_total','tonnage_mois','ecart_ventes'],
  'Défectueuses': ['def_rendues','def_acceptees','def_refusees','taux_remplacement_12','taux_remplacement_6','taux_remplacement_3','taux_remplacement_global'],
  'Performance': ['temps_attente','temps_traitement','temps_sejour','meilleur_client','meilleure_marque'],
}
const menus = ['dashboard','rapport_journalier','saisie_journaliere','mouvements_camions','historique_camions','exports','referentiels','cloture','audit','administration','kpi_profils']
const charts = ['courbe_camions_jour','barres_tonnage_emballage','courbe_defectueuses','camembert_statuts','taux_remplacement','ecarts_ventes']

function parse(s:string){ try { const v = JSON.parse(s||'[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
function label(s:string){ return s.replaceAll('_',' ') }

export default function KpiProfils(){
  const [role,setRole]=useState('CHEF_CENTRE')
  const [allConfigs,setAllConfigs]=useState<Record<string,{kpis:string[];menus:string[];charts:string[]}>>({})
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [dirty,setDirty]=useState(false)

  // Config courante (état local éditable)
  const current = allConfigs[role] || { kpis:[], menus:[], charts:[] }

  useEffect(()=>{
    fetch('/api/admin-dashboard-config').then(r=>r.json()).then(j=>{
      const map: Record<string,any> = {}
      for (const c of (j.configs||[])) {
        map[c.role] = { kpis: parse(c.kpis), menus: parse(c.menus), charts: parse(c.charts) }
      }
      setAllConfigs(map)
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  function toggleItem(kind:'kpis'|'menus'|'charts', value:string){
    setAllConfigs(prev => {
      const c = prev[role] || { kpis:[], menus:[], charts:[] }
      const list = c[kind]
      const next = list.includes(value) ? list.filter(x=>x!==value) : [...list, value]
      return { ...prev, [role]: { ...c, [kind]: next } }
    })
    setDirty(true)
    setMsg('')
  }

  async function save(){
    setSaving(true); setMsg('')
    const r=await fetch('/api/admin-dashboard-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ role, kpis:current.kpis, menus:current.menus, charts:current.charts })})
    if(r.ok){ localStorage.setItem('ouargaz-profile-config-updated', String(Date.now())); window.dispatchEvent(new Event('ouargaz-profile-config-updated')); setMsg('✅ Paramètres sauvegardés et appliqués sur le champ'); setDirty(false) } else { setMsg('❌ Erreur sauvegarde') }
    setSaving(false)
  }

  if(loading) return <div className="flex h-64 items-center justify-center"><div className="spinner"/></div>

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black" style={{color:'var(--text-primary)'}}>Paramétrage KPI, menus et graphes par profil</h1>
        <p style={{color:'var(--text-muted)'}}>Activation réelle des menus, KPI et graphiques visibles selon le rôle. Sauvegarde explicite.</p>
      </div>
      <button className="btn-primary" disabled={saving||!dirty} onClick={save}>{saving?'Sauvegarde...':dirty?'💾 Sauvegarder':'✓ À jour'}</button>
    </div>

    {msg&&<div className="glass-card p-3 font-bold" style={{color:msg.includes('Erreur')?'#FF3B3B':'#00D97E'}}>{msg}</div>}

    <div className="glass-card p-5">
      <label><span className="form-label">Profil</span>
        <select className="form-input max-w-md" value={role} onChange={e=>setRole(e.target.value)}>
          {roles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}
        </select>
      </label>
      <p className="text-xs mt-2" style={{color:'var(--text-muted)'}}>Astuce : laisser tous les menus décochés = aucune restriction (tout visible selon le rôle).</p>
    </div>

    <div className="grid xl:grid-cols-3 gap-6">
      {/* Menus */}
      <div className="glass-card p-5 xl:col-span-1">
        <h2 className="font-black text-xl mb-4" style={{color:'var(--text-primary)'}}>Menus visibles</h2>
        {menus.map(m=><label key={m} className="flex items-center gap-2 p-2 rounded-xl mb-2 cursor-pointer" style={{background:'rgba(255,255,255,.03)'}}>
          <input type="checkbox" checked={current.menus.includes(m)} onChange={()=>toggleItem('menus',m)}/>
          <span>{label(m)}</span>
        </label>)}
      </div>

      {/* KPI */}
      <div className="glass-card p-5">
        <h2 className="font-black text-xl mb-4" style={{color:'var(--text-primary)'}}>KPI visibles par thème</h2>
        {Object.entries(groups).map(([g,items])=><div key={g} className="mb-4">
          <h3 className="font-black mb-2" style={{color:'#DA1A1A'}}>{g}</h3>
          {items.map(k=><label key={k} className="flex items-center gap-2 p-2 rounded-xl mb-1 cursor-pointer" style={{background:'rgba(255,255,255,.03)'}}>
            <input type="checkbox" checked={current.kpis.includes(k)} onChange={()=>toggleItem('kpis',k)}/>
            <span>{label(k)}</span>
          </label>)}
        </div>)}
      </div>

      {/* Graphes */}
      <div className="glass-card p-5">
        <h2 className="font-black text-xl mb-4" style={{color:'var(--text-primary)'}}>Graphes activables</h2>
        {charts.map(g=><label key={g} className="flex items-center gap-2 p-2 rounded-xl mb-2 cursor-pointer" style={{background:'rgba(255,255,255,.03)'}}>
          <input type="checkbox" checked={current.charts.includes(g)} onChange={()=>toggleItem('charts',g)}/>
          <span>{label(g)}</span>
        </label>)}
      </div>
    </div>
  </div>
}
