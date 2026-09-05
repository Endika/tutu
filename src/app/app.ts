import type { Board, Move } from '../core/types'
import { applyMove, isWin } from '../core/board'
import { solve } from '../core/solver'
import { nextLevelAsync, willGenerate } from '../levels/source'
import { createScene } from '../render/scene'
import type { SceneController } from '../render/scene'
import { Audio } from '../audio/audio'
import { WebPlayer } from '../audio/web-player'
import { load, save } from '../state/persistence'
import { setLang, detectLang, LOCALES } from '../i18n/index'
import {
  buildHud,
  updateCounters,
  showWin,
  hideWin,
  refreshLabels,
  updateMuteLabel,
  updateMusicLabel,
  showLoading,
  hideLoading,
} from './hud'

function deepCopy(b: Board): Board {
  return b.map((p) => ({ ...p }))
}

export async function startApp(): Promise<void> {
  const saved = load()
  const lang = saved.lang && saved.lang in LOCALES ? saved.lang : detectLang()
  setLang(lang)

  const canvas = document.getElementById('scene') as HTMLCanvasElement
  const hudEl = document.getElementById('hud') as HTMLDivElement

  const scene: SceneController = createScene(canvas)
  const audio = new Audio(new WebPlayer(), saved.muted, !saved.musicOff)

  let levelIndex = saved.levelIndex
  let currentBoard: Board = []
  let startBoard: Board = []
  let history: Board[] = []
  let moveCount = 0
  let musicStarted = false
  let currentLang = lang
  let won = false

  function persistState(): void {
    save({
      levelIndex,
      muted: audio.isMuted(),
      lang: currentLang,
      musicOff: !audio.isMusicEnabled(),
    })
  }

  function tryStartMusic(): void {
    if (!musicStarted && !audio.isMuted()) {
      musicStarted = true
      audio.music()
    }
  }

  async function loadLevel(index: number): Promise<void> {
    const generating = willGenerate(index)
    if (generating) showLoading()
    const lvl = await nextLevelAsync(index)
    if (generating) hideLoading()
    currentBoard = deepCopy(lvl.board)
    startBoard = deepCopy(lvl.board)
    history = []
    moveCount = 0
    won = false
    hideWin()
    scene.renderBoard(currentBoard)
    updateCounters(index, moveCount)
    levelIndex = index
    persistState()
  }

  scene.setOnMove((move: Move) => {
    history.push(deepCopy(currentBoard))
    currentBoard = applyMove(currentBoard, move)
    moveCount++
    audio.slide()
    scene.renderBoard(currentBoard)
    updateCounters(levelIndex, moveCount)
    if (isWin(currentBoard)) {
      won = true
      audio.victory()
      showWin()
    }
  })

  scene.setOnBlocked(() => {
    audio.horn()
  })

  const handlers = {
    onReset(): void {
      currentBoard = deepCopy(startBoard)
      history = []
      moveCount = 0
      won = false
      hideWin()
      scene.renderBoard(currentBoard)
      updateCounters(levelIndex, moveCount)
    },
    onUndo(): void {
      const prev = history.pop()
      if (!prev) return
      currentBoard = prev
      moveCount = Math.max(0, moveCount - 1)
      won = false
      hideWin()
      scene.renderBoard(currentBoard)
      updateCounters(levelIndex, moveCount)
    },
    onHint(): void {
      const s = solve(currentBoard)
      if (s?.hint) scene.highlightHint(s.hint)
    },
    onNext(): void {
      levelIndex++
      void loadLevel(levelIndex)
    },
    onMuteToggle(): void {
      audio.setMuted(!audio.isMuted())
      if (!audio.isMuted()) {
        musicStarted = true
        audio.music() // resumes the loop if music is enabled
      }
      updateMuteLabel(audio.isMuted())
      persistState()
    },
    onMusicToggle(): void {
      audio.setMusicEnabled(!audio.isMusicEnabled())
      if (audio.isMusicEnabled()) musicStarted = true
      updateMusicLabel(audio.isMusicEnabled())
      persistState()
    },
    onLangChange(code: string): void {
      currentLang = code
      setLang(code)
      persistState()
      refreshLabels({
        ...handlers,
        isMuted: () => audio.isMuted(),
        getLevelIndex: () => levelIndex,
        getMoveCount: () => moveCount,
        getCurrentLang: () => currentLang,
        isWon: () => won,
      })
    },
    isMuted(): boolean {
      return audio.isMuted()
    },
    isMusicEnabled(): boolean {
      return audio.isMusicEnabled()
    },
    getLevelIndex(): number {
      return levelIndex
    },
    getMoveCount(): number {
      return moveCount
    },
    getCurrentLang(): string {
      return currentLang
    },
    isWon(): boolean {
      return won
    },
  }

  buildHud(hudEl, handlers)

  const firstGestureTarget: (EventTarget | null)[] = [canvas, hudEl]
  const onFirstGesture = (): void => {
    tryStartMusic()
    for (const target of firstGestureTarget) {
      target?.removeEventListener('pointerdown', onFirstGesture)
    }
  }
  for (const target of firstGestureTarget) {
    target?.addEventListener('pointerdown', onFirstGesture)
  }

  await loadLevel(levelIndex)
}
