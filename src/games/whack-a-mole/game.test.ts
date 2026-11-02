import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  HOLE_RADIUS,
  POINTS_PER_MOLE,
  ROUND_SECONDS,
  ROWS,
  SPAWN_INTERVAL,
  UP_TIME,
  createState,
  holeAt,
  spawnInterval,
  step,
  upTime,
  whack,
} from './game';

describe('whack-a-mole', () => {
  it('starts with a full clock, no score and every hole empty', () => {
    const state = createState();
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.holes).toHaveLength(ROWS * COLUMNS);
    expect(state.holes.every((hole) => hole.upFor === 0)).toBe(true);
  });

  it('pops a mole up from a hole once the spawn timer runs out', () => {
    const state = createState();
    step(state, SPAWN_INTERVAL.start + 0.01, () => 0);
    expect(state.holes.filter((hole) => hole.upFor > 0)).toHaveLength(1);
  });

  it('drops a mole back down once its time is up', () => {
    const state = createState();
    state.spawnIn = 100;
    state.holes[0].upFor = 0.2;
    step(state, 0.3);
    expect(state.holes[0].upFor).toBe(0);
  });

  it('scores a whack on a mole that is up, and sends it back down', () => {
    const state = createState();
    const hole = state.holes[4];
    hole.upFor = 1;
    expect(whack(state, hole.x + 10, hole.y - 10)).toBe(true);
    expect(state.score).toBe(POINTS_PER_MOLE);
    expect(hole.upFor).toBe(0);
  });

  it('scores nothing for a whack on an empty hole or between holes', () => {
    const state = createState();
    const hole = state.holes[0];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    hole.upFor = 1;
    expect(whack(state, hole.x + HOLE_RADIUS + 5, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('finds the hole under a point', () => {
    const state = createState();
    const hole = state.holes[2];
    expect(holeAt(state, hole.x, hole.y)).toBe(2);
    expect(holeAt(state, 0, 0)).toBe(-1);
  });

  it('pops moles up faster and for less time as the round goes on', () => {
    const state = createState();
    expect(upTime(state)).toBe(UP_TIME.start);
    expect(spawnInterval(state)).toBe(SPAWN_INTERVAL.start);
    state.timeLeft = ROUND_SECONDS / 2;
    expect(upTime(state)).toBeLessThan(UP_TIME.start);
    expect(spawnInterval(state)).toBeLessThan(SPAWN_INTERVAL.start);
    state.timeLeft = 0;
    expect(upTime(state)).toBeCloseTo(UP_TIME.end);
    expect(spawnInterval(state)).toBeCloseTo(SPAWN_INTERVAL.end);
  });

  it('ends the round when the clock runs out, and drops every mole', () => {
    const state = createState();
    state.holes[0].upFor = 5;
    state.timeLeft = 0.05;
    step(state, 0.1);
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(state.holes[0].upFor).toBe(0);
  });

  it('ignores whacks once the round is over', () => {
    const state = createState();
    state.phase = 'over';
    state.holes[0].upFor = 1;
    expect(whack(state, state.holes[0].x, state.holes[0].y)).toBe(false);
    expect(state.score).toBe(0);
  });
});
