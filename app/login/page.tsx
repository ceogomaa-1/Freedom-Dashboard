'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function FreedomMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00C389" />
      <path d="M10 12h16v4H14v4h10v4H14v8h-4V12z" fill="white" />
      <rect x="22" y="20" width="8" height="4" rx="1" fill="white" />
    </svg>
  )
}

function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
  inputMode,
  className = '',
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-n-sub mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={`w-full px-3.5 py-2.5 bg-n-bg border border-n-border rounded-lg text-sm text-n-text placeholder-n-muted focus:outline-none focus:border-n-green transition-colors ${className}`}
      />
    </div>
  )
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-n-red-x border border-n-red/30 text-n-red px-3.5 py-2.5 rounded-lg text-sm">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {error}
    </div>
  )
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-xs text-n-sub hover:text-n-text transition-colors py-1"
    >
      {children}
    </button>
  )
}

function PrimaryButton({ disabled, loading, children }: { disabled?: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="w-full bg-n-green hover:bg-n-green-d text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null)
  const [setupStarted, setSetupStarted] = useState(false)
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const saved = window.localStorage.getItem('fd_auth_email')
    if (saved) { setEmail(saved); setRememberedEmail(saved) }
  }, [])

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => r.json())
      .then(p => {
        if (p.user) router.replace('/dashboard')
        else setCheckingSession(false)
      })
  }, [router])

  async function handleSetupStart(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError(null)
    const res = await fetch('/api/auth/setup/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const p = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(p.error ?? 'Unable to start setup.')
      if (res.status === 409) setMode('login')
      return
    }
    setSetupStarted(true)
    setQrCodeDataUrl(p.qrCodeDataUrl)
    setManualEntryKey(p.manualEntryKey)
    setCode('')
  }

  async function handleSetupVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !code.trim()) return
    setLoading(true); setError(null)
    const res = await fetch('/api/auth/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const p = await res.json()
    setLoading(false)
    if (!res.ok) { setError(p.error ?? 'Invalid code.'); return }
    window.localStorage.setItem('fd_auth_email', email.trim().toLowerCase())
    router.replace('/dashboard'); router.refresh()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !code.trim()) return
    setLoading(true); setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const p = await res.json()
    setLoading(false)
    if (!res.ok) { setError(p.error ?? 'Authentication failed.'); return }
    window.localStorage.setItem('fd_auth_email', email.trim().toLowerCase())
    router.replace('/dashboard'); router.refresh()
  }

  function resetUser() {
    window.localStorage.removeItem('fd_auth_email')
    setRememberedEmail(null); setEmail(''); setCode('')
    setMode('setup'); setSetupStarted(false)
    setQrCodeDataUrl(null); setManualEntryKey(null); setError(null)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-n-bg flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-n-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-n-bg flex flex-col">
      {/* Minimal top bar */}
      <header className="h-12 border-b border-n-border flex items-center px-6">
        <div className="flex items-center gap-2">
          <FreedomMark size={22} />
          <span className="text-sm font-semibold text-n-text tracking-tight">
            Freedom <span className="text-n-green">Dashboard</span>
          </span>
        </div>
      </header>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-n-surface border border-n-border rounded-xl overflow-hidden">
            {/* Green top accent */}
            <div className="h-px bg-n-green" />

            <div className="p-7">
              {/* Title block */}
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-n-text">
                  {mode === 'setup' ? 'Set up authenticator' : 'Sign in'}
                </h1>
                <p className="text-xs text-n-sub mt-1">
                  {mode === 'setup'
                    ? 'Scan the QR code with Microsoft Authenticator.'
                    : 'Enter your 6-digit code from Microsoft Authenticator.'}
                </p>
              </div>

              {/* ── Setup mode ── */}
              {mode === 'setup' ? (
                !setupStarted ? (
                  <form onSubmit={handleSetupStart} className="space-y-4">
                    <InputField
                      label="Work Email"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@freedommobile.ca"
                      required
                      autoFocus
                    />
                    {error && <ErrorBanner error={error} />}
                    <PrimaryButton loading={loading} disabled={!email.trim()}>
                      {loading ? 'Generating QR…' : 'Generate QR code'}
                    </PrimaryButton>
                    <GhostButton onClick={() => { setMode('login'); setError(null) }}>
                      Already set up? Sign in instead →
                    </GhostButton>
                  </form>
                ) : (
                  <form onSubmit={handleSetupVerify} className="space-y-4">
                    {/* QR code */}
                    <div className="flex flex-col items-center gap-3 bg-n-bg border border-n-border rounded-xl p-4">
                      {qrCodeDataUrl && (
                        <div className="bg-white rounded-lg p-2">
                          <img src={qrCodeDataUrl} alt="QR code" className="w-44 h-44 block" />
                        </div>
                      )}
                      <p className="text-xs text-n-sub text-center">
                        Scan once with <span className="text-n-text font-medium">Microsoft Authenticator</span>
                      </p>
                    </div>

                    {/* Manual key */}
                    {manualEntryKey && (
                      <div className="bg-n-raised border border-n-border rounded-lg px-3.5 py-2.5">
                        <p className="text-xs text-n-muted mb-1">Manual entry key</p>
                        <p className="text-xs font-mono text-n-sub break-all tracking-wider">{manualEntryKey}</p>
                      </div>
                    )}

                    <InputField
                      label="Confirm with 6-digit code"
                      value={code}
                      onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123 456"
                      inputMode="numeric"
                      required
                      autoFocus
                      className="tracking-[0.4em] text-center font-mono"
                    />
                    {error && <ErrorBanner error={error} />}
                    <PrimaryButton loading={loading} disabled={code.length !== 6}>
                      {loading ? 'Finishing setup…' : 'Finish setup'}
                    </PrimaryButton>
                    <GhostButton onClick={() => { setSetupStarted(false); setQrCodeDataUrl(null); setManualEntryKey(null); setCode(''); setError(null) }}>
                      ← Start over
                    </GhostButton>
                  </form>
                )
              ) : (
                /* ── Login mode ── */
                <form onSubmit={handleLogin} className="space-y-4">
                  {rememberedEmail ? (
                    <div className="flex items-center justify-between bg-n-raised border border-n-border rounded-lg px-3.5 py-2.5">
                      <div>
                        <p className="text-xs text-n-muted">Signing in as</p>
                        <p className="text-sm font-medium text-n-text">{rememberedEmail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetUser}
                        className="text-xs text-n-sub hover:text-n-green transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <InputField
                      label="Work Email"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@freedommobile.ca"
                      required
                      autoFocus
                    />
                  )}

                  <InputField
                    label="6-digit code"
                    value={code}
                    onChange={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123 456"
                    inputMode="numeric"
                    required
                    autoFocus={Boolean(rememberedEmail)}
                    className="tracking-[0.4em] text-center font-mono"
                  />

                  {error && <ErrorBanner error={error} />}

                  <PrimaryButton loading={loading} disabled={!email.trim() || code.length !== 6}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </PrimaryButton>

                  <GhostButton onClick={() => { setMode('setup'); setSetupStarted(false); setQrCodeDataUrl(null); setManualEntryKey(null); setCode(''); setError(null) }}>
                    First time? Set up Authenticator →
                  </GhostButton>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-n-muted mt-4">
            Freedom Mobile · Internal use only
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
