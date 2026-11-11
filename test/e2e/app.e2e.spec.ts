import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { INestApplication } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import { io, type Socket } from 'socket.io-client'
import request from 'supertest'

import { createApplication } from '../../src/app.factory'
import { SocketRegistryService } from '../../src/realtime/socket-registry.service'
import {
  HMAC_SECRET,
  JWT_SECRET,
  invitationCreatedEvent,
  signedBody,
} from '../helpers/fixtures'

const WS_PATH = '/realtime/socket.io'

let app: INestApplication
let httpServer: Server
let baseUrl: string
const sockets: Socket[] = []

function makeToken(
  id: number,
  username: string,
  options: { expiresIn?: number } = {},
): string {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      sub: String(id),
      username,
      iat: now,
      exp: now + (options.expiresIn ?? 3600),
    },
    JWT_SECRET,
    { algorithm: 'HS256' },
  )
}

function connect(
  token: string | undefined,
  options: Record<string, unknown> = {},
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      path: WS_PATH,
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 3000,
      ...options,
    })
    sockets.push(socket)
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', (error) => reject(error))
  })
}

function connectError(
  token: string | undefined,
  options: Record<string, unknown> = {},
): Promise<Error & { data?: { code?: string } }> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      path: WS_PATH,
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: 3000,
      ...options,
    })
    sockets.push(socket)
    socket.once('connect', () => reject(new Error('expected connection error')))
    socket.once('connect_error', (error) => resolve(error))
  })
}

function nextNotification(
  socket: Socket,
  timeoutMs = 3000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('notification', handler)
      reject(new Error('notification timeout'))
    }, timeoutMs)
    function handler(notification: Record<string, unknown>) {
      clearTimeout(timer)
      resolve(notification)
    }
    socket.once('notification', handler)
  })
}

function expectNoNotification(socket: Socket, waitMs = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('notification', handler)
      resolve()
    }, waitMs)
    function handler() {
      clearTimeout(timer)
      socket.off('notification', handler)
      reject(new Error('unexpected notification'))
    }
    socket.once('notification', handler)
  })
}

function postEvent(
  event: unknown,
  options: { timestamp?: number; nonce?: string; secret?: string } = {},
) {
  const signed = signedBody(event, options)
  return request(httpServer)
    .post('/internal/events')
    .set(signed.headers)
    .send(signed.raw)
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('condition timeout')
}

beforeAll(async () => {
  process.env.REALTIME_JWT_SECRET = JWT_SECRET
  process.env.REALTIME_HMAC_SECRET = HMAC_SECRET
  process.env.REALTIME_ALLOW_MISSING_ORIGIN = 'true'
  process.env.REALTIME_IDENTITY_VERIFY = 'false'
  process.env.REALTIME_EVENT_MAX_AGE_SECONDS = '300'

  const created = await createApplication()
  app = created.app
  app.useLogger(false)
  await app.listen(0, '127.0.0.1')
  const address = app.getHttpServer().address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
  httpServer = app.getHttpServer() as Server
})

afterAll(async () => {
  for (const socket of sockets) socket.disconnect()
  await app.close()
})

describe('health', () => {
  it('reports service status without secrets', async () => {
    const response = await request(httpServer).get('/health').expect(200)
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'cs2-manager-realtime',
      version: '1.0.0',
    })
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain(JWT_SECRET)
    expect(serialized).not.toContain(HMAC_SECRET)
  })
})

describe('internal events API', () => {
  it('rejects requests without HMAC headers', async () => {
    await request(httpServer)
      .post('/internal/events')
      .send(invitationCreatedEvent())
      .expect(401)
  })

  it('rejects invalid signatures and does not leak details', async () => {
    const response = await postEvent(invitationCreatedEvent(), {
      secret: 'wrong-secret-with-enough-length-000',
    }).expect(401)
    expect(response.body.message).toBe('Invalid internal signature')
  })

  it('rejects stale timestamps', async () => {
    await postEvent(invitationCreatedEvent(), {
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    }).expect(401)
  })

  it('rejects replayed nonces', async () => {
    const event = invitationCreatedEvent()
    const nonce = randomUUID()
    await postEvent(event, { nonce }).expect(200)
    await postEvent(event, { nonce }).expect(401)
  })

  it('accepts a valid event and deduplicates event_id', async () => {
    const event = invitationCreatedEvent()
    const first = await postEvent(event).expect(200)
    expect(first.body).toMatchObject({
      accepted: true,
      event_id: event.event_id,
      delivered_to: 0,
    })
    await postEvent(event).expect(409)
  })

  it('rejects unknown event types and invalid payloads', async () => {
    await postEvent({
      ...invitationCreatedEvent(),
      event_type: 'team.secret.read',
    }).expect(400)

    const event = invitationCreatedEvent()
    await postEvent({
      ...event,
      payload: { ...event.payload, extra: 'nope' },
    }).expect(400)
  })

  it('rejects malformed JSON even with a valid signature', async () => {
    const raw = '{"event_id":'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = randomUUID()
    const body = Buffer.from(raw, 'utf8')
    const { signHmac } = await import('../../src/common/hmac')
    const signature = signHmac(HMAC_SECRET, timestamp, nonce, body)
    await request(httpServer)
      .post('/internal/events')
      .set({
        'Content-Type': 'application/json',
        'X-Realtime-Timestamp': timestamp,
        'X-Realtime-Nonce': nonce,
        'X-Realtime-Signature': signature,
      })
      .send(raw)
      .expect(400)
  })
})

describe('Socket.IO authentication and rooms', () => {
  it('accepts a valid JWT and rejects invalid, expired and missing tokens', async () => {
    const valid = await connect(makeToken(7, 'alice'))
    expect(valid.connected).toBe(true)

    const invalid = await connectError(
      jwt.sign(
        { sub: '7', username: 'alice', iat: 1, exp: 2 },
        'another-secret-long-enough',
        { algorithm: 'HS256' },
      ),
    )
    expect(invalid.data?.code).toBe('AUTH_INVALID')

    const expired = await connectError(
      makeToken(7, 'alice', { expiresIn: -3600 }),
    )
    expect(expired.data?.code).toBe('AUTH_EXPIRED')

    const missing = await connectError(undefined)
    expect(missing.data?.code).toBe('AUTH_MISSING_TOKEN')
  })

  it('does not accept JWT in the query string', async () => {
    const error = await connectError(makeToken(7, 'alice'), {
      auth: {},
      query: { token: makeToken(7, 'alice') },
    })
    expect(error.data?.code).toBe('AUTH_INVALID')
  })

  it('delivers notifications only to the intended user room', async () => {
    const alice = await connect(makeToken(71, 'alice'))
    const bob = await connect(makeToken(72, 'bob'))
    const carol = await connect(makeToken(73, 'carol'))

    const forAlice = invitationCreatedEvent({
      recipients: [71],
    } as never)
    const aliceNotification = nextNotification(alice)
    const bobSilence = expectNoNotification(bob)
    const carolSilence = expectNoNotification(carol)
    await postEvent(forAlice).expect(200)
    expect(await aliceNotification).toMatchObject({
      event_id: forAlice.event_id,
      event_type: 'team.invitation.created',
      resource: { path: '/invitations' },
    })
    await Promise.all([bobSilence, carolSilence])

    const forBob = invitationCreatedEvent({ recipients: [72] } as never)
    const bobNotification = nextNotification(bob)
    const aliceSilence = expectNoNotification(alice)
    await postEvent(forBob).expect(200)
    expect(await bobNotification).toMatchObject({ event_id: forBob.event_id })
    await aliceSilence

    alice.disconnect()
    bob.disconnect()
    carol.disconnect()
  })

  it('cleans up on disconnect and accepts a secure reconnection', async () => {
    const registry = app.get(SocketRegistryService)
    const first = await connect(makeToken(81, 'dave'))
    await waitFor(() => registry.connectionsForUser(81) === 1)
    first.disconnect()
    await waitFor(() => registry.connectionsForUser(81) === 0)

    const second = await connect(makeToken(81, 'dave'))
    await waitFor(() => registry.connectionsForUser(81) === 1)
    const event = invitationCreatedEvent({ recipients: [81] } as never)
    const notification = nextNotification(second)
    await postEvent(event).expect(200)
    expect(await notification).toMatchObject({ event_id: event.event_id })
    second.disconnect()
    await waitFor(() => registry.connectionsForUser(81) === 0)
  })

  it('closes an authenticated socket when its JWT expires', async () => {
    const socket = await connect(makeToken(82, 'expiring-user', { expiresIn: 2 }))
    const reason = await new Promise<string>((resolve, reject) => {
      const disconnected = (reason: string) => { clearTimeout(timeout); resolve(reason) }
      const timeout = setTimeout(() => {
        socket.off('disconnect', disconnected)
        reject(new Error('Expired JWT kept socket active'))
      }, 3500)
      socket.once('disconnect', disconnected)
    })
    expect(reason).toBe('io server disconnect')
    await waitFor(() => app.get(SocketRegistryService).connectionsForUser(82) === 0)
  })

  it('automatically reconnects after transport loss and restores its private room', async () => {
    const socket = await connect(makeToken(83, 'reconnecting-user'), {
      reconnection: true, reconnectionDelay: 50, reconnectionAttempts: 3,
    })
    const previousId = socket.id
    const ready = new Promise<void>((resolve, reject) => {
      const connectedAgain = () => {
        if (socket.id === previousId) return
        clearTimeout(timeout)
        socket.off('session.ready', connectedAgain)
        resolve()
      }
      const timeout = setTimeout(() => {
        socket.off('session.ready', connectedAgain)
        reject(new Error('Reconnection timeout'))
      }, 3000)
      socket.on('session.ready', connectedAgain)
    })
    socket.io.engine.close()
    await ready
    expect(socket.connected).toBe(true)
    expect(socket.id).not.toBe(previousId)
    await waitFor(() => app.get(SocketRegistryService).connectionsForUser(83) === 1)

    const event = invitationCreatedEvent({ recipients: [83] } as never)
    const notification = nextNotification(socket)
    await postEvent(event).expect(200)
    expect(await notification).toMatchObject({ event_id: event.event_id })
    socket.disconnect()
  })

  it('rejects connections from a disallowed origin', async () => {
    const error = await connectError(makeToken(91, 'eve'), {
      transports: ['polling'],
      extraHeaders: { Origin: 'http://evil.example' },
    })
    expect(error).toBeInstanceOf(Error)
  })
})
