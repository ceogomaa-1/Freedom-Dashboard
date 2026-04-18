import { type NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/utils/auth/constants'

export async function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login')

  if (!hasSession && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
  ],
}
