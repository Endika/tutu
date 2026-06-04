import type { Player } from './audio';

export class WebPlayer implements Player {
  private ctx: AudioContext | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimeout: ReturnType<typeof setTimeout> | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  play(name: 'horn' | 'slide' | 'victory'): void {
    const ctx = this.getCtx();
    if (name === 'horn') this.playHorn(ctx);
    else if (name === 'slide') this.playSlide(ctx);
    else this.playVictory(ctx);
  }

  private playHorn(ctx: AudioContext): void {
    const freqs = [440, 520];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = ctx.currentTime + i * 0.13;
      const attack = 0.005;
      const sustain = 0.1;
      const release = 0.015;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.26, start + attack);
      gain.gain.setValueAtTime(0.26, start + attack + sustain);
      gain.gain.linearRampToValueAtTime(0, start + attack + sustain + release);

      osc.start(start);
      osc.stop(start + attack + sustain + release + 0.01);
    });
  }

  private playSlide(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const duration = 0.18;
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(180, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playVictory(ctx: AudioContext): void {
    // C4-E4-G4-C5 arpeggio
    const freqs = [261.63, 329.63, 392.0, 523.25];
    const step = 0.1;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);

      const start = ctx.currentTime + i * step;
      const attack = 0.008;
      const sustain = 0.07;
      const release = 0.02;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + attack);
      gain.gain.setValueAtTime(0.22, start + attack + sustain);
      gain.gain.linearRampToValueAtTime(0, start + attack + sustain + release);

      osc.start(start);
      osc.stop(start + attack + sustain + release + 0.01);
    });
  }

  startMusic(): void {
    this.stopMusic();
    const ctx = this.getCtx();
    this.scheduleMusicLoop(ctx);
  }

  private scheduleMusicLoop(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, ctx.currentTime);
    master.connect(ctx.destination);
    this.musicNodes.push(master);

    // A cheerful looping melody in C major: [frequency, beats]
    const BEAT = 0.3;
    const C5 = 523.25,
      D5 = 587.33,
      E5 = 659.25,
      F5 = 698.46,
      G5 = 783.99,
      A5 = 880.0;
    const melody: [number, number][] = [
      [C5, 1], [E5, 1], [G5, 1], [G5, 1],
      [A5, 1], [G5, 1], [E5, 1], [C5, 1],
      [D5, 1], [E5, 1], [F5, 1], [E5, 1],
      [D5, 2], [C5, 2],
    ];
    const loopSeconds = melody.reduce((s, [, b]) => s + b, 0) * BEAT;

    // nodes scheduled in the current iteration, pruned at the next one
    const loopNodes: AudioNode[] = [];

    const playLoop = (): void => {
      if (!this.musicNodes.includes(master)) return;

      for (const node of loopNodes) {
        const idx = this.musicNodes.indexOf(node);
        if (idx !== -1) this.musicNodes.splice(idx, 1);
      }
      loopNodes.length = 0;

      let t = ctx.currentTime + 0.05;
      for (const [freq, beats] of melody) {
        const dur = beats * BEAT;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.02);
        g.gain.setValueAtTime(0.14, t + dur - 0.06);
        g.gain.linearRampToValueAtTime(0, t + dur - 0.02);
        osc.start(t);
        osc.stop(t + dur);
        this.musicNodes.push(osc, g);
        loopNodes.push(osc, g);
        t += dur;
      }

      this.musicTimeout = setTimeout(playLoop, loopSeconds * 1000);
    };

    playLoop();
  }

  stopMusic(): void {
    if (this.musicTimeout !== null) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }

    const ctx = this.ctx;
    if (ctx) {
      this.musicNodes.forEach((node) => {
        try {
          if (node instanceof OscillatorNode) node.stop();
          node.disconnect();
        } catch {
          // already stopped
        }
      });
    }
    this.musicNodes = [];
  }
}
