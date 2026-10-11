# Graph Report - stand-fronts  (2026-10-11)

## Corpus Check
- 84 files · ~54,622 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .xml 10, .glb 4, (none) 3)

## Summary
- 479 nodes · 1227 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- loadModels.js
- writePrecache.mjs
- GemGame.js
- TouchControls
- .frame
- TrainingGame.js
- player.js
- GameEffects
- Stand Fronts 3D — Pique-Gema
- kiraVisuals.js
- AGENTS.md
- botAI.js
- main.js
- WormholeSuper
- protocol.js
- ref_node_assert

## God Nodes (most connected - your core abstractions)
1. `GemGame` - 39 edges
2. `toWorld()` - 31 edges
3. `GemMatch` - 19 edges
4. `hitsCircleRect()` - 17 edges
5. `WormholeSuper` - 17 edges
6. `AmmoMagazine` - 16 edges
7. `TouchControls` - 16 edges
8. `RoomHost` - 14 edges
9. `lineOfSight()` - 13 edges
10. `moveAroundObstacles()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `showGame()` --calls--> `GemGame`  [EXTRACTED]
  src/main.js → src/game/GemGame.js
- `coverGoal()` --calls--> `lineOfSight()`  [EXTRACTED]
  src/game/botAI.js → src/game/botNavigation.js
- `coverGoal()` --calls--> `hitsCircleRect()`  [EXTRACTED]
  src/game/botAI.js → src/game/rules.js
- `decideBot()` --calls--> `lineOfSight()`  [EXTRACTED]
  src/game/botAI.js → src/game/botNavigation.js
- `updateBombVisual()` --calls--> `toWorld()`  [EXTRACTED]
  src/visual/kiraVisuals.js → src/maps/gemArena.js

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "loadModels.js"
Cohesion: 0.09
Nodes (23): java, manifest, manifestFile, native, source, file, source, createJohnnyAnimator() (+15 more)

### Community 1 - "writePrecache.mjs"
Cohesion: 0.20
Nodes (6): files, filesIn(), hash, precache, root, serviceWorker

### Community 2 - "GemGame.js"
Cohesion: 0.12
Nodes (33): ATTACK_START, center(), createNavigationGrid(), crossesBox(), findPath(), lineOfSight(), nearestOpen(), pointSegmentDistanceSquared() (+25 more)

### Community 3 - "TouchControls"
Cohesion: 0.16
Nodes (3): Element, setup(), TouchControls

### Community 4 - ".frame"
Cohesion: 0.10
Nodes (21): standHoverHeight(), standPosition(), GemGame, GEM_RULES, toWorld(), updateAimIndicator(), updateAmmoBar(), createFighterVisual() (+13 more)

### Community 5 - "TrainingGame.js"
Cohesion: 0.08
Nodes (31): AMMO_CAPACITY, AMMO_RELOAD_MS, advanceShot(), ATTACK_LIFE, ATTACK_RANGE, ATTACK_SPEED, ATTACK_WIDTH, autoAimDirection() (+23 more)

### Community 6 - "player.js"
Cohesion: 0.17
Nodes (10): glowMaterial, Player, shotGeometry, shotMaterial, trailMaterial, MOVE_SPEED, createFallbackHero(), createFallbackStand() (+2 more)

### Community 7 - "GameEffects"
Cohesion: 0.15
Nodes (6): color, dummy, GameEffects, particleGeometry, particleMaterial, QUALITY

### Community 8 - "Stand Fronts 3D — Pique-Gema"
Cohesion: 0.29
Nodes (6): APK Android sem Android Studio, Executar no Termux, Modelos, PWA offline, Stand Fronts 3D — Pique-Gema, Verificar

### Community 10 - "kiraVisuals.js"
Cohesion: 0.10
Nodes (20): ClientVisuals, nailGeometry, nailGlowMaterial, nailMaterial, bombCore, bombGlow, bombMark, bombMaterial (+12 more)

### Community 12 - "botAI.js"
Cohesion: 0.10
Nodes (28): ACTOR_CHARACTER, balanceErrors(), CHARACTER_BALANCE, hitsToEliminate(), statsForActor(), sustainedDps(), mirrorDuel(), randomFrom() (+20 more)

### Community 13 - "main.js"
Cohesion: 0.08
Nodes (18): codeInput, gameScreen, lobbyCharacter, lobbyCode, lobbyPlayers, lobbyScreen, lobbyStatus, lobbyTeam (+10 more)

### Community 15 - "protocol.js"
Cohesion: 0.07
Nodes (34): ACTION_TYPES, ACTOR_IDS, CHARACTER_CODES, clamp(), CONNECTION_TIMEOUT_MS, decodeAxis(), finite(), GAME_VERSION (+26 more)

### Community 18 - "ref_node_assert"
Cohesion: 0.08
Nodes (6): Element, correctPredictedPosition(), lerp(), position(), SnapshotBuffer, VisualGarbageCollector

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GemGame` connect `.frame` to `GemGame.js`, `kiraVisuals.js`, `botAI.js`, `main.js`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `loadModels.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09246088193456614 - nodes in this community are weakly interconnected._
- **Why does `TouchControls` connect `TouchControls` to `GemGame.js`, `.frame`, `TrainingGame.js`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `GemGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1191919191919192 - nodes in this community are weakly interconnected._
- **Why does `WormholeSuper` connect `WormholeSuper` to `GemGame.js`, `.frame`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `.frame` be split into smaller, more focused modules?**
  _Cohesion score 0.09586466165413533 - nodes in this community are weakly interconnected._
- **Should `TrainingGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08078431372549019 - nodes in this community are weakly interconnected._