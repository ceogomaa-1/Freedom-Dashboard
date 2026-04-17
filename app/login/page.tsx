'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('Authentication failed. Please try again.')
    }
  }, [searchParams])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        router.replace('/dashboard')
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setError(null)
        router.replace('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
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
                Welcome back
              </h1>
              <p className="text-freedom-text-light text-sm mt-2">
                Sign in to your Freedom Dashboard
              </p>
            </div>

            {!sent ? (
              <form onSubmit={handleLogin} className="space-y-4">
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
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-freedom-green hover:bg-freedom-green-dark text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending magic link...
                    </span>
                  ) : (
                    'Send Magic Link'
                  )}
                </button>

                <p className="text-xs text-center text-freedom-text-light pt-1">
                  No password needed — we&apos;ll email you a secure login link.
                </p>
              </form>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-freedom-green-light rounded-2xl mb-5">
                  <svg className="w-8 h-8 text-freedom-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-freedom-black mb-2">Check your inbox!</h2>
                <p className="text-freedom-text-light text-sm">
                  Magic link sent to{' '}
                  <span className="font-semibold text-freedom-text">{email}</span>
                </p>
                <p className="text-freedom-text-light text-xs mt-2">
                  Click the link in your email to sign in. It expires in 1 hour.
                </p>
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="mt-6 text-freedom-green hover:text-freedom-green-dark text-sm font-semibold transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
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
