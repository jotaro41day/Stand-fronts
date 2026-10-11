import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptivePixelRatio, FrameStats, chooseQuality, clampPixelRatio,
  PERFORMANCE_PRESETS } from './performanceSettings.js';

test('adaptive resolution drops quickly and recovers gradually within bounds', () => {
  const ratio = new AdaptivePixelRatio();
  assert.equal(ratio.update(32, 1500), .85);
  assert.equal(ratio.update(32, 1600), .85);
  assert.equal(ratio.update(32, 3000), .75);
  assert.equal(ratio.update(59, 4500), .8);
  for (let i = 0; i < 30; i++) ratio.update(60, 6000 + i * 1300);
  assert.equal(ratio.value, 1.5);
  assert.equal(ratio.update(20, 50_000, 30), 1.5);
  assert.equal(clampPixelRatio(.2), .5);
});

test('presets keep high effects and auto selection uses measured FPS', () => {
  assert.equal(PERFORMANCE_PRESETS.high.bloom, true);
  assert.equal(PERFORMANCE_PRESETS.medium.bloom, false);
  assert.equal(PERFORMANCE_PRESETS.low.postprocess, false);
  assert.equal(chooseQuality(56), 'high');
  assert.equal(chooseQuality(43), 'medium');
  assert.equal(chooseQuality(28), 'low');
});

test('frame HUD reports average, minimum and current frame times', () => {
  const stats = new FrameStats(3);
  stats.add(100, 4);
  stats.add(116, 5);
  stats.add(132, 6);
  stats.add(164, 9);
  const result = stats.summary();
  assert.equal(Math.round(result.average), 47);
  assert.equal(Math.round(result.minimum), 31);
  assert.equal(result.frameMs, 32);
  assert.equal(result.cpuMs, 9);
  assert.equal(Math.round(stats.recentAverage(1)), 31);
});
