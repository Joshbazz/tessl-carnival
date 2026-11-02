# Ring Toss

Land rings on the necks of the bottles at the back of the booth.

## How to play

- Move the mouse to aim, and click to throw a ring. The cross shows where the
  ring will land.
- The throw sways left and right of your aim, up to 24 px either way, so time
  your click.
- One ring flies at a time. You have 10 rings, and the round ends when the last
  one lands.
- Click again on the game over screen to play another round.

## Scoring

A ring scores when it lands within 10 px of the centre of a bottle's neck.
Bottles further back score more:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

A ring that misses every neck scores nothing. Your final score is saved to the
carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `swayAt`,
  `bottleAt`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
