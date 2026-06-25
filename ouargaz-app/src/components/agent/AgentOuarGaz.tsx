'use client'
import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X, Sparkles, Database, Minimize2 } from 'lucide-react'

type Msg = { role: 'user' | 'agent'; text: string; data?: Array<{ label: string; value: string | number }> }

const suggestions = [
  'combien de clients à OUARGAZ ?',
  'liste des clients',
  'combien de marques ?',
  'quelles sont les provenances ?',
  'seuil VRAC',
  'ventes du mois',
  'top clients du mois',
  'jaugeage C1 aujourd’hui',
  'approvisionnement par provenance ce mois',
]

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function AgentOuarGaz() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'agent', text: 'Bonjour, je suis Agent OUARGAZ. Je réponds avec les référentiels, les seuils et les données enregistrées. Je n’invente jamais de chiffres.' }
  ])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  async function ask(q?: string) {
    const value = (q || question).trim()
    if (!value || loading) return
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: value }])
    setLoading(true)
    try {
      const res = await fetch('/api/agent-ouargaz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: value, selectedDate })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'agent', text: data.answer || 'Donnée non disponible.', data: data.data || [] }])
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Donnée non disponible : impossible de joindre Agent OUARGAZ.' }])
    } finally { setLoading(false) }
  }

  return (
    <>
      <button className="agent-fab" onClick={() => setOpen(true)} aria-label="Ouvrir Agent OUARGAZ">
        <span className="agent-fab-glow" />
        <Bot size={24} />
        <span className="hidden sm:inline">Agent OUARGAZ</span>
      </button>
      {open && (
        <div className="agent-panel">
          <div className="agent-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="agent-avatar"><Sparkles size={18} /></div>
              <div className="min-w-0">
                <div className="font-black truncate">Agent OUARGAZ</div>
                <div className="text-xs opacity-70 flex items-center gap-1"><Database size={12} /> Référentiels + base de données</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="agent-icon-btn" onClick={() => setOpen(false)} title="Réduire"><Minimize2 size={16} /></button>
              <button className="agent-icon-btn" onClick={() => setOpen(false)} title="Fermer"><X size={16} /></button>
            </div>
          </div>
          <div className="agent-date-row">
            <span>Date par défaut</span>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div ref={boxRef} className="agent-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`agent-msg ${m.role === 'user' ? 'user' : 'agent'}`}>
                <div className="agent-msg-text">{m.text}</div>
                {m.data && m.data.length > 0 && (
                  <div className="agent-data-grid">
                    {m.data.map((d, i) => <div key={i} className="agent-data"><span>{d.label}</span><b>{d.value}</b></div>)}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="agent-msg agent"><div className="agent-typing"><span /><span /><span /></div></div>}
          </div>
          <div className="agent-suggestions">
            {suggestions.map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}
          </div>
          <form className="agent-input-row" onSubmit={e => { e.preventDefault(); ask() }}>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex : combien a réalisé ABOUDRAR en juin 2026 ?" />
            <button disabled={loading || !question.trim()}><Send size={18} /></button>
          </form>
        </div>
      )}
    </>
  )
}
