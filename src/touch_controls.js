// touch_controls.js — автономный сенсорный ввод поверх общей игровой логики.
// Узкое окно само по себе режим не включает: нужен реальный touch и coarse/no-hover pointer.

export function detectTouchDevice() {
  const points = Number(navigator.maxTouchPoints || 0);
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
  return points > 0 && !!(coarse || noHover);
}

export class TouchControls {
  constructor({ canvas, onAction, onReturn, onCrouch, canLook }) {
    this.enabled = detectTouchDevice();
    this.moveX = 0;
    this.moveForward = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.running = false;
    this.crouched = false;
    this.canLook = canLook;
    this.root = document.getElementById('touch-controls');
    if (!this.enabled || !this.root) return;

    this.stick = document.getElementById('touch-move');
    this.knob = document.getElementById('touch-move-knob');
    this.actions = document.getElementById('touch-actions');
    this.actionButton = document.getElementById('touch-action');
    this.runButton = document.getElementById('touch-run');
    this.crouchButton = document.getElementById('touch-crouch');
    this.returnButton = document.getElementById('touch-return');
    this.peepholeButton = document.getElementById('touch-peephole-exit');
    this.stickPointer = null;
    this.lookPointer = null;

    this.bindStick();
    this.bindLook(canvas);
    this.actionButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction();
    });
    this.returnButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onReturn();
    });
    this.runButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.running = !this.running;
      this.syncButtons();
    });
    this.crouchButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCrouch();
    });
    this.peepholeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction();
    });
  }

  bindStick() {
    const update = (event) => {
      const rect = this.stick.getBoundingClientRect();
      const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
      let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
      let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      this.moveX = x;
      this.moveForward = -y;
      const travel = Math.min(rect.width, rect.height) * 0.27;
      this.knob.style.transform = `translate(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px))`;
    };
    this.stick.addEventListener('pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.stickPointer = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      update(event);
    });
    this.stick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.stickPointer) return;
      event.preventDefault();
      update(event);
    });
    const release = (event) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.moveX = 0;
      this.moveForward = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    this.stick.addEventListener('pointerup', release);
    this.stick.addEventListener('pointercancel', release);
    this.stick.addEventListener('lostpointercapture', release);
  }

  bindLook(canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      if (this.lookPointer !== null || !this.canLook()) return;
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer || !this.canLook()) return;
      event.preventDefault();
      this.lookX += event.clientX - this.lastLookX;
      this.lookY += event.clientY - this.lastLookY;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
    });
    const release = (event) => {
      if (event.pointerId !== this.lookPointer) return;
      this.lookPointer = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
  }

  consumeLook(out = { x: 0, y: 0 }) {
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  setCrouched(value) {
    this.crouched = !!value;
    this.syncButtons();
  }

  syncButtons() {
    if (!this.enabled || !this.root) return;
    const key = `${this.running}|${this.crouched}`;
    if (this._buttonKey === key) return;
    this._buttonKey = key;
    this.runButton.setAttribute('aria-pressed', String(this.running));
    this.crouchButton.setAttribute('aria-pressed', String(this.crouched));
  }

  update({ visible, walking, peephole, store, canAction, canReturn, crouched }) {
    if (!this.enabled || !this.root) return;
    const key = (visible ? 1 : 0) | (walking ? 2 : 0) | (peephole ? 4 : 0)
      | (store ? 8 : 0) | (canAction ? 16 : 0) | (canReturn ? 32 : 0) | (crouched ? 64 : 0);
    if (this._updateKey === key) return;
    this._updateKey = key;
    this.root.classList.toggle('hidden', !visible);
    this.stick.classList.toggle('hidden', !walking);
    this.actions.classList.toggle('hidden', !walking);
    this.peepholeButton.classList.toggle('hidden', !peephole || !visible);
    this.returnButton.classList.toggle('hidden', !store);
    this.actionButton.disabled = !canAction;
    this.returnButton.disabled = !canReturn;
    this.crouched = !!crouched;
    if (!walking) {
      this.moveX = 0;
      this.moveForward = 0;
      this.running = false;
      this.stickPointer = null;
      this.lookPointer = null;
      this.lookX = 0;
      this.lookY = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
    }
    this.syncButtons();
  }

  reset() {
    this.moveX = 0;
    this.moveForward = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.running = false;
    this.stickPointer = null;
    this.lookPointer = null;
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
    this.syncButtons();
  }
}
