import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CASTS_PER_ROUND = 8;
/** Seconds the hook takes to drop to the water. */
export const DROP_TIME = 0.4;
/** How close to the centre of a duck the hook has to land to catch it. */
export const HOOK_REACH = 22;
/** How fast the ducks float, in pixels per second along the stream. */
export const DUCK_SPEED = 90;
/** The number on the base of each duck, in the order they float. */
export const DUCK_NUMBERS = [1, 5, 2, 10, 3, 1, 5, 2, 3, 1] as const;
/** Where the hook hangs from, at the end of the rod. */
export const ROD_TIP = { y: 50 } as const;

/**
 * The stream is a loop: two straights joined by half circles, round a
 * centre island. Ducks float round it clockwise.
 */
export const STREAM = { x: WIDTH / 2, y: 250, straight: 220, radius: 120 } as const;
const STRAIGHT = STREAM.straight * 2;
const BEND = Math.PI * STREAM.radius;
export const STREAM_LENGTH = 2 * STRAIGHT + 2 * BEND;

export interface Duck {
  /** Distance along the stream, from the left end of the top straight. */
  distance: number;
  points: number;
  caught: boolean;
}

export interface Hook {
  x: number;
  y: number;
  /** Seconds since the cast. */
  age: number;
}

export interface Splash {
  x: number;
  y: number;
  /** The points the cast scored, 0 for a miss. */
  points: number;
  age: number;
}

export interface HookADuckState {
  ducks: Duck[];
  hook: Hook | null;
  splashes: Splash[];
  casts: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): HookADuckState {
  const gap = STREAM_LENGTH / DUCK_NUMBERS.length;
  return {
    ducks: DUCK_NUMBERS.map((points, i) => ({ distance: i * gap, points, caught: false })),
    hook: null,
    splashes: [],
    casts: CASTS_PER_ROUND,
    score: 0,
    phase: 'playing',
  };
}

/** Where on the canvas a point `distance` along the stream is. */
export function streamPoint(distance: number): { x: number; y: number } {
  const d = ((distance % STREAM_LENGTH) + STREAM_LENGTH) % STREAM_LENGTH;
  const { x, y, straight, radius } = STREAM;
  if (d < STRAIGHT) return { x: x - straight + d, y: y - radius };
  if (d < STRAIGHT + BEND) {
    const angle = -Math.PI / 2 + (d - STRAIGHT) / radius;
    return { x: x + straight + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  }
  if (d < 2 * STRAIGHT + BEND) return { x: x + straight - (d - STRAIGHT - BEND), y: y + radius };
  const angle = Math.PI / 2 + (d - 2 * STRAIGHT - BEND) / radius;
  return { x: x - straight + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
}

/** The duck still in the stream under (x, y), if any. */
export function duckAt(ducks: readonly Duck[], x: number, y: number): Duck | undefined {
  return ducks.find((duck) => {
    if (duck.caught) return false;
    const p = streamPoint(duck.distance);
    return Math.hypot(x - p.x, y - p.y) <= HOOK_REACH;
  });
}

/**
 * Lowers the hook at (x, y). Only one hook is down at a time. Returns false
 * if nothing was cast.
 */
export function cast(state: HookADuckState, x: number, y: number): boolean {
  if (state.phase !== 'playing' || state.casts === 0 || state.hook) return false;
  state.hook = { x, y: Math.max(y, ROD_TIP.y), age: 0 };
  state.casts -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: HookADuckState, dt: number): void {
  for (const duck of state.ducks) duck.distance = (duck.distance + DUCK_SPEED * dt) % STREAM_LENGTH;

  const hook = state.hook;
  if (hook) {
    hook.age += dt;
    if (hook.age >= DROP_TIME) {
      const duck = duckAt(state.ducks, hook.x, hook.y);
      if (duck) {
        duck.caught = true;
        state.score += duck.points;
      }
      state.splashes.push({ x: hook.x, y: hook.y, points: duck?.points ?? 0, age: 0 });
      state.hook = null;
    }
  }

  for (const splash of state.splashes) splash.age += dt;
  state.splashes = state.splashes.filter((s) => s.age < 0.8);

  if (state.casts === 0 && !state.hook) state.phase = 'over';
}

function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, points: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 18, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 8, y - 9, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.danger;
  ctx.fillRect(x + 15, y - 10, 7, 4);
  ctx.fillStyle = colors.background;
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'center';
  ctx.fillText(`${points}`, x - 3, y + 9);
}

function draw(ctx: CanvasRenderingContext2D, state: HookADuckState, aim: { x: number; y: number }) {
  const { colors } = theme;
  const { x, y, straight, radius } = STREAM;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 30);
  }

  // The stream, round the island in the middle.
  const loop = () => {
    ctx.beginPath();
    ctx.moveTo(x - straight, y - radius);
    ctx.lineTo(x + straight, y - radius);
    ctx.arc(x + straight, y, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x - straight, y + radius);
    ctx.arc(x - straight, y, radius, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.closePath();
  };
  ctx.strokeStyle = colors.wood;
  ctx.lineWidth = 64;
  loop();
  ctx.stroke();
  ctx.strokeStyle = colors.water;
  ctx.lineWidth = 52;
  loop();
  ctx.stroke();

  for (const duck of state.ducks) {
    if (duck.caught) continue;
    const p = streamPoint(duck.distance);
    drawDuck(ctx, p.x, p.y, duck.points);
  }

  for (const splash of state.splashes) {
    ctx.globalAlpha = 1 - splash.age / 0.8;
    ctx.fillStyle = splash.points > 0 ? colors.accent : colors.danger;
    ctx.font = canvasFont('body', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(
      splash.points > 0 ? `+${splash.points}` : 'Miss',
      splash.x,
      splash.y - 30 - splash.age * 30,
    );
  }
  ctx.globalAlpha = 1;

  // The rod, its line and the hook: hanging at the aim, or dropping.
  const hookX = state.hook ? state.hook.x : aim.x;
  const targetY = state.hook ? state.hook.y : Math.max(aim.y, ROD_TIP.y);
  const hookY = state.hook
    ? ROD_TIP.y + (targetY - ROD_TIP.y) * Math.min(state.hook.age / DROP_TIME, 1)
    : ROD_TIP.y;
  ctx.strokeStyle = colors.wood;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(WIDTH - 20, 24);
  ctx.lineTo(hookX, ROD_TIP.y);
  ctx.stroke();
  if (state.phase === 'playing') {
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hookX, ROD_TIP.y);
    ctx.lineTo(hookX, hookY);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hookX - 5, hookY, 5, 0, Math.PI);
    ctx.stroke();
  }

  // Where the hook will land.
  if (state.phase === 'playing' && !state.hook) {
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hookX, targetY, HOOK_REACH, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Casts ${state.casts}/${CASTS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of casts! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const hookADuck: CarnivalGame = {
  id: 'hook-a-duck',
  name: 'Hook a Duck',
  description: 'Hook the rubber ducks as they float by. The number on each duck is its score.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: STREAM.y + STREAM.radius };

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
        cast(state, aim.x, aim.y);
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
        recordScore(hookADuck.id, state.score);
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

export default hookADuck;
