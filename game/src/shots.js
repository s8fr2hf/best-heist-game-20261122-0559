// The screenshot scenes behind ?shot=heist|alert|vault|getaway. Each one plays the real rules
// forward from a fresh world for a fixed stretch, steered by a small autopilot that walks a
// list of waypoints and freezes whenever a guard's cone is on it, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_CAUGHT, STATE_CHASE, hasLineOfSight } from './world.js';
import { SCREEN_PLAY, SCREEN_WIN } from './render.js';
import { GUARD } from './config.js';

const SAMPLE = STEP;

/** Would a guard or camera at (x,y) facing `angle` see a thief standing at (tx,ty)? */
function coneCovers(level, x, y, angle, halfAngle, dist, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  if (d > dist || d < 1) return false;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > halfAngle) return false;
  return hasLineOfSight(level, x, y, tx, ty);
}

function inAnyCone(state, tx, ty) {
  // Only guard cones make the autopilot wait: a camera cannot catch the thief, and
  // standing still inside a camera's sweep only feeds the alarm.
  const level = state.level;
  for (const guard of state.guards) {
    if (coneCovers(level, guard.x, guard.y, guard.facing, GUARD.viewHalfAngle, GUARD.viewDist, tx, ty)) return true;
  }
  return false;
}

/**
 * Walk the waypoints in order. Freeze while a guard's cone covers the thief (a real player
 * waits for the patrol to pass); if frozen too long, slip through anyway — a little alarm
 * makes a better picture than standing still forever. Once the last waypoint is reached,
 * linger briefly for the frame, then stop. Returns false if the thief was caught.
 */
function autopilot(world, waypoints, maxSeconds) {
  const state = world.state;
  let targetIndex = 0;
  let frozen = 0;
  let settled = 0;
  for (let t = 0; t < maxSeconds; t += SAMPLE) {
    if (targetIndex >= waypoints.length) {
      world.step(SAMPLE, { x: 0, y: 0 }, null);
      settled += SAMPLE;
      if (settled >= 1.2) return true;
      continue;
    }
    const target = waypoints[targetIndex];
    const dx = target[0] - state.thief.x;
    const dy = target[1] - state.thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) {
      targetIndex += 1;
      continue;
    }
    const nx = state.thief.x + (dx / dist) * 20;
    const ny = state.thief.y + (dy / dist) * 20;
    const danger = inAnyCone(state, state.thief.x, state.thief.y)
      || inAnyCone(state, nx, ny);
    const chased = state.guards.some((g) => g.state === STATE_CHASE);
    if ((danger || chased) && frozen < 2.5) {
      frozen += SAMPLE;
      world.step(SAMPLE, { x: 0, y: 0 }, null);
    } else {
      frozen = 0;
      const events = world.step(SAMPLE, { x: dx / dist, y: dy / dist }, null);
      if (events & EVENT_CAUGHT) return false;
    }
    if (state.caught) return false;
  }
  return true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score.
 * Unknown names stage the heist scene.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'alert') {
    world.loadLevel(0);
    // Walk straight into the patrolling warden's lane so the alarm climbs and he gives chase.
    // Stop just before he grabs the thief, while the chase is at its most dramatic.
    state.thief.x = 640;
    state.thief.y = 470;
    for (let t = 0; t < 3.5; t += SAMPLE) {
      world.step(SAMPLE, { x: 0, y: 0 }, null);
      const nearest = Math.min(...state.guards.map((g) => Math.hypot(g.x - state.thief.x, g.y - state.thief.y)));
      if (state.alarm >= 35 || nearest < 50) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'vault') {
    world.loadLevel(2);
    const ok = autopilot(world, [[300, 400], [534, 390], [640, 400]], 16);
    if (!ok) {
      world.loadLevel(2);
      autopilot(world, [[300, 400]], 6);
    }
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'getaway') {
    world.loadLevel(2);
    state.score = 2450;
    for (const item of state.loot) item.taken = true;
    state.lootTaken = state.lootTotal;
    state.thief.x = state.level.exit.x + state.level.exit.w / 2;
    state.thief.y = state.level.exit.y + state.level.exit.h / 2;
    world.step(SAMPLE, { x: 0, y: 0 }, null);
    return { screen: SCREEN_WIN, best: 2450 };
  }
  // 'heist' (and anything else): the cover — the Lobby, mid-run, diamond in hand.
  world.loadLevel(0);
  const ok = autopilot(world, [[280, 180], [640, 330], [900, 200]], 18);
  if (!ok) {
    world.loadLevel(0);
    autopilot(world, [[280, 180]], 7);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
