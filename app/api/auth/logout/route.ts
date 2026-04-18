import { NextResponse } from 'next/server'
import { clearSession } from '@/utils/auth/session'

export async function POST() {
  await clearSession()
  return NextResponse.json({ ok: true })
}
