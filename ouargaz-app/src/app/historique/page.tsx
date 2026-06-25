'use client'
import { useState, useEffect } from 'react'

type Tab = 'jaugeage' | 'ventes' | 'stock' | 'approvisionnements'

export default function HistoriquePage() {
  const [tab, setTab] = useState<Tab>('ventes')
  const today = new Date().toISOString().split('T')[0]
  const [searchMode, setSearchMode] = useState<'single' | 'range'>('range')
  const [date, setDate] = useState(today)
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [to, setTo] = useState(today)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const start = searchMode === 'single' ? date : from
      const end = searchMode === 'single' ? date : to
      const res = await fetch(`/api/${tab === 'jaugeage' ? 'jaugeage' : tab === 'ventes' ? 'ventes' : tab === 'stock' ? 'stock' : 'approvisionnements'}?from=${start}&to=${end}`)
      const d = await res.json()
      setData(d.items || [])
    } catch { setData([]) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [tab, searchMode, date, from, to])

  const TABS: { key: Tab; label: string; color: string }[] = [
    { key: 'ventes', label: 'Ventes Clients', color: '#DA1A1A' },
    { key: 'jaugeage', label: 'Jaugeage', color: '#0066CC' },
    { key: 'stock', label: 'Stock Bouteilles', color: '#00D97E' },
    { key: 'approvisionnements', label: 'Approvisionnements', color: '#FF6B00' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          Historique <span className="gradient-text">Données</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Consultation de l'historique par période</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setSearchMode('single')}
            className="px-4 py-2 rounded-xl text-xs font-black border transition-all"
            style={{ borderColor: searchMode === 'single' ? '#DA1A1A' : 'var(--border-color)', color: searchMode === 'single' ? '#DA1A1A' : 'var(--text-secondary)', background: searchMode === 'single' ? 'rgba(218,26,26,.12)' : 'transparent' }}
          >Date précise</button>
          <button
            onClick={() => setSearchMode('range')}
            className="px-4 py-2 rounded-xl text-xs font-black border transition-all"
            style={{ borderColor: searchMode === 'range' ? '#DA1A1A' : 'var(--border-color)', color: searchMode === 'range' ? '#DA1A1A' : 'var(--text-secondary)', background: searchMode === 'range' ? 'rgba(218,26,26,.12)' : 'transparent' }}
          >Entre deux dates</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.length} enregistrement(s)</span>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          {searchMode === 'single' ? (
            <div>
              <label className="form-label">Date ciblée</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input w-44" />
            </div>
          ) : (
            <>
              <div>
                <label className="form-label">Du</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input w-44" />
              </div>
              <div>
                <label className="form-label">Au</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input w-44" />
              </div>
            </>
          )}
          <button onClick={fetchData} className="btn-primary text-sm py-2 px-4">🔍 Rechercher</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? `${t.color}18` : 'var(--bg-card)',
              color: tab === t.key ? t.color : 'var(--text-secondary)',
              border: tab === t.key ? `1px solid ${t.color}40` : '1px solid var(--border-color)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Data table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="spinner" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucun enregistrement trouvé pour cette période
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  {tab === 'ventes' && <>
                    <th>Date</th><th>Client</th><th>Marque</th><th>N° BC</th><th>N° BL</th>
                    <th>12 kg</th><th>3 kg</th><th>6 kg</th><th>Poids (kg)</th><th>Poids (T)</th>
                  </>}
                  {tab === 'jaugeage' && <>
                    <th>Date</th><th>Réservoir</th><th>Niveau (mm)</th><th>Temp (°C)</th>
                    <th>Pression (bar)</th><th>Vol. Obs. (L)</th><th>VCF</th><th>Total (T)</th><th>%</th>
                  </>}
                  {tab === 'stock' && <>
                    <th>Date</th><th>Marque</th><th>Pl.12kg</th><th>Pl.6kg</th><th>Pl.3kg</th>
                    <th>Def.12kg</th><th>Def.6kg</th><th>Def.3kg</th><th>Total (T)</th>
                  </>}
                  {tab === 'approvisionnements' && <>
                    <th>Date BR</th><th>Camion</th><th>Transporteur</th><th>Provenance</th>
                    <th>N° BL</th><th>Q_net (kg)</th><th>Q_BL (kg)</th><th>Écart (kg)</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {tab === 'ventes' && <>
                      <td className="font-mono">{String(row.date)}</td>
                      <td className="font-semibold">{String(row.client)}</td>
                      <td><span className="badge-orange">{String(row.marque)}</span></td>
                      <td>{String(row.numero_bc || '-')}</td>
                      <td>{String(row.numero_bl || '-')}</td>
                      <td>{String(row.qte_12kg)}</td><td>{String(row.qte_3kg)}</td><td>{String(row.qte_6kg)}</td>
                      <td className="font-mono">{Number(row.poids_kg).toLocaleString('fr-MA')}</td>
                      <td className="font-bold font-mono" style={{ color: '#DA1A1A' }}>{Number(row.poids_t).toFixed(3)}</td>
                    </>}
                    {tab === 'jaugeage' && <>
                      <td className="font-mono">{String(row.date)}</td>
                      <td className="font-bold" style={{ color: '#DA1A1A' }}>{String(row.reservoir)}</td>
                      <td className="font-mono">{String(row.niveau_mm)}</td>
                      <td>{String(row.temperature)}</td><td>{String(row.pression)}</td>
                      <td className="font-mono">{Number(row.volume_obs).toLocaleString('fr-MA')}</td>
                      <td className="font-mono">{Number(row.vcf).toFixed(4)}</td>
                      <td className="font-bold font-mono" style={{ color: '#DA1A1A' }}>{Number(row.tonnage_total).toFixed(3)}</td>
                      <td>{Number(row.remplissage_pct).toFixed(1)}%</td>
                    </>}
                    {tab === 'stock' && <>
                      <td className="font-mono">{String(row.date)}</td>
                      <td className="font-semibold">{String(row.marque)}</td>
                      <td>{String(row.pleines_12kg)}</td><td>{String(row.pleines_6kg)}</td><td>{String(row.pleines_3kg)}</td>
                      <td>{String(row.defectueuses_12kg)}</td><td>{String(row.defectueuses_6kg)}</td><td>{String(row.defectueuses_3kg)}</td>
                      <td className="font-bold font-mono" style={{ color: '#0066CC' }}>{Number(row.stock_cond_t).toFixed(3)}</td>
                    </>}
                    {tab === 'approvisionnements' && <>
                      <td className="font-mono">{String(row.date_br)}</td>
                      <td>{String(row.camion || '-')}</td>
                      <td>{String(row.transporteur || '-')}</td>
                      <td><span className="badge-orange">{String(row.provenance || '-')}</span></td>
                      <td>{String(row.numero_bl || '-')}</td>
                      <td className="font-mono">{Number(row.q_net).toLocaleString('fr-MA')}</td>
                      <td className="font-mono">{Number(row.q_bl).toLocaleString('fr-MA')}</td>
                      <td className="font-bold font-mono" style={{ color: Number(row.ecart) !== 0 ? '#FF6B00' : '#00D97E' }}>
                        {Number(row.ecart).toLocaleString('fr-MA')}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
