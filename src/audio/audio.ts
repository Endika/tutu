export interface Player {
  play(name: 'horn' | 'slide' | 'victory'): void
  startMusic(): void
  stopMusic(): void
}

export class Audio {
  private muted: boolean
  private musicEnabled: boolean

  constructor(
    private player: Player,
    muted = false,
    musicEnabled = true,
  ) {
    this.muted = muted
    this.musicEnabled = musicEnabled
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (m) this.player.stopMusic()
  }

  isMuted(): boolean {
    return this.muted
  }

  // Music can be turned off independently of the sound effects.
  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on
    if (on) this.music()
    else this.player.stopMusic()
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled
  }

  horn(): void {
    if (!this.muted) this.player.play('horn')
  }

  slide(): void {
    if (!this.muted) this.player.play('slide')
  }

  victory(): void {
    if (!this.muted) this.player.play('victory')
  }

  music(): void {
    if (!this.muted && this.musicEnabled) this.player.startMusic()
  }
}
