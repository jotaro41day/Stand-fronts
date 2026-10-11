export class MouseControls {
  constructor(canvas, windowObject = window) {
    this.aimScreen = null;
    this.mouseScreen = null;
    this.pointerId = null;
    this.releases = [];
    windowObject.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') this.mouseScreen = { x: event.clientX, y: event.clientY };
    });
    this.onPointerDown = event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || this.pointerId !== null) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.pointerId = event.pointerId;
      this.aimScreen = { x: event.clientX, y: event.clientY };
    };
    this.onPointerMove = event => {
      if (event.pointerId === this.pointerId) this.aimScreen = { x: event.clientX, y: event.clientY };
    };
    this.onPointerUp = event => {
      if (event.pointerId !== this.pointerId) return;
      this.releases.push({ x: event.clientX, y: event.clientY });
      this.reset();
    };
    this.onPointerCancel = event => {
      if (event.pointerId === this.pointerId) this.reset();
    };
    this.attachCanvas(canvas);
    windowObject.addEventListener('blur', () => {
      this.reset();
      this.releases.length = 0;
    });
  }

  attachCanvas(canvas) {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
      this.canvas.removeEventListener('lostpointercapture', this.onPointerCancel);
    }
    this.reset();
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onPointerCancel);
  }

  reset() {
    this.pointerId = null;
    this.aimScreen = null;
  }

  consumeRelease() {
    return this.releases.shift() ?? null;
  }
}
