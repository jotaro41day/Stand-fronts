import { CHARACTER_BALANCE } from '../balance.js';
import { GEM_RULES } from '../game/gemMatch.js';

export const GAME_VERSION = '0.2.0-p2p1';
export const ACTOR_IDS = Object.freeze(['johnny', 'ally-left', 'ally-right',
  'enemy-left', 'enemy-center', 'enemy-right']);
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INPUT_INTERVAL_MS = 50;
export const SNAPSHOT_INTERVAL_MS = 60;
export const CONNECTION_TIMEOUT_MS = 10_000;
export const ROOM_SILENCE_MS = 5_000;
const POSITION_SCALE = 4;
const AIM_SCALE = 127;
const ACTION_TYPES = ['attack-auto', 'attack-aim', 'super-auto', 'super-aim',
  'super-enter', 'super-exit'];
const PHASES = ['playing', 'suddenDeath', 'finished'];
const TEAM_CODES = { blue: 0, red: 1 };
const CHARACTER_CODES = { johnny: 0, kira: 1 };

const finite = value => typeof value === 'number' && Number.isFinite(value);
const q = (value, scale) => Math.round((finite(value) ? value : 0) * scale);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const pair = point => [q(point?.x, AIM_SCALE), q(point?.y, AIM_SCALE)]
  .map(value => clamp(value, -AIM_SCALE, AIM_SCALE));

export function makeRoomCode(randomBytes = crypto.getRandomValues(new Uint8Array(5))) {
  return Array.from(randomBytes, byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return code.length === 5 && [...code].every(letter => ROOM_ALPHABET.includes(letter))
    ? code : null;
}

export function roomPeerId(code) { return `standfronts-${code}`; }

export function packAction(id, kind, action) {
  const type = `${kind}-${action.type}`;
  const code = ACTION_TYPES.indexOf(type);
  if (!Number.isSafeInteger(id) || id < 0 || code < 0) return null;
  const direction = action.direction ? pair(action.direction) : [0, 0];
  return [id, code, direction[0], direction[1]];
}

export function validateAction(raw) {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(Number.isSafeInteger)) return null;
  const [id, code, x, y] = raw;
  if (id < 0 || id > 1_000_000_000 || code < 0 || code >= ACTION_TYPES.length ||
      Math.abs(x) > AIM_SCALE || Math.abs(y) > AIM_SCALE) return null;
  const [kind, type] = ACTION_TYPES[code].split('-');
  if (type === 'aim' && x === 0 && y === 0) return null;
  const direction = Math.hypot(x, y) > 0 ? { x: x / Math.hypot(x, y),
    y: y / Math.hypot(x, y) } : null;
  return { id, kind, action: direction && type === 'aim'
    ? { type, direction } : { type } };
}

export function packInput(seq, move, aim, actions = []) {
  return { t: 'i', s: seq, m: pair(move), a: aim ? pair(aim) : null,
    e: actions.map(action => packAction(action.id, action.kind, action.action))
      .filter(Boolean).slice(0, 4) };
}

function decodeAxis(raw) {
  if (!Array.isArray(raw) || raw.length !== 2 ||
      !raw.every(value => Number.isSafeInteger(value) && Math.abs(value) <= AIM_SCALE)) return null;
  const x = raw[0] / AIM_SCALE;
  const y = raw[1] / AIM_SCALE;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export function validateInput(raw, lastSeq = -1) {
  if (!raw || raw.t !== 'i' || !Number.isSafeInteger(raw.s) || raw.s <= lastSeq ||
      raw.s > 1_000_000_000 || !Array.isArray(raw.e) || raw.e.length > 4) return null;
  const move = decodeAxis(raw.m);
  const aim = raw.a === null ? null : decodeAxis(raw.a);
  if (!move || (raw.a !== null && !aim)) return null;
  return { seq: raw.s, move, aim,
    actions: raw.e.map(validateAction).filter(Boolean) };
}

export class InputGate {
  constructor() {
    this.lastSeq = -1;
    this.lastActionId = -1;
    this.seenActionIds = new Set();
    this.lastAt = -Infinity;
    this.move = { x: 0, y: 0 };
    this.aim = null;
    this.actions = [];
  }

  acceptInput(raw, now) {
    const input = validateInput(raw, this.lastSeq);
    if (!input) return false;
    this.lastSeq = input.seq;
    this.lastAt = now;
    this.move = input.move;
    this.aim = input.aim;
    for (const action of input.actions) this.acceptAction(action);
    return true;
  }

  acceptAction(raw) {
    const action = Array.isArray(raw) ? validateAction(raw) : raw;
    if (!action || action.id <= this.lastActionId - 64 ||
        this.seenActionIds.has(action.id) || this.actions.length >= 8) return false;
    this.lastActionId = Math.max(this.lastActionId, action.id);
    this.seenActionIds.add(action.id);
    for (const id of this.seenActionIds) {
      if (id <= this.lastActionId - 64) this.seenActionIds.delete(id);
    }
    this.actions.push(action);
    return true;
  }

  consume(now) {
    const actions = this.actions.splice(0).sort((a, b) => a.id - b.id);
    return { move: now - this.lastAt <= 250 ? this.move : { x: 0, y: 0 },
      aim: this.aim, actions };
  }
}

export function packSnapshot(game, now, sequence, events = []) {
  const match = game.match;
  const ammoOf = actor => actor === game.playerActor ? game.player.ammo : actor.ammo;
  const chargeOf = actor => actor.characterId === 'kira'
    ? game.kiraCharge.get(actor.id) ?? 0
    : (actor === game.playerActor ? game.wormhole : game.remoteWormholes?.get(actor.id))?.charge ?? 0;
  const holeOf = actor => actor.characterId === 'johnny'
    ? (actor === game.playerActor ? game.wormhole : game.remoteWormholes?.get(actor.id))
    : null;
  return { t: 's', n: sequence, v: GAME_VERSION,
    r: Math.max(0, q(match.startAt + GEM_RULES.matchTime - now, .01)),
    ph: PHASES.indexOf(match.phase), w: match.winner === null ? -1 : TEAM_CODES[match.winner],
    sc: [match.scores.blue, match.scores.red],
    cd: ['blue', 'red'].map(team => match.countdowns[team] === null ? -1
      : Math.max(0, q(match.countdowns[team] - now, .01))),
    a: match.actors.map(actor => {
      const ammo = ammoOf(actor);
      const fractions = ammo?.fractions(now) ?? [1, 1, 1];
      const hole = holeOf(actor);
      return [q(actor.x, POSITION_SCALE), q(actor.y, POSITION_SCALE),
        q(actor.vx, POSITION_SCALE), q(actor.vy, POSITION_SCALE),
        ...pair(actor.aim ?? { x: 1, y: 0 }), actor.hp, actor.active ? 1 : 0,
        actor.invulnerable ? 1 : 0, actor.gems, ammo?.charges ?? 3,
        ...fractions.map(value => clamp(q(value, 100), 0, 100)),
        chargeOf(actor), CHARACTER_CODES[actor.characterId], hole?.inside ? 1 : 0];
    }),
    p: [...game.projectiles, ...game.superShots].map(shot => [shot.netId ?? 0,
      shot.isSuper ? 2 : shot.kind === 'bomb' ? 1 : 0,
      q(shot.x, POSITION_SCALE), q(shot.y, POSITION_SCALE),
      q(shot.vx, POSITION_SCALE), q(shot.vy, POSITION_SCALE),
      TEAM_CODES[shot.team], shot.damage]),
    b: game.bombs.map(bomb => [bomb.netId ?? 0, q(bomb.x, POSITION_SCALE),
      q(bomb.y, POSITION_SCALE), TEAM_CODES[bomb.team],
      Math.max(0, q(bomb.detonateAt - now, .01))]),
    tk: game.tanks.map(tank => [tank.netId ?? 0, q(tank.x, POSITION_SCALE),
      q(tank.y, POSITION_SCALE), ...pair(tank.aim), TEAM_CODES[tank.team],
      tank.hp, Math.max(0, q(tank.expiresAt - now, .01))]),
    h: match.actors.flatMap((actor, index) => {
      const wormhole = holeOf(actor);
      return wormhole?.hole ? [[index, q(wormhole.hole.position.x, POSITION_SCALE),
        q(wormhole.hole.position.y, POSITION_SCALE),
        Math.max(0, q(wormhole.hole.expiresAt - now, .01)), wormhole.inside ? 1 : 0]] : [];
    }),
    g: match.gems.map(gem => [gem.id, q(gem.x, POSITION_SCALE),
      q(gem.y, POSITION_SCALE), clamp(q(now - gem.bornAt, .01), 0, 30_000)]),
    e: events.slice(-8) };
}

export function unpackSnapshot(wire) {
  if (!wire || wire.t !== 's' || wire.v !== GAME_VERSION ||
      !Number.isSafeInteger(wire.n) || !Array.isArray(wire.a) ||
      wire.a.length !== ACTOR_IDS.length) return null;
  const pos = value => value / POSITION_SCALE;
  const direction = (x, y) => ({ x: x / AIM_SCALE, y: y / AIM_SCALE });
  return { sequence: wire.n, remainingMs: wire.r * 100,
    phase: PHASES[wire.ph], winner: wire.w < 0 ? null : wire.w ? 'red' : 'blue',
    scores: { blue: wire.sc[0], red: wire.sc[1] },
    countdowns: { blue: wire.cd[0] < 0 ? null : wire.cd[0] * 100,
      red: wire.cd[1] < 0 ? null : wire.cd[1] * 100 },
    actors: wire.a.map((actor, index) => ({ id: ACTOR_IDS[index],
      x: pos(actor[0]), y: pos(actor[1]), vx: pos(actor[2]), vy: pos(actor[3]),
      aim: direction(actor[4], actor[5]), hp: actor[6], active: !!actor[7],
      invulnerable: !!actor[8], gems: actor[9], ammo: actor[10],
      ammoFractions: actor.slice(11, 14).map(value => value / 100),
      superCharge: actor[14], characterId: actor[15] ? 'kira' : 'johnny',
      inside: !!actor[16] })),
    projectiles: wire.p.map(shot => ({ id: shot[0], kind: ['nail', 'bomb', 'super'][shot[1]],
      x: pos(shot[2]), y: pos(shot[3]), vx: pos(shot[4]), vy: pos(shot[5]),
      team: shot[6] ? 'red' : 'blue', damage: shot[7] })),
    bombs: wire.b.map(bomb => ({ id: bomb[0], x: pos(bomb[1]), y: pos(bomb[2]),
      team: bomb[3] ? 'red' : 'blue', remainingMs: bomb[4] * 100 })),
    tanks: wire.tk.map(tank => ({ id: tank[0], x: pos(tank[1]), y: pos(tank[2]),
      aim: direction(tank[3], tank[4]), team: tank[5] ? 'red' : 'blue',
      hp: tank[6], remainingMs: tank[7] * 100 })),
    holes: wire.h.map(hole => ({ ownerId: ACTOR_IDS[hole[0]],
      x: pos(hole[1]), y: pos(hole[2]), remainingMs: hole[3] * 100, inside: !!hole[4] })),
    gems: wire.g.map(gem => ({ id: gem[0], x: pos(gem[1]), y: pos(gem[2]),
      ageMs: gem[3] * 100 })), events: wire.e ?? [] };
}

export function validRoster(roster) {
  return ACTOR_IDS.every(id => CHARACTER_BALANCE[roster[id]]);
}
