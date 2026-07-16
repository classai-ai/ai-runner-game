// ==========================================
// AI Runner - Settings Manager
// ==========================================

const SETTINGS_KEY = 'aiRunnerSettings';

const DEFAULT_SETTINGS = {
  bgmVolume: 0.35,
  sfxVolume: 0.6,
  bgmEnabled: true,
  sfxEnabled: true,
  keys: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'ArrowUp'],
    slide: ['ArrowDown'],
  },
};

const KEY_LABELS = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  KeyA: 'A',
  KeyD: 'D',
  KeyW: 'W',
  KeyS: 'S',
};

const SettingsManager = {
  data: null,

  _cloneKeys(keys) {
    return {
      left: [...keys.left],
      right: [...keys.right],
      jump: [...keys.jump],
      slide: [...keys.slide],
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        this.data = { ...DEFAULT_SETTINGS, keys: this._cloneKeys(DEFAULT_SETTINGS.keys) };
        this.applyToAudio();
        return;
      }
      const saved = JSON.parse(raw);
      this.data = {
        ...DEFAULT_SETTINGS,
        ...saved,
        keys: this._cloneKeys({ ...DEFAULT_SETTINGS.keys, ...(saved.keys || {}) }),
      };
    } catch {
      this.data = { ...DEFAULT_SETTINGS, keys: this._cloneKeys(DEFAULT_SETTINGS.keys) };
    }
    this.applyToAudio();
  },

  save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    this.applyToAudio();
  },

  applyToAudio() {
    AudioManager.bgmVolume = this.data.bgmEnabled ? this.data.bgmVolume : 0;
    AudioManager.sfxVolume = this.data.sfxEnabled ? this.data.sfxVolume : 0;
    AudioManager.bgmEnabled = this.data.bgmEnabled;
    AudioManager.sfxEnabled = this.data.sfxEnabled;
    AudioManager.updateVolumes();
  },

  resetKeys() {
    this.data.keys = this._cloneKeys(DEFAULT_SETTINGS.keys);
    this.save();
  },

  formatKeys(codes) {
    return codes.map(code => KEY_LABELS[code] || code.replace(/^Key/, '')).join(' / ');
  },

  isAction(code, action) {
    return this.data.keys[action]?.includes(code);
  },

  getPreventCodes() {
    const codes = new Set();
    Object.values(this.data.keys).forEach(list => list.forEach(c => codes.add(c)));
    return [...codes];
  },
};

SettingsManager.load();
