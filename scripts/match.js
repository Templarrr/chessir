// Bot-vs-bot matches: node scripts/match.js <botA> <botB> [--games N] [--ms M] [--threads T]
// Every opening (a few random plies) is played twice with colours swapped. Each move is
// checked by the real rules in src/game/rules.js, so an illegal engine move fails loudly.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WHITE } from '../src/game/pieces.js';
import { applyAction, legalActions, newGame } from '../src/game/rules.js';
import { chooseGreedyAction } from '../src/players/greedy.js';
import { BOTS } from './bots.js';

const MAX_PLIES = 400;
const OPENING_PLIES = 4;

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function makePlayer(name, ms, random) {
  if (name === 'greedy') return (state) => chooseGreedyAction(state, random);
  if (name === 'random') {
    return (state) => {
      const actions = legalActions(state);
      return actions[Math.floor(random() * actions.length)];
    };
  }
  return BOTS[name](ms);
}

function playGame({ white, black, ms, seed }) {
  const random = seeded(seed);
  const players = { white: makePlayer(white, ms, random), black: makePlayer(black, ms, random) };
  let state = newGame();
  const opening = seeded(seed >>> 1);
  for (let i = 0; i < OPENING_PLIES; i++) {
    const moves = legalActions(state).filter((a) => a.type === 'move');
    state = applyAction(state, moves[Math.floor(opening() * moves.length)]);
  }
  let plies = OPENING_PLIES;
  let rotations = 0;
  while (!state.result && plies < MAX_PLIES) {
    const action = players[state.turn](state);
    if (action.type === 'rotate') rotations++;
    state = applyAction(state, action);
    plies++;
  }
  const result = state.result ?? { outcome: 'draw', reason: 'move limit' };
  const score = result.outcome === 'checkmate' ? (result.winner === WHITE ? 1 : 0) : 0.5;
  return { score, reason: result.reason, plies, rotations };
}

if (isMainThread) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? Number(args[i + 1]) : fallback;
  };
  const [a, b] = args.filter((x, i) => !x.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const games = option('games', 20);
  const ms = option('ms', 200);
  const threads = option('threads', availableParallelism());
  const baseSeed = option('seed', 1);
  const jobs = [];
  for (let g = 0; g < games; g++) {
    const seed = baseSeed * 7919 + Math.floor(g / 2) * 104729;
    jobs.push(g % 2 === 0 ? { white: a, black: b, ms, seed } : { white: b, black: a, ms, seed });
  }
  let points = 0;
  const tally = { win: 0, draw: 0, loss: 0 };
  const reasons = {};
  let done = 0;
  let totalPlies = 0;
  let rotations = 0;
  const started = Date.now();
  const run = () =>
    new Promise((resolve) => {
      const next = () => {
        const job = jobs.shift();
        if (!job) return resolve(worker.terminate());
        worker.once('message', (r) => {
          const forA = job.white === a ? r.score : 1 - r.score;
          points += forA;
          tally[forA === 1 ? 'win' : forA === 0 ? 'loss' : 'draw']++;
          reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
          totalPlies += r.plies;
          rotations += r.rotations;
          done++;
          process.stderr.write(
            `\r${done}/${games}  ${a} ${points}-${done - points} ${b}   (${job.white} vs ${job.black}: ${r.score} by ${r.reason})      `,
          );
          next();
        });
        worker.postMessage(job);
      };
      const worker = new Worker(fileURLToPath(import.meta.url));
      next();
    });
  await Promise.all(Array.from({ length: Math.min(threads, games) }, run));
  process.stderr.write('\n');
  console.log(
    `${a} vs ${b} @ ${ms}ms/move: ${a} +${tally.win} =${tally.draw} -${tally.loss} ` +
      `(${((points / games) * 100).toFixed(0)}%), avg ${Math.round(totalPlies / games)} plies, ` +
      `${((rotations / totalPlies) * 100).toFixed(0)}% rotations, ${JSON.stringify(reasons)}, ` +
      `${Math.round((Date.now() - started) / 1000)}s`,
  );
} else {
  void workerData;
  parentPort.on('message', (job) => parentPort.postMessage(playGame(job)));
}
