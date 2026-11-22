// Shared tuning for Midnight Vault: canvas size, movement speeds, vision, alarm and tools.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 800;
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;
export const BEST_KEY = 'midnight-vault-best';

export const THIEF = {
  radius: 13,
  walk: 165,
  crouch: 95,
  sprint: 235,
  // How far a guard can spot the thief at each pace, before crouch/darkness shrink it.
  seenWalk: 1.0,
  seenCrouch: 0.55,
  seenSprint: 1.25,
};

export const GUARD = {
  radius: 14,
  patrol: 82,
  suspicious: 120,
  chase: 158,
  search: 100,
  viewDist: 250,
  viewHalfAngle: 0.52, // radians either side of facing, about a 60-degree cone
  spotTime: 0.55, // seconds of being seen before a guard commits to chase
  catchDist: 24,
  hearRadius: 170, // sprinting is heard this far
};

export const CAMERA = {
  viewDist: 230,
  viewHalfAngle: 0.42,
  sweepSpeed: 0.55, // radians per second
};

export const ALARM = {
  riseSeen: 26, // per second while any guard or camera sees the thief
  riseCamera: 34,
  decay: 9, // per second while unseen
  lockdownAt: 100,
};

export const TOOLS = {
  empRange: 280,
  empSeconds: 9,
  noiseRadius: 240,
  noiseLinger: 4, // seconds a thrown noise-maker keeps guards interested
};

export const SCORE = {
  gold: 100,
  intel: 150,
  diamond: 500,
  levelClear: 250,
  ghostBonus: 400, // finishing a level without the alarm ever passing 50
  timeBonusPerSecond: 5, // under par time
};
