import { createHmac, randomBytes } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6

function encodeBase32(buffer: Buffer) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function decodeBase32(secret: string) {
  const normalized = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Invalid base32 secret.')
    }

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

function generateTotpAt(secret: string, counter: number) {
  const key = decodeBase32(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac('sha1', key).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

export function normalizeOtp(token: string) {
  return token.replace(/\s+/g, '').replace(/-/g, '')
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20))
}

export function formatManualEntryKey(secret: string) {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret
}

export function buildOtpAuthUri(email: string, secret: string) {
  const issuer = 'Freedom Dashboard'
  const label = `${issuer}:${email}`

  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
}

export function verifyTotpToken(secret: string, token: string, window = 1) {
  const normalizedToken = normalizeOtp(token)

  if (!/^\d{6}$/.test(normalizedToken)) {
    return false
  }

  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS)

  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotpAt(secret, currentCounter + offset) === normalizedToken) {
      return true
    }
  }

  return false
}
