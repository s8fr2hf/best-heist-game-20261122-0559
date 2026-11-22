// The three rooms of one night: the Lobby, the Gallery and the Vault itself.
// Coordinates are canvas pixels; the HUD occupies the top 64 px, so rooms live below y = 80.
// Every wall is a solid rectangle, every dark patch hides a crouched thief, every guard walks a
// loop of waypoints and every camera sweeps back and forth from a fixed mount.
export const LEVELS = [
  {
    name: 'The Lobby',
    subtitle: 'Slip in, lift the display diamond, walk out the service door.',
    par: 75,
    start: { x: 90, y: 700 },
    exit: { x: 1180, y: 92, w: 64, h: 44 },
    emp: 1,
    noise: 2,
    walls: [
      { x: 480, y: 560, w: 320, h: 36 }, // reception desk
      { x: 300, y: 250, w: 60, h: 60 }, // marble pillar
      { x: 920, y: 250, w: 60, h: 60 }, // marble pillar
      { x: 180, y: 150, w: 220, h: 28 }, // planter wall
      { x: 860, y: 620, w: 260, h: 28 }, // bench row
      { x: 60, y: 380, w: 28, h: 180 }, // coat-check wall
    ],
    dark: [
      { x: 120, y: 560, w: 170, h: 130 },
      { x: 1010, y: 130, w: 170, h: 120 },
      { x: 560, y: 640, w: 170, h: 110 },
    ],
    guards: [
      {
        x: 300, y: 430, facing: 0,
        waypoints: [[300, 430], [980, 430], [980, 520], [300, 520]],
      },
      {
        x: 1150, y: 200, facing: Math.PI / 2,
        waypoints: [[1150, 200], [1150, 660]],
      },
    ],
    cameras: [
      { x: 640, y: 88, baseAngle: Math.PI / 2, sweep: 0.65 },
    ],
    loot: [
      { x: 280, y: 180, kind: 'gold' },
      { x: 1000, y: 690, kind: 'gold' },
      { x: 1150, y: 420, kind: 'intel' },
      { x: 640, y: 330, kind: 'diamond' },
    ],
  },
  {
    name: 'The Gallery',
    subtitle: 'Past the partition walls, the sapphire is behind glass in the middle.',
    par: 95,
    start: { x: 80, y: 700 },
    exit: { x: 1200, y: 92, w: 64, h: 44 },
    emp: 2,
    noise: 2,
    walls: [
      { x: 220, y: 200, w: 28, h: 340 }, // partition
      { x: 600, y: 120, w: 28, h: 300 }, // partition, upper
      { x: 600, y: 520, w: 28, h: 200 }, // partition, lower
      { x: 950, y: 200, w: 28, h: 340 }, // partition
      { x: 380, y: 430, w: 220, h: 28 }, // bench
      { x: 800, y: 430, w: 200, h: 28 }, // bench
      { x: 1100, y: 640, w: 120, h: 28 }, // plinth
    ],
    dark: [
      { x: 90, y: 120, w: 160, h: 120 },
      { x: 660, y: 640, w: 180, h: 110 },
      { x: 1030, y: 480, w: 150, h: 120 },
    ],
    guards: [
      {
        x: 200, y: 300, facing: 0,
        waypoints: [[200, 300], [200, 660], [340, 660], [340, 300]],
      },
      {
        x: 760, y: 200, facing: Math.PI,
        waypoints: [[760, 200], [760, 660], [700, 660], [700, 200]],
      },
      {
        x: 1060, y: 300, facing: Math.PI,
        waypoints: [[1060, 300], [1060, 660]],
      },
    ],
    cameras: [
      { x: 330, y: 88, baseAngle: Math.PI / 2, sweep: 0.55 },
      { x: 940, y: 88, baseAngle: Math.PI / 2, sweep: 0.55 },
    ],
    loot: [
      { x: 130, y: 150, kind: 'gold' },
      { x: 130, y: 700, kind: 'gold' },
      { x: 1150, y: 150, kind: 'gold' },
      { x: 790, y: 650, kind: 'intel' },
      { x: 640, y: 320, kind: 'diamond' },
    ],
  },
  {
    name: 'The Vault',
    subtitle: 'The vault room sits in the middle. Four wardens, three cameras, one crown jewel.',
    par: 120,
    start: { x: 90, y: 700 },
    exit: { x: 1190, y: 92, w: 64, h: 44 },
    emp: 2,
    noise: 3,
    walls: [
      { x: 520, y: 220, w: 240, h: 28 }, // vault room, top
      { x: 520, y: 560, w: 240, h: 28 }, // vault room, bottom
      { x: 520, y: 220, w: 28, h: 140 }, // vault room, left upper
      { x: 520, y: 420, w: 28, h: 168 }, // vault room, left lower (door gap 360-420)
      { x: 732, y: 220, w: 28, h: 368 }, // vault room, right
      { x: 200, y: 200, w: 60, h: 60 }, // pillar
      { x: 1020, y: 200, w: 60, h: 60 }, // pillar
      { x: 200, y: 640, w: 60, h: 60 }, // pillar
      { x: 1020, y: 640, w: 60, h: 60 }, // pillar
      { x: 350, y: 120, w: 200, h: 28 }, // barrier
      { x: 730, y: 680, w: 200, h: 28 }, // barrier
    ],
    dark: [
      { x: 90, y: 120, w: 170, h: 120 },
      { x: 1020, y: 480, w: 170, h: 130 },
      { x: 560, y: 640, w: 200, h: 110 },
    ],
    guards: [
      {
        x: 420, y: 180, facing: 0,
        waypoints: [[420, 180], [880, 180], [880, 640], [420, 640]],
      },
      {
        x: 880, y: 180, facing: Math.PI,
        waypoints: [[880, 180], [420, 180], [420, 640], [880, 640]],
      },
      {
        x: 180, y: 300, facing: 0,
        waypoints: [[180, 300], [180, 180]],
      },
      {
        x: 1100, y: 480, facing: Math.PI,
        waypoints: [[1100, 480], [1100, 600], [880, 600]],
      },
    ],
    cameras: [
      { x: 470, y: 390, baseAngle: 0, sweep: 0.5 }, // watches the vault door
      { x: 640, y: 88, baseAngle: Math.PI / 2, sweep: 0.6 },
      { x: 1220, y: 400, baseAngle: Math.PI, sweep: 0.5 },
    ],
    loot: [
      { x: 150, y: 150, kind: 'gold' },
      { x: 1130, y: 150, kind: 'gold' },
      { x: 150, y: 720, kind: 'gold' },
      { x: 1130, y: 720, kind: 'intel' },
      { x: 640, y: 120, kind: 'gold' },
      { x: 640, y: 400, kind: 'diamond' },
    ],
  },
];
