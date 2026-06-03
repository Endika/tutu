import { it, expect } from 'vitest';
import { Audio } from '../../src/audio/audio';
import type { Player } from '../../src/audio/audio';

function fake() {
  const calls: string[] = [];
  const player: Player = {
    play: (n) => { calls.push(`play:${n}`); },
    startMusic: () => { calls.push('startMusic'); },
    stopMusic: () => { calls.push('stopMusic'); },
  };
  return { player, calls };
}

it('plays sounds when unmuted', () => {
  const { player, calls } = fake();
  const a = new Audio(player);
  a.horn(); a.slide(); a.victory(); a.music();
  expect(calls).toEqual(['play:horn', 'play:slide', 'play:victory', 'startMusic']);
});

it('is silent when muted and stops music on mute', () => {
  const { player, calls } = fake();
  const a = new Audio(player, false);
  a.music();
  a.setMuted(true);          // should stop music
  a.horn(); a.victory();     // should produce nothing
  expect(calls).toEqual(['startMusic', 'stopMusic']);
  expect(a.isMuted()).toBe(true);
});
