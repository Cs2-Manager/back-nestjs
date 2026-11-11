import { signHmac, verifyHmac } from '../../src/common/hmac'

const SECRET = 'a'.repeat(40)
const BODY = Buffer.from('{"event_id":"abc"}', 'utf8')

describe('HMAC', () => {
  it('accepts the exact body and rejects any modification', () => {
    const signature = signHmac(SECRET, '1700000000', 'nonce-1234', BODY)
    expect(
      verifyHmac(SECRET, '1700000000', 'nonce-1234', BODY, signature),
    ).toBe(true)
    expect(
      verifyHmac(
        SECRET,
        '1700000000',
        'nonce-1234',
        Buffer.from('{"event_id":"abd"}', 'utf8'),
        signature,
      ),
    ).toBe(false)
    expect(
      verifyHmac(SECRET, '1700000001', 'nonce-1234', BODY, signature),
    ).toBe(false)
    expect(
      verifyHmac(SECRET, '1700000000', 'nonce-9999', BODY, signature),
    ).toBe(false)
  })

  it('rejects malformed signatures without throwing', () => {
    expect(verifyHmac(SECRET, '1700000000', 'nonce-1234', BODY, '')).toBe(false)
    expect(verifyHmac(SECRET, '1700000000', 'nonce-1234', BODY, 'zz')).toBe(
      false,
    )
  })
})
