import { formatMovetext, resultToken } from '../game/notation.js';

const STORAGE_KEY = 'chessir.notation.open';
const WIDE_SCREEN = '(min-width: 700px)';

function initiallyOpen() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    // Storage can be unavailable (private mode).
  }
  // On a phone the panel would cover the board, so it starts closed there.
  return window.matchMedia(WIDE_SCREEN).matches;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The async clipboard API is missing outside secure contexts; fall back to a selection.
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** The side panel with the game's moves; `show(moves, result)` redraws it. */
export function createNotationPanel({ panel, toggle, list, copy }) {
  let text = '';
  let copyTimer = null;

  function setOpen(open) {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      // Not remembering the choice is fine.
    }
  }
  setOpen(initiallyOpen());
  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

  copy.addEventListener('click', async () => {
    const ok = await copyText(text);
    copy.textContent = ok ? 'Copied!' : 'Copy failed';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copy.textContent = 'Copy'), 1500);
  });

  return {
    show(moves, result) {
      text = formatMovetext(moves, result);
      copy.disabled = moves.length === 0;
      const rows = [];
      for (let i = 0; i < moves.length; i += 2) {
        const row = document.createElement('li');
        for (const [cls, content] of [
          ['num', `${i / 2 + 1}.`],
          ['ply', moves[i]],
          ['ply', moves[i + 1] ?? ''],
        ]) {
          const cell = document.createElement('span');
          cell.className = cls;
          cell.textContent = content;
          row.append(cell);
        }
        rows.push(row);
      }
      const last = rows.at(-1)?.querySelectorAll('.ply')[moves.length % 2 === 0 ? 1 : 0];
      last?.classList.add('last');
      if (result) {
        const row = document.createElement('li');
        row.className = 'result';
        row.textContent = resultToken(result);
        rows.push(row);
      }
      if (rows.length === 0) {
        const row = document.createElement('li');
        row.className = 'empty';
        row.textContent = 'No moves yet';
        rows.push(row);
      }
      list.replaceChildren(...rows);
      list.scrollTop = list.scrollHeight;
    },
  };
}
