// Character kits are shared by players and bots. Teams never modify stats.
export const CHARACTER_BALANCE = Object.freeze({
  johnny: Object.freeze({
    health: 5,
    shotDamage: 1,
    ammoCapacity: 3,
    reloadMs: 1000,
    attackRange: 442.7,
    projectileSpeed: 610,
    moveSpeed: 245,
    shotCooldownMs: 240,
    superChargePerHit: 25,
    superChargeMax: 100,
    superDamage: 2,
    superRange: 560,
    superProjectileSpeed: 720,
    superHoleDurationMs: 6000,
    superHoleRadius: 32,
    superPullMs: 400,
    superInsideMs: 3000,
    superTuskStrikeRange: 110,
    superTuskStrikeDamage: 1,
    superTuskStrikeVisualMs: 280,
  }),
  kira: Object.freeze({
    health: 6,
    shotDamage: 2,
    ammoCapacity: 3,
    reloadMs: 2000,
    attackRange: 360,
    projectileSpeed: 500,
    moveSpeed: 235,
    shotCooldownMs: 350,
    bombFuseMs: 500,
    bombBlastRadius: 82,
    superChargePerHit: 25,
    superChargeMax: 100,
    superDamage: 3,
    superRange: 420,
    superTankLifetimeMs: 5000,
    superTankSpeed: 190,
    superTankHealth: 3,
    superTankRadius: 14,
    superBlastRadius: 110,
  }),
});

export const ACTOR_CHARACTER = Object.freeze({
  johnny: 'johnny',
  'ally-left': 'kira',
  'ally-right': 'johnny',
  'enemy-left': 'kira',
  'enemy-center': 'johnny',
  'enemy-right': 'johnny',
});

export function statsForActor(actorOrId) {
  const id = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
  const character = typeof actorOrId === 'string'
    ? ACTOR_CHARACTER[id] : actorOrId.characterId ?? ACTOR_CHARACTER[id];
  const stats = CHARACTER_BALANCE[character];
  if (!stats) throw new Error(`Personagem sem atributos: ${id}`);
  return stats;
}

export function sustainedDps(stats) {
  return stats.shotDamage * 1000 / Math.max(stats.reloadMs, stats.shotCooldownMs);
}

export function hitsToEliminate(attacker, defender) {
  return Math.ceil(defender.health / attacker.shotDamage);
}

export function balanceErrors(profiles = CHARACTER_BALANCE) {
  const entries = Object.entries(profiles);
  const errors = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [nameA, a] = entries[i];
      const [nameB, b] = entries[j];
      const stronger = a.shotDamage > b.shotDamage ? a : b;
      const weaker = stronger === a ? b : a;
      if (a.shotDamage !== b.shotDamage && stronger.reloadMs <= weaker.reloadMs) {
        errors.push(`${nameA}/${nameB}: maior dano precisa de recarga mais lenta`);
      }
      const dpsRatio = Math.max(sustainedDps(a), sustainedDps(b)) /
        Math.min(sustainedDps(a), sustainedDps(b));
      if (dpsRatio > 1.25) errors.push(`${nameA}/${nameB}: DPS sustentado difere mais de 25%`);
      for (const [shortName, short, long] of [[nameA, a, b], [nameB, b, a]]) {
        if (short.attackRange < long.attackRange && short.shotDamage <= long.shotDamage &&
            short.health <= long.health) {
          errors.push(`${shortName}: alcance menor precisa de mais dano ou vida`);
        }
      }
    }
  }
  return errors;
}
