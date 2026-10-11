export class TouchControls {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.aim = null;
    this.pendingAttacks = [];
    this.pendingSupers = [];
    this.superAim = null;
    this.superPointer = null;
    this.superMode = 'blocked';
    this.superCanReplace = false;
    this.joystickPointer = null;
    this.attackPointer = null;
    this.attackDragged = false;
    this.joystick = document.getElementById('joystick');
    this.knob = document.getElementById('joystick-knob');
    this.attack = document.getElementById('attack');
    this.attackKnob = document.getElementById('attack-knob');
    this.superButton = document.getElementById('super');
    this.superKnob = document.getElementById('super-knob');

    this.joystick.addEventListener('pointerdown', event => {
      if (this.joystickPointer !== null) return;
      event.preventDefault();
      this.joystick.setPointerCapture(event.pointerId);
      this.joystickPointer = event.pointerId;
      this.updateJoystick(event);
    });
    this.joystick.addEventListener('pointermove', event => {
      if (this.joystickPointer === event.pointerId) this.updateJoystick(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.joystick.addEventListener(type, event => {
        if (this.joystickPointer === event.pointerId) this.resetJoystick();
      });
    }

    this.attack.addEventListener('pointerdown', event => {
      if (this.attackPointer !== null) return;
      event.preventDefault();
      this.attack.setPointerCapture(event.pointerId);
      this.attackPointer = event.pointerId;
      this.attackStart = { x: event.clientX, y: event.clientY };
      this.attackDragged = false;
      this.attack.classList.add('pressed');
    });
    this.attack.addEventListener('pointermove', event => {
      if (this.attackPointer === event.pointerId) this.updateAttack(event);
    });
    this.attack.addEventListener('pointerup', event => {
      if (this.attackPointer !== event.pointerId) return;
      this.updateAttack(event);
      if (this.attackDragged) {
        if (this.aim) this.pendingAttacks.push({ type: 'aim', direction: this.aim });
      } else {
        this.pendingAttacks.push({ type: 'auto' });
      }
      this.resetAttack();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      this.attack.addEventListener(type, event => {
        if (this.attackPointer === event.pointerId) this.resetAttack();
      });
    }
    this.superButton.addEventListener('pointerdown', event => {
      if (this.superPointer !== null || this.superMode === 'blocked') return;
      event.preventDefault();
      this.superButton.setPointerCapture(event.pointerId);
      this.superPointer = event.pointerId;
      this.superStart = { x: event.clientX, y: event.clientY };
      this.superDragged = false;
      this.superPressMode = this.superMode;
      this.superReplaceOnDrag = this.superMode === 'enter' && this.superCanReplace;
      this.superButton.classList.add('pressed');
    });
    this.superButton.addEventListener('pointermove', event => {
      if (this.superPointer === event.pointerId &&
          (this.superPressMode === 'launch' || this.superReplaceOnDrag)) this.updateSuper(event);
    });
    this.superButton.addEventListener('pointerup', event => {
      if (this.superPointer !== event.pointerId) return;
      if (this.superReplaceOnDrag && this.superDragged) {
        this.updateSuper(event);
        if (this.superAim) this.pendingSupers.push({ type: 'aim', direction: this.superAim });
      } else if (this.superPressMode === 'enter' || this.superPressMode === 'exit') {
        if (Math.hypot(event.clientX - this.superStart.x, event.clientY - this.superStart.y) < 14)
          this.pendingSupers.push({ type: this.superPressMode });
      } else {
        this.updateSuper(event);
        if (this.superDragged) {
          if (this.superAim) this.pendingSupers.push({ type: 'aim', direction: this.superAim });
        } else this.pendingSupers.push({ type: 'auto' });
      }
      this.resetSuper();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      this.superButton.addEventListener(type, event => {
        if (this.superPointer === event.pointerId) this.resetSuper();
      });
    }
    window.addEventListener('blur', () => {
      this.resetJoystick();
      this.resetAttack();
      this.resetSuper();
      this.pendingAttacks.length = 0;
      this.pendingSupers.length = 0;
    });
  }

  resetJoystick() {
    this.joystickPointer = null;
    this.move = { x: 0, y: 0 };
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  resetAttack() {
    this.attackPointer = null;
    this.attackStart = null;
    this.attackDragged = false;
    this.aim = null;
    this.attackKnob.style.transform = 'translate(-50%, -50%)';
    this.attack.classList.remove('pressed', 'aiming');
  }

  consumeAttack() {
    return this.pendingAttacks.shift() ?? null;
  }

  resetSuper() {
    this.superPointer = null;
    this.superStart = null;
    this.superDragged = false;
    this.superReplaceOnDrag = false;
    this.superAim = null;
    this.superKnob.style.transform = 'translate(-50%, -50%)';
    this.superButton.classList.remove('pressed', 'aiming');
  }

  consumeSuper() {
    return this.pendingSupers.shift() ?? null;
  }

  updateSuper(event) {
    const travel = Math.hypot(event.clientX - this.superStart.x, event.clientY - this.superStart.y);
    if (travel >= 14) this.superDragged = true;
    if (!this.superDragged) return;
    const bounds = this.superButton.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(x, y);
    if (length < 14) {
      this.superAim = null;
      this.superKnob.style.transform = 'translate(-50%, -50%)';
      this.superButton.classList.remove('aiming');
      return;
    }
    const radius = Math.max(0, bounds.width / 2 - this.superKnob.getBoundingClientRect().width / 2 - 5);
    const clamped = Math.min(length, radius);
    this.superAim = { x: x / length, y: y / length };
    this.superKnob.style.transform = `translate(-50%, -50%) translate(${this.superAim.x * clamped}px, ${this.superAim.y * clamped}px)`;
    this.superButton.classList.add('aiming');
  }

  updateJoystick(event) {
    const bounds = this.joystick.getBoundingClientRect();
    const radius = bounds.width / 2 - 23;
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(x, y);
    const scale = length > radius ? radius / length : 1;
    const dx = x * scale;
    const dy = y * scale;
    this.move = { x: dx / radius, y: dy / radius };
    this.knob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }

  updateAttack(event) {
    const travel = Math.hypot(event.clientX - this.attackStart.x, event.clientY - this.attackStart.y);
    if (travel >= 14) this.attackDragged = true;
    if (!this.attackDragged) return;
    const bounds = this.attack.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(x, y);
    if (length < 14) {
      this.aim = null;
      this.attackKnob.style.transform = 'translate(-50%, -50%)';
      this.attack.classList.remove('aiming');
      return;
    }
    const radius = Math.max(0, bounds.width / 2 - this.attackKnob.getBoundingClientRect().width / 2 - 6);
    const clamped = Math.min(length, radius);
    this.aim = { x: x / length, y: y / length };
    this.attackKnob.style.transform = `translate(-50%, -50%) translate(${this.aim.x * clamped}px, ${this.aim.y * clamped}px)`;
    this.attack.classList.add('aiming');
  }
}
