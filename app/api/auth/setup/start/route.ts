import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { buildOtpAuthUri, formatManualEntryKey, generateTotpSecret } from '@/utils/auth/totp'
import { isValidEmail, normalizeEmail } from '@/utils/auth/email'

export async function POST(request: Request) {
  const { email } = await request.json()
  const normalizedEmail = normalizeEmail(email ?? '')

  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existingUser } = await admin
    .from('app_auth_users')
    .select('email, enrolled_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingUser?.enrolled_at) {
    return NextResponse.json(
      { error: 'This account is already set up. Enter your 6-digit code to sign in.' },
      { status: 409 }
    )
  }

  const secret = generateTotpSecret()
  const otpauthUri = buildOtpAuthUri(normalizedEmail, secret)
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
    margin: 1,
    width: 240,
  })

  if (existingUser) {
    const { error } = await admin
      .from('app_auth_users')
      .update({ totp_secret: secret, enrolled_at: null })
      .eq('email', normalizedEmail)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await admin.from('app_auth_users').insert({
      email: normalizedEmail,
      totp_secret: secret,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    email: normalizedEmail,
    qrCodeDataUrl,
    manualEntryKey: formatManualEntryKey(secret),
  })
}
