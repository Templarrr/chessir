import { formatMovetext, resultToken } from '../game/notation.js';

const STORAGE_KEY = 'rookabout.notation.open';
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

/**
 * The side panel with the game's moves; `show(moves, result, current)` redraws it, with
 * `current` the number of moves on the board. Clicking a move or a step button asks
 * `goTo` for that position; "Reset here" asks `resetHere` to drop the moves after it.
 */
export function createNotationPanel(
  { panel, toggle, list, copy, first, back, forward, last, reset },
  { goTo, resetHere },
) {
  let text = '';
  let copyTimer = null;
  let current = 0;
  let total = 0;

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

  first.addEventListener('click', () => goTo(0));
  back.addEventListener('click', () => goTo(current - 1));
  forward.addEventListener('click', () => goTo(current + 1));
  last.addEventListener('click', () => goTo(total));
  reset.addEventListener('click', () => resetHere());

  function plyCell(moves, index) {
    if (index >= moves.length) return document.createElement('span');
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'ply';
    cell.textContent = moves[index];
    cell.title = 'Show the board after this move';
    if (index + 1 === current) cell.classList.add('current');
    if (index + 1 > current) cell.classList.add('ahead');
    cell.addEventListener('click', () => goTo(index + 1));
    return cell;
  }

  function scrollToCurrent() {
    const cell = list.querySelector('.current');
    if (!cell || current === total) {
      list.scrollTop = list.scrollHeight;
      return;
    }
    const row = cell.parentElement;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    const bottom = row.offsetTop + row.offsetHeight;
    if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  return {
    show(moves, result, shown = moves.length) {
      text = formatMovetext(moves, result);
      current = shown;
      total = moves.length;
      copy.disabled = total === 0;
      first.disabled = back.disabled = current === 0;
      forward.disabled = last.disabled = current === total;
      reset.disabled = current === total;
      panel.classList.toggle('browsing', current < total);

      const rows = [];
      for (let i = 0; i < moves.length; i += 2) {
        const row = document.createElement('li');
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = `${i / 2 + 1}.`;
        row.append(num, plyCell(moves, i), plyCell(moves, i + 1));
        rows.push(row);
      }
      if (result) {
        const row = document.createElement('li');
        row.className = 'result';
        if (current < total) row.classList.add('ahead');
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
      scrollToCurrent();
    },
  };
}
