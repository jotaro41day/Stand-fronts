import test from 'node:test';
import assert from 'node:assert/strict';
import { AmmoMagazine } from './game/ammo.js';
import { GemMatch } from './game/gemMatch.js';
import { BotController, BOT_PERSONALITIES } from './game/botAI.js';
import { CHARACTER_BALANCE, ACTOR_CHARACTER, statsForActor,
  sustainedDps, hitsToEliminate, balanceErrors } from './balance.js';

test('both teams use matching Johnny and Kira kits from central balance', () => {
  const match = new GemMatch(0);
  assert.equal(Object.keys(ACTOR_CHARACTER).length, match.actors.length);
  for (const actor of match.actors) {
    assert.equal(actor.stats, statsForActor(actor));
    assert.equal(actor.hp, actor.stats.health);
    assert.equal(actor.stats.ammoCapacity, 3);
  }
  assert.deepEqual(match.actors.filter(actor => actor.team === 'blue')
    .map(actor => actor.characterId).sort(), ['johnny', 'johnny', 'kira']);
  assert.deepEqual(match.actors.filter(actor => actor.team === 'red')
    .map(actor => actor.characterId).sort(), ['johnny', 'johnny', 'kira']);
  const kiraMatch = new GemMatch(0, 'kira');
  assert.equal(kiraMatch.actors.find(actor => actor.id === 'johnny').stats, CHARACTER_BALANCE.kira);
  assert.equal(kiraMatch.actors.find(actor => actor.id === 'enemy-right').stats, CHARACTER_BALANCE.kira);
  assert.equal(sustainedDps(CHARACTER_BALANCE.johnny), 1);
  assert.equal(sustainedDps(CHARACTER_BALANCE.kira), 1);
  assert.equal(hitsToEliminate(CHARACTER_BALANCE.johnny, CHARACTER_BALANCE.johnny), 5);
  assert.equal(hitsToEliminate(CHARACTER_BALANCE.kira, CHARACTER_BALANCE.johnny), 3);
  assert.ok(CHARACTER_BALANCE.kira.reloadMs > CHARACTER_BALANCE.johnny.reloadMs);
  assert.ok(CHARACTER_BALANCE.kira.shotDamage > CHARACTER_BALANCE.johnny.shotDamage);
  assert.deepEqual(balanceErrors(), []);
});

test('balance guard requires slower reload for stronger shots and compensates shorter range', () => {
  const small = { health: 4, shotDamage: 1, reloadMs: 1000, shotCooldownMs: 240, attackRange: 500 };
  const heavy = { health: 5, shotDamage: 2, reloadMs: 2000, shotCooldownMs: 240, attackRange: 400 };
  assert.deepEqual(balanceErrors({ small, heavy }), []);
  assert.ok(balanceErrors({ small, heavy: { ...heavy, reloadMs: 800 } })
    .some(error => error.includes('recarga mais lenta')));
  assert.ok(balanceErrors({ small, heavy: { ...heavy, health: 4, shotDamage: 1 } })
    .some(error => error.includes('alcance menor')));
});

test('difficulty changes reaction, aim error and aggression without changing fighter attributes', () => {
  const profiles = [];
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const actor = new GemMatch(0).actors.find(fighter => fighter.id === 'enemy-center');
    const controller = new BotController(actor, {}, difficulty);
    assert.equal(actor.stats, CHARACTER_BALANCE.johnny);
    assert.equal(actor.ammo.capacity, actor.stats.ammoCapacity);
    assert.equal(actor.ammo.reloadMs, actor.stats.reloadMs);
    profiles.push(controller.profile);
  }
  assert.deepEqual(profiles.map(profile => profile.style), ['balanced', 'balanced', 'balanced']);
  assert.ok(profiles[0].reactionMs > profiles[2].reactionMs);
  assert.ok(profiles[0].aimError > profiles[2].aimError);
  assert.ok(profiles[0].aggression < profiles[2].aggression);
});

test('enemy bot personalities have no average reaction, accuracy or aggression advantage', () => {
  const allies = Object.entries(BOT_PERSONALITIES)
    .filter(([id]) => id.startsWith('ally-')).map(([, profile]) => profile);
  const enemies = Object.entries(BOT_PERSONALITIES)
    .filter(([id]) => id.startsWith('enemy-')).map(([, profile]) => profile);
  const average = (profiles, key) => profiles.reduce((sum, profile) => sum + profile[key], 0) / profiles.length;
  assert.ok(average(enemies, 'reactionMs') >= average(allies, 'reactionMs'));
  assert.ok(average(enemies, 'aimErrorDegrees') >= average(allies, 'aimErrorDegrees'));
  assert.ok(average(enemies, 'aggression') <= average(allies, 'aggression'));
});

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mirrorDuel(seed, swapStreams = false) {
  const match = new GemMatch(0);
  const blue = match.actors.find(actor => actor.id === 'johnny');
  const red = match.actors.find(actor => actor.id === 'enemy-center');
  const fighters = [blue, red];
  const streams = [randomFrom(seed * 2 + 19), randomFrom(seed * 2 + 100_019)];
  const randoms = swapStreams ? streams.reverse() : streams;
  for (let i = 0; i < fighters.length; i++) {
    const fighter = fighters[i];
    fighter.ammo = new AmmoMagazine(fighter.stats);
    fighter.nextFire = Math.floor(randoms[i]() * 200);
  }
  for (let now = 0; now < 20_000; now += 20) {
    const hits = [];
    for (let i = 0; i < 2; i++) {
      const attacker = fighters[i];
      if (!attacker.active || now < attacker.nextFire || !attacker.ammo.consume(now)) continue;
      attacker.nextFire = now + attacker.stats.shotCooldownMs + Math.floor(randoms[i]() * 180);
      if (randoms[i]() < .78) hits.push({ target: fighters[1 - i], damage: attacker.stats.shotDamage });
    }
    for (const hit of hits) match.damage(hit.target, hit.damage, now);
    if (!blue.active || !red.active) return blue.active ? 'blue' : red.active ? 'red' : 'tie';
  }
  return 'tie';
}

test('a mirror duel has approximately equal wins over many simulations', context => {
  const results = { blue: 0, red: 0, tie: 0 };
  for (let seed = 1; seed <= 1000; seed++) {
    const first = mirrorDuel(seed);
    const mirrored = mirrorDuel(seed, true);
    assert.equal(mirrored, first === 'blue' ? 'red' : first === 'red' ? 'blue' : 'tie');
    results[first]++;
    results[mirrored]++;
  }
  const decisive = results.blue + results.red;
  assert.ok(decisive > 1800, JSON.stringify(results));
  assert.ok(results.blue / decisive > .49 && results.blue / decisive < .51,
    JSON.stringify(results));
  context.diagnostic(`duelos: azul ${results.blue}, vermelho ${results.red}, empate ${results.tie}`);
});
