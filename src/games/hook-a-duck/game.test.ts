import { describe, expect, it } from 'vitest';
import {
  CASTS_PER_ROUND,
  DROP_TIME,
  DUCK_NUMBERS,
  DUCK_SPEED,
  HOOK_REACH,
  STREAM_LENGTH,
  cast,
  createState,
  duckAt,
  step,
  streamPoint,
} from './game';

/** Where a duck will be once a hook cast now has dropped. */
function whereAfterDrop(distance: number) {
  return streamPoint(distance + DUCK_SPEED * DROP_TIME);
}

describe('hook a duck', () => {
  it('starts with every cast left, no score and every duck in the stream', () => {
    const state = createState();
    expect(state.casts).toBe(CASTS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.hook).toBeNull();
    expect(state.phase).toBe('playing');
    expect(state.ducks.map((d) => d.points)).toEqual([...DUCK_NUMBERS]);
    expect(state.ducks.every((d) => !d.caught)).toBe(true);
  });

  it('floats the ducks round the stream in a loop', () => {
    const state = createState();
    const start = state.ducks[0].distance;
    step(state, 1);
    expect(state.ducks[0].distance).toBeCloseTo(start + DUCK_SPEED);
    const p = streamPoint(0);
    const q = streamPoint(STREAM_LENGTH);
    expect(q.x).toBeCloseTo(p.x);
    expect(q.y).toBeCloseTo(p.y);
  });

  it('keeps the stream joined up all the way round', () => {
    for (let d = 0; d < STREAM_LENGTH; d += 5) {
      const a = streamPoint(d);
      const b = streamPoint(d + 5);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(5.01);
    }
  });

  it('uses one cast per hook', () => {
    const state = createState();
    expect(cast(state, 400, 200)).toBe(true);
    expect(state.casts).toBe(CASTS_PER_ROUND - 1);
    expect(state.hook).not.toBeNull();
  });

  it('lowers one hook at a time', () => {
    const state = createState();
    cast(state, 400, 200);
    expect(cast(state, 400, 200)).toBe(false);
    expect(state.casts).toBe(CASTS_PER_ROUND - 1);
  });

  it('cannot cast once the casts run out', () => {
    const state = createState();
    state.casts = 0;
    expect(cast(state, 400, 200)).toBe(false);
    expect(state.hook).toBeNull();
  });

  it('catches a duck the hook lands on and scores its number', () => {
    const state = createState();
    const duck = state.ducks[3];
    const p = whereAfterDrop(duck.distance);
    cast(state, p.x, p.y);
    step(state, DROP_TIME);
    expect(duck.caught).toBe(true);
    expect(state.score).toBe(duck.points);
    expect(state.hook).toBeNull();
  });

  it('catches the same way however the frames split the landing step', () => {
    const catchWith = (steps: number[]) => {
      const state = createState();
      // Duck 0 is at x = 216, within reach of x = 195, when the hook lands.
      cast(state, 195, 130);
      step(state, 0.39);
      for (const dt of steps) step(state, dt);
      return { caught: state.ducks[0].caught, score: state.score };
    };
    const whole = catchWith([0.05]);
    expect(whole).toEqual({ caught: true, score: DUCK_NUMBERS[0] });
    expect(catchWith([0.02, 0.03])).toEqual(whole);
  });

  it('keeps the hook dropping until it reaches the water', () => {
    const state = createState();
    const p = whereAfterDrop(state.ducks[0].distance);
    cast(state, p.x, p.y);
    step(state, DROP_TIME / 2);
    expect(state.hook).not.toBeNull();
    expect(state.score).toBe(0);
  });

  it('scores nothing for a hook that misses every duck', () => {
    const state = createState();
    cast(state, 10, 480);
    step(state, DROP_TIME);
    expect(state.score).toBe(0);
    expect(state.splashes[0].points).toBe(0);
  });

  it('cannot catch the same duck twice', () => {
    const state = createState();
    const duck = state.ducks[0];
    duck.caught = true;
    const p = streamPoint(duck.distance);
    expect(duckAt(state.ducks, p.x, p.y)).toBeUndefined();
  });

  it('finds a duck only within the hook reach', () => {
    const { ducks } = createState();
    const p = streamPoint(ducks[0].distance);
    expect(duckAt(ducks, p.x, p.y + HOOK_REACH - 1)).toBe(ducks[0]);
    expect(duckAt(ducks, p.x, p.y + HOOK_REACH + 1)).toBeUndefined();
  });

  it('ends the round when the last cast lands', () => {
    const state = createState();
    state.casts = 1;
    cast(state, 400, 200);
    step(state, 0.1);
    expect(state.phase).toBe('playing');
    step(state, DROP_TIME);
    expect(state.phase).toBe('over');
  });
});
