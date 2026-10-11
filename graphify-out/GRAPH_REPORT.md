# Graph Report - stand-fronts  (2026-10-11)

## Corpus Check
- 84 files · ~55,008 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .xml 10, .glb 4, (none) 3)

## Summary
- 482 nodes · 1237 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3e6a9759`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ref_node_assert
- writePrecache.mjs
- GemGame.js
- TouchControls
- .frame
- TrainingGame.js
- player.js
- GameEffects
- Stand Fronts 3D — Pique-Gema
- configureAndroid.mjs
- AGENTS.md
- botAI.js
- main.js
- protocol.js
- SnapshotBuffer

## God Nodes (most connected - your core abstractions)
1. `GemGame` - 41 edges
2. `toWorld()` - 31 edges
3. `GemMatch` - 19 edges
4. `hitsCircleRect()` - 17 edges
5. `WormholeSuper` - 17 edges
6. `AmmoMagazine` - 16 edges
7. `TouchControls` - 16 edges
8. `lineOfSight()` - 14 edges
9. `RoomHost` - 14 edges
10. `moveAroundObstacles()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `updateFighterVisual()` --calls--> `standPosition()`  [EXTRACTED]
  src/visual/gemVisuals.js → src/entities/standFollow.js
- `updateFighterVisual()` --calls--> `standHoverHeight()`  [EXTRACTED]
  src/visual/gemVisuals.js → src/entities/standFollow.js
- `showGame()` --calls--> `GemGame`  [EXTRACTED]
  src/main.js → src/game/GemGame.js
- `coverGoal()` --calls--> `lineOfSight()`  [EXTRACTED]
  src/game/botAI.js → src/game/botNavigation.js
- `coverGoal()` --calls--> `hitsCircleRect()`  [EXTRACTED]
  src/game/botAI.js → src/game/rules.js

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "ref_node_assert"
Cohesion: 0.06
Nodes (20): file, source, Element, createJohnnyAnimator(), createJohnnyRig(), meshRegions(), smoothstep(), createKiraRig() (+12 more)

### Community 1 - "writePrecache.mjs"
Cohesion: 0.20
Nodes (6): files, filesIn(), hash, precache, root, serviceWorker

### Community 2 - "GemGame.js"
Cohesion: 0.09
Nodes (32): ATTACK_START, center(), createNavigationGrid(), crossesBox(), findPath(), lineOfSight(), nearestOpen(), pointSegmentDistanceSquared() (+24 more)

### Community 3 - "TouchControls"
Cohesion: 0.16
Nodes (3): Element, setup(), TouchControls

### Community 4 - ".frame"
Cohesion: 0.07
Nodes (30): GemGame, setTextIfChanged(), toWorld(), ClientVisuals, nailGeometry, nailGlowMaterial, nailMaterial, updateAimIndicator() (+22 more)

### Community 5 - "TrainingGame.js"
Cohesion: 0.09
Nodes (25): AMMO_CAPACITY, advanceShot(), ATTACK_LIFE, ATTACK_RANGE, ATTACK_SPEED, ATTACK_WIDTH, autoAimDirection(), impactGeometry (+17 more)

### Community 6 - "player.js"
Cohesion: 0.09
Nodes (27): glowMaterial, Player, shotGeometry, shotMaterial, trailMaterial, standHoverHeight(), standPosition(), MOVE_SPEED (+19 more)

### Community 7 - "GameEffects"
Cohesion: 0.15
Nodes (6): color, dummy, GameEffects, particleGeometry, particleMaterial, QUALITY

### Community 8 - "Stand Fronts 3D — Pique-Gema"
Cohesion: 0.29
Nodes (6): APK Android sem Android Studio, Executar no Termux, Modelos, PWA offline, Stand Fronts 3D — Pique-Gema, Verificar

### Community 10 - "configureAndroid.mjs"
Cohesion: 0.33
Nodes (5): java, manifest, manifestFile, native, source

### Community 12 - "botAI.js"
Cohesion: 0.09
Nodes (32): ACTOR_CHARACTER, balanceErrors(), CHARACTER_BALANCE, hitsToEliminate(), statsForActor(), sustainedDps(), mirrorDuel(), randomFrom() (+24 more)

### Community 13 - "main.js"
Cohesion: 0.08
Nodes (18): codeInput, gameScreen, lobbyCharacter, lobbyCode, lobbyPlayers, lobbyScreen, lobbyStatus, lobbyTeam (+10 more)

### Community 15 - "protocol.js"
Cohesion: 0.07
Nodes (34): ACTION_TYPES, ACTOR_IDS, CHARACTER_CODES, clamp(), CONNECTION_TIMEOUT_MS, decodeAxis(), finite(), GAME_VERSION (+26 more)

### Community 18 - "SnapshotBuffer"
Cohesion: 0.29
Nodes (4): correctPredictedPosition(), lerp(), position(), SnapshotBuffer

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GemGame` connect `.frame` to `GemGame.js`, `botAI.js`, `main.js`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.06487434248977206 - nodes in this community are weakly interconnected._
- **Why does `TouchControls` connect `TouchControls` to `GemGame.js`, `.frame`, `TrainingGame.js`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `GemGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0880503144654088 - nodes in this community are weakly interconnected._
- **Why does `WormholeSuper` connect `GemGame.js` to `.frame`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `.frame` be split into smaller, more focused modules?**
  _Cohesion score 0.06774774774774775 - nodes in this community are weakly interconnected._
- **Should `TrainingGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09407665505226481 - nodes in this community are weakly interconnected._