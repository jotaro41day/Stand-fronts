import test from 'node:test';
import assert from 'node:assert/strict';
import { GemMatch, GEM_RULES } from './gemMatch.js';
import { ARENA, OBSTACLES } from '../maps/gemArena.js';

const setup = async () => {
  const module = await import('./botAI.js').catch(() => ({}));
  assert.equal(typeof module.decideBot, 'function');
  const match = new GemMatch(0);
  const bot = match.actors.find(actor => actor.id === 'ally-left');
  bot.x = 450;
  bot.y = 500;
  bot.ammo = { charges: 3 };
  return { module, match, bot };
};

test('bot retreats with low health or no ammo near an enemy', async () => {
  const { module, match, bot } = await setup();
  const enemy = match.actors.find(actor => actor.id === 'enemy-left');
  enemy.x = 620; enemy.y = 500;
  bot.hp = 1;
  const lowHealth = module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id));
  assert.equal(lowHealth.state, 'retreat');
  assert.equal(lowHealth.fire, null);
  bot.hp = GEM_RULES.health;
  bot.ammo.charges = 0;
  const empty = module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id));
  assert.equal(empty.state, 'retreat');
  assert.equal(empty.fire, null);
  for (const enemyActor of match.actors.filter(actor => actor.team === 'red')) enemyActor.active = false;
  assert.equal(module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id)).state, 'retreat');
});

test('bot hunts a gem carrier and targets countdown carriers urgently', async () => {
  const { module, match, bot } = await setup();
  bot.x = 800; bot.y = 650;
  match.gems.push({ id: 1, x: 800, y: 600, radius: 16, bornAt: 0 });
  const carrier = match.actors.find(actor => actor.id === 'enemy-center');
  carrier.x = 800; carrier.y = 450; carrier.gems = 4;
  const profile = module.botProfile(bot.id);
  const hunt = module.decideBot(bot, match, OBSTACLES, profile);
  assert.equal(hunt.state, 'hunt');
  assert.equal(hunt.target?.id, carrier.id);
  carrier.gems = GEM_RULES.targetGems;
  match.countdowns.red = 15000;
  const urgent = module.decideBot(bot, match, OBSTACLES, profile);
  assert.equal(urgent.state, 'hunt');
  assert.equal(urgent.target?.id, carrier.id);
});

test('bot never fires through a wall even when the enemy is in range', async () => {
  const { module, match, bot } = await setup();
  bot.x = 450; bot.y = 300;
  for (const enemy of match.actors.filter(actor => actor.team === 'red')) enemy.active = false;
  const enemy = match.actors.find(actor => actor.id === 'enemy-center');
  enemy.active = true; enemy.x = 620; enemy.y = 300;
  const decision = module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id));
  assert.equal(decision.fire, null);
});

test('bots do not target Johnny while he is inside the wormhole', async () => {
  const { module, match } = await setup();
  const bot = match.actors.find(actor => actor.id === 'enemy-center');
  bot.x = 800; bot.y = 600; bot.ammo = { charges: 3 };
  const johnny = match.actors.find(actor => actor.id === 'johnny');
  johnny.x = 800; johnny.y = 750; johnny.invulnerable = true;
  for (const ally of match.actors.filter(actor => actor.team === 'blue' && actor !== johnny))
    ally.active = false;
  const decision = module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id));
  assert.equal(decision.fire, null);
  assert.notEqual(decision.target, johnny);
});

test('without a safe gem or visible target, bots hold the mine instead of rushing the enemy base', async () => {
  const { module, match } = await setup();
  const bot = match.actors.find(actor => actor.id === 'enemy-left');
  bot.ammo = { charges: 3 };
  for (const ally of match.actors.filter(actor => actor.team === 'blue')) ally.y = 850;
  const decision = module.decideBot(bot, match, OBSTACLES, module.botProfile(bot.id));
  assert.equal(decision.state, 'collect');
  assert.ok(Math.hypot(decision.goal.x - 800, decision.goal.y - 500) < 180);
  assert.equal(decision.fire, null);
});

test('support protects an allied carrier during our countdown and difficulty changes one profile', async () => {
  const { module, match } = await setup();
  const support = match.actors.find(actor => actor.id === 'ally-right');
  support.ammo = { charges: 3 };
  const carrier = match.actors.find(actor => actor.id === 'johnny');
  carrier.gems = GEM_RULES.targetGems;
  match.countdowns.blue = 15000;
  const decision = module.decideBot(support, match, OBSTACLES, module.botProfile(support.id));
  assert.equal(decision.state, 'protect');
  assert.equal(decision.target?.id, carrier.id);
  const easy = module.botProfile(support.id, 'easy');
  const hard = module.botProfile(support.id, 'hard');
  assert.ok(easy.reactionMs > hard.reactionMs);
  assert.ok(easy.aimError > hard.aimError);
  assert.ok(easy.aggression < hard.aggression);
});

test('controller waits for its reaction and path intervals while using the player speed', async () => {
  const { BotController } = await import('./botAI.js').catch(() => ({}));
  assert.equal(typeof BotController, 'function');
  const { createNavigationGrid } = await import('./botNavigation.js');
  const match = new GemMatch(0);
  const bot = match.actors.find(actor => actor.id === 'enemy-center');
  const grid = createNavigationGrid(ARENA, OBSTACLES, 50, bot.radius);
  const controller = new BotController(bot, grid);
  controller.update(1000, .016, match);
  const firstPathAt = controller.nextPathAt;
  const firstThinkAt = controller.nextThinkAt;
  const before = { x: bot.x, y: bot.y };
  controller.update(1016, .016, match);
  assert.equal(controller.nextPathAt, firstPathAt);
  assert.equal(controller.nextThinkAt, firstThinkAt);
  assert.ok(Math.hypot(bot.x - before.x, bot.y - before.y) <= 245 * .016 + .001);
});
