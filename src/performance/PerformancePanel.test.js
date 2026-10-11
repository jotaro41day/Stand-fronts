import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformancePanel } from './PerformancePanel.js';

class Element {
  constructor() { this.hidden = true; this.listeners = new Map(); this.attributes = new Map(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  emit(type) { this.listeners.get(type)?.(); }
}

test('five quality taps reveal diagnostics and keep the choice for the next opening', () => {
  const nodes = new Map();
  const settings = new Map();
  for (const id of ['performance-hud', 'performance-panel', 'quality-trigger',
    'perf-resolution-value', 'perf-bots-value', 'perf-resolution-auto']) nodes.set(id, new Element());
  const panel = nodes.get('performance-panel');
  const controls = new Map();
  for (const key of ['shadows', 'outline', 'bloom', 'postprocess', 'antialias',
    'particles', 'resolutionScale', 'botCount', 'fpsLimit']) {
    const control = new Element();
    control.dataset = { perf: key };
    control.type = ['resolutionScale', 'botCount'].includes(key) ? 'range'
      : key === 'fpsLimit' ? 'select-one' : 'checkbox';
    controls.set(key, control);
  }
  panel.querySelectorAll = () => controls.values();
  panel.querySelector = selector => controls.get(selector.match(/"([^"]+)"/)[1]);
  const previousDocument = globalThis.document;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  globalThis.document = { getElementById: id => nodes.get(id) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => settings.get(key) ?? null,
    setItem: (key, value) => settings.set(key, value),
  } });
  try {
    const debug = new PerformancePanel(() => {});
    debug.botSlots = 5;
    debug.refresh('medium');
    const trigger = nodes.get('quality-trigger');
    for (let i = 0; i < 5; i++) trigger.emit('click');
    assert.equal(debug.visible, true);
    assert.equal(nodes.get('performance-hud').hidden, false);
    assert.equal(trigger.attributes.get('aria-expanded'), 'true');
    assert.equal(new PerformancePanel(() => {}).visible, true);
  } finally {
    globalThis.document = previousDocument;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});
