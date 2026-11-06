/**
 * Everything a player can do on their turn is expressed as one of these plain objects,
 * so human input and bots produce exactly the same thing.
 *
 * @typedef {{ type: 'move', from: number, to: number, promotion?: string }} MoveAction
 * @typedef {{ type: 'rotate', band: number, direction: 1 | -1 }} RotateAction
 * @typedef {MoveAction | RotateAction} Action
 *
 * @typedef {object} Player
 * @property {string} name
 * @property {(state: object) => Promise<Action>} chooseAction
 */

export function moveAction(from, to, promotion) {
  return promotion ? { type: 'move', from, to, promotion } : { type: 'move', from, to };
}

export function rotateAction(band, direction) {
  return { type: 'rotate', band, direction };
}
