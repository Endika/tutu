import { t, LOCALES } from '../i18n/index'

export interface HudHandlers {
  onReset(): void
  onUndo(): void
  onHint(): void
  onNext(): void
  onMuteToggle(): void
  onMusicToggle(): void
  onLangChange(code: string): void
  isMuted(): boolean
  isMusicEnabled(): boolean
  getLevelIndex(): number
  getMoveCount(): number
  getCurrentLang(): string
  isWon(): boolean
}

let container: HTMLElement | null = null
let handlers: HudHandlers | null = null

let levelEl: HTMLSpanElement | null = null
let movesEl: HTMLSpanElement | null = null
let muteBtn: HTMLButtonElement | null = null
let musicBtn: HTMLButtonElement | null = null
let winBanner: HTMLDivElement | null = null
let nextBtn: HTMLButtonElement | null = null
let loadingOverlay: HTMLDivElement | null = null

function btn(
  icon: string,
  label: string,
  onClick: () => void,
  extra = 'bg-white/90 text-slate-800',
): HTMLButtonElement {
  const b = document.createElement('button')
  // colour comes only from `extra` (default = white) so callers can override without a class clash
  b.className =
    `flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-2xl font-bold shadow active:scale-95 transition-transform touch-manipulation ${extra}`.trim()
  const iconEl = document.createElement('span')
  iconEl.className = 'text-2xl leading-none'
  iconEl.textContent = icon
  const labelEl = document.createElement('span')
  labelEl.className = 'text-xs leading-tight'
  labelEl.textContent = label
  b.append(iconEl, labelEl)
  b.addEventListener('click', onClick)
  return b
}

// Update the icon + label of a button built by btn().
function setBtnContent(b: HTMLButtonElement, icon: string, label: string): void {
  const iconEl = b.children[0]
  const labelEl = b.children[1]
  if (iconEl) iconEl.textContent = icon
  if (labelEl) labelEl.textContent = label
}

// Icon for each toggle reflects the ACTION the button performs (matching its label).
const muteIcon = (muted: boolean) => (muted ? '🔊' : '🔇')
const musicIcon = (enabled: boolean) => (enabled ? '🔕' : '🎵')

export function buildHud(el: HTMLElement, h: HudHandlers): void {
  container = el
  handlers = h
  el.innerHTML = ''

  el.className = 'pointer-events-none fixed inset-0 flex flex-col justify-between p-3 gap-2'

  // --- top bar: level + moves ---
  const topBar = document.createElement('div')
  topBar.className = 'pointer-events-auto flex items-center justify-between gap-2'

  const levelBadge = document.createElement('div')
  levelBadge.className =
    'flex items-center gap-1 bg-white/90 rounded-2xl px-4 py-2 shadow font-bold text-slate-800 text-base'
  const levelLabel = document.createElement('span')
  levelLabel.textContent = t('level') + ' '
  levelEl = document.createElement('span')
  levelEl.className = 'text-orange-500'
  levelEl.textContent = String(h.getLevelIndex() + 1)
  levelBadge.append(levelLabel, levelEl)

  const movesBadge = document.createElement('div')
  movesBadge.className =
    'flex items-center gap-1 bg-white/90 rounded-2xl px-4 py-2 shadow font-bold text-slate-800 text-base'
  const movesLabel = document.createElement('span')
  movesLabel.textContent = t('moves') + ': '
  movesEl = document.createElement('span')
  movesEl.className = 'text-blue-600'
  movesEl.textContent = String(h.getMoveCount())
  movesBadge.append(movesLabel, movesEl)

  topBar.append(levelBadge, movesBadge)

  // --- win overlay (centered modal, hidden by default) ---
  winBanner = document.createElement('div')
  winBanner.className =
    'pointer-events-auto fixed inset-0 z-20 hidden items-center justify-center bg-black/40'
  const winCard = document.createElement('div')
  winCard.className = 'flex flex-col items-center gap-4 bg-white rounded-3xl px-10 py-8 shadow-xl'
  const winMsg = document.createElement('p')
  winMsg.className = 'text-3xl font-extrabold text-orange-500'
  winMsg.id = 'win-msg'
  winMsg.textContent = t('youWin')
  nextBtn = btn('⏭️', t('next'), () => h.onNext(), 'bg-orange-400 text-white px-10 py-4')
  winCard.append(winMsg, nextBtn)
  winBanner.append(winCard)

  // --- loading overlay (shown while a level is being generated) ---
  loadingOverlay = document.createElement('div')
  loadingOverlay.className =
    'pointer-events-auto fixed inset-0 z-30 hidden flex-col items-center justify-center gap-4 bg-black/40'
  const spinner = document.createElement('div')
  spinner.className = 'h-12 w-12 rounded-full border-4 border-white/40 border-t-white animate-spin'
  const loadingMsg = document.createElement('p')
  loadingMsg.id = 'loading-msg'
  loadingMsg.className = 'text-xl font-bold text-white'
  loadingMsg.textContent = t('loading')
  loadingOverlay.append(spinner, loadingMsg)

  // --- bottom controls ---
  const bottomBar = document.createElement('div')
  bottomBar.className = 'pointer-events-auto grid grid-cols-3 gap-2 sm:grid-cols-7'

  const resetBtn = btn('🔄', t('reset'), () => h.onReset())
  resetBtn.id = 'btn-reset'

  const undoBtn = btn('↩️', t('undo'), () => h.onUndo())
  undoBtn.id = 'btn-undo'

  const hintBtn = btn('💡', t('hint'), () => h.onHint())
  hintBtn.id = 'btn-hint'

  const bottomNext = btn('⏭️', t('next'), () => h.onNext())
  bottomNext.id = 'btn-next'

  muteBtn = btn(muteIcon(h.isMuted()), h.isMuted() ? t('unmute') : t('mute'), () =>
    h.onMuteToggle(),
  )
  muteBtn.id = 'btn-mute'

  musicBtn = btn(
    musicIcon(h.isMusicEnabled()),
    h.isMusicEnabled() ? t('musicOff') : t('music'),
    () => h.onMusicToggle(),
  )
  musicBtn.id = 'btn-music'

  // Language selector
  const langWrap = document.createElement('div')
  langWrap.className = 'flex flex-col items-center bg-white/90 rounded-2xl px-3 py-2 shadow gap-0.5'
  const langLabel = document.createElement('label')
  langLabel.className = 'text-2xl leading-none'
  langLabel.textContent = '🌐'
  langLabel.title = t('language')
  const langSel = document.createElement('select')
  langSel.id = 'lang-select'
  langSel.className = 'bg-transparent font-bold text-slate-800 text-sm outline-none cursor-pointer'
  const currentLang = h.getCurrentLang()
  for (const code of Object.keys(LOCALES)) {
    const opt = document.createElement('option')
    opt.value = code
    opt.textContent = code.toUpperCase()
    if (code === currentLang) opt.selected = true
    langSel.appendChild(opt)
  }
  langSel.addEventListener('change', () => h.onLangChange(langSel.value))
  langWrap.append(langLabel, langSel)

  bottomBar.append(resetBtn, undoBtn, hintBtn, bottomNext, muteBtn, musicBtn, langWrap)

  el.append(topBar, winBanner, loadingOverlay, bottomBar)
}

export function showLoading(): void {
  if (!loadingOverlay) return
  loadingOverlay.classList.remove('hidden')
  loadingOverlay.classList.add('flex')
}

export function hideLoading(): void {
  if (!loadingOverlay) return
  loadingOverlay.classList.add('hidden')
  loadingOverlay.classList.remove('flex')
}

export function updateCounters(levelIndex: number, moveCount: number): void {
  if (levelEl) levelEl.textContent = String(levelIndex + 1)
  if (movesEl) movesEl.textContent = String(moveCount)
}

export function showWin(): void {
  if (!winBanner) return
  winBanner.classList.remove('hidden')
  winBanner.classList.add('flex')
}

export function hideWin(): void {
  if (!winBanner) return
  winBanner.classList.add('hidden')
  winBanner.classList.remove('flex')
}

export function refreshLabels(h: HudHandlers): void {
  if (!container || !handlers) return
  buildHud(container, h)
  if (h.isWon()) showWin()
}

export function updateMuteLabel(muted: boolean): void {
  if (muteBtn) setBtnContent(muteBtn, muteIcon(muted), muted ? t('unmute') : t('mute'))
}

export function updateMusicLabel(musicEnabled: boolean): void {
  if (musicBtn)
    setBtnContent(musicBtn, musicIcon(musicEnabled), musicEnabled ? t('musicOff') : t('music'))
}
