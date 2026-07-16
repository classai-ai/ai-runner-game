// ==========================================
// AI Runner : Escape from Virus
// HTML Canvas 기반 3레인 무한 러닝 게임
// ==========================================

const LANES = 3;
const INVINCIBLE_MS = 1000;
const JUMP_DURATION = 500;
const SLIDE_DURATION = 450;
const HEAL_DURATION = 800;
const HEAL_FRAME_MS = 200;
const RUN_FRAME_MS = 100;
const HIT_FRAME_MS = 120;

const CHAR_TRAITS = {
  ppiya: {
    maxLives: 3,
    sizeScale: 1.0,
    hitboxHScale: 0.72,
    label: '세로 피격: 작음',
  },
  oru: {
    maxLives: 5,
    sizeScale: 1.18,
    hitboxHScale: 1.38,
    label: '세로 피격: 넓음',
  },
};

function getMaxLives(char) {
  return CHAR_TRAITS[char].maxLives;
}

// 화면 전환
const screens = {
  menu: document.getElementById('screen-menu'),
  select: document.getElementById('screen-select'),
  settings: document.getElementById('screen-settings'),
  game: document.getElementById('screen-game'),
  over: document.getElementById('screen-over'),
};

let settingsReturnTo = 'menu';
let gamePausedForSettings = false;

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  AudioManager.forScreen(name);
}

function unlockAudio() {
  AudioManager.unlock();
  AudioManager.forScreen(screens.menu.classList.contains('active') ? 'menu' : 'select');
}

// 캐릭터 선택
let selectedChar = 'ppiya';
const charCards = document.querySelectorAll('.char-card');
charCards.forEach(card => {
  card.addEventListener('click', () => {
    charCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedChar = card.dataset.char;
  });
});

// 버튼 이벤트
document.getElementById('btn-start').addEventListener('click', () => {
  unlockAudio();
  showScreen('select');
  startSelectPreview();
});
document.getElementById('btn-settings-menu').addEventListener('click', () => {
  unlockAudio();
  openSettings('menu');
});
document.getElementById('btn-settings-game').addEventListener('click', () => {
  pauseGameForSettings();
  openSettings('game');
});
document.getElementById('btn-settings-back').addEventListener('click', () => closeSettings());
document.getElementById('btn-back-menu').addEventListener('click', () => {
  stopSelectPreview();
  showScreen('menu');
});
document.getElementById('btn-play').addEventListener('click', () => {
  unlockAudio();
  stopSelectPreview();
  startGame();
});
document.getElementById('btn-retry').addEventListener('click', () => {
  unlockAudio();
  startGame();
});
document.getElementById('btn-over-menu').addEventListener('click', () => {
  updateMenuHighScore();
  showScreen('menu');
});

// 최고 점수
function getHighScore() {
  return parseInt(localStorage.getItem('aiRunnerHighScore') || '0', 10);
}
function setHighScore(score) {
  localStorage.setItem('aiRunnerHighScore', String(score));
}
function updateMenuHighScore() {
  document.getElementById('menu-high-score').textContent = getHighScore();
}
updateMenuHighScore();

// ── 설정 UI ──
let rebindingAction = null;

function openSettings(returnTo) {
  settingsReturnTo = returnTo;
  syncSettingsUI();
  showScreen('settings');
}

function closeSettings() {
  cancelKeyRebind();
  if (settingsReturnTo === 'game' && gamePausedForSettings) {
    resumeGameFromSettings();
  } else {
    showScreen(settingsReturnTo);
  }
}

function pauseGameForSettings() {
  if (!gameState || !gameState.running) return;
  gamePausedForSettings = true;
  gameState.paused = true;
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function resumeGameFromSettings() {
  if (!gameState) return;
  gameState.paused = false;
  gamePausedForSettings = false;
  showScreen('game');
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

function syncSettingsUI() {
  const s = SettingsManager.data;
  document.getElementById('setting-bgm-enabled').checked = s.bgmEnabled;
  document.getElementById('setting-sfx-enabled').checked = s.sfxEnabled;
  document.getElementById('setting-bgm-volume').value = Math.round(s.bgmVolume * 100);
  document.getElementById('setting-sfx-volume').value = Math.round(s.sfxVolume * 100);
  document.getElementById('setting-bgm-value').textContent = Math.round(s.bgmVolume * 100) + '%';
  document.getElementById('setting-sfx-value').textContent = Math.round(s.sfxVolume * 100) + '%';
  updateKeyDisplays();
}

function updateKeyDisplays() {
  for (const action of ['left', 'right', 'jump', 'slide']) {
    const el = document.getElementById(`key-display-${action}`);
    if (el) el.textContent = SettingsManager.formatKeys(SettingsManager.data.keys[action]);
  }
}

function cancelKeyRebind() {
  rebindingAction = null;
  document.querySelectorAll('.btn-key-bind').forEach(btn => btn.classList.remove('listening'));
  document.getElementById('key-bind-hint').textContent = '모바일: 좌우/상하 스와이프로 조작';
}

document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('setting-bgm-enabled').addEventListener('change', e => {
  SettingsManager.data.bgmEnabled = e.target.checked;
  SettingsManager.save();
  AudioManager.forScreen('settings');
});

document.getElementById('setting-sfx-enabled').addEventListener('change', e => {
  SettingsManager.data.sfxEnabled = e.target.checked;
  SettingsManager.save();
});

document.getElementById('setting-bgm-volume').addEventListener('input', e => {
  const val = parseInt(e.target.value, 10);
  SettingsManager.data.bgmVolume = val / 100;
  document.getElementById('setting-bgm-value').textContent = val + '%';
  SettingsManager.save();
});

document.getElementById('setting-sfx-volume').addEventListener('input', e => {
  const val = parseInt(e.target.value, 10);
  SettingsManager.data.sfxVolume = val / 100;
  document.getElementById('setting-sfx-value').textContent = val + '%';
  SettingsManager.save();
});

document.getElementById('btn-test-sfx').addEventListener('click', () => {
  unlockAudio();
  AudioManager.playSfx('sfxData');
});

document.getElementById('btn-reset-keys').addEventListener('click', () => {
  SettingsManager.resetKeys();
  updateKeyDisplays();
});

document.querySelectorAll('.btn-key-bind').forEach(btn => {
  btn.addEventListener('click', () => {
    cancelKeyRebind();
    rebindingAction = btn.dataset.action;
    btn.classList.add('listening');
    document.getElementById('key-bind-hint').textContent = '새 키를 눌러주세요… (Esc: 취소)';
  });
});

document.addEventListener('keydown', e => {
  if (rebindingAction) {
    e.preventDefault();
    if (e.code === 'Escape') {
      cancelKeyRebind();
      return;
    }
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) {
      return;
    }
    SettingsManager.data.keys[rebindingAction] = [e.code];
    SettingsManager.save();
    updateKeyDisplays();
    cancelKeyRebind();
    return;
  }

  keys[e.code] = true;
  const preventCodes = SettingsManager.getPreventCodes();
  if (preventCodes.includes(e.code)) {
    e.preventDefault();
  }
  handleInput(e.code);
});

document.addEventListener('keyup', e => { keys[e.code] = false; });

// 스프라이트 로드
const SPRITE_DEF = {
  ppiya: { run: 5, heal: 4, hit: 4 },
  oru:   { run: 5, heal: 4, hit: 4 },
};

const sprites = { ppiya: { front: null, run: [], heal: [], hit: [] }, oru: { front: null, run: [], heal: [], hit: [] } };
let spritesReady = false;

function loadSprites() {
  const promises = [];
  for (const char of ['ppiya', 'oru']) {
    const base = `assets/sprites/${char}`;
    sprites[char].front = loadImage(`${base}/front.png`);
    promises.push(sprites[char].front);
    for (const type of ['run', 'heal', 'hit']) {
      sprites[char][type] = [];
      for (let i = 0; i < SPRITE_DEF[char][type]; i++) {
        const img = loadImage(`${base}/${type}/${type}_${i}.png`);
        sprites[char][type].push(img);
        promises.push(img);
      }
    }
  }
  return Promise.all(promises.map(img => new Promise(res => {
    if (img.complete) res();
    else { img.onload = res; img.onerror = res; }
  }))).then(() => { spritesReady = true; });
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

// 아이템/장애물 스프라이트
const ENTITY_SPRITE_PATHS = {
  virus: 'assets/items/virus_red.png',
  tall_virus: 'assets/items/virus_tall.png',
  float_virus: 'assets/items/virus_pink.png',
  vaccine: 'assets/items/vaccine.png',
  data: 'assets/items/data_coin.png',
};

const ENTITY_RENDER = {
  virus:       { w: 0.52, h: 0.52, glow: '#ff4466', bob: false },
  tall_virus:  { w: 0.68, h: 0.88, glow: '#ff2255', bob: false },
  float_virus: { w: 0.56, h: 0.40, glow: '#dd66ff', bob: true },
  vaccine:     { w: 0.44, h: 0.48, glow: '#00ff99', bob: true },
  data:        { w: 0.46, h: 0.46, glow: '#ffd700', bob: true },
};

const entitySprites = {};
let entitySpritesReady = false;

function loadEntitySprites() {
  const promises = Object.entries(ENTITY_SPRITE_PATHS).map(([type, src]) => {
    const img = loadImage(src);
    entitySprites[type] = img;
    return new Promise(res => {
      if (img.complete) res();
      else { img.onload = res; img.onerror = res; }
    });
  });
  return Promise.all(promises).then(() => { entitySpritesReady = true; });
}

Promise.all([loadSprites(), loadEntitySprites()]).then(() => startSelectPreview());

// 공통 스프라이트 그리기
function drawSprite(targetCtx, img, cx, cy, height, bobY = 0, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const aspect = img.width / img.height;
  const drawH = height;
  const drawW = height * aspect;
  const x = cx - drawW / 2;
  const y = cy - drawH / 2 + bobY;

  targetCtx.save();
  targetCtx.globalAlpha = alpha;
  targetCtx.drawImage(img, x, y, drawW, drawH);
  targetCtx.restore();
}

// ── 캐릭터 선택 화면 애니메이션 ──
let selectAnimId = null;

function getSelectAnim(isSelected, timestamp) {
  const bob = Math.sin(timestamp / 400) * (isSelected ? 5 : 3);
  return { set: 'front', frame: 0, bob };
}

function drawSelectPreview(timestamp) {
  if (!spritesReady || !screens.select.classList.contains('active')) return;

  charCards.forEach(card => {
    const char = card.dataset.char;
    const canvas = card.querySelector('.char-preview-canvas');
    if (!canvas) return;

    const cctx = canvas.getContext('2d');
    const isSelected = card.classList.contains('selected');
    const { bob } = getSelectAnim(isSelected, timestamp);

    cctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawH = canvas.height * 0.72 * CHAR_TRAITS[char].sizeScale;
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.62;
    drawSprite(cctx, sprites[char].front, cx, cy, drawH, bob);
    drawHitboxPreview(cctx, char, cx, cy, drawH);
  });

  selectAnimId = requestAnimationFrame(drawSelectPreview);
}

function startSelectPreview() {
  if (selectAnimId) cancelAnimationFrame(selectAnimId);
  if (spritesReady) selectAnimId = requestAnimationFrame(drawSelectPreview);
}

function stopSelectPreview() {
  if (selectAnimId) {
    cancelAnimationFrame(selectAnimId);
    selectAnimId = null;
  }
}

function drawHitboxPreview(cctx, char, cx, cy, drawH) {
  const hScale = CHAR_TRAITS[char].hitboxHScale;
  const w = drawH * 0.7;
  const h = drawH * hScale;
  cctx.save();
  cctx.strokeStyle = char === 'ppiya' ? 'rgba(0, 255, 180, 0.75)' : 'rgba(255, 90, 110, 0.75)';
  cctx.fillStyle = char === 'ppiya' ? 'rgba(0, 255, 180, 0.12)' : 'rgba(255, 90, 110, 0.12)';
  cctx.setLineDash([5, 4]);
  cctx.lineWidth = 2;
  cctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  cctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  cctx.restore();
}

// Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const container = document.getElementById('game-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

// 게임 상태
let gameState = null;
let animId = null;
let lastTime = 0;

// 장애물/아이템 타입
const TYPES = {
  VIRUS: 'virus',
  TALL_VIRUS: 'tall_virus',
  FLOAT_VIRUS: 'float_virus',
  VACCINE: 'vaccine',
  DATA: 'data',
};

function createGameState() {
  const maxLives = getMaxLives(selectedChar);
  return {
    lane: 1,
    lives: maxLives,
    maxLives,
    score: 0,
    distance: 0,
    combo: 0,
    speed: 280,
    invincibleUntil: 0,
    jumping: false,
    jumpStart: 0,
    sliding: false,
    slideStart: 0,
    entities: [],
    popups: [],
    spawnTimer: 0,
    spawnInterval: 1.2,
    phase: 1,
    char: selectedChar,
    running: true,
    paused: false,
    healAnimStart: 0,
    healAnimUntil: 0,
    hitAnimStart: 0,
  };
}

function startGame() {
  if (animId) cancelAnimationFrame(animId);
  resizeCanvas();
  gameState = createGameState();
  gamePausedForSettings = false;
  lastTime = performance.now();
  showScreen('game');
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
}

// 입력
const keys = {};

function handleInput(code) {
  if (!gameState || !gameState.running || gameState.paused) return;
  const gs = gameState;

  if (SettingsManager.isAction(code, 'left') && gs.lane > 0) {
    gs.lane--;
  }
  if (SettingsManager.isAction(code, 'right') && gs.lane < LANES - 1) {
    gs.lane++;
  }
  if (SettingsManager.isAction(code, 'jump') && !gs.jumping && !gs.sliding) {
    gs.jumping = true;
    gs.jumpStart = performance.now();
  }
  if (SettingsManager.isAction(code, 'slide') && !gs.sliding && !gs.jumping) {
    gs.sliding = true;
    gs.slideStart = performance.now();
  }
}

// 터치 스와이프
let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const threshold = 30;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -threshold) handleInput(SettingsManager.data.keys.left[0]);
    if (dx > threshold) handleInput(SettingsManager.data.keys.right[0]);
  } else {
    if (dy < -threshold) handleInput(SettingsManager.data.keys.jump[0]);
    if (dy > threshold) handleInput(SettingsManager.data.keys.slide[0]);
  }
}, { passive: true });

// 스폰
function spawnEntity(gs) {
  const lane = Math.floor(Math.random() * LANES);
  const roll = Math.random();

  let type;
  if (roll < 0.45) {
    type = TYPES.VIRUS;
  } else if (roll < 0.58) {
    type = TYPES.TALL_VIRUS;
  } else if (roll < 0.65 && gs.phase >= 2) {
    type = TYPES.FLOAT_VIRUS;
  } else if (roll < 0.78) {
    type = TYPES.VACCINE;
  } else {
    type = TYPES.DATA;
  }

  // 같은 레인에 겹치지 않도록
  const tooClose = gs.entities.some(
    ent => ent.lane === lane && ent.y < 120
  );
  if (tooClose && type !== TYPES.DATA) return;

  gs.entities.push({ type, lane, y: -60, collected: false });
}

// 충돌 판정
function getCharacterBounds(gs, laneW, playerY) {
  const size = laneW * 0.78 * CHAR_TRAITS[gs.char].sizeScale;
  const jumpProgress = gs.jumping
    ? Math.min(1, (performance.now() - gs.jumpStart) / JUMP_DURATION)
    : 0;
  const jumpHeight = Math.sin(jumpProgress * Math.PI) * 80;
  const slideOffset = gs.sliding ? 22 : 0;
  const drawH = gs.sliding ? size * 0.55 : size;
  const cx = gs.lane * laneW + laneW / 2;
  const cy = playerY - drawH / 2 + 8 - jumpHeight + slideOffset;

  return {
    x: cx - drawH * 0.35,
    y: cy - drawH / 2,
    w: drawH * 0.7,
    h: drawH,
  };
}

function getEntityHitbox(ent, laneW, playerY) {
  const cfg = ENTITY_RENDER[ent.type] || ENTITY_RENDER.virus;
  const cx = ent.lane * laneW + laneW / 2;
  const w = laneW * cfg.w * 0.82;
  const h = laneW * cfg.h * 0.88;
  let y = ent.y;
  if (ent.type === TYPES.FLOAT_VIRUS) y = playerY - 50;
  return { x: cx - w / 2, y, w, h };
}

function getPlayerHitbox(gs, laneW, playerY) {
  const bounds = getCharacterBounds(gs, laneW, playerY);
  const hScale = CHAR_TRAITS[gs.char].hitboxHScale;
  const cy = bounds.y + bounds.h / 2;
  const h = bounds.h * hScale;
  return {
    x: bounds.x,
    y: cy - h / 2,
    w: bounds.w,
    h,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function checkCollisions(gs, laneW, playerY) {
  const now = performance.now();
  const player = getPlayerHitbox(gs, laneW, playerY);

  for (const ent of gs.entities) {
    if (ent.collected || ent.lane !== gs.lane) continue;

    const entBox = getEntityHitbox(ent, laneW, playerY);
    const isCollectible = ent.type === TYPES.DATA || ent.type === TYPES.VACCINE;
    const overlapping = rectsOverlap(player, entBox);
    const nearPlayer = isCollectible &&
      Math.abs((entBox.y + entBox.h / 2) - (player.y + player.h / 2)) < 45;

    if (!overlapping && !nearPlayer) continue;

    if (ent.type === TYPES.VIRUS || ent.type === TYPES.TALL_VIRUS || ent.type === TYPES.FLOAT_VIRUS) {
      if (ent.type === TYPES.TALL_VIRUS && gs.jumping) continue;
      if (ent.type === TYPES.FLOAT_VIRUS && gs.sliding) continue;
      if (now < gs.invincibleUntil) continue;

      gs.lives--;
      gs.combo = 0;
      gs.hitAnimStart = now;
      gs.invincibleUntil = now + INVINCIBLE_MS;
      gs.healAnimUntil = 0;
      ent.collected = true;
      AudioManager.playSfx('sfxHit');

      if (gs.lives <= 0) {
        gs.running = false;
        endGame();
      }
    } else if (ent.type === TYPES.VACCINE) {
      if (gs.lives < gs.maxLives) gs.lives++;
      ent.collected = true;
      gs.combo++;
      gs.healAnimStart = now;
      gs.healAnimUntil = now + HEAL_DURATION;
      AudioManager.playSfx('sfxHeal');
    } else if (ent.type === TYPES.DATA) {
      const bonus = 50 + gs.combo * 10;
      gs.score += bonus;
      ent.collected = true;
      gs.combo++;
      gs.popups.push({
        text: `+${bonus}`,
        x: gs.lane * laneW + laneW / 2,
        y: playerY - 60,
        life: 1.0,
      });
      AudioManager.playSfx('sfxData');
    }
  }
}

function endGame() {
  cancelAnimationFrame(animId);
  animId = null;

  const finalScore = Math.floor(gameState.score);
  const high = getHighScore();
  if (finalScore > high) setHighScore(finalScore);

  document.getElementById('over-score').textContent = finalScore;
  document.getElementById('over-distance').textContent = Math.floor(gameState.distance);
  document.getElementById('over-high-score').textContent = getHighScore();
  showScreen('over');
}

// HUD
function updateHUD() {
  if (!gameState) return;
  document.getElementById('hud-score').textContent = Math.floor(gameState.score);
  document.getElementById('hud-distance').textContent = Math.floor(gameState.distance) + 'm';

  const hearts = [];
  for (let i = 0; i < gameState.maxLives; i++) {
    hearts.push(i < gameState.lives ? '❤️' : '♡');
  }
  document.getElementById('hud-lives').textContent = hearts.join('');

  const comboEl = document.getElementById('hud-combo');
  comboEl.textContent = gameState.combo >= 2 ? `Combo x${gameState.combo}!` : '';
}

// 렌더링
function drawBackground(w, h, offset) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0a1020');
  grad.addColorStop(0.5, '#12082a');
  grad.addColorStop(1, '#081828');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 데이터 스트림 (양옆)
  ctx.fillStyle = 'rgba(0, 200, 255, 0.06)';
  ctx.fillRect(0, 0, w * 0.08, h);
  ctx.fillRect(w * 0.92, 0, w * 0.08, h);

  // 레인 구분선
  const laneW = w / LANES;
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
  ctx.lineWidth = 2;
  for (let i = 1; i < LANES; i++) {
    const x = i * laneW;
    ctx.beginPath();
    ctx.setLineDash([12, 18]);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 회로판 바닥 격자
  const gridOffset = offset % 60;
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let y = gridOffset; y < h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = 0; i <= LANES; i++) {
    const x = i * laneW;
    for (let y = gridOffset; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + laneW, y + 30);
      ctx.stroke();
    }
  }
}

function getAnimFrame(gs, timestamp) {
  // 1. 장애물 충돌 (무적 시간)
  if (timestamp < gs.invincibleUntil) {
    const elapsed = timestamp - gs.hitAnimStart;
    const frame = Math.min(SPRITE_DEF[gs.char].hit - 1, Math.floor(elapsed / HIT_FRAME_MS));
    return { set: 'hit', frame };
  }

  // 2. 회복 (백신 획득)
  if (timestamp < gs.healAnimUntil) {
    const elapsed = timestamp - gs.healAnimStart;
    const frame = Math.min(SPRITE_DEF[gs.char].heal - 1, Math.floor(elapsed / HEAL_FRAME_MS));
    return { set: 'heal', frame };
  }

  // 3. 달리기 (기본)
  const speedFactor = gs.speed / 280;
  const frameMs = Math.max(70, RUN_FRAME_MS / speedFactor);
  const frame = Math.floor(timestamp / frameMs) % SPRITE_DEF[gs.char].run;
  return { set: 'run', frame };
}

function drawCharacter(gs, laneW, playerY) {
  if (!spritesReady) return;

  const timestamp = performance.now();
  const charSprites = sprites[gs.char];
  const { set, frame } = getAnimFrame(gs, timestamp);
  const img = set === 'front'
    ? charSprites.front
    : charSprites[set][frame];

  if (!img || !img.complete) return;

  const size = laneW * 0.78 * CHAR_TRAITS[gs.char].sizeScale;
  const jumpProgress = gs.jumping
    ? Math.min(1, (timestamp - gs.jumpStart) / JUMP_DURATION)
    : 0;
  const jumpHeight = Math.sin(jumpProgress * Math.PI) * 80;
  const slideOffset = gs.sliding ? 22 : 0;
  const drawH = gs.sliding ? size * 0.55 : size;

  const cx = gs.lane * laneW + laneW / 2;
  const cy = playerY - drawH / 2 + 8 - jumpHeight + slideOffset;

  let alpha = 1;
  if (set === 'hit' && Math.floor(timestamp / 100) % 2 === 0) {
    alpha = 0.55;
  }

  drawSprite(ctx, img, cx, cy, drawH, 0, alpha);
}

function drawEntityImage(img, cx, topY, laneW, cfg, timestamp) {
  if (!img || !img.complete || !img.naturalWidth) return false;

  const w = laneW * cfg.w;
  const h = laneW * cfg.h;
  const bob = cfg.bob ? Math.sin(timestamp / 280) * 5 : 0;
  const x = cx - w / 2;
  const y = topY + bob;

  ctx.save();
  if (cfg.glow) {
    ctx.shadowColor = cfg.glow;
    ctx.shadowBlur = 16;
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return true;
}

function drawEntityFallback(ent, laneW, playerY) {
  const x = ent.lane * laneW + laneW * 0.25;
  const w = laneW * 0.5;

  switch (ent.type) {
    case TYPES.VIRUS: {
      const y = ent.y;
      ctx.fillStyle = '#ff2255';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 25, 22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case TYPES.TALL_VIRUS: {
      ctx.fillStyle = '#cc0044';
      ctx.fillRect(x + 8, ent.y, w - 16, 65);
      break;
    }
    case TYPES.FLOAT_VIRUS: {
      const y = playerY - 35;
      ctx.fillStyle = '#aa22ff';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + 15, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case TYPES.VACCINE: {
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(x + w / 2 - 6, ent.y + 5, 12, 35);
      ctx.fillRect(x + w / 2 - 16, ent.y + 14, 32, 12);
      break;
    }
    case TYPES.DATA: {
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(x + 5, ent.y + 10, w - 10, 32);
      break;
    }
  }
}

function drawEntity(ent, laneW, playerY) {
  const cx = ent.lane * laneW + laneW / 2;
  const timestamp = performance.now();
  const cfg = ENTITY_RENDER[ent.type] || ENTITY_RENDER.virus;
  const img = entitySprites[ent.type];
  let topY = ent.y;
  if (ent.type === TYPES.FLOAT_VIRUS) topY = playerY - 50;

  if (!entitySpritesReady || !drawEntityImage(img, cx, topY, laneW, cfg, timestamp)) {
    drawEntityFallback(ent, laneW, playerY);
  }
}

function drawPopups(gs) {
  for (const p of gs.popups) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 8;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

// 게임 루프
function gameLoop(timestamp) {
  if (!gameState || !gameState.running || gameState.paused) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  const gs = gameState;

  // 점프/슬라이드 종료
  if (gs.jumping && timestamp - gs.jumpStart > JUMP_DURATION) gs.jumping = false;
  if (gs.sliding && timestamp - gs.slideStart > SLIDE_DURATION) gs.sliding = false;

  // 속도 & 난이도
  gs.distance += gs.speed * dt * 0.01;
  gs.score += gs.speed * dt * 0.01;
  gs.speed = Math.min(600, 280 + gs.distance * 0.3);

  if (gs.distance > 200) gs.phase = 2;
  if (gs.distance > 500) gs.phase = 3;
  if (gs.distance > 1000) gs.phase = 4;

  gs.spawnInterval = Math.max(0.5, 1.2 - gs.phase * 0.15);
  gs.spawnTimer += dt;
  if (gs.spawnTimer >= gs.spawnInterval) {
    gs.spawnTimer = 0;
    spawnEntity(gs);
    if (gs.phase >= 3 && Math.random() < 0.3) spawnEntity(gs);
  }

  // 엔티티 이동
  const laneW = canvas.width / LANES;
  const playerY = canvas.height - 120;

  for (const ent of gs.entities) {
    ent.y += gs.speed * dt;
  }
  gs.entities = gs.entities.filter(ent => ent.y < canvas.height + 80 && !ent.collected);

  checkCollisions(gs, laneW, playerY);
  updateHUD();

  // 팝업 업데이트
  gs.popups.forEach(p => { p.life -= dt; p.y -= 50 * dt; });
  gs.popups = gs.popups.filter(p => p.life > 0);

  // 그리기
  const gridOffset = (timestamp * gs.speed * 0.05) % 60;
  drawBackground(canvas.width, canvas.height, gridOffset);

  for (const ent of gs.entities) {
    drawEntity(ent, laneW, playerY);
  }

  drawCharacter(gs, laneW, playerY);
  drawPopups(gs);

  animId = requestAnimationFrame(gameLoop);
}
