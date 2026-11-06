import { createGreedyBot } from './greedy.js';

/**
 * Who can sit at each side of the board. Bots are created fresh per side; the human
 * player is shared, since one screen serves both sides in hot-seat play.
 */
export const PLAYER_KINDS = [
  { id: 'human', label: 'Human' },
  { id: 'greedy', label: 'Greedy bot', create: () => createGreedyBot() },
];
