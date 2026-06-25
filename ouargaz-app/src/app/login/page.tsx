'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { loginRedirect } from '@/lib/roles'

// ─── Canvas animation for background ─────────────────────
function useGPLAnimation(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Particles
    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      size: number; opacity: number; color: string
    }> = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.1,
        color: ['#DA1A1A', '#FF6B00', '#FFAA00', '#0066CC', '#00A8E8'][
          Math.floor(Math.random() * 5)
        ],
      })
    }

    // Trucks
    const trucks: Array<{ x: number; y: number; speed: number; scale: number }> = []
    for (let i = 0; i < 3; i++) {
      trucks.push({
        x: -300 - i * 500,
        y: window.innerHeight * (0.6 + i * 0.1),
        speed: 0.5 + i * 0.2,
        scale: 0.5 + i * 0.1,
      })
    }

    // Reservoirs
    const reservoirs = [
      { x: 0.1, y: 0.45, r: 50 },
      { x: 0.25, y: 0.5, r: 60 },
      { x: 0.75, y: 0.48, r: 55 },
      { x: 0.88, y: 0.44, r: 48 },
    ]

    function drawReservoir(x: number, y: number, r: number, fill: number) {
      // Sphere body
      const grad = ctx!.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
      grad.addColorStop(0, 'rgba(80,120,180,0.25)')
      grad.addColorStop(0.5, 'rgba(40,70,130,0.15)')
      grad.addColorStop(1, 'rgba(10,20,60,0.1)')
      ctx!.beginPath()
      ctx!.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2)
      ctx!.fillStyle = grad
      ctx!.fill()
      ctx!.strokeStyle = 'rgba(0,102,204,0.2)'
      ctx!.lineWidth = 1
      ctx!.stroke()

      // Fill level indicator
      const fillH = r * 0.65 * fill
      ctx!.beginPath()
      ctx!.ellipse(x, y + r * 0.65 - fillH, r * 0.95, r * 0.25, 0, 0, Math.PI)
      ctx!.fillStyle = `rgba(218,26,26,${0.1 + fill * 0.1})`
      ctx!.fill()

      // Legs
      ctx!.strokeStyle = 'rgba(0,102,204,0.15)'
      ctx!.lineWidth = 2
      for (let i = -1; i <= 1; i += 2) {
        ctx!.beginPath()
        ctx!.moveTo(x + i * r * 0.6, y + r * 0.5)
        ctx!.lineTo(x + i * r * 0.7, y + r * 1.3)
        ctx!.stroke()
      }
    }

    function drawTruck(x: number, y: number, scale: number) {
      ctx!.save()
      ctx!.translate(x, y)
      ctx!.scale(scale, scale)
      ctx!.strokeStyle = 'rgba(255,107,0,0.2)'
      ctx!.fillStyle = 'rgba(255,107,0,0.05)'
      ctx!.lineWidth = 1.5
      // Cab
      ctx!.beginPath()
      ctx!.roundRect(-20, -30, 50, 30, 4)
      ctx!.fill()
      ctx!.stroke()
      // Tank
      ctx!.beginPath()
      ctx!.roundRect(30, -25, 120, 25, 6)
      ctx!.fill()
      ctx!.stroke()
      // Wheels
      ;[0, 90, 120].forEach(wx => {
        ctx!.beginPath()
        ctx!.arc(wx, 8, 10, 0, Math.PI * 2)
        ctx!.fillStyle = 'rgba(100,100,120,0.1)'
        ctx!.fill()
        ctx!.stroke()
      })
      ctx!.restore()
    }

    // KPI counters
    const kpis = [
      { label: 'STOCK VRAC', val: 235, unit: 'T', x: 0.15, y: 0.2 },
      { label: 'VENTES', val: 48, unit: 'T', x: 0.82, y: 0.22 },
      { label: 'BONI/MALI', val: 0.12, unit: '%', x: 0.5, y: 0.82 },
    ]
    let kpiFrame = 0

    let animId: number
    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Dark gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      bgGrad.addColorStop(0, '#05080F')
      bgGrad.addColorStop(0.5, '#0A0E1A')
      bgGrad.addColorStop(1, '#0D1424')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Grid lines
      ctx.strokeStyle = 'rgba(0,102,204,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 80) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += 80) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Ground line
      const groundY = canvas.height * 0.72
      ctx.strokeStyle = 'rgba(0,102,204,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, groundY)
      ctx.lineTo(canvas.width, groundY)
      ctx.stroke()

      // Pipe network (horizontal)
      ctx.strokeStyle = 'rgba(0,102,204,0.1)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, groundY - 20)
      ctx.lineTo(canvas.width, groundY - 20)
      ctx.stroke()

      // Reservoirs
      reservoirs.forEach((r, i) => {
        const fillLevel = 0.5 + 0.15 * Math.sin(kpiFrame * 0.005 + i)
        drawReservoir(r.x * canvas.width, r.y * canvas.height, r.r, fillLevel)
        // Connecting pipes
        ctx.strokeStyle = 'rgba(0,102,204,0.08)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(r.x * canvas.width, r.y * canvas.height + r.r * 1.3)
        ctx.lineTo(r.x * canvas.width, groundY - 20)
        ctx.stroke()
      })

      // Trucks
      trucks.forEach(t => {
        t.x += t.speed
        if (t.x > canvas.width + 200) t.x = -350
        drawTruck(t.x, t.y, t.scale)
      })

      // KPI overlays
      kpiFrame++
      kpis.forEach(kpi => {
        const pulse = Math.abs(Math.sin(kpiFrame * 0.02 + kpi.x * 10)) * 0.2
        ctx.fillStyle = `rgba(218,26,26,${0.04 + pulse * 0.05})`
        ctx.strokeStyle = `rgba(218,26,26,${0.08 + pulse * 0.08})`
        ctx.lineWidth = 1
        const bx = kpi.x * canvas.width - 55
        const by = kpi.y * canvas.height - 22
        ctx.beginPath()
        ctx.roundRect(bx, by, 110, 44, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = `rgba(148,163,184,0.6)`
        ctx.font = '9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(kpi.label, kpi.x * canvas.width, kpi.y * canvas.height - 6)
        const dispVal = kpiFrame % 120 < 60
          ? kpi.val.toFixed(2)
          : (kpi.val * (0.98 + Math.random() * 0.04)).toFixed(2)
        ctx.fillStyle = `rgba(218,26,26,${0.6 + pulse * 0.4})`
        ctx.font = 'bold 14px Inter, sans-serif'
        ctx.fillText(`${dispVal} ${kpi.unit}`, kpi.x * canvas.width, kpi.y * canvas.height + 10)
      })

      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })

      // Vignette
      const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.height
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      animId = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])
}

// ─── Main Login Component ─────────────────────────────────
type ThemeMode = 'dark' | 'light'

function PremiumThemeSwitch({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="premium-theme-toggle login-theme-toggle"
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
    >
      <span className="toggle-sun">☀️</span>
      <span className="toggle-moon">🌙</span>
      <span className="toggle-knob" style={{ transform: dark ? 'translateX(38px)' : 'translateX(2px)' }} />
    </button>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useGPLAnimation(canvasRef)

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as ThemeMode | null) || 'dark'
    setTheme(saved)
    document.documentElement.classList.toggle('dark', saved === 'dark')
  }, [])

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.add('theme-cinematic')
    document.documentElement.classList.toggle('dark', next === 'dark')
    setTimeout(() => document.documentElement.classList.remove('theme-cinematic'), 1200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects')
      } else {
        router.push(loginRedirect(data.user?.role || ''))
        router.refresh()
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  const dark = theme === 'dark'

  return (
    <div className={`relative min-h-screen overflow-hidden flex items-center justify-center login-page ${dark ? 'login-dark' : 'login-light'}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="login-mode-overlay" />
      <div className="absolute top-5 right-5 z-20">
        <PremiumThemeSwitch dark={dark} onToggle={toggleTheme} />
      </div>

      <div className="login-industrial-scene" aria-hidden="true">
        <div className="pipe pipe-top"><span /></div>
        <div className="pipe pipe-bottom"><span /></div>
        <div className="vertical-tank-mini tank-a"><span /></div>
        <div className="vertical-tank-mini tank-b"><span /></div>
        <div className="bottle-line"><i /><i /><i /><i /><i /><i /></div>
        <div className="conditioned-truck"><span className="truck-cab" /><span className="truck-bed"><b /><b /><b /><b /></span></div>
        <div className="bulk-truck"><span className="truck-cab" /><span className="tank-trailer" /></div>
      </div>

      <div className="relative z-10 w-full max-w-[460px] mx-4">
        <div className="text-center mb-7">
          <div className="flex justify-center mb-5">
            <div className="te-logo-shell">
              <img src="/images/totalenergies-logo.png" alt="TotalEnergies" className="te-logo-img" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: dark ? '#fff' : '#0F172A' }}>
            OUARGAZ APP
          </h1>
          <p className="text-sm font-semibold tracking-widest uppercase" style={{ color: dark ? '#94A3B8' : '#475569' }}>
            Centre Emplisseur GPL
          </p>
          <p className="text-xs mt-1" style={{ color: dark ? '#64748B' : '#64748B' }}>TotalEnergies Marketing Maroc</p>
        </div>

        <div className="login-card-premium">
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #DA1A1A, #FF6B00, #FFAA00, #0066CC)' }} />
          <div className="p-8">
            <h2 className="text-lg font-black mb-1" style={{ color: 'var(--login-text)' }}>Connexion sécurisée</h2>
            <p className="text-xs mb-6" style={{ color: 'var(--login-muted)' }}>Plateforme industrielle GPL — accès réservé</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="login-label">Identifiant</label>
                <div className="login-field-wrap">
                  <div className="login-field-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="login-input"
                    placeholder="Saisir votre identifiant"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="login-label">Mot de passe</label>
                <div className="login-field-wrap">
                  <div className="login-field-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="login-input login-input-password"
                    placeholder="Saisir votre mot de passe"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="login-eye-btn"
                    aria-label={showPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPass ? 'Masquer' : 'Voir'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.25)', color: '#FF3B3B' }}>
                  <span>⚠️</span>{error}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-submit-btn">
                {loading ? <><div className="spinner" style={{ borderTopColor: 'white' }} />Connexion en cours...</> : <>Accéder à la plateforme</>}
              </button>
            </form>

            <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--login-separator)' }}>
              <p className="text-xs" style={{ color: 'var(--login-muted)' }}>Accès réservé au personnel autorisé du Centre Emplisseur OUARGAZ.</p>
            </div>
          </div>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: dark ? '#64748B' : '#64748B' }}>
          © 2026 OUARGAZ S.A — TotalEnergies Marketing Maroc
        </p>
      </div>
    </div>
  )
}
