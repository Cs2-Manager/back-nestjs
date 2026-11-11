import { createServer, type Server as HttpServer } from 'node:http'
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
  signedBody,
  team,
  teamActivityEvent,
  user,
} from '../helpers/fixtures'

const WS_PATH = '/realtime/socket.io'

interface IdentityRecord {
  username: string
  team_id: number | null
  role: string | null
}

let app: INestApplication
let httpServer: HttpServer
let identityServer: HttpServer
let baseUrl: string
const sockets: Socket[] = []
const identities: Record<number, IdentityRecord> = {}

function makeToken(id: number, username: string): string {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { sub: String(id), username, iat: now, exp: now + 3600 },
    JWT_SECRET,
    { algorithm: 'HS256' },
  )
}

function openSocket(id: number, username: string): Socket {
  const socket = io(baseUrl, {
    path: WS_PATH,
    auth: { token: makeToken(id, username) },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 3000,
  })
  sockets.push(socket)
  return socket
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 3000)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.once('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function nextEvent<T = Record<string, unknown>>(
  socket: Socket,
  name: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, handler)
      reject(new Error(`${name} timeout`))
    }, timeoutMs)
    function handler(payload: T) {
      clearTimeout(timer)
      resolve(payload)
    }
    socket.once(name, handler)
  })
}

function expectNoEvent(socket: Socket, name: string, waitMs = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, handler)
      resolve()
    }, waitMs)
    function handler() {
      clearTimeout(timer)
      socket.off(name, handler)
      reject(new Error(`unexpected ${name}`))
    }
    socket.once(name, handler)
  })
}

function postEvent(event: unknown) {
  const signed = signedBody(event)
  return request(httpServer)
    .post('/internal/events')
    .set(signed.headers)
    .send(signed.raw)
}

async function connect(
  id: number,
  username: string,
  expectSnapshot = true,
): Promise<{
  socket: Socket
  snapshot: Record<string, unknown> | null
}> {
  const socket = openSocket(id, username)
  const snapshot = expectSnapshot
    ? nextEvent(socket, 'presence.snapshot')
    : null
  await waitForConnect(socket)
  return { socket, snapshot: snapshot ? await snapshot : null }
}

beforeAll(async () => {
  identityServer = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        const body = JSON.parse(raw) as { user_id?: number }
        const identity = body.user_id ? identities[body.user_id] : undefined
        if (!identity || !body.user_id) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            user_id: body.user_id,
            username: identity.username,
            active: true,
            team_id: identity.team_id,
            role: identity.role,
          }),
        )
      } catch {
        res.writeHead(400)
        res.end()
      }
    })
  })
  await new Promise<void>((resolve) =>
    identityServer.listen(0, '127.0.0.1', resolve),
  )
  const identityAddress = identityServer.address() as AddressInfo

  process.env.REALTIME_JWT_SECRET = JWT_SECRET
  process.env.REALTIME_HMAC_SECRET = HMAC_SECRET
  process.env.REALTIME_ALLOW_MISSING_ORIGIN = 'true'
  process.env.REALTIME_IDENTITY_VERIFY = 'true'
  process.env.REALTIME_IDENTITY_FAIL_OPEN = 'false'
  process.env.REALTIME_FLASK_IDENTITY_URL = `http://127.0.0.1:${identityAddress.port}/internal/realtime/identity`
  process.env.REALTIME_PRESENCE_GRACE_SECONDS = '0'
  process.env.REALTIME_EVENT_MAX_AGE_SECONDS = '300'

  const created = await createApplication()
  app = created.app
  app.useLogger(false)
  await app.listen(0, '127.0.0.1')
  const address = app.getHttpServer().address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
  httpServer = app.getHttpServer() as HttpServer
})

afterAll(async () => {
  for (const socket of sockets) socket.disconnect()
  await app.close()
  await new Promise<void>((resolve) => identityServer.close(() => resolve()))
})

describe('presence derived from authenticated sockets', () => {
  it('publishes snapshots and updates only inside the team room', async () => {
    identities[7] = { username: 'alice', team_id: 300, role: 'PLAYER' }
    identities[8] = { username: 'bob', team_id: 300, role: 'COACH' }
    identities[9] = { username: 'eve', team_id: 400, role: 'CAPTAIN' }

    const alice = await connect(7, 'alice')
    expect(alice.snapshot).toMatchObject({
      team_id: 300,
      members: [{ user_id: 7, username: 'alice', role: 'PLAYER' }],
    })

    const aliceUpdate = nextEvent(alice.socket, 'presence.updated')
    const bob = await connect(8, 'bob')
    expect(bob.snapshot).toMatchObject({
      team_id: 300,
      members: [
        { user_id: 7, username: 'alice', role: 'PLAYER' },
        { user_id: 8, username: 'bob', role: 'COACH' },
      ],
    })
    expect(await aliceUpdate).toMatchObject({
      team_id: 300,
      members: [
        { user_id: 7, username: 'alice', role: 'PLAYER' },
        { user_id: 8, username: 'bob', role: 'COACH' },
      ],
    })

    // Otro equipo no recibe ni produce presencia en la room de 300.
    const aliceSilence = expectNoEvent(alice.socket, 'presence.updated')
    const bobSilence = expectNoEvent(bob.socket, 'presence.updated')
    const eve = await connect(9, 'eve')
    expect(eve.snapshot).toMatchObject({
      team_id: 400,
      members: [{ user_id: 9, username: 'eve', role: 'CAPTAIN' }],
    })
    await Promise.all([aliceSilence, bobSilence])

    // Varias pestañas del mismo usuario cuentan como una sola presencia.
    const aliceTabUpdate = nextEvent(alice.socket, 'presence.updated')
    const secondTab = await connect(7, 'alice')
    expect(secondTab.snapshot).toMatchObject({
      team_id: 300,
      members: [
        { user_id: 7, username: 'alice', role: 'PLAYER' },
        { user_id: 8, username: 'bob', role: 'COACH' },
      ],
    })
    expect(await aliceTabUpdate).toMatchObject({
      members: [
        { user_id: 7, username: 'alice', role: 'PLAYER' },
        { user_id: 8, username: 'bob', role: 'COACH' },
      ],
    })

    // Al desconectarse la última pestaña de bob, desaparece de la presencia.
    const afterDisconnect = nextEvent(alice.socket, 'presence.updated')
    bob.socket.disconnect()
    expect(await afterDisconnect).toMatchObject({
      team_id: 300,
      members: [{ user_id: 7, username: 'alice', role: 'PLAYER' }],
    })

    alice.socket.disconnect()
    secondTab.socket.disconnect()
    eve.socket.disconnect()
  })
})

describe('team activity over the team room', () => {
  it('delivers role changes and removes a leaving member first', async () => {
    identities[10] = { username: 'dan', team_id: 500, role: 'PLAYER' }
    identities[11] = { username: 'fay', team_id: 500, role: 'COACH' }
    identities[12] = { username: 'gus', team_id: 600, role: 'CAPTAIN' }

    const dan = await connect(10, 'dan')
    const fay = await connect(11, 'fay')
    const gus = await connect(12, 'gus')

    const danActivity = nextEvent(dan.socket, 'team.activity')
    const fayActivity = nextEvent(fay.socket, 'team.activity')
    const gusSilence = expectNoEvent(gus.socket, 'team.activity')

    const roleChange = teamActivityEvent(
      {
        team_id: 500,
        resource_id: 900,
        recipients: [10, 11],
        actor: user(10, 'dan'),
      },
      {
        activity_id: 900,
        activity_type: 'member.role_changed',
        description: 'dan cambió el rol de fay a coach.',
        actor: user(10, 'dan'),
        team: team(500, 'Presence Team', 'PT'),
        metadata: { role: 'COACH', previous_role: 'PLAYER', user_id: 11 },
      },
    )
    await postEvent(roleChange).expect(200)

    expect(await danActivity).toMatchObject({
      event_id: roleChange.event_id,
      event_type: 'team.activity',
      team_id: 500,
      activity_type: 'member.role_changed',
    })
    expect(await fayActivity).toMatchObject({
      event_id: roleChange.event_id,
      team_id: 500,
    })
    await gusSilence

    const registry = app.get(SocketRegistryService)
    expect(registry.roleForUser(11)).toBe('COACH')

    const fayAfterLeave = nextEvent(fay.socket, 'team.activity')
    const danSilence = expectNoEvent(dan.socket, 'team.activity', 600)

    const left = teamActivityEvent(
      {
        team_id: 500,
        resource_id: 901,
        recipients: [11],
        actor: user(10, 'dan'),
      },
      {
        activity_id: 901,
        activity_type: 'member.left',
        description: 'dan abandonó el equipo.',
        actor: user(10, 'dan'),
        team: team(500, 'Presence Team', 'PT'),
        metadata: {},
      },
    )
    await postEvent(left).expect(200)

    expect(await fayAfterLeave).toMatchObject({
      event_id: left.event_id,
      activity_type: 'member.left',
    })
    await danSilence
    expect(registry.teamIdForUser(10)).toBeNull()

    dan.socket.disconnect()
    fay.socket.disconnect()
    gus.socket.disconnect()
  })

  it('adds a joining member to the room and removes an expelled member', async () => {
    identities[13] = { username: 'hana', team_id: 700, role: 'CAPTAIN' }
    identities[14] = { username: 'ivan', team_id: null, role: null }
    identities[15] = { username: 'judy', team_id: 700, role: 'PLAYER' }

    const hana = await connect(13, 'hana')
    const ivan = await connect(14, 'ivan', false)
    const judy = await connect(15, 'judy')

    const hanaJoin = nextEvent(hana.socket, 'team.activity')
    const judyJoin = nextEvent(judy.socket, 'team.activity')
    const ivanJoin = nextEvent(ivan.socket, 'team.activity')

    const joined = teamActivityEvent(
      {
        team_id: 700,
        resource_id: 910,
        recipients: [13, 14, 15],
        actor: user(14, 'ivan'),
      },
      {
        activity_id: 910,
        activity_type: 'member.joined',
        description: 'ivan se unió al equipo.',
        actor: user(14, 'ivan'),
        team: team(700, 'Join Team', 'JT'),
        metadata: { role: 'PLAYER' },
      },
    )
    await postEvent(joined).expect(200)

    expect(await hanaJoin).toMatchObject({ event_id: joined.event_id })
    expect(await judyJoin).toMatchObject({ event_id: joined.event_id })
    expect(await ivanJoin).toMatchObject({ event_id: joined.event_id })

    const registry = app.get(SocketRegistryService)
    expect(registry.teamIdForUser(14)).toBe(700)
    expect(registry.onlineMembers(700)).toEqual(
      expect.arrayContaining([
        { user_id: 13, username: 'hana', role: 'CAPTAIN' },
        { user_id: 14, username: 'ivan', role: 'PLAYER' },
        { user_id: 15, username: 'judy', role: 'PLAYER' },
      ]),
    )

    const hanaRemove = nextEvent(hana.socket, 'team.activity')
    const judyRemove = nextEvent(judy.socket, 'team.activity')
    const ivanSilence = expectNoEvent(ivan.socket, 'team.activity', 600)

    const removed = teamActivityEvent(
      {
        team_id: 700,
        resource_id: 911,
        recipients: [13, 15],
        actor: user(13, 'hana'),
      },
      {
        activity_id: 911,
        activity_type: 'member.removed',
        description: 'hana expulsó a ivan del equipo.',
        actor: user(13, 'hana'),
        team: team(700, 'Join Team', 'JT'),
        metadata: { removed_user_id: 14 },
      },
    )
    await postEvent(removed).expect(200)

    expect(await hanaRemove).toMatchObject({ event_id: removed.event_id })
    expect(await judyRemove).toMatchObject({ event_id: removed.event_id })
    await ivanSilence
    expect(registry.teamIdForUser(14)).toBeNull()

    hana.socket.disconnect()
    ivan.socket.disconnect()
    judy.socket.disconnect()
  })
})
