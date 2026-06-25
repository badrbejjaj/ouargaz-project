'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { STATUT_LABELS, casiers12, casiers6, casiers3, fmt } from '@/lib/camions'
import { canManageQueue, canProcessInternal, canValidateExit } from '@/lib/roles'

type Camion = Record<string, any>
type User = { username: string; role: string; name: string }
type Tab = 'attente' | 'internes' | 'sortie' | 'historique' | 'kpi'
const qkeys = ['12kg','6kg','3kg'] as const

const makeEmptyForm = () => ({
  date: new Date().toISOString().slice(0,10),
  client:'', marque:'', chauffeur:'', matricule:'', numero_bc:'',
  saisie_12kg:0, saisie_6kg:0, saisie_3kg:0,
  vides_12kg:0, vides_6kg:0, vides_3kg:0,
  def_rendues_12kg:0, def_rendues_6kg:0, def_rendues_3kg:0,
  etrangeres_12kg:0, etrangeres_6kg:0, etrangeres_3kg:0,
})
const emptyForm = makeEmptyForm()

function int(v:any){ return Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0 }
function Field({label, value, onChange, type='text', disabled=false}:{label:string; value:any; onChange:(v:any)=>void; type?:string; disabled?:boolean}){
  // Display empty if 0, auto-convert empty to 0 on blur
  const displayValue = type === 'number' && (value === 0 || value === null || value === undefined) ? '' : (value ?? '')
  const handleBlur = (e: any) => {
    if (type === 'number' && e.target.value === '') {
      onChange(0)
    }
  }
  return <label><span className="form-label">{label}</span><input className="form-input" disabled={disabled} type={type} value={displayValue} onChange={e=>onChange(type==='number'?int(e.target.value):e.target.value)} onBlur={handleBlur} /></label>
}
function Read({label,value}:{label:string;value:any}){
  return <div className="rounded-xl p-2" style={{background:'rgba(255,255,255,.035)'}}>
    <div className="text-[10px] uppercase font-black" style={{color:'var(--text-muted)'}}>{label}</div>
    <div className="font-bold whitespace-nowrap" style={{color:'var(--text-primary)'}}>{value ?? '—'}</div>
  </div>
}
function Kpi({label,value,unit,color='#DA1A1A'}:{label:string;value:any;unit?:string;color?:string}){
  return <div className="glass-card p-4">
    <div className="text-xs uppercase tracking-widest font-black" style={{color:'var(--text-muted)'}}>{label}</div>
    <div className="text-2xl font-black mt-2 whitespace-nowrap" style={{color}}>{value}{unit&&` ${unit}`}</div>
  </div>
}

function qTotal12(c:any){ return int(c.vides_12kg)+int(c.def_rendues_12kg)+int(c.etrangeres_12kg) }
function qTotal6(c:any){ return int(c.vides_6kg)+int(c.def_rendues_6kg)+int(c.etrangeres_6kg) }
function qTotal3(c:any){ return int(c.vides_3kg)+int(c.def_rendues_3kg)+int(c.etrangeres_3kg) }
function casiersInfo(c:any){
  const c12=casiers12(int(c.vides_12kg), int(c.def_rendues_12kg), int(c.etrangeres_12kg))
  const c6=casiers6(int(c.vides_6kg), int(c.def_rendues_6kg), int(c.etrangeres_6kg))
  const c3=casiers3(int(c.vides_3kg), int(c.def_rendues_3kg), int(c.etrangeres_3kg))
  return { c12, c6, c3, total: c12+c6+c3 }
}

function totalParking(c:any){ return qTotal12(c)+qTotal6(c)+qTotal3(c) }
function tonnageParking(c:any){ return ((qTotal12(c)*12)+(qTotal6(c)*6)+(qTotal3(c)*3))/1000 }
function ParkingKpis({camions}:{camions:Camion[]}){
  const attente = camions.filter((c:any)=>c.statut==='EN_ATTENTE')
  const t12 = attente.reduce((a,c)=>a+qTotal12(c),0)
  const t6 = attente.reduce((a,c)=>a+qTotal6(c),0)
  const t3 = attente.reduce((a,c)=>a+qTotal3(c),0)
  const total = t12+t6+t3
  const ton = ((t12*12)+(t6*6)+(t3*3))/1000
  return <div className="grid md:grid-cols-5 gap-3">
    <Kpi label="Camions dehors parking" value={attente.length} color="#FF6B00"/>
    <Kpi label="Bouteilles dehors 12 kg" value={t12} color="#00A8E8"/>
    <Kpi label="Bouteilles dehors 6 kg" value={t6} color="#00A8E8"/>
    <Kpi label="Bouteilles dehors 3 kg" value={t3} color="#00A8E8"/>
    <Kpi label="Tonnage total dehors" value={fmt(ton,3)} unit="T" color="#00D97E"/>
  </div>
}

export default function MouvementsCamionsPage(){
  const [tab,setTab]=useState<Tab>('attente')
  const [camions,setCamions]=useState<Camion[]>([])
  const [clients,setClients]=useState<any[]>([])
  const [form,setForm]=useState<any>(makeEmptyForm())
  const [selected,setSelected]=useState<Camion|null>(null)
  const [msg,setMsg]=useState('')
  const [stats,setStats]=useState<any>(null)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [user,setUser]=useState<User|null>(null)
  const [notifications,setNotifications]=useState<any[]>([])
  const [showNotif,setShowNotif]=useState(false)
  const [newInternes,setNewInternes]=useState(false)
  const [newPrets,setNewPrets]=useState(false)
  const [prevInternesCount,setPrevInternesCount]=useState(0)
  const [prevPretsCount,setPrevPretsCount]=useState(0)

  const canQueue=canManageQueue(user?.role)
  const canProcess=canProcessInternal(user?.role)
  const canExit=canValidateExit(user?.role)
  const isChefEquipe = user?.role === 'CHEF_EQUIPE'
  const unread = notifications.filter(n=>!n.read).length

  const load = useCallback(async () => {
    const q = tab==='historique' ? `all=1&date=${date}` : tab==='kpi' ? `all=1&date=${date}` : tab==='internes' ? `statut=TOUS` : `statut=${tab==='attente'?'EN_ATTENTE':tab==='sortie'?'PRET_A_SORTIR':'TOUS'}`
    const r=await fetch(`/api/mouvements-camions?${q}`).catch(()=>null)
    if(!r?.ok) return
    const j=await r.json()
    const newCamions: Camion[] = j.camions||[]
    setCamions(newCamions)
    // Badges
    const currentInternes = newCamions.filter((c:any)=>['EN_COURS_TRAITEMENT','DEMARRAGE_EMPLISSAGE'].includes(c.statut)).length
    const currentPrets = newCamions.filter((c:any)=>c.statut==='PRET_A_SORTIR').length
    setPrevInternesCount(prev => { if(currentInternes > prev) setNewInternes(true); return currentInternes })
    setPrevPretsCount(prev => { if(currentPrets > prev) setNewPrets(true); return currentPrets })
    const s=await fetch(`/api/mouvements-camions/stats?date=${date}`).catch(()=>null)
    if(s?.ok) setStats(await s.json())
    const nf=await fetch('/api/notifications').then(r=>r.json()).catch(()=>({notifications:[],unread:0}))
    setNotifications(nf.notifications||[])
  }, [tab, date])

  useEffect(()=>{
    fetch('/api/auth/session').then(r=>r.json()).then(j=>setUser(j.user||null))
    fetch('/api/referentiels').then(r=>r.json()).then(j=>setClients(j.clients||[])).catch(()=>{})
  },[])

  useEffect(()=>{
    load()
    const t=setInterval(load, 3000)
    return ()=>clearInterval(t)
  },[load])

  async function markNotifRead(id?:number){
    const body = id ? { id } : {}
    await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{})
    setNotifications(ns=>id ? ns.map(n=>n.id===id?{...n,read:true}:n) : ns.map(n=>({...n,read:true})))
  }
  async function markAllRead(){ await markNotifRead(); }

  function chooseClient(name:string){ const c=clients.find(x=>x.name===name); setForm((f:any)=>({...f, client:name, marque:c?.marque||f.marque})) }

  async function saveNew(){
    setMsg('')
    const r=await fetch('/api/mouvements-camions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const j=await r.json()
    if(!r.ok){setMsg(j.error||'Erreur')} else {setForm(makeEmptyForm()); setSelected(null); setTab('attente'); setMsg('✅ Camion ajouté en file d\'attente'); load()}
  }
  async function act(action:string, extra:any={}){
    if(!selected) return
    setMsg('')
    const r=await fetch('/api/mouvements-camions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...selected,...extra,action,id:selected.id})})
    const j=await r.json()
    if(!r.ok){setMsg(j.error||'Erreur')} else {setSelected(j.camion); setMsg('✅ Action enregistrée'); load()}
  }

  const internes=camions.filter((c:any)=>['EN_COURS_TRAITEMENT','DEMARRAGE_EMPLISSAGE'].includes(c.statut))
  const list = tab==='internes'?internes:camions
  const isFullAccess = ['CHEF_CENTRE','ADJOINT_CHEF_CENTRE'].includes(user?.role || '')
  const allowedTabs: Tab[] = isFullAccess ? ['attente','internes','sortie','historique','kpi'] : user?.role==='AGENT_SAISIE' ? ['attente','sortie','historique'] : user?.role==='CHEF_EQUIPE' ? ['attente','internes','historique'] : user?.role==='CONSULTATION' ? ['attente','internes','sortie','historique','kpi'] : ['attente','internes','sortie','historique','kpi']
  useEffect(()=>{ if(user && !allowedTabs.includes(tab)) setTab(allowedTabs[0]) }, [user?.role, tab])

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black" style={{color:'var(--text-primary)'}}>Mouvements Camions Conditionnés <span style={{color:'#DA1A1A'}}>V6.5 PRO</span></h1>
        <p style={{color:'var(--text-muted)'}}>Entrée : vides + défectueuses + étrangères · Sortie : pleines + défectueuses refusées + étrangères</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="date" className="form-input" value={date} onChange={e=>setDate(e.target.value)}/>
        <a className="btn-secondary" href={`/api/mouvements-camions/export?mode=jour&date=${date}`}>📥 Jour</a>
        <a className="btn-secondary" href={`/api/mouvements-camions/export?mode=mois&date=${date}`}>📥 Mois</a>
        {/* Cloche notifications */}
        <div className="relative">
          <button
            className="relative h-10 w-10 rounded-2xl border flex items-center justify-center"
            style={{background:'var(--bg-card)',borderColor:'var(--border-color)',color:'var(--text-secondary)'}}
            onClick={()=>{ setShowNotif(v=>!v); }}
          >
            🔔
            {unread > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] font-black text-white bg-red-600">{unread}</span>}
          </button>
          {showNotif && <div className="absolute right-0 mt-3 w-80 rounded-2xl border p-3 shadow-2xl z-50" style={{background:'var(--bg-secondary)',borderColor:'var(--border-color)'}}>
            <div className="flex items-center justify-between mb-2">
              <b style={{color:'var(--text-primary)'}}>Notifications</b>
              <button className="text-xs" onClick={markAllRead}>Tout lire</button>
            </div>
            {notifications.length===0 && <div className="text-xs p-3" style={{color:'var(--text-muted)'}}>Aucune notification.</div>}
            {notifications.map(n=><div key={n.id} className="block p-3 rounded-xl mb-2 cursor-pointer" style={{background:n.read?'rgba(255,255,255,.03)':'rgba(218,26,26,.10)',color:'var(--text-secondary)'}} onClick={()=>markNotifRead(n.id)}>
              <div className="font-bold text-sm">{n.title}</div>
              <div className="text-xs mt-1">{n.message}</div>
              {!n.read && <div className="text-[10px] mt-1" style={{color:'#DA1A1A'}}>● Non lu — cliquer pour marquer comme lu</div>}
            </div>)}
          </div>}
        </div>
      </div>
    </div>
    {msg&&<div className="glass-card p-3 font-bold" style={{color:msg.includes('Erreur')?'#FF3B3B':'#00D97E'}}>{msg}</div>}

    {/* Tabs */}
    <div className="flex flex-wrap gap-2">
      {allowedTabs.map(t=>{
        const isInternes = t==='internes'
        const isSortie = t==='sortie'
        return <button key={t} onClick={()=>{
          setTab(t)
          if(isInternes){ setNewInternes(false) }
          if(isSortie){ setNewPrets(false) }
        }} className={tab===t?'btn-primary':'btn-secondary'}>
          {t==='attente'?'File d\'attente':t==='internes'?'Camions internes':t==='sortie'?'Prêts à sortir':t==='historique'?'Historique':'KPI & graphes'}
          {isInternes && newInternes && tab!=='internes' ? <span className="ml-2 rounded-full bg-red-600 px-2 text-white text-xs">●</span> : null}
          {isSortie && newPrets && tab!=='sortie' ? <span className="ml-2 rounded-full bg-red-600 px-2 text-white text-xs">●</span> : null}
        </button>
      })}
    </div>

    {/* KPI */}
    {tab==='kpi' && stats && <KpiDashboard stats={stats}/>}

    {tab==='attente' && <ParkingKpis camions={camions}/>}

    {/* Formulaire nouvelle arrivée (Agent saisie uniquement) */}
    {tab==='attente' && canQueue && !isChefEquipe && <NouvelleArrivee form={form} setForm={setForm} clients={clients} chooseClient={chooseClient} saveNew={saveNew}/>}

    {/* Message lecture seule pour chef équipe sur attente */}
    {tab==='attente' && isChefEquipe && <div className="glass-card p-4" style={{color:'var(--text-muted)'}}>📋 Lecture seule — La file d'attente est consultable uniquement par le chef d'équipe.</div>}

    {/* Table + détail */}
    {tab!=='kpi' && <div className="grid xl:grid-cols-[1fr_460px] gap-5">
      <ListeCamions list={list} tab={tab} selected={selected} onSelect={setSelected}/>
      <Detail selected={selected} setSelected={setSelected} act={act} canQueue={canQueue && !isChefEquipe} canProcess={canProcess} canExit={canExit} isChefEquipe={isChefEquipe}/>
    </div>}
  </div>
}

function NouvelleArrivee({form,setForm,clients,chooseClient,saveNew}:any){
  const csi = casiersInfo(form)
  return <div className="glass-card p-5 space-y-4">
    <h2 className="text-xl font-black" style={{color:'var(--text-primary)'}}>Nouvelle arrivée camion</h2>
    <div className="grid md:grid-cols-3 gap-3">
      <Field label="Date" type="date" value={form.date} onChange={(v:any)=>setForm({...form,date:v})}/>
      <label><span className="form-label">Client</span><select className="form-input" value={form.client} onChange={e=>chooseClient(e.target.value)}><option value="">Choisir...</option>{clients.map((c:any)=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
      <Field label="Marque" value={form.marque} onChange={(v:any)=>setForm({...form,marque:v})}/>
      <Field label="Chauffeur" value={form.chauffeur} onChange={(v:any)=>setForm({...form,chauffeur:v})}/>
      <Field label="Matricule" value={form.matricule} onChange={(v:any)=>setForm({...form,matricule:v})}/>
      <Field label="N° BC" value={form.numero_bc} onChange={(v:any)=>setForm({...form,numero_bc:v})}/>
    </div>
    <QuantityBlock obj={form} setObj={setForm} prefix="" includeEtrangeres={false}/>
    <div className="grid md:grid-cols-4 gap-3">
      <Read label="Casiers 12 kg" value={csi.c12}/>
      <Read label="Casiers 6 kg" value={csi.c6}/>
      <Read label="Casiers 3 kg" value={csi.c3}/>
      <Read label="Total casiers" value={csi.total}/>
    </div>
    <button className="btn-primary w-full" onClick={saveNew}>Ajouter en file d'attente</button>
  </div>
}

function QuantityBlock({obj,setObj,prefix='',includeEtrangeres=false}:{obj:any;setObj:(o:any)=>void;prefix?:string;includeEtrangeres?:boolean}){
  const key=(k:string)=>prefix?`${prefix}_${k}`:k
  const up=(k:string,v:any)=>setObj({...obj,[key(k)]:v})
  return <div className={`grid gap-3 ${includeEtrangeres ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
    <div className="space-y-2">
      <h3 className="font-black" style={{color:'#00A8E8'}}>Vides</h3>
      {qkeys.map(q=><Field key={q} label={`Vide ${q.replace('kg',' kg')}`} type="number" value={obj[key(`vides_${q}`)]} onChange={(v:any)=>up(`vides_${q}`,v)}/>)}
    </div>
    <div className="space-y-2">
      <h3 className="font-black" style={{color:'#FF6B00'}}>Défectueuses</h3>
      {qkeys.map(q=><Field key={q} label={`Défect. ${q.replace('kg',' kg')}`} type="number" value={obj[key(`def_rendues_${q}`)]} onChange={(v:any)=>up(`def_rendues_${q}`,v)}/>)}
    </div>
    {includeEtrangeres && <div className="space-y-2">
      <h3 className="font-black" style={{color:'#C084FC'}}>Étrangères</h3>
      {qkeys.map(q=><Field key={q} label={`Étrangère ${q.replace('kg',' kg')}`} type="number" value={obj[key(`etrangeres_${q}`)]} onChange={(v:any)=>up(`etrangeres_${q}`,v)}/>)}
    </div>}
  </div>
}

function ListeCamions({list,tab,selected,onSelect}:{list:Camion[];tab:Tab;selected:Camion|null;onSelect:(c:Camion)=>void}){
  return <div className="glass-card overflow-auto">
    <table className="w-full text-sm">
      <thead>
        <tr style={{color:'var(--text-muted)'}}>
          <th className="p-2 text-left">Heure</th>
          <th className="p-2 text-left">Camion</th>
          <th className="p-2 text-left">Client</th>
          <th className="p-2">Statut</th>
          <th className="p-2 text-right">Vides 12/6/3</th>
          <th className="p-2 text-right">Déf. 12/6/3</th>
          <th className="p-2 text-right">Étr. 12/6/3</th>
          <th className="p-2 text-right">Total parking</th>
          <th className="p-2 text-right">Tonnage</th>
        </tr>
      </thead>
      <tbody>
        {list.map(c=><tr key={c.id} onClick={()=>onSelect(c)} className="cursor-pointer hover:bg-white/5 border-t" style={{borderColor:'var(--border-color)',background:selected?.id===c.id?'rgba(218,26,26,.08)':undefined}}>
          <td className="p-2">{new Date(c.arriveeAt).toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})}</td>
          <td className="p-2 font-bold">{c.matricule}<div className="text-xs" style={{color:'var(--text-muted)'}}>{c.chauffeur}</div></td>
          <td className="p-2">{c.client}<div className="text-xs" style={{color:'var(--text-muted)'}}>{c.marque}</div></td>
          <td className="p-2 text-center text-xs">{STATUT_LABELS[c.statut]||c.statut}</td>
          <td className="p-2 text-right font-mono">{c.vides_12kg}/{c.vides_6kg}/{c.vides_3kg}</td>
          <td className="p-2 text-right font-mono">{c.def_rendues_12kg}/{c.def_rendues_6kg}/{c.def_rendues_3kg}</td>
          <td className="p-2 text-right font-mono">{c.etrangeres_12kg}/{c.etrangeres_6kg}/{c.etrangeres_3kg}</td>
          <td className="p-2 text-right font-black">{totalParking(c)}</td>
          <td className="p-2 text-right font-mono">{fmt(tonnageParking(c),3)} T</td>
        </tr>)}
      </tbody>
    </table>
    {list.length===0 && <div className="p-8 text-center" style={{color:'var(--text-muted)'}}>Aucun camion dans cette liste.</div>}
  </div>
}

function Detail({selected,setSelected,act,canQueue,canProcess,canExit,isChefEquipe}:{selected:Camion|null;setSelected:(c:Camion)=>void;act:(a:string,e?:any)=>void;canQueue:boolean;canProcess:boolean;canExit:boolean;isChefEquipe:boolean}){
  const [motif,setMotif]=useState('')
  if(!selected) return <div className="glass-card p-5" style={{color:'var(--text-muted)'}}>Sélectionner un camion pour consulter ou traiter.</div>
  const c=selected
  const up=(k:string,v:any)=>setSelected({...c,[k]:v})
  const tr12=c.def_traitees_12kg || c.def_rendues_12kg
  const tr6=c.def_traitees_6kg || c.def_rendues_6kg
  const tr3=c.def_traitees_3kg || c.def_rendues_3kg
  const ref12=Math.max(0,tr12-int(c.def_acceptees_12kg))
  const ref6=Math.max(0,tr6-int(c.def_acceptees_6kg))
  const ref3=Math.max(0,tr3-int(c.def_acceptees_3kg))
  const csi=casiersInfo(c)

  const fmt_dt = (dt:any) => dt ? new Date(dt).toLocaleString('fr-MA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'

  return <div className="glass-card p-5 space-y-4 overflow-auto max-h-[85vh]">
    <h3 className="text-xl font-black" style={{color:'var(--text-primary)'}}>{c.matricule} — {c.client}</h3>
    <div className="text-sm" style={{color:'var(--text-muted)'}}>Statut : <b style={{color:'var(--text-primary)'}}>{STATUT_LABELS[c.statut]||c.statut}</b></div>

    {/* Infos générales */}
    <div className="grid grid-cols-2 gap-2">
      <Read label="Client" value={c.client}/>
      <Read label="Marque" value={c.marque}/>
      <Read label="Matricule" value={c.matricule}/>
      <Read label="Chauffeur" value={c.chauffeur}/>
      <Read label="N° BC" value={c.numero_bc}/>
      <Read label="BL sortie" value={c.numero_bl_sortie}/>
    </div>

    {/* Entrée quantités */}
    <div>
      <div className="text-xs font-black uppercase mb-2" style={{color:'var(--text-muted)'}}>Entrée centre</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {['12 kg','6 kg','3 kg'].map((s,i)=>{const k=['12kg','6kg','3kg'][i]; return <div key={k}>
          <div style={{color:'#00A8E8'}}>Vide {s}: {c[`vides_${k}`]||0}</div>
          <div style={{color:'#FF6B00'}}>Déf. {s}: {c[`def_rendues_${k}`]||0}</div>
        </div>})}
      </div>
    </div>

    {/* Casiers */}
    <div className="grid grid-cols-4 gap-2">
      <Read label="Casiers 12 kg" value={csi.c12}/>
      <Read label="Casiers 6 kg" value={csi.c6}/>
      <Read label="Casiers 3 kg" value={csi.c3}/>
      <Read label="Total casiers" value={csi.total}/>
    </div>

    {/* Chargement */}
    {(c.def_acceptees_12kg>0||c.def_acceptees_6kg>0||c.def_acceptees_3kg>0||c.def_refusees_12kg>0) && <div>
      <div className="text-xs font-black uppercase mb-2" style={{color:'var(--text-muted)'}}>Chargement</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div style={{color:'#00D97E'}}>Acceptées : {c.def_acceptees_12kg}/{c.def_acceptees_6kg}/{c.def_acceptees_3kg}</div>
        <div style={{color:'#FF3B3B'}}>Refusées : {c.def_refusees_12kg}/{c.def_refusees_6kg}/{c.def_refusees_3kg}</div>
      </div>
    </div>}

    {/* Dates */}
    <div className="grid grid-cols-2 gap-2">
      <Read label="Arrivée" value={fmt_dt(c.arriveeAt)}/>
      <Read label="Entrée" value={fmt_dt(c.entreeAt)}/>
      <Read label="Emplissage" value={fmt_dt(c.debutEmplissageAt)}/>
      <Read label="Fin chargement" value={fmt_dt(c.finChargementAt)}/>
      <Read label="Sortie" value={fmt_dt(c.sortieAt)}/>
      <Read label="Saisi par" value={c.createdBy}/>
      <Read label="Traité par" value={c.processedBy}/>
      <Read label="Sorti par" value={c.exitedBy}/>
    </div>

    {/* Actions EN_ATTENTE — Agent saisie uniquement */}
    {c.statut==='EN_ATTENTE' && canQueue && <>
      <div className="border-t pt-4" style={{borderColor:'var(--border-color)'}}>
        <div className="text-xs font-black uppercase mb-3" style={{color:'var(--text-muted)'}}>Modifier camion (file d'attente)</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" value={c.client} onChange={v=>up('client',v)}/>
          <Field label="Marque" value={c.marque} onChange={v=>up('marque',v)}/>
          <Field label="Chauffeur" value={c.chauffeur} onChange={v=>up('chauffeur',v)}/>
          <Field label="Matricule" value={c.matricule} onChange={v=>up('matricule',v)}/>
          <Field label="N° BC" value={c.numero_bc} onChange={v=>up('numero_bc',v)}/>
          <Field label="Date" type="date" value={c.date} onChange={v=>up('date',v)}/>
        </div>
        <QuantityBlock obj={c} setObj={setSelected as any} includeEtrangeres={false}/>
        <div className="space-y-2 mt-3">
          <button className="btn-secondary w-full" onClick={()=>act('update-attente')}>💾 Enregistrer modification</button>
          <button className="btn-primary w-full" onClick={()=>act('entrer')}>🚛 Faire entrer au centre</button>
          <Field label="Justificatif annulation obligatoire" value={motif} onChange={setMotif}/>
          <button className="w-full px-4 py-2 rounded-xl font-bold" style={{background:'rgba(255,59,59,.12)',color:'#FF3B3B'}} onClick={()=>act('annuler',{motif})}>❌ Annuler / supprimer de la file</button>
        </div>
      </div>
    </>}
    {c.statut==='EN_ATTENTE' && !canQueue && <div className="text-sm p-3 rounded-xl" style={{background:'rgba(255,255,255,.04)',color:'var(--text-muted)'}}>📋 Lecture seule — file d'attente consultable uniquement.</div>}

    {/* Actions internes — Chef équipe */}
    {['EN_COURS_TRAITEMENT','DEMARRAGE_EMPLISSAGE'].includes(c.statut) && canProcess && <>
      <div className="border-t pt-4" style={{borderColor:'var(--border-color)'}}>
        <div className="text-xs font-black uppercase mb-3" style={{color:'var(--text-muted)'}}>Correction quantités terrain (Chef d'équipe)</div>
        <div className="grid grid-cols-3 gap-3">
          {c.statut==='EN_COURS_TRAITEMENT' ? (
            <>
              <Field label="Vide 12 kg" type="number" value={c.terrain_vides_12kg} onChange={v=>up('terrain_vides_12kg',v)}/>
              <Field label="Vide 6 kg" type="number" value={c.terrain_vides_6kg} onChange={v=>up('terrain_vides_6kg',v)}/>
              <Field label="Vide 3 kg" type="number" value={c.terrain_vides_3kg} onChange={v=>up('terrain_vides_3kg',v)}/>
              <Field label="Défect. 12 kg" type="number" value={c.def_rendues_12kg} onChange={v=>up('def_rendues_12kg',v)}/>
              <Field label="Défect. 6 kg" type="number" value={c.def_rendues_6kg} onChange={v=>up('def_rendues_6kg',v)}/>
              <Field label="Défect. 3 kg" type="number" value={c.def_rendues_3kg} onChange={v=>up('def_rendues_3kg',v)}/>
            </>
          ) : (
            <>
              <Read label="Vide 12 kg" value={c.terrain_vides_12kg}/>
              <Read label="Vide 6 kg" value={c.terrain_vides_6kg}/>
              <Read label="Vide 3 kg" value={c.terrain_vides_3kg}/>
              <Read label="Défect. 12 kg" value={c.def_rendues_12kg}/>
              <Read label="Défect. 6 kg" value={c.def_rendues_6kg}/>
              <Read label="Défect. 3 kg" value={c.def_rendues_3kg}/>
            </>
          )}
        </div>
        {c.statut==='EN_COURS_TRAITEMENT' && <>
          <button className="btn-secondary w-full mt-2" onClick={()=>act('terrain')}>✔️ Valider / corriger quantités</button>
          <button className="btn-primary w-full mt-2" onClick={()=>act('demarrer')}>▶️ Démarrer emplissage</button>
        </>}
        {c.statut==='DEMARRAGE_EMPLISSAGE' && <div className="text-xs p-2 mt-2 rounded" style={{color:'var(--text-muted)',background:'rgba(255,255,255,.02)'}}>📋 Données de démarrage en lecture seule</div>}
      </div>
        {c.statut==='DEMARRAGE_EMPLISSAGE' && <>
          <div className="text-xs font-black uppercase mt-4 mb-2" style={{color:'var(--text-muted)'}}>Fin chargement — sortie prévue : pleines + défectueuses refusées + étrangères</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pleines chargées 12" type="number" value={c.charge_12kg} onChange={v=>up('charge_12kg',v)}/>
            <Field label="Pleines chargées 6" type="number" value={c.charge_6kg} onChange={v=>up('charge_6kg',v)}/>
            <Field label="Pleines chargées 3" type="number" value={c.charge_3kg} onChange={v=>up('charge_3kg',v)}/>
            <Read label="Traitées 12" value={tr12}/><Read label="Traitées 6" value={tr6}/><Read label="Traitées 3" value={tr3}/>
            <Field label="Acceptées 12" type="number" value={c.def_acceptees_12kg} onChange={v=>up('def_acceptees_12kg',v)}/>
            <Field label="Acceptées 6" type="number" value={c.def_acceptees_6kg} onChange={v=>up('def_acceptees_6kg',v)}/>
            <Field label="Acceptées 3" type="number" value={c.def_acceptees_3kg} onChange={v=>up('def_acceptees_3kg',v)}/>
            <Read label="Refusées 12" value={ref12}/><Read label="Refusées 6" value={ref6}/><Read label="Refusées 3" value={ref3}/>
          </div>
          <div className="mt-3 border-t pt-3" style={{borderColor:'var(--border-color)'}}>
            <div className="text-xs font-black mb-2" style={{color:'#C084FC'}}>Bouteilles étrangères détectées pendant emplissage</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Étrangère 12 kg" type="number" value={c.terrain_etr_12kg} onChange={v=>up('terrain_etr_12kg',v)}/>
              <Field label="Étrangère 6 kg" type="number" value={c.terrain_etr_6kg} onChange={v=>up('terrain_etr_6kg',v)}/>
              <Field label="Étrangère 3 kg" type="number" value={c.terrain_etr_3kg} onChange={v=>up('terrain_etr_3kg',v)}/>
            </div>
            <button className="btn-primary w-full mt-2" onClick={()=>act('terminer')}>✅ Chargement terminé</button>
          </div>
        </>}
    </>}
    {['EN_COURS_TRAITEMENT','DEMARRAGE_EMPLISSAGE'].includes(c.statut) && !canProcess && <div className="text-sm p-3 rounded-xl" style={{background:'rgba(255,255,255,.04)',color:'var(--text-muted)'}}>📋 Lecture seule — traitement interne réservé au chef d'équipe.</div>}

    {/* Sortie — Agent saisie */}
    {c.statut==='PRET_A_SORTIR' && canExit && <>
      <div className="border-t pt-4" style={{borderColor:'var(--border-color)'}}>
        <div className="text-xs font-black uppercase mb-3" style={{color:'var(--text-muted)'}}>Sortie camion</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sortie pleine 12" type="number" value={c.sortie_12kg} onChange={v=>up('sortie_12kg',v)}/>
          <Field label="Sortie pleine 6" type="number" value={c.sortie_6kg} onChange={v=>up('sortie_6kg',v)}/>
          <Field label="Sortie pleine 3" type="number" value={c.sortie_3kg} onChange={v=>up('sortie_3kg',v)}/>
          <Field label="Sortie étrangère 12" type="number" value={c.sortie_etr_12kg} onChange={v=>up('sortie_etr_12kg',v)}/>
          <Field label="Sortie étrangère 6" type="number" value={c.sortie_etr_6kg} onChange={v=>up('sortie_etr_6kg',v)}/>
          <Field label="Sortie étrangère 3" type="number" value={c.sortie_etr_3kg} onChange={v=>up('sortie_etr_3kg',v)}/>
          <Field label="Acceptées 12" type="number" value={c.def_acceptees_12kg} onChange={v=>up('def_acceptees_12kg',v)}/>
          <Field label="Acceptées 6" type="number" value={c.def_acceptees_6kg} onChange={v=>up('def_acceptees_6kg',v)}/>
          <Field label="Acceptées 3" type="number" value={c.def_acceptees_3kg} onChange={v=>up('def_acceptees_3kg',v)}/>
        </div>
        <div className="mt-2">
          <Field label="N° Bon de Livraison obligatoire" value={c.numero_bl_sortie||''} onChange={v=>up('numero_bl_sortie',v)}/>
        </div>
        <button className="btn-primary w-full mt-3" onClick={()=>act('sortir')}>🚛 Sortir camion du centre</button>
      </div>
    </>}
    {c.statut==='PRET_A_SORTIR' && !canExit && <div className="text-sm p-3 rounded-xl" style={{background:'rgba(255,255,255,.04)',color:'var(--text-muted)'}}>📋 Lecture seule — sortie réservée à l'agent de saisie/garde.</div>}
  </div>
}

function KpiDashboard({stats}:{stats:any}){
  const d=stats.day||{}
  const mc=stats.dayCounts||{}
  return <div className="space-y-5">
    <Section title="Camions" color="#DA1A1A">
      <Kpi label="Arrivés" value={mc.arrives||0}/>
      <Kpi label="En attente" value={mc.attente||0} color="#FF6B00"/>
      <Kpi label="Internes" value={mc.internes||0} color="#0066CC"/>
      <Kpi label="En emplissage" value={mc.emplissage||0} color="#00A8E8"/>
      <Kpi label="Prêts sortie" value={mc.prets||0} color="#FFAA00"/>
      <Kpi label="Sortis" value={mc.sortis||0} color="#00D97E"/>
      <Kpi label="Annulés" value={mc.annules||0} color="#64748B"/>
    </Section>
    <Section title="Bouteilles" color="#0066CC">
      <Kpi label="Entrées vides 12/6/3" value={`${d.vides12||0}/${d.vides6||0}/${d.vides3||0}`} color="#00A8E8"/>
      <Kpi label="Sorties totales" value={d.sortiesTotal||0}/><Kpi label="Sorties pleines 12/6/3" value={`${d.sorties12||0}/${d.sorties6||0}/${d.sorties3||0}`} color="#00D97E"/>
      <Kpi label="Étrangères entrées 12/6/3" value={`${d.etr12||0}/${d.etr6||0}/${d.etr3||0}`} color="#C084FC"/>
      <Kpi label="Étrangères sorties 12/6/3" value={`${d.sortEtr12||0}/${d.sortEtr6||0}/${d.sortEtr3||0}`} color="#9B59B6"/>
    </Section>
    <Section title="Défectueuses" color="#FF6B00">
      <Kpi label="Rendues 12/6/3" value={`${d.rendues12||0}/${d.rendues6||0}/${d.rendues3||0}`}/>
      <Kpi label="Acceptées 12/6/3" value={`${d.remp12||0}/${d.remp6||0}/${d.remp3||0}`} color="#00D97E"/>
      <Kpi label="Refusées 12/6/3" value={`${d.refus12||0}/${d.refus6||0}/${d.refus3||0}`} color="#FF3B3B"/>
      <Kpi label="Taux 12 kg" value={fmt(d.taux12||0,2)} unit="%"/>
      <Kpi label="Taux 6 kg" value={fmt(d.taux6||0,2)} unit="%"/>
      <Kpi label="Taux 3 kg" value={fmt(d.taux3||0,2)} unit="%"/>
      <Kpi label="Taux global" value={fmt(d.tauxGlobal||0,2)} unit="%" color="#00D97E"/>
    </Section>
    <Section title="Tonnages" color="#00D97E">
      <Kpi label="Tonnage 12 kg" value={fmt(d.tonnage12||0)} unit="T"/>
      <Kpi label="Tonnage 6 kg" value={fmt(d.tonnage6||0)} unit="T"/>
      <Kpi label="Tonnage 3 kg" value={fmt(d.tonnage3||0)} unit="T"/>
      <Kpi label="Tonnage sorti" value={fmt(d.tonnageSortiTotal||0)} unit="T" color="#00D97E"/>
    </Section>
    <Section title="Temps moyens" color="#C084FC">
      <Kpi label="Attente moy." value={fmt(d.tempsAttenteH||0,2)} unit="h"/>
      <Kpi label="Traitement moy." value={fmt(d.tempsTraitementH||0,2)} unit="h"/>
      <Kpi label="Séjour moy." value={fmt(d.tempsSejourH||0,2)} unit="h"/>
    </Section>
  </div>
}
function Section({title,children,color}:{title:string;children:any;color:string}){
  return <div><h2 className="font-black text-xl mb-3" style={{color}}>{title}</h2><div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">{children}</div></div>
}
