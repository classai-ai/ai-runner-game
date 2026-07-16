// ==========================================
// AI Runner - Audio Manager
// BGM: OpenGameArt / Mixkit (royalty-free)
// ==========================================

const AudioManager = {
  unlocked: false,
  bgmVolume: 0.35,
  sfxVolume: 0.6,
  bgmEnabled: true,
  sfxEnabled: true,
  currentBgm: null,

  tracks: {
    bgmLobby: 'assets/audio/bgm_lobby.mp3',
    bgmGame: 'assets/audio/bgm_game.mp3',
    sfxHeal: 'assets/audio/sfx_heal.mp3',
    sfxHit: 'assets/audio/sfx_hit.mp3',
    sfxData: 'assets/audio/sfx_data.mp3',
  },

  _cache: {},

  _get(key) {
    if (!this._cache[key]) {
      const audio = new Audio(this.tracks[key]);
      audio.preload = 'auto';
      if (key.startsWith('bgm')) {
        audio.loop = true;
        audio.volume = this.bgmEnabled ? this.bgmVolume : 0;
      } else {
        audio.volume = this.sfxEnabled ? this.sfxVolume : 0;
      }
      this._cache[key] = audio;
    }
    return this._cache[key];
  },

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    Object.keys(this.tracks).forEach(key => {
      const a = this._get(key);
      a.load();
    });
  },

  updateVolumes() {
    Object.keys(this.tracks).forEach(k => {
      const a = this._cache[k];
      if (!a) return;
      if (k.startsWith('bgm')) {
        a.volume = this.bgmEnabled ? this.bgmVolume : 0;
      } else {
        a.volume = this.sfxEnabled ? this.sfxVolume : 0;
      }
    });
  },

  playBgm(key) {
    if (!this.unlocked || !this.bgmEnabled) {
      this.stopBgm();
      return;
    }
    if (this.currentBgm === key) {
      const playing = this._get(key);
      playing.volume = this.bgmVolume;
      if (playing.paused) playing.play().catch(() => {});
      return;
    }

    Object.keys(this.tracks).forEach(k => {
      if (k.startsWith('bgm')) {
        const a = this._get(k);
        a.pause();
        a.currentTime = 0;
      }
    });

    const bgm = this._get(key);
    bgm.volume = this.bgmVolume;
    bgm.play().catch(() => {});
    this.currentBgm = key;
  },

  stopBgm() {
    Object.keys(this.tracks).forEach(k => {
      if (k.startsWith('bgm')) this._get(k).pause();
    });
    this.currentBgm = null;
  },

  playSfx(key) {
    if (!this.unlocked || !this.sfxEnabled) return;
    const src = this._get(key);
    const sfx = src.cloneNode();
    sfx.volume = this.sfxVolume;
    sfx.play().catch(() => {});
  },

  forScreen(screenName) {
    if (screenName === 'game') {
      this.playBgm('bgmGame');
    } else if (['menu', 'select', 'settings', 'over'].includes(screenName)) {
      this.playBgm('bgmLobby');
    }
  },
};
