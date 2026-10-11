import { PERFORMANCE_PRESETS } from './performanceSettings.js';

const STORAGE_KEY = 'stand-fronts-performance';
const switches = ['shadows', 'outline', 'bloom', 'postprocess', 'antialias', 'particles'];

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; }
  catch { return {}; }
}

export class PerformancePanel {
  constructor(onChange) {
    this.onChange = onChange;
    const saved = readSaved();
    this.visible = saved.visible === true;
    this.overrides = saved.overrides && typeof saved.overrides === 'object'
      ? saved.overrides : {};
    this.quality = saved.quality ?? null;
    this.hud = document.getElementById('performance-hud');
    this.panel = document.getElementById('performance-panel');
    this.trigger = document.getElementById('quality-trigger');
    this.resolutionValue = document.getElementById('perf-resolution-value');
    this.botsValue = document.getElementById('perf-bots-value');
    this.autoResolution = document.getElementById('perf-resolution-auto');
    this.taps = 0;
    this.lastTapAt = 0;
    this.trigger.addEventListener('click', () => {
      const now = performance.now();
      this.taps = now - this.lastTapAt > 2500 ? 1 : this.taps + 1;
      this.lastTapAt = now;
      if (this.taps < 5) return;
      this.taps = 0;
      this.visible = !this.visible;
      this.syncVisibility();
      this.save();
    });
    for (const input of this.panel.querySelectorAll('[data-perf]')) {
      input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
        const key = input.dataset.perf;
        this.overrides[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (key === 'bloom' && input.checked) this.overrides.postprocess = true;
        if (key === 'postprocess' && !input.checked) this.overrides.bloom = false;
        if (key === 'resolutionScale') this.autoResolution.checked = false;
        this.save();
        this.refresh(this.level);
        this.onChange();
      });
    }
    this.autoResolution.addEventListener('change', () => {
      if (this.autoResolution.checked) delete this.overrides.resolutionScale;
      else this.overrides.resolutionScale = Number(this.panel.querySelector('[data-perf="resolutionScale"]').value);
      this.save();
      this.refresh(this.level);
      this.onChange();
    });
    this.syncVisibility();
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ visible: this.visible,
      quality: this.quality, overrides: this.overrides })); }
    catch { /* Offline app remains usable when storage is unavailable. */ }
  }

  hasOverrides() {
    for (const key in this.overrides) if (Object.hasOwn(this.overrides, key)) return true;
    return false;
  }

  syncVisibility() {
    this.hud.hidden = !this.visible;
    this.panel.hidden = !this.visible;
    this.trigger.setAttribute('aria-expanded', String(this.visible));
  }

  refresh(level) {
    this.level = level;
    const effective = { ...PERFORMANCE_PRESETS[level], ...this.overrides };
    for (const key of switches) this.panel.querySelector(`[data-perf="${key}"]`).checked = !!effective[key];
    this.panel.querySelector('[data-perf="fpsLimit"]').value = String(effective.fpsLimit);
    const botCount = Math.max(0, Math.min(6, Number(effective.botCount ?? 5)));
    this.panel.querySelector('[data-perf="botCount"]').value = String(botCount);
    const slots = this.botSlots ?? 5;
    this.botsValue.textContent = `${Math.min(botCount, slots)}/${slots}`;
    this.autoResolution.checked = this.overrides.resolutionScale === undefined;
    const scale = Number(this.overrides.resolutionScale ?? 1);
    this.panel.querySelector('[data-perf="resolutionScale"]').value = String(scale);
    this.resolutionValue.textContent = `${scale.toFixed(2).replace('.', ',')}×`;
    return effective;
  }

  showMetrics(stats, renderer, entities, ratio) {
    if (!this.visible) return;
    const info = renderer.info;
    this.hud.textContent = `FPS médio ${stats.average.toFixed(0)}  mínimo ${stats.minimum.toFixed(0)}\n`
      + `Frame ${stats.frameMs.toFixed(1)} ms  CPU ${stats.cpuMs.toFixed(1)} ms\n`
      + `Draw ${info.render.calls}  tri ${info.render.triangles}\n`
      + `Texturas ${info.memory.textures}  geometrias ${info.memory.geometries}\n`
      + `Entidades ${entities}  pixel ratio ${ratio.toFixed(2)}×`;
  }
}
