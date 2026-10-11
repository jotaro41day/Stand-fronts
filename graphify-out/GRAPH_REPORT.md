# Graph Report - stand-fronts  (2026-10-11)

## Corpus Check
- 88 files · ~57,560 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .xml 10, .glb 4, (none) 3)

## Summary
- 541 nodes · 1348 edges · 23 communities (18 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51a0ce88`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- loadModels.js
- writePrecache.mjs
- GemGame.js
- TouchControls
- GemGame
- TrainingGame.js
- player.js
- gemVisuals.js
- Stand Fronts 3D — Pique-Gema
- PerformancePanel
- AGENTS.md
- botAI.js
- main.js
- GameEffects
- protocol.js
- MouseControls
- SnapshotBuffer
- ref_node_assert
- tuskRig.test.js
- toon.js
- configureAndroid.mjs

## God Nodes (most connected - your core abstractions)
1. `GemGame` - 47 edges
2. `toWorld()` - 31 edges
3. `GemMatch` - 20 edges
4. `WormholeSuper` - 17 edges
5. `AmmoMagazine` - 16 edges
6. `hitsCircleRect()` - 16 edges
7. `TouchControls` - 16 edges
8. `lineOfSight()` - 14 edges
9. `MouseControls` - 14 edges
10. `RoomHost` - 14 edges

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

## Communities (23 total, 5 thin omitted)

### Community 0 - "loadModels.js"
Cohesion: 0.20
Nodes (11): createJohnnyAnimator(), createJohnnyRig(), meshRegions(), smoothstep(), createKiraRig(), definitions, loader, templates (+3 more)

### Community 1 - "writePrecache.mjs"
Cohesion: 0.20
Nodes (6): files, filesIn(), hash, precache, root, serviceWorker

### Community 2 - "GemGame.js"
Cohesion: 0.07
Nodes (39): ATTACK_START, center(), createNavigationGrid(), crossesBox(), findPath(), lineOfSight(), nearestOpen(), pointSegmentDistanceSquared() (+31 more)

### Community 3 - "TouchControls"
Cohesion: 0.16
Nodes (3): Element, setup(), TouchControls

### Community 4 - "GemGame"
Cohesion: 0.06
Nodes (34): advanceShot(), autoAimDirection(), GemGame, setTextIfChanged(), toWorld(), ClientVisuals, nailGeometry, nailGlowMaterial (+26 more)

### Community 5 - "TrainingGame.js"
Cohesion: 0.11
Nodes (22): AMMO_CAPACITY, AMMO_RELOAD_MS, ATTACK_LIFE, ATTACK_RANGE, ATTACK_SPEED, ATTACK_WIDTH, impactGeometry, TrainingGame (+14 more)

### Community 6 - "player.js"
Cohesion: 0.17
Nodes (11): glowMaterial, Player, shotGeometry, shotMaterial, trailMaterial, standHoverHeight(), MOVE_SPEED, createFallbackHero() (+3 more)

### Community 7 - "gemVisuals.js"
Cohesion: 0.12
Nodes (15): standPosition(), bodyGeometry, createFighterVisual(), createHealthBar(), crestGeometry, gemGeometry, gemHaloGeometry, gemHaloMaterial (+7 more)

### Community 8 - "Stand Fronts 3D — Pique-Gema"
Cohesion: 0.29
Nodes (6): APK Android sem Android Studio, Executar no Termux, Modelos, PWA offline, Stand Fronts 3D — Pique-Gema, Verificar

### Community 10 - "PerformancePanel"
Cohesion: 0.10
Nodes (9): PerformancePanel, readSaved(), switches, Element, AdaptivePixelRatio, chooseQuality(), clampPixelRatio(), FrameStats (+1 more)

### Community 12 - "botAI.js"
Cohesion: 0.09
Nodes (31): ACTOR_CHARACTER, balanceErrors(), CHARACTER_BALANCE, hitsToEliminate(), statsForActor(), sustainedDps(), mirrorDuel(), randomFrom() (+23 more)

### Community 13 - "main.js"
Cohesion: 0.08
Nodes (18): codeInput, gameScreen, lobbyCharacter, lobbyCode, lobbyPlayers, lobbyScreen, lobbyStatus, lobbyTeam (+10 more)

### Community 14 - "GameEffects"
Cohesion: 0.14
Nodes (6): color, dummy, GameEffects, particleGeometry, particleMaterial, QUALITY

### Community 15 - "protocol.js"
Cohesion: 0.07
Nodes (34): ACTION_TYPES, ACTOR_IDS, CHARACTER_CODES, clamp(), CONNECTION_TIMEOUT_MS, decodeAxis(), finite(), GAME_VERSION (+26 more)

### Community 18 - "SnapshotBuffer"
Cohesion: 0.29
Nodes (5): correctPredictedPosition(), fillReusable(), lerp(), position(), SnapshotBuffer

### Community 20 - "tuskRig.test.js"
Cohesion: 0.24
Nodes (5): file, source, classifyPieces(), createTuskRig(), smoothstep()

### Community 21 - "toon.js"
Cohesion: 0.24
Nodes (9): buildTemplate(), loadModelIfPresent(), addOutlineToModel(), gradient, outlinedMesh(), outlineMaterial, sharedMaterials, steps (+1 more)

### Community 22 - "configureAndroid.mjs"
Cohesion: 0.33
Nodes (5): java, manifest, manifestFile, native, source

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GemGame` connect `GemGame` to `GemGame.js`, `botAI.js`, `main.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `GemGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.074034902168165 - nodes in this community are weakly interconnected._
- **Why does `TouchControls` connect `TouchControls` to `GemGame.js`, `GemGame`, `TrainingGame.js`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `GemGame` be split into smaller, more focused modules?**
  _Cohesion score 0.05966386554621849 - nodes in this community are weakly interconnected._
- **Why does `WormholeSuper` connect `GemGame.js` to `GemGame`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `TrainingGame.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11260504201680673 - nodes in this community are weakly interconnected._
- **Should `gemVisuals.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._