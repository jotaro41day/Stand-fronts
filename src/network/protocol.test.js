import test from 'node:test';
import assert from 'node:assert/strict';
import { InputGate, GAME_VERSION, makeRoomCode, normalizeRoomCode, packAction,
  packInput, packSnapshot, roomPeerId, unpackSnapshot, validateInput } from './protocol.js';
import { GemMatch } from '../game/gemMatch.js';
import { AmmoMagazine } from '../game/ammo.js';

test('room codes are five readable characters and map to one PeerJS ID', () => {
  const code = makeRoomCode(Uint8Array.from([0, 1, 2, 3, 4]));
  assert.equal(code.length, 5);
  assert.equal(normalizeRoomCode(` ${code.toLowerCase()} `), code);
  assert.equal(roomPeerId(code), `standfronts-${code}`);
  assert.equal(normalizeRoomCode('12!45'), null);
});

test('input gate normalizes movement, rejects stale or forged fields, and stops stale movement', () => {
  const gate = new InputGate();
  const packet = packInput(1, { x: 1, y: 1 }, { x: 10, y: 0 }, []);
  packet.position = { x: 99999, y: 99999 };
  packet.damage = 99999;
  assert.equal(gate.acceptInput(packet, 1000), true);
  assert.ok(Math.hypot(gate.move.x, gate.move.y) <= 1.00001);
  assert.deepEqual(gate.aim, { x: 1, y: 0 });
  assert.equal(gate.position, undefined);
  assert.equal(gate.damage, undefined);
  assert.equal(gate.acceptInput(packet, 1100), false);
  assert.deepEqual(gate.consume(1300).move, { x: 0, y: 0 });
  assert.equal(validateInput({ ...packet, s: 2, m: [Infinity, 0] }, 1), null);
});

test('attack and super release events are deduplicated across fast and reliable channels', () => {
  const gate = new InputGate();
  const action = packAction(7, 'attack', { type: 'aim', direction: { x: 0, y: -1 } });
  assert.equal(gate.acceptAction(action), true);
  assert.equal(gate.acceptInput(packInput(1, { x: 0, y: 0 }, null,
    [{ id: 7, kind: 'attack', action: { type: 'aim', direction: { x: 0, y: -1 } } }]), 10), true);
  const applied = gate.consume(10).actions;
  assert.equal(applied.length, 1);
  assert.equal(applied[0].action.type, 'aim');
  assert.ok(applied[0].action.direction.y < -.99);
  assert.equal(gate.acceptAction(packAction(8, 'super', { type: 'enter' })), true);
  assert.deepEqual(gate.consume(11).actions[0].action, { type: 'enter' });
});

test('fast actions arriving out of order do not erase reliable release events', () => {
  const gate = new InputGate();
  assert.equal(gate.acceptAction(packAction(12, 'attack', { type: 'auto' })), true);
  assert.equal(gate.acceptAction(packAction(11, 'super', { type: 'enter' })), true);
  assert.equal(gate.acceptAction(packAction(12, 'attack', { type: 'auto' })), false);
  assert.deepEqual(gate.consume(20).actions.map(action => action.id), [11, 12]);
});

test('snapshots quantize state and retain all six fighters, gems and combat objects', () => {
  const match = new GemMatch(0, 'kira');
  for (const actor of match.actors) {
    actor.ammo = new AmmoMagazine(actor.stats);
    actor.aim = { x: 1, y: 0 };
  }
  match.actors[0].x = 222.123;
  match.actors[0].gems = 3;
  match.gems.push({ id: 11, x: 800, y: 500, bornAt: 900 });
  const game = { match, playerActor: match.actors[0],
    player: { ammo: match.actors[0].ammo }, kiraCharge: new Map([['johnny', 75]]),
    wormhole: { charge: 0, hole: null }, remoteWormholes: new Map(),
    projectiles: [{ netId: 4, kind: 'bomb', x: 123.42, y: 456.12,
      vx: 100, vy: 0, team: 'blue', damage: 2 }], superShots: [],
    bombs: [{ netId: 5, x: 150, y: 200, team: 'red', detonateAt: 1500 }],
    tanks: [{ netId: 6, x: 250, y: 260, aim: { x: 0, y: 1 },
      team: 'blue', hp: 2, expiresAt: 5000 }] };
  const wire = packSnapshot(game, 1000, 9, [[3, 'hit', 1, 2]]);
  assert.equal(wire.v, GAME_VERSION);
  assert.equal(wire.a.length, 6);
  assert.ok(JSON.stringify(wire).length < 1000);
  const decoded = unpackSnapshot(wire);
  assert.equal(decoded.actors[0].characterId, 'kira');
  assert.equal(decoded.actors[0].gems, 3);
  assert.ok(Math.abs(decoded.actors[0].x - 222.123) <= .125);
  assert.equal(decoded.projectiles[0].kind, 'bomb');
  assert.equal(decoded.bombs[0].remainingMs, 500);
  assert.equal(decoded.tanks[0].hp, 2);
  assert.equal(decoded.gems[0].id, 11);
  assert.equal(unpackSnapshot({ ...wire, v: 'old-version' }), null);
});
