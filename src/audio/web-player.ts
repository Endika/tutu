import type { Player } from './audio';

const MUSIC_GAIN = 0.14;

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
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MUSIC_GAIN, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.musicNodes.push(masterGain);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.3, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.03, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start();
    this.musicNodes.push(lfo, lfoGain);

    const padFreqs = [130.81, 146.83]; // C3, D3
    const noteDuration = 1.8;
    const loopDuration = noteDuration * padFreqs.length;

    const loopOscs: OscillatorNode[] = [];

    const playLoop = (): void => {
      if (!this.musicNodes.includes(masterGain)) return;

      // Drop oscillators from previous iterations that have already stopped
      for (const osc of loopOscs) {
        const idx = this.musicNodes.indexOf(osc);
        if (idx !== -1) this.musicNodes.splice(idx, 1);
      }
      loopOscs.length = 0;

      padFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.connect(masterGain);

        const start = ctx.currentTime + i * noteDuration;
        osc.start(start);
        osc.stop(start + noteDuration + 0.05);
        this.musicNodes.push(osc);
        loopOscs.push(osc);
      });

      this.musicTimeout = setTimeout(playLoop, loopDuration * 1000);
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
