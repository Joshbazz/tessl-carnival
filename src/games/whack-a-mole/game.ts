import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const POINTS_PER_MOLE = 10;
export const COLUMNS = 3;
export const ROWS = 3;
export const HOLE_RADIUS = 46;
const GRID_TOP = 120;
const ROW_GAP = 115;
const COLUMN_GAP = 200;

/** How long a mole stays up, at the start and at the end of a round. */
export const UP_TIME = { start: 1.2, end: 0.5 } as const;
/** Seconds between moles popping up, at the start and at the end of a round. */
export const SPAWN_INTERVAL = { start: 0.9, end: 0.35 } as const;

export interface Hole {
  x: number;
  y: number;
  /** Seconds the mole in this hole stays up; 0 means the hole is empty. */
  upFor: number;
}

export interface Bonk {
  x: number;
  y: number;
  age: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  bonks: Bonk[];
  timeLeft: number;
  /** Seconds until the next mole pops up. */
  spawnIn: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const left = WIDTH / 2 - COLUMN_GAP * ((COLUMNS - 1) / 2);
  const holes = Array.from({ length: ROWS * COLUMNS }, (_, i) => ({
    x: left + (i % COLUMNS) * COLUMN_GAP,
    y: GRID_TOP + Math.floor(i / COLUMNS) * ROW_GAP,
    upFor: 0,
  }));
  return {
    holes,
    bonks: [],
    timeLeft: ROUND_SECONDS,
    spawnIn: SPAWN_INTERVAL.start,
    score: 0,
    phase: 'playing',
  };
}

/** How far through the round we are, from 0 at the start to 1 at the end. */
function progress(state: WhackAMoleState): number {
  return Math.min(Math.max(1 - state.timeLeft / ROUND_SECONDS, 0), 1);
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Moles stay up for less time as the round goes on. */
export function upTime(state: WhackAMoleState): number {
  return lerp(UP_TIME.start, UP_TIME.end, progress(state));
}

/** Moles pop up more often as the round goes on. */
export function spawnInterval(state: WhackAMoleState): number {
  return lerp(SPAWN_INTERVAL.start, SPAWN_INTERVAL.end, progress(state));
}

/** The hole under a point, or -1 if the point misses every hole. */
export function holeAt(state: WhackAMoleState, x: number, y: number): number {
  return state.holes.findIndex((hole) => Math.hypot(x - hole.x, y - hole.y) <= HOLE_RADIUS);
}

/** Whacks at a point. Returns true if it hit a mole that was up. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes[holeAt(state, x, y)];
  if (!hole || hole.upFor <= 0) return false;
  hole.upFor = 0;
  state.score += POINTS_PER_MOLE;
  state.bonks.push({ x: hole.x, y: hole.y, age: 0 });
  return true;
}

/** Runs the clock, the moles and the spawn countdown forward by `dt` seconds. */
function advance(state: WhackAMoleState, dt: number) {
  state.timeLeft = Math.max(state.timeLeft - dt, 0);
  for (const hole of state.holes) hole.upFor = Math.max(hole.upFor - dt, 0);
  state.spawnIn -= dt;
  if (state.timeLeft === 0) {
    for (const hole of state.holes) hole.upFor = 0;
    state.phase = 'over';
  }
}

/**
 * Advances the game by `dt` seconds. `random` picks which empty hole the next
 * mole pops up from, and returns a number in [0, 1) like Math.random.
 */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random) {
  for (const bonk of state.bonks) bonk.age += dt;
  state.bonks = state.bonks.filter((b) => b.age < 0.3);
  if (state.phase !== 'playing') return;

  // Pop up a mole at every spawn deadline this step crosses, in order, so the
  // time past each deadline counts toward the next one and ages the new mole.
  let remaining = dt;
  while (state.spawnIn <= remaining) {
    const untilSpawn = Math.max(state.spawnIn, 0);
    advance(state, untilSpawn);
    remaining -= untilSpawn;
    if (state.phase !== 'playing') return;
    const empty = state.holes.filter((hole) => hole.upFor === 0);
    if (empty.length > 0) {
      empty[Math.floor(random() * empty.length)].upFor = upTime(state);
    }
    state.spawnIn = spawnInterval(state);
  }
  advance(state, remaining);
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const hole of state.holes) {
    if (hole.upFor > 0) {
      // The mole, peeking out of its hole.
      ctx.fillStyle = colors.wood;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - 10, HOLE_RADIUS * 0.7, Math.PI, 0);
      ctx.fillRect(hole.x - HOLE_RADIUS * 0.7, hole.y - 10, HOLE_RADIUS * 1.4, 20);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(hole.x - 11, hole.y - 22, 5, 0, Math.PI * 2);
      ctx.arc(hole.x + 11, hole.y - 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.danger;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The front lip of the hole, drawn over the mole's base.
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 14, HOLE_RADIUS, HOLE_RADIUS * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const bonk of state.bonks) {
    ctx.globalAlpha = 1 - bonk.age / 0.3;
    ctx.beginPath();
    ctx.arc(bonk.x, bonk.y - 10, 20 + bonk.age * 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the moles before they duck back down. They get quicker as the clock runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default whackAMole;
