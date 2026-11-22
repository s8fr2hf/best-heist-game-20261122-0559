// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between seven screens:
// title, play, paused, caught, room cleared, clean getaway and game over.
//
// ?seed=N fixes the patrol timing. ?shot=heist|alert|vault|getaway (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, HUD_HEIGHT, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_PICKUP, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_EMP, ACTION_MUTE, ACTION_NOISE, ACTION_PAUSE, ACTION_RETRY,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;

  // Test hook: automated play tests read state and drive input through this handle.
  // It changes nothing about the game itself.
  window.__midnightVault = { world, input, getScreen: () => screen };
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let alarmWasHigh = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.resetRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal everything, then reach the exit.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.stopAlarm();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) {
      world.nextLevel();
      screen = SCREEN_PLAY;
      announce(`Room ${world.state.levelIndex + 1}: ${world.state.level.name}.`);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) {
      if (world.state.lives > 1) {
        world.retryLevel();
        screen = SCREEN_PLAY;
      } else {
        endGame();
      }
    } else if (actions & ACTION_RETRY && (screen === SCREEN_CAUGHT || screen === SCREEN_PLAY)) {
      if (world.state.lives > 1) {
        world.retryLevel();
        screen = SCREEN_PLAY;
        announce('Retrying the room.');
      } else if (screen === SCREEN_CAUGHT) {
        endGame();
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_EMP) {
        const before = world.state.emp;
        world.step(0, { x: 0, y: 0 }, 'emp');
        if (world.state.emp < before) audio.emp();
      }
      if (actions & ACTION_NOISE) {
        const target = input.clickTarget ?? {
          x: world.state.thief.x + Math.cos(world.state.thief.facing) * 120,
          y: world.state.thief.y + Math.sin(world.state.thief.facing) * 120,
        };
        const before = world.state.noise;
        world.step(0, { x: 0, y: 0 }, { kind: 'noise', x: target.x, y: target.y });
        if (world.state.noise < before) {
          audio.toss();
          setTimeout(() => audio.clatter(), 250);
        }
        input.clearClickTarget();
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The room idles behind the title: patrols walk, cameras sweep.
      world.step(STEP, { x: 0, y: 0 }, null);
      return;
    }
    const dir = input.direction();
    let move = dir;
    if (dir.x === 0 && dir.y === 0 && input.clickTarget) {
      const target = input.clickTarget;
      const dx = target.x - world.state.thief.x;
      const dy = target.y - world.state.thief.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 16) {
        input.clearClickTarget();
        move = { x: 0, y: 0 };
      } else {
        move = { x: dx / dist, y: dy / dist };
      }
    }
    const thief = world.state.thief;
    thief.crouching = input.crouching;
    thief.sprinting = input.sprinting && !input.crouching;
    const events = world.step(STEP, move, null);
    if (events & EVENT_PICKUP) {
      if (world.state.lootTaken === world.state.lootTotal) audio.diamond();
      else audio.pickup();
    }
    if (world.state.alarm > 55 && !alarmWasHigh) audio.startAlarm();
    if (world.state.alarm < 30 && alarmWasHigh) audio.stopAlarm();
    alarmWasHigh = world.state.alarm > 55;
    if (events & EVENT_CAUGHT) {
      audio.caught();
      audio.stopAlarm();
      alarmWasHigh = false;
      screen = SCREEN_CAUGHT;
      announce(world.state.lives > 1 ? 'Caught! Press R to retry the room.' : 'Caught! That was your last life.');
    } else if (events & EVENT_WIN) {
      audio.win();
      audio.stopAlarm();
      screen = SCREEN_WIN;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Clean getaway! Final score ${world.state.score}.`);
    } else if (events & EVENT_LEVEL_CLEAR) {
      audio.win();
      audio.stopAlarm();
      screen = SCREEN_CLEAR;
      announce(`${world.state.level.name} cleared. Score ${world.state.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Enter to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
