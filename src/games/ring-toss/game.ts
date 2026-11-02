import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
/** How close to the centre of a bottle neck a ring has to land to score. */
export const NECK_RADIUS = 10;
/** How far, in pixels, the throw sways left and right of the aim. */
export const SWAY = 24;
/** Seconds for one full sway, left and back. */
const SWAY_PERIOD = 1.6;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
const ROWS = [
  { y: 120, points: 30 },
  { y: 185, points: 20 },
  { y: 250, points: 10 },
];
const BOTTLES_PER_ROW = 5;

export interface Bottle {
  x: number;
  /** Where the neck is, which is where a ring has to land. */
  y: number;
  points: number;
  rings: number;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Landing {
  x: number;
  y: number;
  /** The points the ring scored, 0 for a miss. */
  points: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  ring: Ring | null;
  landings: Landing[];
  rings: number;
  score: number;
  /** Seconds since the round started; drives the sway. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const spacing = 90;
  const left = WIDTH / 2 - (spacing * (BOTTLES_PER_ROW - 1)) / 2;
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: left + spacing * i,
      y: row.y,
      points: row.points,
      rings: 0,
    })),
  );
  return {
    bottles,
    ring: null,
    landings: [],
    rings: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** How far the throw drifts from the aim at a given time, between -SWAY and SWAY. */
export function swayAt(time: number): number {
  return SWAY * Math.sin((time / SWAY_PERIOD) * Math.PI * 2);
}

/** The bottle a ring landing at (x, y) rings, if any. */
export function bottleAt(bottles: readonly Bottle[], x: number, y: number): Bottle | undefined {
  return bottles.find((b) => Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/**
 * Throws one ring at the aim point, drifted by the sway. Only one ring flies
 * at a time. Returns false if nothing was thrown.
 */
export function throwRing(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.rings === 0 || state.ring) return false;
  state.ring = {
    fromX: THROWER.x,
    fromY: THROWER.y,
    toX: aimX + swayAt(state.time),
    toY: Math.min(aimY, THROWER.y),
    age: 0,
  };
  state.rings -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;

  const ring = state.ring;
  if (ring) {
    ring.age += dt;
    if (ring.age >= FLIGHT_TIME) {
      const bottle = bottleAt(state.bottles, ring.toX, ring.toY);
      if (bottle) {
        bottle.rings += 1;
        state.score += bottle.points;
      }
      state.landings.push({ x: ring.toX, y: ring.toY, points: bottle?.points ?? 0, age: 0 });
      state.ring = null;
    }
  }

  for (const landing of state.landings) landing.age += dt;
  state.landings = state.landings.filter((l) => l.age < 0.8);

  if (state.rings === 0 && !state.ring) state.phase = 'over';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.strokeStyle = theme.colors.accent;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.ellipse(x, y, 16 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The table the bottles stand on.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(120, 90, WIDTH - 240, 200);

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - 12, bottle.y + 6, 24, 28);
    ctx.fillRect(bottle.x - 4, bottle.y - 6, 8, 14);
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    if (bottle.rings > 0) drawRing(ctx, bottle.x, bottle.y + 4, 0.7);
  }

  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.textAlign = 'right';
  for (const row of ROWS) ctx.fillText(`${row.points}`, 110, row.y + 20);

  for (const landing of state.landings) {
    ctx.globalAlpha = 1 - landing.age / 0.8;
    ctx.fillStyle = landing.points > 0 ? colors.accent : colors.danger;
    ctx.font = canvasFont('body', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(
      landing.points > 0 ? `+${landing.points}` : 'Miss',
      landing.x,
      landing.y - 24 - landing.age * 30,
    );
  }
  ctx.globalAlpha = 1;

  // Where the next ring will land, sway included.
  if (state.phase === 'playing' && !state.ring) {
    const x = aim.x + swayAt(state.time);
    const y = Math.min(aim.y, THROWER.y);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }

  if (state.ring) {
    const { fromX, fromY, toX, toY, age } = state.ring;
    const t = Math.min(age / FLIGHT_TIME, 1);
    // An arc: straight across, lifted in the middle, and smaller as it goes back.
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t - Math.sin(t * Math.PI) * 80;
    drawRing(ctx, x, y, 1.2 - 0.5 * t);
  }

  // Rings still in hand.
  if (state.rings > 0) drawRing(ctx, THROWER.x, THROWER.y, 1.2);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.rings}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land rings on the bottle necks. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: 185 };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwRing(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;
