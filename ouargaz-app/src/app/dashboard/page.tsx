'use client'
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface DashboardData {
  stockVrac: number; stockCond: number; stockTotal: number; stockDebut: number; stockComptable: number
  ventesJour: number; ventesMois: number; approJour: number; approMois: number; nbreCiternes: number; ecartAppro: number
  boniMaliKg: number; boniMaliT: number; boniMaliPct: number; emplissageJour: number; autonomieJours: number
  tauxRemplissageMoyen: number
  reservoirPlusPlein?: { name: string; remplissage: number; tonnage: number } | null
  reservoirPlusBas?: { name: string; remplissage: number; tonnage: number } | null
  meilleurClientJour?: { client: string; marque: string; total: number } | null
  reservoirs: Array<{ name: string; remplissage: number; tonnage: number; niveau: number; temperature: number; pression: number }>
  ventesChart: Array<{ date: string; ventes: number }>
  stockVracChart: Array<{ date: string; stock: number }>
  topClients: Array<{ client: string; marque: string; total: number }>
  ventesParMarque: Array<{ marque: string; total: number }>
  lastUpdate: string
}

const COLORS: Record<string, string> = {
  'TOTAL GAZ': '#DA1A1A', 'AFRIQUIA GAZ': '#FF6B00', 'VIVO ENERGY': '#FFAA00',
  TISSIR: '#0066CC', SAADA: '#00D97E', DIMAGAZ: '#9B59B6',
}

const KPI_OPTIONS = [
  'stockVrac','stockCond','stockTotal','autonomie','ventesJour','ventesMois','approJour','approMois','citernes','ecartAppro','boniKg','boniPct','stockDebut','stockComptable','tauxRemplissage','reservoirsExtremes','meilleurClient'
]

const KPI_LABELS: Record<string, string> = {
  stockVrac: 'Stock VRAC', stockCond: 'Stock conditionné', stockTotal: 'Stock GPL total', autonomie: 'Autonomie',
  ventesJour: 'Ventes du jour', ventesMois: 'Ventes du mois', approJour: 'Appro. jour', approMois: 'Appro. mois',
  citernes: 'Citernes reçues', ecartAppro: 'Écart appro.', boniKg: 'Boni/Mali kg', boniPct: 'Boni/Mali %',
  stockDebut: 'Stock début', stockComptable: 'Stock comptable', tauxRemplissage: 'Taux remplissage', reservoirsExtremes: 'Réservoirs extrêmes', meilleurClient: 'Meilleur client'
}

const KPI_GROUPS = [
  { title: 'Stock', color: '#0066CC', items: ['stockVrac','stockCond','stockTotal','autonomie','stockDebut','stockComptable','tauxRemplissage','reservoirsExtremes'] },
  { title: 'Ventes', color: '#DA1A1A', items: ['ventesJour','ventesMois','meilleurClient'] },
  { title: 'Approvisionnement', color: '#FF6B00', items: ['approJour','approMois','citernes','ecartAppro'] },
  { title: 'Boni / Mali', color: '#00D97E', items: ['boniKg','boniPct'] },
]

function oneLine(value: number | string, unit?: string) {
  return <span className="whitespace-nowrap">{typeof value === 'number' ? value.toLocaleString('fr-MA', { maximumFractionDigits: 3 }) : value}{unit ? ` ${unit}` : ''}</span>
}

function KpiCard({ id, visible, label, value, unit, color, sub, alert }: { id: string; visible: boolean; label: string; value: number | string; unit?: string; color: string; sub?: string; alert?: boolean }) {
  if (!visible) return null
  return (
    <div className={`glass-card kpi-card relative overflow-hidden ${alert ? 'alert-pulse' : ''}`} style={{ borderColor: alert ? `${color}88` : undefined }}>
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="text-xs font-bold uppercase tracking-widest mb-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl md:text-3xl font-black whitespace-nowrap" style={{ color }}>{oneLine(value, unit)}</div>
      {sub && <div className="text-xs mt-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function ReservoirVertical({ r }: { r: DashboardData['reservoirs'][number] }) {
  const color = r.remplissage < 25 ? '#FF3B3B' : r.remplissage < 50 ? '#FF6B00' : r.remplissage > 85 ? '#FFAA00' : '#0066CC'
  const safePct = Math.min(100, Math.max(0, r.remplissage || 0))
  return (
    <div className="glass-card p-4 reservoir-card-vertical">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
          <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Réservoir GPL</div>
        </div>
        <div className="text-sm font-black whitespace-nowrap" style={{ color }}>{r.remplissage.toFixed(1)}%</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="vertical-tank relative h-56 w-24 flex-shrink-0 overflow-hidden rounded-[2rem] border-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="absolute inset-0 tank-metal" />
          <div className="absolute left-0 right-0 bottom-0 transition-all duration-1000 tank-liquid" style={{ height: `${safePct}%`, background: `linear-gradient(180deg, ${color}, ${color}aa)` }}>
            <div className="liquid-wave" />
          </div>
          <div className="absolute inset-0 tank-glass" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="info-line"><span>Tonnage</span><b>{r.tonnage.toFixed(3)} T</b></div>
          <div className="info-line"><span>Niveau</span><b>{r.niveau} mm</b></div>
          <div className="info-line"><span>Température</span><b>{r.temperature} °C</b></div>
          <div className="info-line"><span>Pression</span><b>{r.pression} bar</b></div>
        </div>
      </div>
    </div>
  )
}

const tooltip = { background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F1F5F9', fontSize: 12 }

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [movementStats, setMovementStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showFilters, setShowFilters] = useState(false)
  const [visibleKpi, setVisibleKpi] = useState<string[]>(() => {
    if (typeof window === 'undefined') return KPI_OPTIONS
    return JSON.parse(localStorage.getItem('ouargaz-kpi-visible') || 'null') || KPI_OPTIONS
  })

  const fetchData = async () => {
    setLoading(true)
    try { const r = await fetch(`/api/dashboard?date=${selectedDate}`); setData(await r.json()); const m = await fetch(`/api/mouvements-camions/stats?date=${selectedDate}`); setMovementStats(await m.json()) } finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [selectedDate])
  useEffect(() => { localStorage.setItem('ouargaz-kpi-visible', JSON.stringify(visibleKpi)) }, [visibleKpi])

  const visible = (id: string) => visibleKpi.includes(id)
  const toggleKpi = (id: string) => setVisibleKpi(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  const d = data
  const boniCritical = (d?.boniMaliPct ?? 0) < 3
  const vracCritical = (d?.stockVrac ?? 0) < 50

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="spinner" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Salle de contrôle <span className="gradient-text">OUARGAZ</span></h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Supervision GPL — données du {selectedDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="form-input text-sm py-2 w-40" />
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm py-2 px-4">⚙️ KPI</button>
          <button onClick={fetchData} className="btn-primary text-sm py-2 px-4">↻ Actualiser</button>
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 md:p-8 bg-black/35 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
          <div className="kpi-filter-modal w-full max-w-[520px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Filtres KPI</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Activez ou désactivez les indicateurs par thème.</div>
              </div>
              <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setShowFilters(false)}>Fermer</button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {KPI_GROUPS.map(group => (
                <div key={group.title} className="kpi-filter-group">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: group.color }}>{group.title}</h3>
                    <button
                      className="text-[11px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => {
                        const allActive = group.items.every(visible)
                        setVisibleKpi(v => allActive ? v.filter(x => !group.items.includes(x)) : Array.from(new Set([...v, ...group.items])))
                      }}
                    >Tout {group.items.every(visible) ? 'désactiver' : 'activer'}</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(id => {
                      const active = visible(id)
                      return (
                        <button key={id} onClick={() => toggleKpi(id)} className="kpi-filter-pill" style={{ borderColor: active ? group.color : 'var(--border-color)', color: active ? group.color : 'var(--text-secondary)', background: active ? `${group.color}1A` : 'transparent' }}>
                          <span className="kpi-toggle-dot" style={{ background: active ? group.color : 'transparent', borderColor: active ? group.color : 'var(--border-color)' }} />
                          {KPI_LABELS[id] || id}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`glass-card p-4 ${vracCritical ? 'alert-pulse' : ''}`} style={{ borderColor: vracCritical ? '#FF3B3B77' : '#00D97E55' }}>
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Alerte Stock VRAC</div>
          <div className="mt-2 text-xl font-black whitespace-nowrap" style={{ color: vracCritical ? '#FF3B3B' : '#00D97E' }}>{vracCritical ? '🔴 Stock VRAC critique' : '🟢 Stock VRAC normal'} — {oneLine(d?.stockVrac ?? 0, 'T')}</div>
        </div>
        <div className={`glass-card p-4 ${boniCritical ? 'alert-pulse' : ''}`} style={{ borderColor: boniCritical ? '#FF3B3B77' : '#00D97E55' }}>
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Alerte Boni/Mali</div>
          <div className="mt-2 text-xl font-black whitespace-nowrap" style={{ color: boniCritical ? '#FF3B3B' : '#00D97E' }}>{boniCritical ? '🔴 Boni < 3%' : '🟢 Boni > 3%'} — {oneLine(d?.boniMaliPct?.toFixed(3) ?? '0.000', '%')}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard id="stockVrac" visible={visible('stockVrac')} label="Stock VRAC" value={d?.stockVrac ?? 0} unit="T" color={vracCritical ? '#FF3B3B' : '#00D97E'} alert={vracCritical} />
        <KpiCard id="stockCond" visible={visible('stockCond')} label="Stock conditionné" value={d?.stockCond ?? 0} unit="T" color="#0066CC" />
        <KpiCard id="stockTotal" visible={visible('stockTotal')} label="Stock total GPL" value={d?.stockTotal ?? 0} unit="T" color="#FF6B00" />
        <KpiCard id="autonomie" visible={visible('autonomie')} label="Autonomie" value={d?.autonomieJours ?? 0} unit="j" color="#00D97E" />
        <KpiCard id="ventesJour" visible={visible('ventesJour')} label="Ventes jour" value={d?.ventesJour ?? 0} unit="T" color="#DA1A1A" />
        <KpiCard id="ventesMois" visible={visible('ventesMois')} label="Ventes mois" value={d?.ventesMois ?? 0} unit="T" color="#DA1A1A" />
        <KpiCard id="approJour" visible={visible('approJour')} label="Appro jour" value={d?.approJour ?? 0} unit="T" color="#0066CC" />
        <KpiCard id="approMois" visible={visible('approMois')} label="Appro mois" value={d?.approMois ?? 0} unit="T" color="#0066CC" />
        <KpiCard id="citernes" visible={visible('citernes')} label="Citernes" value={d?.nbreCiternes ?? 0} color="#FFAA00" />
        <KpiCard id="ecartAppro" visible={visible('ecartAppro')} label="Écart appro" value={d?.ecartAppro ?? 0} unit="T" color="#FF6B00" />
        <KpiCard id="boniKg" visible={visible('boniKg')} label="Boni/Mali" value={d?.boniMaliKg ?? 0} unit="kg" color={boniCritical ? '#FF3B3B' : '#00D97E'} alert={boniCritical} />
        <KpiCard id="boniPct" visible={visible('boniPct')} label="Boni/Mali %" value={d?.boniMaliPct?.toFixed(3) ?? '0.000'} unit="%" color={boniCritical ? '#FF3B3B' : '#00D97E'} alert={boniCritical} />
        <KpiCard id="stockDebut" visible={visible('stockDebut')} label="Stock début" value={d?.stockDebut ?? 0} unit="T" color="#64748B" />
        <KpiCard id="stockComptable" visible={visible('stockComptable')} label="Stock comptable" value={d?.stockComptable ?? 0} unit="T" color="#64748B" />
        <KpiCard id="tauxRemplissage" visible={visible('tauxRemplissage')} label="Taux remplissage" value={d?.tauxRemplissageMoyen ?? 0} unit="%" color="#9B59B6" />
        <KpiCard id="meilleurClient" visible={visible('meilleurClient')} label="Client jour" value={d?.meilleurClientJour?.client || '-'} color="#00D97E" sub={d?.meilleurClientJour ? `${d.meilleurClientJour.total} T` : 'Aucune vente'} />
      </div>


      {movementStats && (
        <div className="space-y-4">
          <h2 className="section-title">KPI Mouvements Camions Conditionnés</h2>
          {/* Statuts camions */}
          <div className="text-xs font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Statuts camions</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
            <KpiCard id="mvt_arrives" visible={true} label="Arrivés" value={movementStats.dayCounts?.arrives ?? 0} color="#DA1A1A" />
            <KpiCard id="mvt_attente" visible={true} label="En attente" value={movementStats.dayCounts?.attente ?? 0} color="#FF6B00" />
            <KpiCard id="mvt_internes" visible={true} label="Internes" value={movementStats.dayCounts?.internes ?? 0} color="#0066CC" />
            <KpiCard id="mvt_emplissage" visible={true} label="En emplissage" value={movementStats.dayCounts?.emplissage ?? 0} color="#00A8E8" />
            <KpiCard id="mvt_prets" visible={true} label="Prêts sortie" value={movementStats.dayCounts?.prets ?? 0} color="#FFAA00" />
            <KpiCard id="mvt_sortis" visible={true} label="Sortis" value={movementStats.dayCounts?.sortis ?? 0} color="#00D97E" />
            <KpiCard id="mvt_annules" visible={true} label="Annulés" value={movementStats.dayCounts?.annules ?? 0} color="#64748B" />
          </div>
          {/* Bouteilles */}
          <div className="text-xs font-black uppercase mb-1 mt-2" style={{ color: 'var(--text-muted)' }}>Bouteilles</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard id="mvt_entrees" visible={true} label="Bouteilles entrées" value={movementStats.day?.entreesTotal ?? 0} color="#00A8E8" />
            <KpiCard id="mvt_sorties" visible={true} label="Bouteilles sorties" value={movementStats.day?.sortiesTotal ?? 0} color="#00D97E" />
            <KpiCard id="mvt_sortis12" visible={true} label="Sorties 12 kg" value={movementStats.day?.sorties12 ?? 0} color="#DA1A1A" />
            <KpiCard id="mvt_sortis6" visible={true} label="Sorties 6 kg" value={movementStats.day?.sorties6 ?? 0} color="#FF6B00" />
            <KpiCard id="mvt_sortis3" visible={true} label="Sorties 3 kg" value={movementStats.day?.sorties3 ?? 0} color="#FFAA00" />
            <KpiCard id="mvt_ecart" visible={true} label="Écart bouteilles" value={movementStats.day?.ecartBouteilles ?? 0} color={(movementStats.day?.ecartBouteilles ?? 0) < 0 ? '#FF3B3B' : '#00D97E'} />
          </div>
          {/* Étrangères */}
          <div className="text-xs font-black uppercase mb-1 mt-2" style={{ color: 'var(--text-muted)' }}>Bouteilles étrangères</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard id="mvt_etr12_in" visible={true} label="Étr. entrées 12 kg" value={movementStats.day?.etr12 ?? 0} color="#C084FC" />
            <KpiCard id="mvt_etr6_in" visible={true} label="Étr. entrées 6 kg" value={movementStats.day?.etr6 ?? 0} color="#C084FC" />
            <KpiCard id="mvt_etr3_in" visible={true} label="Étr. entrées 3 kg" value={movementStats.day?.etr3 ?? 0} color="#C084FC" />
            <KpiCard id="mvt_etr12_out" visible={true} label="Étr. sorties 12 kg" value={movementStats.day?.sortEtr12 ?? 0} color="#9B59B6" />
            <KpiCard id="mvt_etr6_out" visible={true} label="Étr. sorties 6 kg" value={movementStats.day?.sortEtr6 ?? 0} color="#9B59B6" />
            <KpiCard id="mvt_etr3_out" visible={true} label="Étr. sorties 3 kg" value={movementStats.day?.sortEtr3 ?? 0} color="#9B59B6" />
          </div>
          {/* Défectueuses */}
          <div className="text-xs font-black uppercase mb-1 mt-2" style={{ color: 'var(--text-muted)' }}>Défectueuses</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard id="mvt_def12" visible={true} label="Rendues 12 kg" value={movementStats.day?.rendues12 ?? 0} color="#FF6B00" />
            <KpiCard id="mvt_def6" visible={true} label="Rendues 6 kg" value={movementStats.day?.rendues6 ?? 0} color="#FF6B00" />
            <KpiCard id="mvt_def3" visible={true} label="Rendues 3 kg" value={movementStats.day?.rendues3 ?? 0} color="#FF6B00" />
            <KpiCard id="mvt_acc12" visible={true} label="Acceptées 12 kg" value={movementStats.day?.remp12 ?? 0} color="#00D97E" />
            <KpiCard id="mvt_acc6" visible={true} label="Acceptées 6 kg" value={movementStats.day?.remp6 ?? 0} color="#00D97E" />
            <KpiCard id="mvt_acc3" visible={true} label="Acceptées 3 kg" value={movementStats.day?.remp3 ?? 0} color="#00D97E" />
            <KpiCard id="mvt_ref12" visible={true} label="Refusées 12 kg" value={movementStats.day?.refus12 ?? 0} color="#FF3B3B" />
            <KpiCard id="mvt_ref6" visible={true} label="Refusées 6 kg" value={movementStats.day?.refus6 ?? 0} color="#FF3B3B" />
            <KpiCard id="mvt_ref3" visible={true} label="Refusées 3 kg" value={movementStats.day?.refus3 ?? 0} color="#FF3B3B" />
            <KpiCard id="mvt_taux12" visible={true} label="Taux remplac. 12" value={(movementStats.day?.taux12 ?? 0).toFixed(2)} unit="%" color="#00D97E" />
            <KpiCard id="mvt_taux6" visible={true} label="Taux remplac. 6" value={(movementStats.day?.taux6 ?? 0).toFixed(2)} unit="%" color="#00D97E" />
            <KpiCard id="mvt_taux" visible={true} label="Taux global" value={(movementStats.day?.tauxGlobal ?? 0).toFixed(2)} unit="%" color="#00D97E" />
          </div>
          {/* Tonnages & écarts */}
          <div className="text-xs font-black uppercase mb-1 mt-2" style={{ color: 'var(--text-muted)' }}>Tonnages</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard id="mvt_tonnage" visible={true} label="Tonnage sorti" value={(movementStats.day?.tonnageSortiTotal ?? 0).toFixed(3)} unit="T" color="#DA1A1A" />
            <KpiCard id="mvt_ecart_ventes" visible={true} label="Écart ventes" value={(movementStats.ecartVentesT ?? 0).toFixed(3)} unit="T" color={(movementStats.ecartVentesT ?? 0) < 0 ? '#FF3B3B' : '#00D97E'} />
          </div>
        </div>
      )}

      {d?.reservoirs?.length ? (
        <div>
          <h2 className="section-title mb-3">Réservoirs GPL verticaux</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">{d.reservoirs.map(r => <ReservoirVertical key={r.name} r={r} />)}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-5"><h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Ventes journalières</h3><ResponsiveContainer width="100%" height={240}><AreaChart data={d?.ventesChart || []}><defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DA1A1A" stopOpacity={0.35}/><stop offset="95%" stopColor="#DA1A1A" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:11 }}/><YAxis tick={{ fill:'#64748B', fontSize:11 }}/><Tooltip contentStyle={tooltip}/><Area dataKey="ventes" stroke="#DA1A1A" fill="url(#vg)" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></div>
        <div className="glass-card p-5"><h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Ventes par marque</h3><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={d?.ventesParMarque || []} dataKey="total" nameKey="marque" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>{(d?.ventesParMarque || []).map((e,i)=><Cell key={i} fill={COLORS[e.marque] || '#64748B'} />)}</Pie><Tooltip contentStyle={tooltip}/><Legend formatter={(v)=><span style={{fontSize:11,color:'var(--text-secondary)'}}>{v}</span>}/></PieChart></ResponsiveContainer></div>
        <div className="xl:col-span-3 glass-card p-5"><h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Évolution stock VRAC</h3><ResponsiveContainer width="100%" height={220}><LineChart data={d?.stockVracChart || []}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="date" tick={{ fill:'#64748B', fontSize:11 }}/><YAxis tick={{ fill:'#64748B', fontSize:11 }}/><Tooltip contentStyle={tooltip}/><Line type="monotone" dataKey="stock" stroke="#0066CC" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>
      </div>
    </div>
  )
}
