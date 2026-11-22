// Everything the player sees: the room, the vision cones, the HUD and the screens.
// The canvas is a fixed 1280x800; CSS scales it to the window.
import { ALARM, CAMERA, CANVAS_HEIGHT, CANVAS_WIDTH, GUARD, HUD_HEIGHT } from './config.js';
import { STATE_CHASE, STATE_SEARCH, STATE_SUSPICIOUS, hasLineOfSight } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const GUARD_COLORS = {
  patrol: '#f5a623',
  suspicious: '#ff7a1a',
  chase: '#ff3b30',
  search: '#ffcc00',
};

function drawCone(ctx, x, y, angle, halfAngle, dist, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, dist, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  function drawFloor(level) {
    ctx.fillStyle = '#1b2233';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    // Floor tiles.
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, HUD_HEIGHT);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = HUD_HEIGHT; y <= CANVAS_HEIGHT; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    // Dark patches: crouch here and guards barely see you.
    for (const patch of level.dark) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
      ctx.strokeStyle = 'rgba(120,180,255,0.18)';
      ctx.strokeRect(patch.x + 0.5, patch.y + 0.5, patch.w, patch.h);
    }
    // Walls.
    for (const wall of level.walls) {
      ctx.fillStyle = '#39415a';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = '#4d5878';
      ctx.fillRect(wall.x, wall.y, wall.w, 4);
      ctx.fillRect(wall.x, wall.y, 4, wall.h);
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 4 + item.x);
      ctx.save();
      ctx.translate(item.x, item.y);
      if (item.kind === 'diamond') {
        // The prize, in a glass case.
        ctx.strokeStyle = 'rgba(140,220,255,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-26, -26, 52, 52);
        ctx.fillStyle = 'rgba(140,220,255,0.12)';
        ctx.fillRect(-26, -26, 52, 52);
        ctx.fillStyle = `rgba(120,220,255,${pulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(13, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-13, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#eaf7ff';
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(7, -4);
        ctx.lineTo(0, 2);
        ctx.lineTo(-7, -4);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'intel') {
        ctx.fillStyle = '#8be04e';
        ctx.fillRect(-9, -12, 18, 24);
        ctx.fillStyle = '#1b2233';
        ctx.fillRect(-6, -8, 12, 3);
        ctx.fillRect(-6, -2, 12, 3);
        ctx.fillRect(-6, 4, 8, 3);
        ctx.fillStyle = `rgba(139,224,78,${0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,205,60,${pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5200';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
  }

  function drawExit(state) {
    const level = state.level;
    const open = state.lootTaken === state.lootTotal;
    const blink = open ? 0.7 + 0.3 * Math.sin(state.time * 5) : 1;
    ctx.save();
    ctx.fillStyle = open ? `rgba(60,220,120,${blink})` : 'rgba(90,110,90,0.9)';
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.fillStyle = '#0c2416';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', level.exit.x + level.exit.w / 2, level.exit.y + level.exit.h / 2);
    ctx.restore();
  }

  function drawGuards(state) {
    const level = state.level;
    for (const guard of state.guards) {
      const color = GUARD_COLORS[guard.state] ?? GUARD_COLORS.patrol;
      const alpha = guard.state === STATE_CHASE ? 0.34 : guard.state === STATE_SUSPICIOUS ? 0.28 : 0.2;
      drawCone(ctx, guard.x, guard.y, guard.facing, 0.52, 250, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
      // Guard body.
      ctx.fillStyle = '#2c2f3a';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Facing tick and eyes.
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 7), guard.y + Math.sin(guard.facing) * (guard.radius + 7));
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(guard.state === STATE_CHASE ? '!' : guard.state === STATE_SUSPICIOUS || guard.state === STATE_SEARCH ? '?' : 'G', guard.x, guard.y + 0.5);
      // Suspicion arc over the head.
      if (guard.suspicion > 0.05 && guard.state !== STATE_CHASE) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius + 8, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
    }
    void level;
    void hasLineOfSight;
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      const disabled = camera.disabledT > 0;
      const color = disabled ? '#5a6a7a' : '#ff4d4d';
      if (!disabled) {
        drawCone(ctx, camera.x, camera.y, camera.angle, 0.42, 230, 'rgba(255,77,77,0.16)');
      }
      ctx.fillStyle = '#22242e';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (disabled) {
        ctx.fillStyle = '#cfe8ff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(camera.disabledT)}s`, camera.x, camera.y - 16);
      }
    }
  }

  function drawNoise(state) {
    for (const noise of state.noises) {
      const r = 14 + 6 * Math.sin(state.time * 8);
      ctx.strokeStyle = 'rgba(255,200,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(noise.x, noise.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23c';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♪', noise.x, noise.y - 20);
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    // Soft shadow of being seen: a ring when any watcher has eyes on the thief.
    if (state.spottedNow) {
      ctx.strokeStyle = 'rgba(255,59,48,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, thief.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = thief.crouching ? '#1f9d8a' : '#2fd4b8';
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b3d36';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Mask stripe and facing tick.
    ctx.strokeStyle = '#0b3d36';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(thief.x - 7, thief.y - 2);
    ctx.lineTo(thief.x + 7, thief.y - 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(thief.x, thief.y);
    ctx.lineTo(thief.x + Math.cos(thief.facing) * (thief.radius + 5), thief.y + Math.sin(thief.facing) * (thief.radius + 5));
    ctx.stroke();
  }

  function drawHud(state, screen) {
    ctx.fillStyle = '#10141f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = '#2a3247';
    ctx.fillRect(0, HUD_HEIGHT - 2, CANVAS_WIDTH, 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('MIDNIGHT VAULT', 18, 24);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#9fb0cc';
    ctx.fillText(`${state.level.name}  ·  Level ${state.levelIndex + 1}/3`, 18, 48);

    // Loot.
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`◆ Loot ${state.lootTaken}/${state.lootTotal}`, 330, 24);
    ctx.fillStyle = '#9fb0cc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Score ${state.score}`, 330, 48);

    // Alarm meter.
    const meterX = 540;
    const meterW = 260;
    ctx.fillStyle = '#9fb0cc';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ALARM', meterX, 18);
    ctx.fillStyle = '#222a3d';
    roundRect(ctx, meterX, 28, meterW, 20, 5);
    ctx.fill();
    const frac = state.alarm / ALARM.lockdownAt;
    const alarmColor = frac > 0.75 ? '#ff3b30' : frac > 0.4 ? '#ff9500' : '#ffd23c';
    if (frac > 0.01) {
      ctx.fillStyle = alarmColor;
      roundRect(ctx, meterX, 28, Math.max(8, meterW * frac), 20, 5);
      ctx.fill();
    }
    ctx.strokeStyle = '#4d5878';
    ctx.lineWidth = 1;
    roundRect(ctx, meterX, 28, meterW, 20, 5);
    ctx.stroke();
    ctx.fillStyle = state.alarm >= 100 ? '#ff3b30' : '#9fb0cc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(state.alarm >= 100 ? 'LOCKDOWN!' : `${Math.round(state.alarm)}%`, meterX + meterW + 10, 38);

    // Timer, tools, lives.
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(state.time), 1050, 24);
    ctx.fillStyle = '#9fb0cc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`EMP ${state.emp} · Noise ${state.noise} · ♥ ${state.lives}`, 1050, 48);
    ctx.textAlign = 'left';
    void screen;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent ?? '#e8ecf5';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(title, CANVAS_WIDTH / 2, 300);
    ctx.fillStyle = '#cdd7ea';
    ctx.font = '20px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, CANVAS_WIDTH / 2, 360 + i * 32);
    });
  }

  function draw(state, screen, best) {
    const level = state.level;
    drawFloor(level);
    drawExit(state);
    drawLoot(state);
    drawGuards(state);
    drawCameras(state);
    drawNoise(state);
    drawThief(state);
    drawHud(state, screen);

    // Toast message.
    if (state.message && state.messageTtl > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px sans-serif';
      const w = ctx.measureText(state.message).width + 36;
      ctx.fillStyle = 'rgba(8,10,18,0.85)';
      roundRect(ctx, CANVAS_WIDTH / 2 - w / 2, HUD_HEIGHT + 14, w, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd23c';
      ctx.fillText(state.message, CANVAS_WIDTH / 2, HUD_HEIGHT + 32);
    }

    if (screen === SCREEN_TITLE) {
      overlay('MIDNIGHT VAULT', [
        'One night. Three rooms. Every jewel in the house.',
        'WASD / arrows — move · Shift — sprint (loud!) · C — crouch (hard to spot)',
        'E — EMP a camera · Q + click — throw a noise-maker · P — pause · M — mute',
        'Grab all the loot, then reach the green EXIT. Get caught and the night is over.',
        'Press Enter or click to start the heist.',
        best > 0 ? `Best score: ${best}` : '',
      ], '#ffd23c');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Enter to keep stealing.']);
    } else if (screen === SCREEN_CAUGHT) {
      overlay('BUSTED!', [
        'A warden grabbed you by the collar.',
        state.lives > 1 ? `Lives left: ${state.lives - 1} — press R to try the room again.` : 'That was your last life.',
        'Press R to retry, or Enter for the title screen.',
      ], '#ff3b30');
    } else if (screen === SCREEN_CLEAR) {
      overlay('ROOM CLEARED', [
        `${state.level.name} is empty. Score ${state.score}.`,
        'Press Enter for the next room.',
      ], '#3cdc78');
    } else if (screen === SCREEN_WIN) {
      overlay('CLEAN GETAWAY!', [
        `Every jewel, every room. Final score ${state.score}.`,
        `Total time ${formatTime(state.totalTime)} · Best ${Math.max(best, state.score)}`,
        'Press Enter to play again.',
      ], '#ffd23c');
    } else if (screen === SCREEN_OVER) {
      overlay('THE NIGHT IS OVER', [
        `Score ${state.score} · Best ${Math.max(best, state.score)}`,
        'Press Enter to start a new night.',
      ], '#ff3b30');
    }
  }

  return { draw };
}
