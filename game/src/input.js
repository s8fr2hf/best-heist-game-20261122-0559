// Keyboard + mouse input. Keys are tracked by code so WASD and arrows both work;
// a click sets a walk-to target the thief follows until keys take over.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_EMP = 4;
export const ACTION_NOISE = 8;
export const ACTION_MUTE = 16;
export const ACTION_RETRY = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clickTarget = null;

  function scalePoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(code);
    if (code === 'Enter' || code === 'Space') actions |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    if (code === 'KeyE') actions |= ACTION_EMP;
    if (code === 'KeyQ') actions |= ACTION_NOISE;
    if (code === 'KeyM') actions |= ACTION_MUTE;
    if (code === 'KeyR') actions |= ACTION_RETRY;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    clickTarget = scalePoint(event);
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement from keys; {x, y} zero when no key is held. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const len = Math.hypot(x, y);
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    get sprinting() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get crouching() {
      return keys.has('KeyC');
    },
    /** One-shot actions since the last read; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Click-to-move target, or null. Keys clear it; arriving clears it. */
    get clickTarget() {
      return clickTarget;
    },
    clearClickTarget() {
      clickTarget = null;
    },
    /** Test hook: pretend a key is held, for scripted play tests. */
    press(code) { keys.add(code); },
    release(code) { keys.delete(code); },
    clickAt(x, y) { clickTarget = { x, y }; },
  };
}
