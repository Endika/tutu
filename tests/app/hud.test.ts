import { it, expect, beforeEach } from 'vitest'
import { buildHud, showLoading, showLoadError, hideLoading } from '../../src/app/hud'
import type { HudHandlers } from '../../src/app/hud'
import { setLang } from '../../src/i18n'
import { en } from '../../src/i18n/locales/en'

const noop = (): void => {}
const handlers: HudHandlers = {
  onReset: noop,
  onUndo: noop,
  onHint: noop,
  onNext: noop,
  onMuteToggle: noop,
  onMusicToggle: noop,
  onLangChange: noop,
  isMuted: () => false,
  isMusicEnabled: () => true,
  getLevelIndex: () => 0,
  getMoveCount: () => 0,
  getCurrentLang: () => 'en',
  isWon: () => false,
}

const overlay = () => document.getElementById('loading-msg')!.parentElement!
const message = () => document.getElementById('loading-msg')!.textContent
const retry = () => document.getElementById('btn-retry') as HTMLButtonElement
const shown = (el: Element) => !el.classList.contains('hidden')

beforeEach(() => {
  setLang('en')
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  buildHud(el, handlers)
})

it('a failed load replaces the spinner with an error and a working retry', () => {
  let retries = 0
  showLoading()
  showLoadError(() => retries++)
  expect(shown(overlay())).toBe(true)
  expect(message()).toBe(en.loadError)
  expect(shown(retry())).toBe(true)
  retry().click()
  expect(retries).toBe(1)
})

it('loading again after an error shows the spinner without the retry', () => {
  showLoadError(noop)
  showLoading()
  expect(message()).toBe(en.loading)
  expect(shown(retry())).toBe(false)
  hideLoading()
  expect(shown(overlay())).toBe(false)
})
