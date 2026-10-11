import test from 'node:test';
import assert from 'node:assert/strict';

test('three attacks empty the magazine and restore charges one at a time', async () => {
  const { AmmoMagazine } = await import('./ammo.js').catch(() => ({}));
  assert.equal(typeof AmmoMagazine, 'function');
  const ammo = new AmmoMagazine();
  assert.deepEqual(ammo.fractions(0), [1, 1, 1]);
  assert.equal(ammo.consume(0), true);
  assert.equal(ammo.consume(0), true);
  assert.equal(ammo.consume(0), true);
  assert.equal(ammo.consume(0), false);
  assert.deepEqual(ammo.fractions(500), [.5, 0, 0]);
  assert.deepEqual(ammo.fractions(1000), [1, 0, 0]);
  assert.deepEqual(ammo.fractions(1500), [1, .5, 0]);
  assert.deepEqual(ammo.fractions(2000), [1, 1, 0]);
  assert.deepEqual(ammo.fractions(3000), [1, 1, 1]);
});

test('a new attack does not reset the current recharge progress', async () => {
  const { AmmoMagazine } = await import('./ammo.js').catch(() => ({}));
  assert.equal(typeof AmmoMagazine, 'function');
  const ammo = new AmmoMagazine();
  assert.equal(ammo.consume(1000), true);
  assert.deepEqual(ammo.fractions(1500), [1, 1, .5]);
  assert.equal(ammo.consume(1500), true);
  assert.deepEqual(ammo.fractions(1500), [1, .5, 0]);
  assert.deepEqual(ammo.fractions(2000), [1, 1, 0]);
});

test('enemy bots use the same magazine and reload as Johnny', async () => {
  const { AmmoMagazine } = await import('./ammo.js');
  const { BotController } = await import('./botAI.js');
  const { GemMatch } = await import('./gemMatch.js');
  const match = new GemMatch(0);
  const johnny = new AmmoMagazine(match.actors.find(actor => actor.id === 'johnny').stats);
  const actor = match.actors.find(actor => actor.id === 'enemy-center');
  new BotController(actor, {});
  const bot = actor.ammo;
  for (let i = 0; i < 3; i++) {
    johnny.consume(0);
    bot.consume(0);
  }
  assert.equal(johnny.capacity, bot.capacity);
  assert.equal(johnny.reloadMs, bot.reloadMs);
  assert.deepEqual(johnny.fractions(500), bot.fractions(500));
  assert.deepEqual(johnny.fractions(1000), bot.fractions(1000));
});
