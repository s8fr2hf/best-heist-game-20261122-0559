// The simulation: one thief, patrolling guards, sweeping cameras, loot and an alarm.
// Guards cycle patrol -> suspicious -> chase -> search; cameras raise the alarm; the thief
// wins a level by taking every loot item and reaching the exit, and wins the night by
// clearing all three rooms. Nothing here draws anything — render.js owns that.
import { ALARM, CAMERA, CANVAS_HEIGHT, CANVAS_WIDTH, GUARD, HUD_HEIGHT, SCORE, STEP, THIEF, TOOLS } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_CLEAR = 8;
export const EVENT_WIN = 16;
export const EVENT_EMP = 32;
export const EVENT_NOISE = 64;

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_CHASE = 'chase';
export const STATE_SEARCH = 'search';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/** Does segment (x1,y1)-(x2,y2) cross rectangle r? */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/** True when no wall stands between the two points. */
export function hasLineOfSight(level, x1, y1, x2, y2) {
  for (const wall of level.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Move a circle against the walls, axis by axis, so it slides along them; never leaves the room. */
function moveWithWalls(level, body, dx, dy) {
  const nx = body.x + dx;
  if (!level.walls.some((w) => circleHitsRect(nx, body.y, body.radius, w))) body.x = nx;
  const ny = body.y + dy;
  if (!level.walls.some((w) => circleHitsRect(body.x, ny, body.radius, w))) body.y = ny;
  body.x = Math.max(body.radius, Math.min(CANVAS_WIDTH - body.radius, body.x));
  body.y = Math.max(HUD_HEIGHT + body.radius, Math.min(CANVAS_HEIGHT - body.radius, body.y));
}

function circleHitsRect(cx, cy, radius, r) {
  const nearestX = Math.max(r.x, Math.min(cx, r.x + r.w));
  const nearestY = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function thiefInDark(level, thief) {
  return level.dark.some((patch) => pointInRect(thief.x, thief.y, patch));
}

/** How far a watcher can spot the thief right now, given pace and cover. */
function spotRange(thief, crouching) {
  let factor = crouching ? THIEF.seenCrouch : THIEF.seenWalk;
  if (thief.sprinting) factor = THIEF.seenSprint;
  if (thief.hidden) factor *= 0.45;
  return factor;
}

/** Can watcher at (x,y) facing `angle` with this cone see the thief? */
function canSee(level, x, y, angle, halfAngle, maxDist, thief) {
  const dx = thief.x - x;
  const dy = thief.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist || dist < 1) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  return hasLineOfSight(level, x, y, thief.x, thief.y);
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    thief: null,
    guards: [],
    cameras: [],
    loot: [],
    alarm: 0,
    maxAlarm: 0,
    score: 0,
    lives: 3,
    time: 0, // seconds in this level
    totalTime: 0,
    lootTaken: 0,
    lootTotal: 0,
    emp: 0,
    noise: 0,
    noises: [], // {x, y, ttl} thrown noise-makers guards investigate
    message: '',
    messageTtl: 0,
    caught: false,
    levelCleared: false,
    won: false,
    spottedNow: false,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.thief = {
      x: level.start.x,
      y: level.start.y,
      radius: THIEF.radius,
      facing: -Math.PI / 2,
      crouching: false,
      sprinting: false,
      hidden: false,
      moving: false,
      stepT: 0,
    };
    state.guards = level.guards.map((g) => ({
      x: g.x,
      y: g.y,
      radius: GUARD.radius,
      facing: g.facing,
      waypoints: g.waypoints,
      waypointIndex: 1 % g.waypoints.length,
      state: STATE_PATROL,
      suspicion: 0,
      investigate: null, // {x, y}
      searchT: 0,
      waitT: 0,
    }));
    state.cameras = level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      phase: random() * TAU,
      angle: c.baseAngle,
      disabledT: 0,
    }));
    state.loot = level.loot.map((item) => ({ ...item, taken: false }));
    state.alarm = 0;
    state.maxAlarm = 0;
    state.time = 0;
    state.lootTaken = 0;
    state.lootTotal = level.loot.length;
    state.emp = level.emp;
    state.noise = level.noise;
    state.noises = [];
    state.caught = false;
    state.levelCleared = false;
    state.message = '';
    state.messageTtl = 0;
  }

  loadLevel(0);

  function useEmp() {
    if (state.emp <= 0) {
      state.message = 'No EMP charges left.';
      state.messageTtl = 2;
      return EVENT_NONE;
    }
    let hit = false;
    for (const camera of state.cameras) {
      const dist = Math.hypot(camera.x - state.thief.x, camera.y - state.thief.y);
      if (dist <= TOOLS.empRange) {
        camera.disabledT = TOOLS.empSeconds;
        hit = true;
      }
    }
    state.emp -= 1;
    state.message = hit ? 'EMP burst — cameras down!' : 'EMP fired, but no camera in range.';
    state.messageTtl = 2;
    return EVENT_EMP;
  }

  function throwNoise(target) {
    if (state.noise <= 0) {
      state.message = 'No noise-makers left.';
      state.messageTtl = 2;
      return EVENT_NONE;
    }
    state.noise -= 1;
    const x = Math.max(40, Math.min(1240, target.x));
    const y = Math.max(90, Math.min(770, target.y));
    state.noises.push({ x, y, ttl: TOOLS.noiseLinger });
    for (const guard of state.guards) {
      const dist = Math.hypot(guard.x - x, guard.y - y);
      if (dist <= TOOLS.noiseRadius && guard.state !== STATE_CHASE) {
        guard.state = STATE_SUSPICIOUS;
        guard.investigate = { x, y };
        guard.suspicion = 0.6;
      }
    }
    state.message = 'Clatter! A guard goes to look.';
    state.messageTtl = 2;
    return EVENT_NOISE;
  }

  function stepGuard(guard, dt, events) {
    const thief = state.thief;
    const level = state.level;
    const seen = canSee(
      level, guard.x, guard.y, guard.facing,
      GUARD.viewHalfAngle, GUARD.viewDist * spotRange(thief, thief.crouching), thief,
    );
    if (seen) {
      guard.suspicion += dt / GUARD.spotTime;
      guard.investigate = { x: thief.x, y: thief.y };
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - dt * 0.8);
    }
    if (guard.suspicion >= 1 && guard.state !== STATE_CHASE) {
      guard.state = STATE_CHASE;
      if (!(events & EVENT_SPOTTED)) {
        state.message = 'Spotted! Break line of sight!';
        state.messageTtl = 2;
      }
      events |= EVENT_SPOTTED;
    }

    let speed = GUARD.patrol;
    let target = null;
    if (guard.state === STATE_CHASE) {
      speed = GUARD.chase;
      target = seen ? { x: thief.x, y: thief.y } : guard.investigate;
      if (!seen && guard.investigate) {
        const d = Math.hypot(guard.x - guard.investigate.x, guard.y - guard.investigate.y);
        if (d < 30) {
          guard.state = STATE_SEARCH;
          guard.searchT = 3;
        }
      }
      if (!seen && guard.suspicion <= 0) {
        guard.state = STATE_SEARCH;
        guard.searchT = 3;
      }
    } else if (guard.state === STATE_SUSPICIOUS) {
      speed = GUARD.suspicious;
      target = guard.investigate;
      if (target) {
        const d = Math.hypot(guard.x - target.x, guard.y - target.y);
        if (d < 26) {
          guard.state = STATE_SEARCH;
          guard.searchT = 3;
        }
      }
    } else if (guard.state === STATE_SEARCH) {
      speed = GUARD.search;
      guard.searchT -= dt;
      if (guard.searchT <= 0) {
        guard.state = STATE_PATROL;
        guard.investigate = null;
        guard.waypointIndex = nearestWaypoint(guard);
      } else {
        // Wander near the last seen spot while searching.
        const t = guard.searchT;
        target = {
          x: (guard.investigate?.x ?? guard.x) + Math.sin(t * 1.7) * 40,
          y: (guard.investigate?.y ?? guard.y) + Math.cos(t * 1.3) * 40,
        };
      }
    } else {
      // Patrol: walk the loop, pausing briefly at each waypoint.
      if (guard.waitT > 0) {
        guard.waitT -= dt;
      } else {
        target = {
          x: guard.waypoints[guard.waypointIndex][0],
          y: guard.waypoints[guard.waypointIndex][1],
        };
        const d = Math.hypot(target.x - guard.x, target.y - guard.y);
        if (d < 12) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.waitT = 0.7;
        }
      }
    }

    if (target) {
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const want = Math.atan2(dy, dx);
        guard.facing = turnToward(guard.facing, want, dt * 6);
        moveWithWalls(level, guard, (dx / dist) * speed * dt, (dy / dist) * speed * dt);
      }
    }
    return events;
  }

  function nearestWaypoint(guard) {
    let best = 0;
    let bestDist = Infinity;
    guard.waypoints.forEach(([x, y], i) => {
      const d = Math.hypot(x - guard.x, y - guard.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function turnToward(angle, want, maxStep) {
    const diff = angleDiff(want, angle);
    if (Math.abs(diff) <= maxStep) return want;
    return angle + Math.sign(diff) * maxStep;
  }

  function step(dt, move, useTool) {
    let events = EVENT_NONE;
    const thief = state.thief;
    const level = state.level;
    state.time += dt;
    state.totalTime += dt;
    if (state.messageTtl > 0) state.messageTtl -= dt;

    // --- thief movement ---
    const speed = thief.crouching ? THIEF.crouch : thief.sprinting ? THIEF.sprint : THIEF.walk;
    thief.moving = move.x !== 0 || move.y !== 0;
    if (thief.moving) {
      thief.facing = Math.atan2(move.y, move.x);
      moveWithWalls(level, thief, move.x * speed * dt, move.y * speed * dt);
      thief.stepT += dt;
      if (thief.stepT > 0.34) {
        thief.stepT = 0;
        if (thief.sprinting) {
          // Sprinting is loud: nearby guards come to look.
          for (const guard of state.guards) {
            const d = Math.hypot(guard.x - thief.x, guard.y - thief.y);
            if (d < GUARD.hearRadius && guard.state === STATE_PATROL) {
              guard.state = STATE_SUSPICIOUS;
              guard.investigate = { x: thief.x, y: thief.y };
              guard.suspicion = 0.5;
            }
          }
        }
      }
    }
    thief.hidden = thiefInDark(level, thief);

    // --- tools ---
    if (useTool === 'emp') events |= useEmp();
    else if (useTool && useTool.kind === 'noise') events |= throwNoise(useTool);

    // --- cameras sweep and watch ---
    let seenByCamera = false;
    for (const camera of state.cameras) {
      if (camera.disabledT > 0) {
        camera.disabledT -= dt;
        continue;
      }
      camera.phase += CAMERA.sweepSpeed * dt;
      camera.angle = camera.baseAngle + Math.sin(camera.phase) * camera.sweep;
      if (canSee(level, camera.x, camera.y, camera.angle, CAMERA.viewHalfAngle,
        CAMERA.viewDist * spotRange(thief, thief.crouching), thief)) {
        seenByCamera = true;
      }
    }

    // --- guards ---
    let seenByGuard = false;
    for (const guard of state.guards) {
      const before = guard.state;
      events = stepGuard(guard, dt, events);
      if (guard.state === STATE_CHASE) seenByGuard = true;
      if (before !== STATE_CHASE && guard.state === STATE_CHASE) seenByGuard = true;
    }
    state.spottedNow = seenByGuard || seenByCamera;

    // --- alarm ---
    if (state.spottedNow) {
      state.alarm += (seenByCamera ? ALARM.riseCamera : ALARM.riseSeen) * dt;
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }
    state.alarm = Math.min(ALARM.lockdownAt, state.alarm);
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    if (state.alarm >= ALARM.lockdownAt) {
      for (const guard of state.guards) {
        if (guard.state !== STATE_CHASE) {
          guard.state = STATE_CHASE;
          guard.investigate = { x: thief.x, y: thief.y };
          guard.suspicion = 1;
        }
      }
    }

    // --- noise-makers fade ---
    for (const noise of state.noises) noise.ttl -= dt;
    state.noises = state.noises.filter((n) => n.ttl > 0);

    // --- loot ---
    for (const item of state.loot) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - thief.x, item.y - thief.y);
      if (d < thief.radius + 20) {
        item.taken = true;
        state.lootTaken += 1;
        const value = SCORE[item.kind] ?? SCORE.gold;
        state.score += value;
        events |= EVENT_PICKUP;
        state.message = item.kind === 'diamond'
          ? 'The diamond is yours. Get to the exit!'
          : `Loot +${value}`;
        state.messageTtl = 2;
      }
    }

    // --- caught? ---
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - thief.x, guard.y - thief.y);
      if (d < GUARD.catchDist) {
        state.caught = true;
        events |= EVENT_CAUGHT;
        break;
      }
    }

    // --- exit ---
    if (state.lootTaken === state.lootTotal && pointInRect(thief.x, thief.y, level.exit)) {
      state.levelCleared = true;
      const timeBonus = Math.max(0, Math.round((level.par - state.time) * SCORE.timeBonusPerSecond));
      const ghost = state.maxAlarm < 50 ? SCORE.ghostBonus : 0;
      state.score += SCORE.levelClear + timeBonus + ghost;
      events |= EVENT_LEVEL_CLEAR;
      if (state.levelIndex === LEVELS.length - 1) {
        state.won = true;
        events |= EVENT_WIN;
      }
    }
    return events;
  }

  return {
    state,
    /** Advance the world one fixed step. `move` is {x, y}; `useTool` is 'emp', {kind:'noise',x,y} or null. */
    step,
    loadLevel,
    nextLevel() {
      if (state.levelIndex < LEVELS.length - 1) loadLevel(state.levelIndex + 1);
    },
    resetRun() {
      state.score = 0;
      state.lives = 3;
      state.totalTime = 0;
      loadLevel(0);
    },
    retryLevel() {
      state.lives -= 1;
      loadLevel(state.levelIndex);
    },
  };
}
