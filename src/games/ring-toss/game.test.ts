import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  SWAY,
  bottleAt,
  createState,
  step,
  swayAt,
  throwRing,
} from './game';

/** Throws at a point with no sway, so the ring lands exactly there. */
function throwAt(state: ReturnType<typeof createState>, x: number, y: number) {
  state.time = 0;
  expect(throwRing(state, x, y)).toBe(true);
  step(state, FLIGHT_TIME);
}

describe('ring toss', () => {
  it('starts with a full hand of rings and no score', () => {
    const state = createState();
    expect(state.rings).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.ring).toBeNull();
    expect(state.phase).toBe('playing');
  });

  it('stands a grid of bottles, worth more the further back they are', () => {
    const { bottles } = createState();
    const rows = [...new Set(bottles.map((b) => b.y))].sort((a, b) => a - b);
    expect(rows.length).toBeGreaterThan(1);
    const pointsByRow = rows.map((y) => bottles.find((b) => b.y === y)!.points);
    expect(pointsByRow).toEqual([...pointsByRow].sort((a, b) => b - a));
    expect(new Set(pointsByRow).size).toBe(rows.length);
  });

  it('uses one ring per throw', () => {
    const state = createState();
    expect(throwRing(state, 400, 200)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring).not.toBeNull();
  });

  it('throws one ring at a time', () => {
    const state = createState();
    throwRing(state, 400, 200);
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
  });

  it('cannot throw once the rings run out', () => {
    const state = createState();
    state.rings = 0;
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.ring).toBeNull();
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    throwAt(state, bottle.x, bottle.y);
    expect(state.score).toBe(bottle.points);
    expect(bottle.rings).toBe(1);
    expect(state.ring).toBeNull();
  });

  it('scores a back bottle higher than a front one', () => {
    const state = createState();
    const back = state.bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = state.bottles.reduce((a, b) => (b.y > a.y ? b : a));
    throwAt(state, back.x, back.y);
    const backScore = state.score;
    throwAt(state, front.x, front.y);
    expect(backScore).toBeGreaterThan(state.score - backScore);
  });

  it('scores nothing for a ring that misses every neck', () => {
    const state = createState();
    throwAt(state, 10, 450);
    expect(state.score).toBe(0);
    expect(state.landings[0].points).toBe(0);
  });

  it('keeps the ring in the air until its flight is over', () => {
    const state = createState();
    const bottle = state.bottles[0];
    throwRing(state, bottle.x, bottle.y);
    step(state, FLIGHT_TIME / 2);
    expect(state.ring).not.toBeNull();
    expect(state.score).toBe(0);
  });

  it('drifts the throw by the sway', () => {
    const state = createState();
    state.time = 0.4;
    throwRing(state, 400, 200);
    expect(state.ring!.toX).toBeCloseTo(400 + swayAt(0.4));
  });

  it('never sways further than SWAY', () => {
    for (let t = 0; t < 4; t += 0.05) expect(Math.abs(swayAt(t))).toBeLessThanOrEqual(SWAY);
  });

  it('finds a bottle only within the neck radius', () => {
    const { bottles } = createState();
    const bottle = bottles[0];
    expect(bottleAt(bottles, bottle.x + NECK_RADIUS - 1, bottle.y)).toBe(bottle);
    expect(bottleAt(bottles, bottle.x + NECK_RADIUS + 1, bottle.y)).toBeUndefined();
  });

  it('ends the round when the last ring lands', () => {
    const state = createState();
    state.rings = 1;
    throwRing(state, 400, 200);
    step(state, 0.1);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('over');
  });
});
