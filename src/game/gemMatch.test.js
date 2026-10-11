import test from 'node:test';
import assert from 'node:assert/strict';

test('3v3 match spawns gems, lets any fighter collect, and drops carried gems on death', async () => {
  const { GemMatch, GEM_RULES } = await import('./gemMatch.js').catch(() => ({}));
  assert.equal(typeof GemMatch, 'function');
  const match = new GemMatch(0);
  assert.equal(match.actors.filter(actor => actor.team === 'blue').length, 3);
  assert.equal(match.actors.filter(actor => actor.team === 'red').length, 3);
  match.update(GEM_RULES.gemInterval);
  assert.equal(match.gems.length, 1);
  const johnny = match.actors.find(actor => actor.id === 'johnny');
  johnny.x = match.gems[0].x;
  johnny.y = match.gems[0].y;
  match.update(GEM_RULES.gemInterval + 550);
  assert.equal(johnny.gems, 1);
  assert.equal(match.scores.blue, 1);
  match.damage(johnny, GEM_RULES.health, 8000);
  assert.equal(johnny.active, false);
  assert.equal(johnny.gems, 0);
  assert.equal(match.gems.length, 1);
  assert.equal(match.scores.blue, 0);
  match.update(8000 + GEM_RULES.respawnTime);
  assert.equal(johnny.active, true);
  assert.equal(johnny.hp, GEM_RULES.health);
  assert.deepEqual({ x: johnny.x, y: johnny.y }, johnny.spawn);
  const enemy = match.actors.find(actor => actor.team === 'red');
  enemy.x = match.gems[0].x;
  enemy.y = match.gems[0].y;
  match.update(8001 + GEM_RULES.respawnTime);
  assert.equal(enemy.gems, 1);
  assert.equal(match.scores.red, 1);
});

test('ten gems start a 15 second countdown that stops when the carrier dies', async () => {
  const { GemMatch, GEM_RULES } = await import('./gemMatch.js').catch(() => ({}));
  assert.equal(typeof GemMatch, 'function');
  const match = new GemMatch(0);
  const johnny = match.actors.find(actor => actor.id === 'johnny');
  johnny.gems = GEM_RULES.targetGems;
  match.update(1000);
  assert.equal(match.countdowns.blue, 1000 + GEM_RULES.countdownTime);
  match.damage(johnny, GEM_RULES.health, 4000);
  assert.equal(match.countdowns.blue, null);
  match.update(17000);
  assert.equal(match.winner, null);
  johnny.gems = GEM_RULES.targetGems;
  match.update(18000);
  match.update(18000 + GEM_RULES.countdownTime);
  assert.equal(match.winner, 'blue');
});

test('time limit compares gems, and a tie enters sudden death until one team gains a gem', async () => {
  const { GemMatch, GEM_RULES } = await import('./gemMatch.js').catch(() => ({}));
  assert.equal(typeof GemMatch, 'function');
  const ahead = new GemMatch(0);
  ahead.nextGemAt = Infinity;
  ahead.actors.find(actor => actor.team === 'red').gems = 2;
  ahead.update(GEM_RULES.matchTime);
  assert.equal(ahead.winner, 'red');
  const tied = new GemMatch(0);
  tied.nextGemAt = Infinity;
  tied.update(GEM_RULES.matchTime);
  assert.equal(tied.phase, 'suddenDeath');
  assert.equal(tied.winner, null);
  tied.actors.find(actor => actor.team === 'blue').gems = 1;
  tied.update(GEM_RULES.matchTime + 1);
  assert.equal(tied.winner, 'blue');
});

test('a delayed frame cannot spawn gems after the three-minute deadline', async () => {
  const { GemMatch, GEM_RULES } = await import('./gemMatch.js');
  const match = new GemMatch(0);
  match.update(GEM_RULES.matchTime + 60_000);
  assert.ok(match.nextGemId <= Math.floor(GEM_RULES.matchTime / GEM_RULES.gemInterval));
});

test('every stationary teammate and enemy has health, death, and base respawn', async () => {
  const { GemMatch, GEM_RULES } = await import('./gemMatch.js').catch(() => ({}));
  assert.equal(typeof GemMatch, 'function');
  const match = new GemMatch(0);
  for (const actor of match.actors) {
    match.damage(actor, actor.stats.health, 1000);
    assert.equal(actor.active, false);
  }
  match.update(1000 + GEM_RULES.respawnTime);
  for (const actor of match.actors) {
    assert.equal(actor.active, true);
    assert.equal(actor.hp, actor.stats.health);
    assert.deepEqual({ x: actor.x, y: actor.y }, actor.spawn);
  }
});

test('cover stops shots before fighters and allied fighters cannot be hit', async () => {
  const { findShotHit } = await import('./gemMatch.js');
  assert.equal(typeof findShotHit, 'function');
  const shot = { x: 100, y: 100, radius: 8, team: 'blue' };
  const actors = [
    { team: 'blue', x: 100, y: 100, radius: 19, active: true },
    { team: 'red', x: 100, y: 100, radius: 19, active: true },
  ];
  assert.equal(findShotHit(shot, actors, [{ x: 90, y: 90, width: 20, height: 20 }]).type, 'wall');
  assert.equal(findShotHit(shot, actors, []).actor, actors[1]);
  actors[1].active = false;
  assert.equal(findShotHit(shot, actors, []), null);
});
