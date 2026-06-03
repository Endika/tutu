export interface Player {
  play(name: 'horn' | 'slide' | 'victory'): void;
  startMusic(): void;
  stopMusic(): void;
}

export class Audio {
  private muted: boolean;

  constructor(
    private player: Player,
    muted = false,
  ) {
    this.muted = muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.player.stopMusic();
  }

  isMuted(): boolean {
    return this.muted;
  }

  horn(): void {
    if (!this.muted) this.player.play('horn');
  }

  slide(): void {
    if (!this.muted) this.player.play('slide');
  }

  victory(): void {
    if (!this.muted) this.player.play('victory');
  }

  music(): void {
    if (!this.muted) this.player.startMusic();
  }
}
