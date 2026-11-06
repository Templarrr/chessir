# Chessir

Chess where the board itself can turn. Rendered in the browser with [three.js](https://threejs.org/).

## Rules

All classic chess rules apply, plus one extra option. The board is split into four square
rings ("bands"): the outer ring of 28 squares, then 20, then 12, and the 4 central squares.
On your turn, instead of moving a piece you may rotate one band by one square in either
direction; every piece on that band travels with it.

While your king is in check you may not rotate a band that holds your king or the checking
piece. You may still escape check by rotating another band so that a piece lands between them.

## Status

- [x] 3D board and pieces, scales to any window size
- [ ] Piece moves and band rotation in the UI
- [ ] Rules enforcement (check, mate, special moves)
- [ ] Computer opponent

## Development

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev      # local server with hot reload
npm run check    # lint + tests + production build
npm run format   # auto-fix lint and formatting
```

Code style is enforced by [ESLint](https://eslint.org/) (correctness) and
[Prettier](https://prettier.io/) (formatting); CI fails if either complains.

## Code layout

- `src/game/` holds the rules and game state as plain data with no three.js or DOM
  dependencies, so it can be unit-tested and used by a computer player.
- `src/render/` turns that state into a three.js scene.
- `src/game/actions.js` defines the two kinds of turn (`move`, `rotate`) and the `Player`
  contract: anything with `chooseAction(state) => Promise<Action>`. Human input and a future AI
  player both plug in through it.

## Deploying to GitHub Pages

Every push to `main` is built and published by `.github/workflows/deploy.yml`. One-time setup:

1. Open the repository on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Merge to `main` (or run the workflow from the **Actions** tab). The site appears at
   `https://<user>.github.io/chessir/`.
