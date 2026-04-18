import { NextResponse } from 'next/server'
import { getSessionUser } from '@/utils/auth/session'

export async function GET() {
  const user = await getSessionUser()
  return NextResponse.json({ user })
}
