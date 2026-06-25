'use client'
import { useState } from 'react'

const EXPORTS = [
  { key: 'rapport_journalier', label: 'Rapport Journalier', icon: '📋', desc: 'Rapport complet d\'une journée', daily: true },
  { key: 'approvisionnements', label: 'Approvisionnements', icon: '🚛', desc: 'Citernes VRAC du mois', daily: false },
  { key: 'vente_afriquia', label: 'Vente AFRIQUIA GAZ', icon: '⛽', desc: 'Ventes dépositaires Afriquia', daily: false },
  { key: 'vente_tissir', label: 'Vente TISSIR', icon: '⛽', desc: 'Ventes dépositaires Tissir', daily: false },
  { key: 'vente_vivo', label: 'Vente VIVO ENERGY', icon: '⛽', desc: 'Suivi enlèvements Bouhalba', daily: false },
  { key: 'vente_te_dimagaz', label: 'Vente TE & Dimagaz', icon: '⛽', desc: 'TotalEnergies + Dimagaz', daily: false },
  { key: 'suivi_dimagaz', label: 'Suivi DIMAGAZ', icon: '🧾', desc: 'Suivi séparé des ventes Dimagaz', daily: false },
  { key: 'stock_ventes', label: 'Stock et Ventes', icon: '📊', desc: 'Stock VRAC, ventes et citernes', daily: false },
  { key: 'recap', label: 'Récap Mensuelle', icon: '📈', desc: 'B/M, emplissage, ventes, stocks', daily: false },
  { key: 'zip', label: 'Export ZIP Complet', icon: '📦', desc: 'Tous les fichiers du mois en ZIP', daily: false },
]

export default function ExportsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: string) => {
    setLoading(type)
    try {
      const param = type === 'rapport_journalier' ? `date=${date}` : `date=${yearMonth}-01`
      const res = await fetch(`/api/exports?type=${type}&${param}`)
      if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        let message = `Erreur HTTP ${res.status}`
        try {
          if (contentType.includes('application/json')) {
            const d = await res.json()
            message = d.error || message
          } else {
            message = await res.text()
          }
        } catch {}
        alert(`Erreur: ${message}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') || ''
      const fname = cd.match(/filename="(.+)"/)?.[1] || `export_${type}.xlsx`
      a.download = fname
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Erreur réseau: ${e}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          Exports <span className="gradient-text">Excel</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Génération des fichiers Excel officiels OUARGAZ
        </p>
      </div>

      {/* Date pickers */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="form-label">Date (rapport journalier)</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input w-44" />
        </div>
        <div>
          <label className="form-label">Mois (exports mensuels)</label>
          <input type="month" value={yearMonth} onChange={e => { setYearMonth(e.target.value); setDate(e.target.value + '-01') }}
            className="form-input w-44" />
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          ℹ️ Les exports utilisent les canevas officiels OUARGAZ S.A
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPORTS.map(exp => (
          <div key={exp.key} className="glass-card p-5 flex flex-col gap-4 hover:scale-[1.01] transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{exp.icon}</span>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{exp.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{exp.desc}</div>
                {exp.key === 'zip' && (
                  <div className="mt-1">
                    <span className="badge-orange text-xs">Fichier ZIP</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {exp.daily ? `Date : ${date}` : `Mois : ${yearMonth}`}
              </div>
              <button
                onClick={() => handleExport(exp.key)}
                disabled={loading === exp.key}
                className="btn-primary text-xs py-2 px-4"
                style={exp.key === 'zip' ? { background: 'linear-gradient(135deg, #0066CC, #0088FF)' } : {}}
              >
                {loading === exp.key ? (
                  <><span className="spinner" /> Génération...</>
                ) : (
                  <><span>⤓</span> Télécharger</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 text-xs" style={{ color: 'var(--text-muted)', borderColor: 'rgba(255,170,0,0.2)', background: 'rgba(255,170,0,0.04)' }}>
        <strong style={{ color: '#FFAA00' }}>⚠️ Important :</strong> Les exports utilisent les canevas Excel officiels.
        Les formules Excel existantes sont préservées. Seules les cellules de données sont remplies.
      </div>
    </div>
  )
}
