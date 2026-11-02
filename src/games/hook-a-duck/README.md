# Hook a Duck

Hook the rubber ducks as they float round the stream.

## How to play

- Ten rubber ducks float clockwise round a looping stream.
- Move the mouse to move the rod. The circle shows where the hook will drop.
- Click to lower the hook. It takes 0.4 seconds to reach the water, so cast a
  little ahead of the duck you want.
- One hook is down at a time. You have 8 casts, and the round ends when the
  last one lands.
- Click again on the game over screen to play another round.

## Scoring

A cast catches a duck when the hook lands within 22 px of the duck's centre.
Each duck has a number on its base, and that number is what it scores: the
ducks are numbered 1, 2, 3, 5 and 10. A caught duck leaves the stream for the
rest of the round.

A cast that misses every duck scores nothing. Your final score is saved to the
carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `cast`, `step`, `streamPoint`,
  `duckAt`) and the `hookADuck` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
