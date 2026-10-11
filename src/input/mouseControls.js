export class MouseControls {
  constructor(canvas, windowObject = window) {
    this.aimScreen = null;
    this.mouseScreen = null;
    this.pointerId = null;
    this.releases = [];
    windowObject.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') this.mouseScreen = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || this.pointerId !== null) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      this.pointerId = event.pointerId;
      this.aimScreen = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId === this.pointerId) this.aimScreen = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerup', event => {
      if (event.pointerId !== this.pointerId) return;
      this.releases.push({ x: event.clientX, y: event.clientY });
      this.reset();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        if (event.pointerId === this.pointerId) this.reset();
      });
    }
    windowObject.addEventListener('blur', () => {
      this.reset();
      this.releases.length = 0;
    });
  }

  reset() {
    this.pointerId = null;
    this.aimScreen = null;
  }

  consumeRelease() {
    return this.releases.shift() ?? null;
  }
}
