# Chessir

Chess where the board itself can turn. Rendered in the browser with [three.js](https://threejs.org/).

**Play it:** https://templarrr.github.io/chessir/

![A hot-seat game with the moves panel open: two band rotations after a normal opening](docs/screenshots/desktop.png)

## Rules

All classic chess rules apply, plus one extra option. The board is split into four square
rings ("bands"): the outer ring of 28 squares, then 20, then 12, and the 4 central squares.
On your turn, instead of moving a piece you may rotate one band by one square in either
direction; every piece on that band travels with it.

While your king is in check you may not rotate a band that holds your king or the checking
piece. You may still escape check by rotating another band so that a piece lands between them.
As with any move, a rotation may never leave your own king in check.

A rotation may not simply undo the one before it: if your opponent has just rotated a band,
you may not rotate that same band back in the opposite direction on your very next turn.
Rotating it further in the same direction, or rotating any other band, is fine. Without this
rule a game could stall forever with one band turning back and forth.

Details that follow from the twist:

- Castling is allowed only if neither the king nor that rook has ever left its square, whether
  by a move or by riding a rotating band.
- En passant is possible only on the turn right after the double step.
- A pawn always moves toward the opponent's side. One carried onto its last rank by a rotation
  stays a pawn and cannot move forward until a rotation carries it off again; promotion happens
  only by moving there.
- An empty band cannot be rotated (that would be a "pass").
- Because of the no-undo rule, whether that reverse rotation is available is part of the
  position when counting threefold repetition.
- The game ends in checkmate, or in a draw by stalemate, threefold repetition, the fifty-move
  rule, or when only the two kings remain.

## How to play

Pick who plays each side with the **White** and **Black** selectors at the top: a human or one
of the bots. Two humans play hot-seat on one screen; two bots play each other. The choice is
remembered and can be changed mid-game; if it is that side's turn, the new player takes over
right away. By default you play White against the greedy bot.

As a human:

- Tap one of your pieces to see where it can go (dots, or rings for captures), then tap the
  destination. Promotions ask which piece you want.
- Tap any square to select its band; use ↺ / ↻ at the bottom to turn that band one square
  counter-clockwise or clockwise (as seen from White's side). If the turn is not allowed, the
  reason appears under the buttons.
- Drag to orbit the camera, scroll or pinch to zoom.

The **Moves** button on the right shows or hides the game record; **Copy** puts it on the
clipboard as text, e.g. `1. e4 e5 2. Nf3 Nc6 3. A+ C- 4. Bxf7+`. The panel starts open on wide
screens and closed on phones, and remembers your choice.

| Phone                                                 | Phone, moves panel open                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| ![Phone layout](docs/screenshots/mobile-portrait.png) | ![Moves panel on a phone](docs/screenshots/mobile-moves.png) |

![In check: the king's ring is locked](docs/screenshots/in-check.png)

![White just turned the second ring clockwise, so Black may not turn it straight back](docs/screenshots/no-undo.png)

## Notation

Normal moves use standard algebraic notation (`e4`, `Nbd2`, `exd6`, `O-O`, `e8=Q`).

A band rotation is written as the band's letter plus a direction. Each band is named after the
first file it covers: **A** is the outer ring (it covers file a), then **B**, **C**, and **D**
for the four central squares. `+` means the band's squares on that file move toward higher rank
numbers, `-` toward lower ones. Seen from White's side, `+` is clockwise (↻) and `-` is
counter-clockwise (↺). So `A+` carries the rook on a1 up to a2 and `D-` turns the centre so
that a piece on d5 goes to d4.

As with any move, `+` is added if the rotation gives check and `#` if it mates, so a rotation
that gives check reads `A++` or `B-+`. The copied record ends with `1-0`, `0-1` or `1/2-1/2`
once the game is over.

## Bots

**Greedy bot** looks one turn ahead. It tries every legal action (moves and rotations) and
picks the best by these priorities, in order:

1. Checkmate if it can.
2. The biggest material gain (captures; a promotion counts as the value it adds) minus the
   value of its own pieces left exposed afterwards. A piece is exposed if the opponent attacks
   it and it is undefended (counts in full) or defended but attacked by something cheaper
   (counts the difference). So it will not grab a pawn with its queen if the queen is then lost.
3. If that ties (typically when nothing can be captured), the best capture it lines up for its
   next turn, valued the same way.
4. If that also ties, the most squares its pieces can move to afterwards.
5. If still tied, a random pick among the best.

It also avoids a draw by threefold repetition: an action that would repeat the position for
the third time ranks below every other one, so it is played only if nothing else is legal.
The exception is when the bot is behind on material (by the piece values below); then a draw
is a fine result and repetition is treated like any other move.

Piece values: pawn 1, knight 3, bishop 3, rook 5, queen 9.

## Status

- [x] 3D board and pieces, scales to any window size
- [x] Piece moves and band rotation in the UI (hot-seat)
- [x] Rules enforcement (check, mate, special moves, draws)
- [x] Player picker: human or bot for each side
- [x] Greedy bot
- [x] Move record panel with copy to clipboard

## Development

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev      # local server with hot reload
npm run check    # lint + tests + production build
npm run format   # auto-fix lint and formatting
```

Keep `docs/screenshots/` up to date whenever the look or the UI changes; the README and pull
requests show them.

Code style is enforced by [ESLint](https://eslint.org/) (correctness) and
[Prettier](https://prettier.io/) (formatting); CI fails if either complains.

## Code layout

- `src/game/` holds the rules and game state as plain data with no three.js or DOM
  dependencies, so it can be unit-tested and used by a computer player.
  `src/game/rules.js` holds move generation, the rotation rules and game-end detection.
  `src/game/notation.js` writes moves and rotations as text.
- `src/render/` turns that state into a three.js scene.
- `src/ui/` holds page widgets outside the board, such as the moves panel.
- `src/players/` holds the players: `human.js` turns taps and button presses into actions,
  `greedy.js` is the greedy bot, and `index.js` lists what the side pickers offer. A new bot is
  a new file there plus one line in `index.js`.
- `src/game/actions.js` defines the two kinds of turn (`move`, `rotate`) and the `Player`
  contract: anything with `chooseAction(state) => Promise<Action>`. Humans and bots both plug in
  through it.

## Deploying to GitHub Pages

Every push to `main` is built and published by `.github/workflows/deploy.yml`. One-time setup:

1. Open the repository on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Merge to `main` (or run the workflow from the **Actions** tab). The site appears at
   `https://<user>.github.io/chessir/`.
