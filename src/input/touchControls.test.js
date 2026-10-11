import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls } from './touchControls.js';

class Element {
  constructor(left = 0, top = 0, width = 112, height = width) {
    this.rect = { left, top, width, height };
    this.listeners = new Map();
    this.style = {};
    const names = new Set();
    this.classList = {
      add: (...items) => items.forEach(item => names.add(item)),
      remove: (...items) => items.forEach(item => names.delete(item)),
      contains: item => names.has(item),
    };
    this.captured = new Set();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  setPointerCapture(pointerId) { this.captured.add(pointerId); }
  getBoundingClientRect() { return this.rect; }
  dispatch(type, pointerId, clientX, clientY) {
    const event = { type, pointerId, clientX, clientY, preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function setup() {
  const elements = {
    joystick: new Element(0, 0, 112),
    'joystick-knob': new Element(),
    attack: new Element(200, 0, 92),
    'attack-knob': new Element(0, 0, 42),
    super: new Element(120, 0, 72),
    'super-knob': new Element(0, 0, 30),
  };
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { getElementById: id => elements[id] };
  globalThis.window = new Element();
  return {
    elements,
    controls: new TouchControls(),
    restore() { globalThis.document = previousDocument; globalThis.window = previousWindow; },
  };
}

test('movement and aim use independent pointers and fire only on attack release', () => {
  const { elements, controls, restore } = setup();
  try {
    const move = elements.joystick, attack = elements.attack;
    move.dispatch('pointerdown', 1, 56, 56);
    move.dispatch('pointermove', 1, 91, 56);
    assert.ok(controls.move.x > .5);
    attack.dispatch('pointerdown', 2, 246, 46);
    assert.ok(attack.captured.has(2));
    assert.equal(controls.aim, null);
    assert.equal(controls.consumeAttack(), null);
    attack.dispatch('pointermove', 2, 280, 46);
    assert.ok(controls.aim.x > .99);
    assert.ok(controls.move.x > .5);
    assert.equal(controls.consumeAttack(), null);
    attack.dispatch('pointerup', 2, 280, 46);
    assert.deepEqual(controls.consumeAttack(), { type: 'aim', direction: { x: 1, y: 0 } });
    assert.equal(controls.aim, null);
    assert.ok(controls.move.x > .5);
    move.dispatch('pointercancel', 1, 91, 56);
    assert.deepEqual(controls.move, { x: 0, y: 0 });
  } finally { restore(); }
});

test('super uses a separate pointer, aims on drag, and cancels on return to center', () => {
  const { elements, controls, restore } = setup();
  try {
    controls.superMode = 'launch';
    elements.joystick.dispatch('pointerdown', 1, 56, 56);
    elements.joystick.dispatch('pointermove', 1, 90, 56);
    elements.super.dispatch('pointerdown', 2, 156, 36);
    elements.super.dispatch('pointermove', 2, 184, 36);
    assert.ok(controls.superAim.x > .99);
    assert.ok(controls.move.x > .5);
    assert.equal(controls.consumeSuper(), null);
    elements.super.dispatch('pointerup', 2, 184, 36);
    assert.deepEqual(controls.consumeSuper(), { type: 'aim', direction: { x: 1, y: 0 } });
    elements.super.dispatch('pointerdown', 3, 156, 36);
    elements.super.dispatch('pointermove', 3, 184, 36);
    elements.super.dispatch('pointerup', 3, 156, 36);
    assert.equal(controls.consumeSuper(), null);
    elements.super.dispatch('pointerdown', 4, 156, 36);
    elements.super.dispatch('pointercancel', 4, 156, 36);
    assert.equal(controls.consumeSuper(), null);
  } finally { restore(); }
});

test('tap auto aims, returning to center cancels, and pointercancel never fires', () => {
  const { elements, controls, restore } = setup();
  try {
    const attack = elements.attack;
    attack.dispatch('pointerdown', 3, 246, 46);
    attack.dispatch('pointerup', 3, 246, 46);
    assert.deepEqual(controls.consumeAttack(), { type: 'auto' });
    attack.dispatch('pointerdown', 4, 246, 46);
    attack.dispatch('pointermove', 4, 280, 46);
    attack.dispatch('pointermove', 4, 246, 46);
    assert.equal(controls.aim, null);
    attack.dispatch('pointerup', 4, 246, 46);
    assert.equal(controls.consumeAttack(), null);
    attack.dispatch('pointerdown', 5, 246, 46);
    attack.dispatch('pointermove', 5, 280, 46);
    attack.dispatch('pointercancel', 5, 280, 46);
    assert.equal(controls.consumeAttack(), null);
  } finally { restore(); }
});

test('super button switches between entering and exiting with a tap', () => {
  const { elements, controls, restore } = setup();
  try {
    controls.superMode = 'enter';
    elements.super.dispatch('pointerdown', 6, 156, 36);
    elements.super.dispatch('pointerup', 6, 156, 36);
    assert.deepEqual(controls.consumeSuper(), { type: 'enter' });
    controls.superMode = 'exit';
    elements.super.dispatch('pointerdown', 7, 156, 36);
    elements.super.dispatch('pointerup', 7, 156, 36);
    assert.deepEqual(controls.consumeSuper(), { type: 'exit' });
  } finally { restore(); }
});

test('dragging ENTRAR launches a replacement when the super has recharged', () => {
  const { elements, controls, restore } = setup();
  try {
    controls.superMode = 'enter';
    controls.superCanReplace = true;
    elements.super.dispatch('pointerdown', 8, 156, 36);
    elements.super.dispatch('pointermove', 8, 184, 36);
    elements.super.dispatch('pointerup', 8, 184, 36);
    assert.deepEqual(controls.consumeSuper(), { type: 'aim', direction: { x: 1, y: 0 } });
  } finally { restore(); }
});
