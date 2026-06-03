import { t, LOCALES } from '../i18n/index';
import type { Dict } from '../i18n/index';

export interface HudHandlers {
  onReset(): void;
  onUndo(): void;
  onHint(): void;
  onNext(): void;
  onMuteToggle(): void;
  onLangChange(code: string): void;
  isMuted(): boolean;
  getLevelIndex(): number;
  getMoveCount(): number;
  getCurrentLang(): string;
}

let container: HTMLElement | null = null;
let handlers: HudHandlers | null = null;

let levelEl: HTMLSpanElement | null = null;
let movesEl: HTMLSpanElement | null = null;
let muteBtn: HTMLButtonElement | null = null;
let winBanner: HTMLDivElement | null = null;
let nextBtn: HTMLButtonElement | null = null;

function btn(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className =
    `px-4 py-3 rounded-2xl font-bold text-lg bg-white/90 text-slate-800 shadow active:scale-95 transition-transform touch-manipulation ${extra}`.trim();
  b.addEventListener('click', onClick);
  return b;
}

export function buildHud(el: HTMLElement, h: HudHandlers): void {
  container = el;
  handlers = h;
  el.innerHTML = '';

  el.className =
    'pointer-events-none fixed inset-0 flex flex-col justify-between p-3 gap-2';

  // --- top bar: level + moves ---
  const topBar = document.createElement('div');
  topBar.className = 'pointer-events-auto flex items-center justify-between gap-2';

  const levelBadge = document.createElement('div');
  levelBadge.className =
    'flex items-center gap-1 bg-white/90 rounded-2xl px-4 py-2 shadow font-bold text-slate-800 text-base';
  const levelLabel = document.createElement('span');
  levelLabel.textContent = t('level') + ' ';
  levelEl = document.createElement('span');
  levelEl.className = 'text-orange-500';
  levelEl.textContent = String(h.getLevelIndex() + 1);
  levelBadge.append(levelLabel, levelEl);

  const movesBadge = document.createElement('div');
  movesBadge.className =
    'flex items-center gap-1 bg-white/90 rounded-2xl px-4 py-2 shadow font-bold text-slate-800 text-base';
  const movesLabel = document.createElement('span');
  movesLabel.textContent = t('moves') + ': ';
  movesEl = document.createElement('span');
  movesEl.className = 'text-blue-600';
  movesEl.textContent = String(h.getMoveCount());
  movesBadge.append(movesLabel, movesEl);

  topBar.append(levelBadge, movesBadge);

  // --- win banner (hidden by default) ---
  winBanner = document.createElement('div');
  winBanner.className =
    'pointer-events-auto hidden flex-col items-center gap-3 bg-white/95 rounded-3xl p-6 shadow-xl mx-auto';
  const winMsg = document.createElement('p');
  winMsg.className = 'text-3xl font-extrabold text-orange-500';
  winMsg.id = 'win-msg';
  winMsg.textContent = t('youWin');
  nextBtn = btn(t('next'), () => h.onNext(), 'bg-orange-400 text-white text-xl px-8 py-4');
  winBanner.append(winMsg, nextBtn);

  // --- bottom controls ---
  const bottomBar = document.createElement('div');
  bottomBar.className =
    'pointer-events-auto grid grid-cols-3 gap-2 sm:grid-cols-6';

  const resetBtn = btn(t('reset'), () => h.onReset());
  resetBtn.id = 'btn-reset';

  const undoBtn = btn(t('undo'), () => h.onUndo());
  undoBtn.id = 'btn-undo';

  const hintBtn = btn(t('hint'), () => h.onHint());
  hintBtn.id = 'btn-hint';

  const bottomNext = btn(t('next'), () => h.onNext());
  bottomNext.id = 'btn-next';

  muteBtn = btn(h.isMuted() ? t('unmute') : t('mute'), () => h.onMuteToggle());
  muteBtn.id = 'btn-mute';

  // Language selector
  const langWrap = document.createElement('div');
  langWrap.className =
    'flex flex-col items-center bg-white/90 rounded-2xl px-3 py-2 shadow gap-0.5';
  const langLabel = document.createElement('label');
  langLabel.className = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';
  langLabel.textContent = t('language');
  const langSel = document.createElement('select');
  langSel.id = 'lang-select';
  langSel.className =
    'bg-transparent font-bold text-slate-800 text-sm outline-none cursor-pointer';
  const currentLang = h.getCurrentLang();
  for (const code of Object.keys(LOCALES)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code.toUpperCase();
    if (code === currentLang) opt.selected = true;
    langSel.appendChild(opt);
  }
  langSel.addEventListener('change', () => h.onLangChange(langSel.value));
  langWrap.append(langLabel, langSel);

  bottomBar.append(resetBtn, undoBtn, hintBtn, bottomNext, muteBtn, langWrap);

  el.append(topBar, winBanner, bottomBar);
}

export function updateCounters(levelIndex: number, moveCount: number): void {
  if (levelEl) levelEl.textContent = String(levelIndex + 1);
  if (movesEl) movesEl.textContent = String(moveCount);
}

export function showWin(): void {
  if (!winBanner) return;
  winBanner.classList.remove('hidden');
  winBanner.classList.add('flex');
}

export function hideWin(): void {
  if (!winBanner) return;
  winBanner.classList.add('hidden');
  winBanner.classList.remove('flex');
}

export function refreshLabels(h: HudHandlers): void {
  if (!container || !handlers) return;
  buildHud(container, h);
}

export function updateMuteLabel(muted: boolean): void {
  if (muteBtn) muteBtn.textContent = muted ? t('unmute') : t('mute');
}

export function getWinMsgEl(): HTMLElement | null {
  return document.getElementById('win-msg');
}

// Re-export so app.ts can call a single function
export type { Dict };
