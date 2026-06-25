'use client'
import { useEffect, useState } from 'react'

type DayReport = {
  stockVrac: number; stockCond: number; stockTotal: number; stockDebut: number; stockComptable: number
  ventesJour: number; approJour: number; ecartAppro: number; boniMaliT: number; boniMaliPct: number; nbreCiternes: number
  reservoirs: Array<{ name: string; remplissage: number; tonnage: number; niveau: number; temperature: number; pression: number }>
  topClients: Array<{ client: string; marque: string; total: number }>
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="glass-card kpi-card"><div className="text-xs uppercase font-bold tracking-widest whitespace-nowrap" style={{ color:'var(--text-muted)' }}>{label}</div><div className="text-2xl font-black mt-2 whitespace-nowrap" style={{ color }}>{value}</div></div>
}

export default function RapportsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<DayReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const res = await fetch(`/api/dashboard?date=${date}`); setData(await res.json()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [date])

  const d = data
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black" style={{ color:'var(--text-primary)' }}>Rapport <span className="gradient-text">Journalier</span></h1><p className="text-sm" style={{ color:'var(--text-muted)' }}>Synthèse opérationnelle de la journée sélectionnée</p></div>
        <div className="flex gap-3"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="form-input w-40"/><button className="btn-primary text-sm px-4 py-2" onClick={load}>Actualiser</button></div>
      </div>
      {loading ? <div className="flex h-48 items-center justify-center"><div className="spinner" /></div> : d ? <>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <Card label="Stock début" value={`${(d.stockDebut||0).toFixed(3)} T`} color="#64748B" />
          <Card label="Stock VRAC" value={`${(d.stockVrac||0).toFixed(3)} T`} color="#DA1A1A" />
          <Card label="Stock conditionné" value={`${(d.stockCond||0).toFixed(3)} T`} color="#0066CC" />
          <Card label="Stock total GPL" value={`${(d.stockTotal||0).toFixed(3)} T`} color="#FF6B00" />
          <Card label="Ventes totales" value={`${(d.ventesJour||0).toFixed(3)} T`} color="#00D97E" />
          <Card label="Approvisionnement" value={`${(d.approJour||0).toFixed(3)} T`} color="#0066CC" />
          <Card label="Écart appro" value={`${(d.ecartAppro||0).toFixed(3)} T`} color="#FF6B00" />
          <Card label="Boni/Mali" value={`${(d.boniMaliT||0).toFixed(3)} T`} color={(d.boniMaliPct||0) < 3 ? '#FF3B3B' : '#00D97E'} />
          <Card label="Boni/Mali %" value={`${(d.boniMaliPct||0).toFixed(3)} %`} color={(d.boniMaliPct||0) < 3 ? '#FF3B3B' : '#00D97E'} />
          <Card label="Citernes" value={`${d.nbreCiternes||0}`} color="#FFAA00" />
          <Card label="Stock comptable" value={`${(d.stockComptable||0).toFixed(3)} T`} color="#9B59B6" />
          <Card label="Clients servis" value={`${d.topClients?.length || 0}`} color="#00D97E" />
        </div>
        <div className="glass-card p-5"><h2 className="section-title mb-4">Jaugeage réservoirs</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{(d.reservoirs||[]).map(r=><div key={r.name} className="rounded-xl border p-3" style={{ borderColor:'var(--border-color)' }}><div className="flex justify-between mb-2"><b>{r.name}</b><span className="whitespace-nowrap">{r.tonnage.toFixed(3)} T</span></div><div className="h-5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.08)' }}><div className="h-full" style={{ width:`${Math.min(100,r.remplissage)}%`, background:'linear-gradient(90deg,#0066CC,#00D97E)' }} /></div><div className="mt-2 text-xs grid grid-cols-4 gap-2" style={{ color:'var(--text-secondary)' }}><span>{r.remplissage.toFixed(1)}%</span><span>{r.niveau} mm</span><span>{r.temperature} °C</span><span>{r.pression} bar</span></div></div>)}</div></div>
      </> : <div className="glass-card p-8 text-center" style={{ color:'var(--text-muted)' }}>Aucune donnée pour cette journée</div>}
    </div>
  )
}
