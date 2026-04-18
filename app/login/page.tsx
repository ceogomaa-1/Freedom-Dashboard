'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'

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
    const savedEmail = window.localStorage.getItem('fd_auth_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberedEmail(savedEmail)
    }
  }, [])

  useEffect(() => {
    async function checkSession() {
      const response = await fetch('/api/auth/session', { cache: 'no-store' })
      const payload = await response.json()

      if (payload.user) {
        router.replace('/dashboard')
        return
      }

      setCheckingSession(false)
    }

    checkSession()
  }, [router])

  async function handleSetupStart(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    const response = await fetch('/api/auth/setup/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const payload = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(payload.error ?? 'Unable to start Authenticator setup.')
      if (response.status === 409) {
        setMode('login')
      }
      return
    }

    setSetupStarted(true)
    setQrCodeDataUrl(payload.qrCodeDataUrl)
    setManualEntryKey(payload.manualEntryKey)
    setCode('')
  }

  async function handleSetupVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !code.trim()) return

    setLoading(true)
    setError(null)

    const response = await fetch('/api/auth/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const payload = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(payload.error ?? 'Unable to verify that 6-digit code.')
      return
    }

    window.localStorage.setItem('fd_auth_email', email.trim().toLowerCase())
    router.replace('/dashboard')
    router.refresh()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !code.trim()) return

    setLoading(true)
    setError(null)

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const payload = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(payload.error ?? 'Authentication failed.')
      return
    }

    window.localStorage.setItem('fd_auth_email', email.trim().toLowerCase())
    router.replace('/dashboard')
    router.refresh()
  }

  function resetRememberedUser() {
    window.localStorage.removeItem('fd_auth_email')
    setRememberedEmail(null)
    setEmail('')
    setCode('')
    setMode('setup')
    setSetupStarted(false)
    setQrCodeDataUrl(null)
    setManualEntryKey(null)
    setError(null)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-freedom-gray flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-freedom-green border-t-transparent rounded-full animate-spin" />
          <p className="text-freedom-text-light text-sm font-medium">Loading secure sign-in…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-freedom-gray flex flex-col">
      {/* Top bar */}
      <header className="bg-freedom-black h-14 flex items-center px-8 shadow-lg">
        <div className="flex items-center gap-2.5">
          <FreedomLogo />
          <span className="text-white font-bold text-lg tracking-tight leading-none">
            Freedom<span className="text-freedom-green">Mobile</span>
          </span>
        </div>
      </header>
      <div className="h-0.5 bg-freedom-green" />

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-card w-full max-w-md overflow-hidden">
          {/* Green band */}
          <div className="h-1.5 bg-freedom-green w-full" />

          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-freedom-green-light rounded-2xl mb-5">
                <FreedomLogo size={36} />
              </div>
              <h1 className="text-2xl font-bold text-freedom-black leading-tight">
                {mode === 'setup' ? 'Set up Authenticator' : 'Welcome back'}
              </h1>
              <p className="text-freedom-text-light text-sm mt-2">
                {mode === 'setup'
                  ? 'Scan a QR code with Microsoft Authenticator, then confirm with a 6-digit code.'
                  : 'Sign in with your 6-digit Microsoft Authenticator code.'}
              </p>
            </div>

            {mode === 'setup' ? (
              !setupStarted ? (
                <form onSubmit={handleSetupStart} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-freedom-text mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@freedommobile.ca"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors text-sm"
                    />
                  </div>

                  {error && (
                    <ErrorBanner error={error} />
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full bg-freedom-green hover:bg-freedom-green-dark text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
                  >
                    {loading ? 'Preparing QR...' : 'Generate Authenticator QR'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null) }}
                    className="w-full text-sm font-semibold text-freedom-green hover:text-freedom-green-dark transition-colors"
                  >
                    Already set up? Use a 6-digit code instead
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSetupVerify} className="space-y-4">
                  <div className="bg-freedom-gray rounded-2xl p-4 text-center">
                    {qrCodeDataUrl && (
                      <img
                        src={qrCodeDataUrl}
                        alt="Microsoft Authenticator QR code"
                        className="mx-auto rounded-xl bg-white p-2"
                      />
                    )}
                    <p className="text-xs text-freedom-text-light mt-3">
                      Scan this once in Microsoft Authenticator.
                    </p>
                  </div>

                  {manualEntryKey && (
                    <div className="bg-freedom-green-light rounded-xl p-3">
                      <p className="text-xs font-semibold text-freedom-black mb-1">Manual setup key</p>
                      <p className="text-sm font-mono text-freedom-text break-all">{manualEntryKey}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-freedom-text mb-2">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors text-sm tracking-[0.3em] text-center"
                    />
                  </div>

                  {error && (
                    <ErrorBanner error={error} />
                  )}

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full bg-freedom-green hover:bg-freedom-green-dark text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
                  >
                    {loading ? 'Finishing setup...' : 'Finish Setup'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSetupStarted(false)
                      setQrCodeDataUrl(null)
                      setManualEntryKey(null)
                      setCode('')
                      setError(null)
                    }}
                    className="w-full text-sm font-semibold text-freedom-green hover:text-freedom-green-dark transition-colors"
                  >
                    Start over
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                {rememberedEmail ? (
                  <div className="bg-freedom-green-light rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-freedom-text-light">Signing in as</p>
                      <p className="text-sm font-semibold text-freedom-black">{rememberedEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetRememberedUser}
                      className="text-xs font-semibold text-freedom-green hover:text-freedom-green-dark transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-freedom-text mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@freedommobile.ca"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-freedom-text mb-2">
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    autoFocus={Boolean(rememberedEmail)}
                    className="w-full px-4 py-3 border-2 border-freedom-border rounded-xl focus:outline-none focus:border-freedom-green text-freedom-text placeholder-freedom-text-light transition-colors text-sm tracking-[0.3em] text-center"
                  />
                </div>

                {error && <ErrorBanner error={error} />}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || code.length !== 6}
                  className="w-full bg-freedom-green hover:bg-freedom-green-dark text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
                >
                  {loading ? 'Signing in...' : 'Sign in with Code'}
                </button>

                <p className="text-xs text-center text-freedom-text-light pt-1">
                  Open Microsoft Authenticator and enter the current 6-digit code.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setMode('setup')
                    setSetupStarted(false)
                    setQrCodeDataUrl(null)
                    setManualEntryKey(null)
                    setCode('')
                    setError(null)
                  }}
                  className="w-full text-sm font-semibold text-freedom-green hover:text-freedom-green-dark transition-colors"
                >
                  First time on this device? Set up Authenticator
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-freedom-text-light">
              Freedom Mobile Internal Dashboard &bull; Secure &amp; Private
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {error}
    </div>
  )
}

function FreedomLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00C389" />
      <path
        d="M10 12h16v4H14v4h10v4H14v8h-4V12z"
        fill="white"
      />
      <rect x="22" y="20" width="8" height="4" rx="1" fill="white" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
