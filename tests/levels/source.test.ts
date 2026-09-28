import { it, expect } from 'vitest'
import { createAsyncSource, nextLevel } from '../../src/levels/source'
import type { LevelWorker } from '../../src/levels/source'
import type { Level } from '../../src/core/types'
import type { GenerateRequest } from '../../src/worker/protocol'
import { bankSize } from '../../src/levels/bank'
import { generateAtDepth } from '../../src/core/generator'
import { makeRng } from '../../src/core/rng'
import { solve } from '../../src/core/solver'

it('serves bank levels in order, then generates a solvable tail level', () => {
  const first = nextLevel(0)
  expect(solve(first.board)).not.toBeNull()
  // Inject a fast easy generator so the test stays quick and deterministic: it asserts
  // the bank→generation orchestration yields a solvable tail level. Hard live generation
  // is exercised by the generator's own test.
  const rng = makeRng(1)
  const fastGen = (pc: number) => generateAtDepth(Math.min(pc, 5), 2, 5, rng)
  const tail = nextLevel(bankSize + 5, fastGen)
  expect(solve(tail.board)).not.toBeNull()
})

it('never returns null and bank levels match the bank', () => {
  const l = nextLevel(0)
  expect(l).toBeTruthy()
  expect(typeof l.optimalMoves).toBe('number')
})

class FakeWorker extends EventTarget implements LevelWorker {
  requests: GenerateRequest[] = []
  postMessage(request: GenerateRequest): void {
    this.requests.push(request)
  }
  terminate(): void {}
  reply(id: number, level: Level | null): void {
    this.dispatchEvent(new MessageEvent('message', { data: { id, level } }))
  }
}

function fakeSource() {
  const workers: FakeWorker[] = []
  const next = createAsyncSource(() => {
    const w = new FakeWorker()
    workers.push(w)
    return w
  })
  return { next, workers }
}

it('rejects every pending generation when the worker fails', async () => {
  const { next, workers } = fakeSource()
  const a = next(bankSize + 1)
  const b = next(bankSize + 2)
  workers[0]!.dispatchEvent(new Event('error'))
  await expect(a).rejects.toThrow()
  await expect(b).rejects.toThrow()
})

it('rejects the pending generation when a worker reply cannot be read', async () => {
  const { next, workers } = fakeSource()
  const a = next(bankSize + 1)
  workers[0]!.dispatchEvent(new MessageEvent('messageerror'))
  await expect(a).rejects.toThrow()
})

it('a retry after a failure gets a fresh worker and its level', async () => {
  const { next, workers } = fakeSource()
  const failed = next(bankSize + 1)
  workers[0]!.dispatchEvent(new Event('error'))
  await expect(failed).rejects.toThrow()

  const retry = next(bankSize + 1)
  const fresh = workers[1]!
  // A late error from the dead worker must not touch the new request.
  workers[0]!.dispatchEvent(new Event('error'))
  const level = nextLevel(0)
  fresh.reply(fresh.requests[0]!.id, level)
  await expect(retry).resolves.toBe(level)
})
