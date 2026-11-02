---
name: review-carnival-house-rules
description: Review a change to a carnival game for house rules 1 to 3 in AGENTS.md, that every game registers on the midway, reports scores through recordScore from src/carnival, and draws with theme and canvasFont. Use as one lens in a code review run.
---

# Review lens: Carnival House Rules

Review changes under `src/games/` for whether each game still plugs into the shared carnival the way `AGENTS.md` house rules 1 to 3 require, and what the player or the next game author loses when it does not.

## Scope

- **Registration** Whether the game reaches the midway: its folder under `src/games/` has a `game.ts` whose default export is its `CarnivalGame`, and the game's `id` matches the folder name.
- **Scores** Whether a round's score reaches the shared board: `recordScore(game.id, score)` from `src/carnival`, once, when a round ends. A game that reads or writes local storage itself, keeps its own high score table, or records a score more than once per round splits the board the midway shows.
- **Theme** Whether what the game draws follows the carnival's look: colours, fonts and sizes from `theme` and `canvasFont` in `src/carnival/theme.ts`, not hex colours, `rgb()` strings or font strings written into the game.

## Method

Start at each changed `game.ts` under `src/games/` and read it whole, not only the hunk: a default export, a call to `recordScore` or a colour can sit outside the diff and still decide whether the rule holds.

For scores, follow the code path that ends a round to where the score is recorded, and check that nothing else in the game touches `localStorage` or keeps a best score of its own.

For the theme, read each value assigned to `fillStyle`, `strokeStyle`, `font` and similar drawing state back to where it comes from.

## Threshold

Report a game that skips the shared scores module, records a score more than once per round, keeps its own score storage, or draws with a colour or font that does not come from `theme` or `canvasFont`.

Be accurate about consequences. `src/games/index.ts` throws when the midway loads if a game's `game.ts` has no default export, or if its `id` differs from its folder name, so the whole midway fails to start, and `src/games/index.test.ts` fails in `npm run check`. Report either only when the change also weakens those checks, since the tests already enforce them otherwise.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and the scores, and `src/midway/palette.ts` has its own scenery colours.
- Values derived from the theme, such as a colour picked from `theme`, a size computed from `theme.canvas`, or an alpha applied to a theme colour.
- Test data in `game.test.ts`.
- Anything lint, the type-checker or the tests already enforce.
- Correctness of the game logic itself, which belongs to `review-correctness-and-data-integrity`, or naming and structure, which belong to `review-maintainability-and-code-quality`.

## Reporting

- Name the house rule, the file and the line that breaks it.
- Say what follows for the player or for the carnival: a score missing from the shared board, a second score table, a colour that will not follow a theme change.
- State the fix with the shared piece to use: `recordScore(game.id, score)` from `src/carnival`, or the `theme` key or `canvasFont` size that fits.
