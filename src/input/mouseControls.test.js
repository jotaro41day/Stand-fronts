import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
  constructor() { this.listeners = new Map(); this.captured = new Set(); }
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener));
  }
  setPointerCapture(id) { this.captured.add(id); }
  dispatch(type, id, x, y, pointerType = 'mouse') {
    const event = { pointerId: id, clientX: x, clientY: y, pointerType, button: 0, preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

test('mouse aims only while held and shoots once on release', async () => {
  const module = await import('./mouseControls.js').catch(() => ({}));
  assert.equal(typeof module.MouseControls, 'function');
  const canvas = new Element(), window = new Element();
  const controls = new module.MouseControls(canvas, window);
  canvas.dispatch('pointermove', 1, 90, 20);
  assert.equal(controls.aimScreen, null);
  canvas.dispatch('pointerdown', 1, 90, 20);
  assert.ok(canvas.captured.has(1));
  canvas.dispatch('pointermove', 1, 120, 35);
  assert.deepEqual(controls.aimScreen, { x: 120, y: 35 });
  assert.equal(controls.consumeRelease(), null);
  canvas.dispatch('pointerup', 1, 130, 40);
  assert.deepEqual(controls.consumeRelease(), { x: 130, y: 40 });
  assert.equal(controls.consumeRelease(), null);
  assert.equal(controls.aimScreen, null);
  canvas.dispatch('pointerdown', 2, 90, 20);
  canvas.dispatch('pointercancel', 2, 90, 20);
  assert.equal(controls.consumeRelease(), null);
});

test('mouse input follows a replacement canvas after antialias changes', async () => {
  const { MouseControls } = await import('./mouseControls.js');
  const oldCanvas = new Element(), newCanvas = new Element(), window = new Element();
  const controls = new MouseControls(oldCanvas, window);
  controls.attachCanvas(newCanvas);
  oldCanvas.dispatch('pointerdown', 1, 0, 0);
  assert.equal(controls.pointerId, null);
  newCanvas.dispatch('pointerdown', 2, 12, 20);
  newCanvas.dispatch('pointerup', 2, 18, 21);
  assert.deepEqual(controls.consumeRelease(), { x: 18, y: 21 });
});
