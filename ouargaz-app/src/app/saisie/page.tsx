'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────
type JaugeageRow = { reservoir: string; niveau_mm: string; temperature: string; pression: string }
type VenteRow = { client: string; marque: string; numero_bc: string; numero_bl: string; qte_12kg: string; qte_3kg: string; qte_6kg: string; qte_34kg: string }
type StockRow = { marque: string; pleines_12kg: string; pleines_6kg: string; pleines_3kg: string; defectueuses_12kg: string; defectueuses_6kg: string; defectueuses_3kg: string }
type ApproRow = { mois: string; quinzaine: string; camion: string; transporteur: string; numero_bc: string; date_bc: string; produit: string; provenance: string; numero_bl: string; date_bl: string; numero_br: string; date_br: string; q_net: string; q_bl: string }

const RESERVOIRS = ['C1', 'C2', 'C3', 'C4', 'C5']
const MARQUES_STOCK = ['AFRIQUIA GAZ', 'VIVO ENERGY', 'TISSIR', 'TOTAL GAZ', 'SAADA', 'DIMAGAZ']

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}>
      <span>{type === 'success' ? '✓' : '✗'}</span>
      <span>{msg}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">✕</button>
    </div>
  )
}

// ─── Jaugeage Block ───────────────────────────────────────
function JaugeageBlock({ date, readOnly, onSaved }: { date: string; readOnly: boolean; onSaved: () => void }) {
  const [rows, setRows] = useState<JaugeageRow[]>(
    RESERVOIRS.map(r => ({ reservoir: r, niveau_mm: '', temperature: '', pression: '' }))
  )
  const [results, setResults] = useState<Record<string, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const fetchExisting = useCallback(async () => {
    const res = await fetch(`/api/jaugeage?date=${date}`)
    const data = await res.json()
    if (data.items && data.items.length > 0) {
      const mapped = RESERVOIRS.map(r => {
        const found = data.items.find((i: { reservoir: string; niveau_mm: number; temperature: number; pression: number }) => i.reservoir === r)
        return found
          ? { reservoir: r, niveau_mm: String(found.niveau_mm), temperature: String(found.temperature), pression: String(found.pression) }
          : { reservoir: r, niveau_mm: '', temperature: '', pression: '' }
      })
      setRows(mapped)
      const resMap: Record<string, Record<string, number>> = {}
      data.items.forEach((i: Record<string, unknown>) => { resMap[i.reservoir as string] = i as Record<string, number> })
      setResults(resMap)
    }
  }, [date])

  useEffect(() => { fetchExisting() }, [fetchExisting])

  const handleChange = (idx: number, field: keyof JaugeageRow, val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/jaugeage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setResults(data.results || {})
      setToast({ msg: 'Jaugeage sauvegardé avec succès', type: 'success' })
      onSaved()
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <h3 className="section-title">1. Jaugeage Réservoirs</h3>
        {!readOnly && (
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2 px-4">
            {saving ? <span className="spinner" /> : '💾'} Sauvegarder
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full text-xs">
          <thead>
            <tr>
              <th>Réservoir</th>
              <th>Niveau (mm)</th>
              <th>Temp. (°C)</th>
              <th>Pression (bar)</th>
              <th>Vol. Obs. (L)</th>
              <th>VCF</th>
              <th>Masse Liq. (T)</th>
              <th>Masse Vap. (T)</th>
              <th>Total (T)</th>
              <th>Remplis. %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const r = results[row.reservoir] || {}
              const pct = r.remplissage_pct || 0
              const color = pct < 25 ? '#FF3B3B' : pct < 50 ? '#FF6B00' : '#00D97E'
              return (
                <tr key={row.reservoir}>
                  <td className="font-bold" style={{ color: '#DA1A1A' }}>{row.reservoir}</td>
                  <td>
                    <input type="number" value={row.niveau_mm} onChange={e => handleChange(idx, 'niveau_mm', e.target.value)}
                      className="form-input w-20 text-xs py-1" disabled={readOnly} min={0} max={2974} step={1} />
                  </td>
                  <td>
                    <input type="number" value={row.temperature} onChange={e => handleChange(idx, 'temperature', e.target.value)}
                      className="form-input w-20 text-xs py-1" disabled={readOnly} min={-10} max={60} step={0.1} />
                  </td>
                  <td>
                    <input type="number" value={row.pression} onChange={e => handleChange(idx, 'pression', e.target.value)}
                      className="form-input w-20 text-xs py-1" disabled={readOnly} min={0} max={20} step={0.01} />
                  </td>
                  <td className="font-mono">{r.volume_obs ? r.volume_obs.toLocaleString('fr-MA') : '-'}</td>
                  <td className="font-mono">{r.vcf ? r.vcf.toFixed(4) : '-'}</td>
                  <td className="font-mono">{r.masse_liquide_t ? r.masse_liquide_t.toFixed(3) : '-'}</td>
                  <td className="font-mono">{r.masse_vapeur_t ? r.masse_vapeur_t.toFixed(3) : '-'}</td>
                  <td className="font-bold font-mono" style={{ color: '#DA1A1A' }}>
                    {r.tonnage_total ? r.tonnage_total.toFixed(3) : '-'}
                  </td>
                  <td>
                    {pct > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-16 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: '4px' }} />
                        </div>
                        <span style={{ color, fontSize: '10px', fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {Object.keys(results).length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={8} className="font-bold text-right pr-2">TOTAL STOCK VRAC</td>
                <td className="font-black" style={{ color: '#DA1A1A' }}>
                  {Object.values(results).reduce((sum, item) => sum + (Number((item as Record<string, number>).tonnage_total) || 0), 0).toFixed(3)} T
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── Ventes Block ─────────────────────────────────────────
function VentesBlock({ date, readOnly, onSaved }: { date: string; readOnly: boolean; onSaved: () => void }) {
  const [rows, setRows] = useState<VenteRow[]>([{ client: '', marque: '', numero_bc: '', numero_bl: '', qte_12kg: '', qte_3kg: '', qte_6kg: '', qte_34kg: '' }])
  const [clients, setClients] = useState<Array<{ name: string; marque: string }>>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/referentiels/clients').then(r => r.json()).then(d => setClients(d.clients || []))
    fetch(`/api/ventes?date=${date}`).then(r => r.json()).then(d => {
      if (d.items && d.items.length > 0) {
        setRows(d.items.map((i: Record<string, unknown>) => ({
          client: i.client, marque: i.marque, numero_bc: i.numero_bc || '', numero_bl: i.numero_bl || '',
          qte_12kg: String(i.qte_12kg || 0), qte_3kg: String(i.qte_3kg || 0),
          qte_6kg: String(i.qte_6kg || 0), qte_34kg: String(i.qte_34kg || 0),
        })))
      }
    })
  }, [date])

  const handleChange = (idx: number, field: keyof VenteRow, val: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, [field]: val }
      if (field === 'client') {
        const found = clients.find(c => c.name === val)
        if (found) updated.marque = found.marque
      }
      return updated
    }))
  }

  const addRow = () => setRows(prev => [...prev, { client: '', marque: '', numero_bc: '', numero_bl: '', qte_12kg: '', qte_3kg: '', qte_6kg: '', qte_34kg: '' }])
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))

  const calcPoids = (row: VenteRow) => {
    const kg = (parseFloat(row.qte_12kg) || 0) * 12 + (parseFloat(row.qte_3kg) || 0) * 3
      + (parseFloat(row.qte_6kg) || 0) * 6 + (parseFloat(row.qte_34kg) || 0) * 34
    return { kg, t: kg / 1000 }
  }

  const totalT = rows.reduce((s, r) => s + calcPoids(r).t, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setToast({ msg: `${data.count} ligne(s) de vente sauvegardées`, type: 'success' })
      onSaved()
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title">2. Ventes Clients</h3>
          <div className="mt-1 text-sm font-semibold" style={{ color: '#DA1A1A' }}>
            Total jour : {totalT.toFixed(3)} T
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={addRow} className="btn-secondary text-xs py-2 px-3">+ Ligne</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2 px-4">
              {saving ? <span className="spinner" /> : '💾'} Sauvegarder
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table text-xs">
          <thead>
            <tr>
              <th>Client</th>
              <th>Marque</th>
              <th>N° BC</th>
              <th>N° BL</th>
              <th>12 kg</th>
              <th>3 kg</th>
              <th>6 kg</th>
              <th>34 kg</th>
              <th>Poids (kg)</th>
              <th>Poids (T)</th>
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const { kg, t } = calcPoids(row)
              return (
                <tr key={idx}>
                  <td>
                    <select value={row.client} onChange={e => handleChange(idx, 'client', e.target.value)}
                      className="form-input text-xs py-1 w-40" disabled={readOnly}>
                      <option value="">— Sélectionner —</option>
                      {clients.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="font-semibold text-xs" style={{ color: '#0066CC' }}>{row.marque || '-'}</td>
                  <td><input type="text" value={row.numero_bc} onChange={e => handleChange(idx, 'numero_bc', e.target.value)} className="form-input w-24 text-xs py-1" disabled={readOnly} /></td>
                  <td><input type="text" value={row.numero_bl} onChange={e => handleChange(idx, 'numero_bl', e.target.value)} className="form-input w-24 text-xs py-1" disabled={readOnly} /></td>
                  {(['qte_12kg', 'qte_3kg', 'qte_6kg', 'qte_34kg'] as (keyof VenteRow)[]).map(f => (
                    <td key={f}><input type="number" value={row[f]} onChange={e => handleChange(idx, f, e.target.value)} className="form-input w-16 text-xs py-1" disabled={readOnly} min={0} /></td>
                  ))}
                  <td className="font-mono font-semibold" style={{ color: '#DA1A1A' }}>{kg > 0 ? kg.toLocaleString('fr-MA') : '-'}</td>
                  <td className="font-mono font-bold" style={{ color: '#DA1A1A' }}>{t > 0 ? t.toFixed(3) : '-'}</td>
                  {!readOnly && (
                    <td>
                      <button onClick={() => removeRow(idx)} className="text-red-500 hover:text-red-700 text-sm px-1">×</button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-color)' }}>
              <td colSpan={8} className="font-bold text-right pr-2">TOTAL</td>
              <td className="font-bold font-mono" style={{ color: '#DA1A1A' }}>
                {rows.reduce((s, r) => s + calcPoids(r).kg, 0).toLocaleString('fr-MA')} kg
              </td>
              <td className="font-black font-mono" style={{ color: '#DA1A1A' }}>
                {totalT.toFixed(3)} T
              </td>
              {!readOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Stock Bouteilles Block ───────────────────────────────
function StockBlock({ date, readOnly, onSaved }: { date: string; readOnly: boolean; onSaved: () => void }) {
  const initRows = (): StockRow[] => MARQUES_STOCK.map(m => ({
    marque: m, pleines_12kg: '0', pleines_6kg: '0', pleines_3kg: '0',
    defectueuses_12kg: '0', defectueuses_6kg: '0', defectueuses_3kg: '0',
  }))
  const [rows, setRows] = useState<StockRow[]>(initRows())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch(`/api/stock?date=${date}`).then(r => r.json()).then(d => {
      if (d.items && d.items.length > 0) {
        setRows(MARQUES_STOCK.map(m => {
          const found = d.items.find((i: Record<string, unknown>) => i.marque === m)
          return found ? {
            marque: m,
            pleines_12kg: String(found.pleines_12kg || 0), pleines_6kg: String(found.pleines_6kg || 0),
            pleines_3kg: String(found.pleines_3kg || 0), defectueuses_12kg: String(found.defectueuses_12kg || 0),
            defectueuses_6kg: String(found.defectueuses_6kg || 0), defectueuses_3kg: String(found.defectueuses_3kg || 0),
          } : initRows().find(r => r.marque === m)!
        }))
      }
    })
  }, [date])

  const calcStock = (row: StockRow) => {
    const pleines = (parseFloat(row.pleines_12kg) || 0) * 12 + (parseFloat(row.pleines_6kg) || 0) * 6 + (parseFloat(row.pleines_3kg) || 0) * 3
    const def = (parseFloat(row.defectueuses_12kg) || 0) * 10 + (parseFloat(row.defectueuses_6kg) || 0) * 5 + (parseFloat(row.defectueuses_3kg) || 0) * 2
    return { pleines, def, total: pleines + def, tonnes: (pleines + def) / 1000 }
  }

  const handleChange = (idx: number, field: keyof StockRow, val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const totalT = rows.reduce((s, r) => s + calcStock(r).tonnes, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setToast({ msg: 'Stock bouteilles sauvegardé', type: 'success' })
      onSaved()
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-5 space-y-5">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">3. Stock Bouteilles</h3>
          <div className="mt-1 text-sm font-semibold whitespace-nowrap" style={{ color: '#0066CC' }}>
            Total conditionné : {totalT.toFixed(3)} T
          </div>
        </div>
        {!readOnly && (
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2 px-4">
            {saving ? <span className="spinner" /> : '💾'} Sauvegarder
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(0,217,126,.28)', background: 'rgba(0,217,126,.045)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: '#00D97E' }}>Bouteilles pleines</h4>
            <span className="badge-green whitespace-nowrap">Stock vendable</span>
          </div>
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const { pleines } = calcStock(row)
              return (
                <div key={`pleines-${row.marque}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_repeat(3,90px)_110px] gap-2 items-end rounded-xl p-3" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid var(--border-color)' }}>
                  <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{row.marque}</div>
                  {(['pleines_12kg','pleines_6kg','pleines_3kg'] as (keyof StockRow)[]).map((f, i) => (
                    <label key={f} className="block">
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{i === 0 ? '12 kg' : i === 1 ? '6 kg' : '3 kg'}</span>
                      <input type="number" value={row[f]} onChange={e => handleChange(idx, f, e.target.value)} className="form-input text-xs py-1.5" disabled={readOnly} min={0} />
                    </label>
                  ))}
                  <div className="font-black text-sm whitespace-nowrap" style={{ color: '#00D97E' }}>{(pleines / 1000).toFixed(3)} T</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,107,0,.30)', background: 'rgba(255,107,0,.045)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: '#FF6B00' }}>Bouteilles défectueuses à vider</h4>
            <span className="badge-orange whitespace-nowrap">Stock à traiter</span>
          </div>
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const { def, tonnes } = calcStock(row)
              return (
                <div key={`def-${row.marque}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_repeat(3,90px)_110px] gap-2 items-end rounded-xl p-3" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid var(--border-color)' }}>
                  <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{row.marque}</div>
                  {(['defectueuses_12kg','defectueuses_6kg','defectueuses_3kg'] as (keyof StockRow)[]).map((f, i) => (
                    <label key={f} className="block">
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{i === 0 ? '12 kg' : i === 1 ? '6 kg' : '3 kg'}</span>
                      <input type="number" value={row[f]} onChange={e => handleChange(idx, f, e.target.value)} className="form-input text-xs py-1.5" disabled={readOnly} min={0} />
                    </label>
                  ))}
                  <div className="font-black text-sm whitespace-nowrap" style={{ color: '#FF6B00' }}>{(def / 1000).toFixed(3)} T</div>
                  <div className="md:col-span-5 text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Total marque pleines + défectueuses : <b style={{ color: '#0066CC' }}>{tonnes.toFixed(3)} T</b></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
// ─── Approvisionnement Block ──────────────────────────────
function ApproBlock({ date, readOnly, onSaved }: { date: string; readOnly: boolean; onSaved: () => void }) {
  const [rows, setRows] = useState<ApproRow[]>([{
    mois: date.slice(0, 7), quinzaine: '1', camion: '', transporteur: '', numero_bc: '', date_bc: date,
    produit: 'Butane', provenance: '', numero_bl: '', date_bl: date, numero_br: '', date_br: date, q_net: '', q_bl: '',
  }])
  const [transporteurs, setTransporteurs] = useState<string[]>([])
  const [provenances, setProvenances] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/referentiels/transporteurs').then(r => r.json()).then(d => setTransporteurs(d.items?.map((t: { name: string }) => t.name) || []))
    fetch('/api/referentiels/provenances').then(r => r.json()).then(d => setProvenances(d.items?.map((p: { name: string }) => p.name) || []))
    fetch(`/api/approvisionnements?date=${date}`).then(r => r.json()).then(d => {
      if (d.items && d.items.length > 0) {
        setRows(d.items.map((i: Record<string, unknown>) => ({
          mois: (i.mois as string) || date.slice(0, 7), quinzaine: (i.quinzaine as string) || '1',
          camion: (i.camion as string) || '', transporteur: (i.transporteur as string) || '',
          numero_bc: (i.numero_bc as string) || '', date_bc: (i.date_bc as string) || date,
          produit: (i.produit as string) || 'Butane', provenance: (i.provenance as string) || '',
          numero_bl: (i.numero_bl as string) || '', date_bl: (i.date_bl as string) || date,
          numero_br: (i.numero_br as string) || '', date_br: (i.date_br as string) || date,
          q_net: String(i.q_net || ''), q_bl: String(i.q_bl || ''),
        })))
      }
    })
  }, [date])

  const handleChange = (idx: number, field: keyof ApproRow, val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const addRow = () => setRows(prev => [...prev, {
    mois: date.slice(0, 7), quinzaine: '1', camion: '', transporteur: '', numero_bc: '', date_bc: date,
    produit: 'Butane', provenance: '', numero_bl: '', date_bl: date, numero_br: '', date_br: date, q_net: '', q_bl: '',
  }])

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx))

  const calcEcart = (row: ApproRow) => (parseFloat(row.q_net) || 0) - (parseFloat(row.q_bl) || 0)
  const totalQnet = rows.reduce((s, r) => s + (parseFloat(r.q_net) || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/approvisionnements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setToast({ msg: `${data.count} citerne(s) sauvegardée(s)`, type: 'success' })
      onSaved()
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-5 space-y-5">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">4. Approvisionnements Citernes VRAC</h3>
          <div className="mt-1 text-sm font-semibold whitespace-nowrap" style={{ color: '#0066CC' }}>
            Q_net total : {totalQnet.toLocaleString('fr-MA')} kg ({(totalQnet / 1000).toFixed(3)} T) — {rows.length} citerne(s)
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={addRow} className="btn-secondary text-xs py-2 px-3">+ Citerne</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2 px-4">
              {saving ? <span className="spinner" /> : '💾'} Sauvegarder
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className="rounded-2xl border p-4 appro-card" style={{ borderColor: 'var(--border-color)', background: 'rgba(255,255,255,.035)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Citerne #{idx + 1}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold whitespace-nowrap" style={{ color: calcEcart(row) !== 0 ? '#FF6B00' : '#00D97E' }}>
                  Écart : {(calcEcart(row)).toLocaleString('fr-MA')} kg ({(calcEcart(row) / 1000).toFixed(3)} T)
                </span>
                {!readOnly && <button onClick={() => removeRow(idx)} className="text-red-500 hover:text-red-700 text-xl leading-none">×</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <label><span className="form-label">Mois</span><input type="month" value={row.mois} onChange={e => handleChange(idx, 'mois', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Quinzaine</span><select value={row.quinzaine} onChange={e => handleChange(idx, 'quinzaine', e.target.value)} className="form-input" disabled={readOnly}><option value="1">1ère quinzaine</option><option value="2">2ème quinzaine</option></select></label>
              <label><span className="form-label">Camion</span><input type="text" value={row.camion} onChange={e => handleChange(idx, 'camion', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Transporteur</span><select value={row.transporteur} onChange={e => handleChange(idx, 'transporteur', e.target.value)} className="form-input" disabled={readOnly}><option value="">Sélectionner</option>{transporteurs.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label><span className="form-label">Produit</span><input type="text" value={row.produit} onChange={e => handleChange(idx, 'produit', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">N° BC</span><input type="text" value={row.numero_bc} onChange={e => handleChange(idx, 'numero_bc', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Date BC</span><input type="date" value={row.date_bc} onChange={e => handleChange(idx, 'date_bc', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Provenance</span><select value={row.provenance} onChange={e => handleChange(idx, 'provenance', e.target.value)} className="form-input" disabled={readOnly}><option value="">Sélectionner</option>{provenances.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
              <label><span className="form-label">N° BL</span><input type="text" value={row.numero_bl} onChange={e => handleChange(idx, 'numero_bl', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Date BL</span><input type="date" value={row.date_bl} onChange={e => handleChange(idx, 'date_bl', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">N° BR</span><input type="text" value={row.numero_br} onChange={e => handleChange(idx, 'numero_br', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Date BR</span><input type="date" value={row.date_br} onChange={e => handleChange(idx, 'date_br', e.target.value)} className="form-input" disabled={readOnly} /></label>
              <label><span className="form-label">Q_net (kg)</span><input type="number" value={row.q_net} onChange={e => handleChange(idx, 'q_net', e.target.value)} className="form-input font-mono" disabled={readOnly} min={0} /></label>
              <label><span className="form-label">Q_BL (kg)</span><input type="number" value={row.q_bl} onChange={e => handleChange(idx, 'q_bl', e.target.value)} className="form-input font-mono" disabled={readOnly} min={0} /></label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function previousDate(date: string) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function StockInitialBlock({ targetDate, readOnly, onSaved }: { targetDate: string; readOnly: boolean; onSaved: () => void }) {
  const [date, setDate] = useState(previousDate(targetDate))
  const [n12, setN12] = useState('')
  const [n3, setN3] = useState('')
  const [n6, setN6] = useState('')
  const [d12, setD12] = useState('')
  const [d3, setD3] = useState('')
  const [d6, setD6] = useState('')
  const [vracKg, setVracKg] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  useEffect(() => setDate(previousDate(targetDate)), [targetDate])
  const pleinesKg = (Number(n12) || 0) * 12 + (Number(n3) || 0) * 3 + (Number(n6) || 0) * 6
  const defKg = (Number(d12) || 0) * 10 + (Number(d3) || 0) * 2 + (Number(d6) || 0) * 5
  const condKg = pleinesKg + defKg
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/stock-debut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, n12, n3, n6, defectueuses_12kg: d12, defectueuses_3kg: d3, defectueuses_6kg: d6, vracKg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setToast({ msg: 'Stock initial sauvegardé. Il sera repris comme stock début.', type: 'success' })
      onSaved()
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }
  return (
    <div className="glass-card p-5 space-y-4" style={{ borderColor: 'rgba(255,170,0,0.35)', background: 'rgba(255,170,0,0.05)' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div>
        <h3 className="section-title">Initialisation manuelle du stock début</h3>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          À utiliser uniquement au premier lancement ou si aucun stock fin précédent n'existe. Saisir le stock fin du dernier jour travaillé avant la journée sélectionnée.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <label><span className="form-label">Date stock fin précédent</span><input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" disabled={readOnly} /></label>
        <label><span className="form-label">12 kg - Nbre</span><input type="number" value={n12} onChange={e => setN12(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">03 kg - Nbre</span><input type="number" value={n3} onChange={e => setN3(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">06 kg - Nbre</span><input type="number" value={n6} onChange={e => setN6(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">Déf. 12 kg</span><input type="number" value={d12} onChange={e => setD12(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">Déf. 03 kg</span><input type="number" value={d3} onChange={e => setD3(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">Déf. 06 kg</span><input type="number" value={d6} onChange={e => setD6(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
        <label><span className="form-label">VRAC Kg</span><input type="number" value={vracKg} onChange={e => setVracKg(e.target.value)} className="form-input" disabled={readOnly} min={0} /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold whitespace-nowrap" style={{ color: '#0066CC' }}>PLEINES : {pleinesKg.toLocaleString('fr-MA')} kg — DÉFECTUEUSES : {defKg.toLocaleString('fr-MA')} kg — CONDITIONNÉ : {condKg.toLocaleString('fr-MA')} kg</div>
        {!readOnly && <button onClick={save} disabled={saving} className="btn-primary text-xs py-2 px-4">{saving ? <span className="spinner" /> : '💾'} Sauvegarder stock initial</button>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────
export default function SaisiePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<{ cloturee: boolean } | null>(null)
  const [userRole, setUserRole] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [stockDebut, setStockDebut] = useState<{ prevDate: string; disponible: boolean; vracDebutT: number; condDebutT: number; stockDebutTotalT: number } | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setUserRole(d.user?.role || ''))
  }, [])

  useEffect(() => {
    fetch(`/api/cloture?date=${date}`).then(r => r.json()).then(d => setStatus(d))
    fetch(`/api/stock-debut?date=${date}`).then(r => r.json()).then(d => setStockDebut(d)).catch(() => setStockDebut(null))
  }, [date, refreshKey])

  const isReadOnly = status?.cloturee || userRole === 'CONSULTATION'
  const handleSaved = () => setRefreshKey(k => k + 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Saisie <span className="gradient-text">Journalière</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Centre Emplisseur OUARGAZ — Rapport du jour
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="form-input text-sm py-2" style={{ width: '180px' }} />
          {status?.cloturee ? (
            <span className="badge-red">🔒 Journée clôturée</span>
          ) : (
            <span className="badge-green">✎ Saisie ouverte</span>
          )}
        </div>
      </div>

      {isReadOnly && !status?.cloturee && (
        <div className="glass-card p-4 text-sm" style={{ borderColor: 'rgba(0,102,204,0.2)', color: '#0066CC', background: 'rgba(0,102,204,0.05)' }}>
          ℹ️ Accès lecture seule — profil Consultation
        </div>
      )}

      {/* Stock début J = Stock fin J-1 (report automatique, non ressaisi) */}
      <div className="glass-card p-4" style={{ borderColor: 'rgba(0,217,126,0.2)', background: 'rgba(0,217,126,0.04)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Stock Début de Journée
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Report automatique depuis le {stockDebut?.prevDate || 'jour précédent'} (Stock Début J = Stock Fin J-1)
              </div>
            </div>
          </div>
          {stockDebut?.disponible ? (
            <div className="flex flex-wrap gap-4">
              <div className="text-center">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>VRAC</div>
                <div className="text-lg font-black" style={{ color: '#DA1A1A' }}>{stockDebut.vracDebutT.toFixed(2)} <span className="text-xs">T</span></div>
              </div>
              <div className="text-center">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Conditionné</div>
                <div className="text-lg font-black" style={{ color: '#0066CC' }}>{stockDebut.condDebutT.toFixed(2)} <span className="text-xs">T</span></div>
              </div>
              <div className="text-center">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total GPL</div>
                <div className="text-lg font-black gradient-text">{stockDebut.stockDebutTotalT.toFixed(2)} <span className="text-xs">T</span></div>
              </div>
            </div>
          ) : (
            <span className="badge-orange text-xs">Aucune donnée J-1 — premier jour ou veille non saisie</span>
          )}
        </div>
      </div>

      {!stockDebut?.disponible && (
        <StockInitialBlock targetDate={date} readOnly={!!isReadOnly} onSaved={handleSaved} />
      )}

      <JaugeageBlock date={date} readOnly={isReadOnly} onSaved={handleSaved} />
      <VentesBlock date={date} readOnly={isReadOnly} onSaved={handleSaved} />
      <StockBlock date={date} readOnly={isReadOnly} onSaved={handleSaved} />
      <ApproBlock date={date} readOnly={isReadOnly} onSaved={handleSaved} />
    </div>
  )
}
