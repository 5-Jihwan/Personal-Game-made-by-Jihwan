/* ============================================================
   main.js
   - 부트스트랩 (DOM 핸들 / 이벤트 / 루프)
   - 키보드 / 마우스 입력
   - HUD(점수, 레벨, 아이템, 최근 단어) 갱신
   - 게임 오버 오버레이
   ============================================================ */

// ---------- DOM 핸들 ----------
const ui = {};

function cacheDom() {
  ui.score = document.getElementById('score');
  ui.level = document.getElementById('level');
  ui.wordCount = document.getElementById('wordCount');
  ui.dropCount = document.getElementById('dropCount');
  ui.cntCho = document.getElementById('cnt-cho');
  ui.cntJung = document.getElementById('cnt-jung');
  ui.cntStop = document.getElementById('cnt-stop');
  ui.cntWild = document.getElementById('cnt-wild');
  ui.itemBtns = {
    cho:  document.getElementById('item-cho'),
    jung: document.getElementById('item-jung'),
    stop: document.getElementById('item-stop'),
    wild: document.getElementById('item-wild'),
  };
  ui.recent = document.getElementById('recentWords');
  ui.overlay = document.getElementById('overlay');
  ui.overlayTitle = document.getElementById('overlayTitle');
  ui.overlayMsg = document.getElementById('overlayMsg');
  ui.restart = document.getElementById('restartBtn');
  ui.bgmBtn = document.getElementById('bgmBtn');
  ui.sfxBtn = document.getElementById('sfxBtn');
  ui.dictStatus = document.getElementById('dictStatus');
}

// ---------- HUD 갱신 ----------
function updateHUD() {
  ui.score.textContent = State.score.toLocaleString();
  ui.level.textContent = State.level;
  ui.wordCount.textContent = State.wordCount;
  ui.dropCount.textContent = State.dropCount;

  ui.cntCho.textContent  = State.items.cho;
  ui.cntJung.textContent = State.items.jung;
  ui.cntStop.textContent = State.items.stop;
  ui.cntWild.textContent = State.items.wild;

  for (const t of ['cho', 'jung', 'stop', 'wild']) {
    const btn = ui.itemBtns[t];
    if (State.items[t] <= 0) btn.setAttribute('disabled', '');
    else btn.removeAttribute('disabled');
  }

  if (State.recentWords.length === 0) {
    ui.recent.innerHTML = '<div style="opacity:0.4;">— 아직 없음 —</div>';
  } else {
    ui.recent.innerHTML = State.recentWords
      .map(w => `<div>${w}</div>`)
      .join('');
  }
}

// ---------- 입력 ----------
function bindInput() {
  // 첫 입력 시 오디오 컨텍스트 활성화 (브라우저 자동재생 정책)
  const ensureAudio = () => audioInit();

  document.addEventListener('keydown', (e) => {
    ensureAudio();
    if (State.gameOver) return;

    switch (e.key) {
      case 'ArrowLeft':
        if (moveActive(0, -1)) sfxMove();
        e.preventDefault();
        break;
      case 'ArrowRight':
        if (moveActive(0, 1)) sfxMove();
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (!moveActive(1, 0)) { landActive(); sfxLand(); }
        State.lastFall = performance.now();
        e.preventDefault();
        break;
      case ' ':
        hardDrop();
        sfxLand();
        e.preventDefault();
        break;
      case 'p':
      case 'P':
        State.paused = !State.paused;
        break;
      case '1': useItem('cho');  break;
      case '2': useItem('jung'); break;
      case '3': useItem('stop'); break;
      case '4': useItem('wild'); break;
    }
  });

  for (const t of ['cho', 'jung', 'stop', 'wild']) {
    ui.itemBtns[t].addEventListener('click', () => {
      ensureAudio();
      useItem(t);
    });
  }
  ui.restart.addEventListener('click', () => {
    ensureAudio();
    hideOverlay();
    // 시작 또는 재시작
    if (State.gameOver) resetGame();
    State.paused = false;
  });

  if (ui.bgmBtn) ui.bgmBtn.addEventListener('click', () => {
    ensureAudio();
    const on = toggleBGM();
    ui.bgmBtn.classList.toggle('off', !on);
    ui.bgmBtn.textContent = on ? 'BGM ♪' : 'BGM ✕';
  });
  if (ui.sfxBtn) ui.sfxBtn.addEventListener('click', () => {
    ensureAudio();
    const on = toggleSFX();
    ui.sfxBtn.classList.toggle('off', !on);
    ui.sfxBtn.textContent = on ? 'SFX ♪' : 'SFX ✕';
  });
}

// ---------- 게임 이벤트 콜백 (game.js 에서 호출) ----------
function onLand() {
  sfxLand();
}
function onWordCleared(len, combo) {
  sfxClear(combo, len);
}
function onCombo(combo) {
  if (combo >= 2) sfxCombo(combo);
}

// ---------- 오버레이 제어 ----------
function showOverlay(title, msg, btnLabel) {
  ui.overlayTitle.textContent = title;
  ui.overlayTitle.setAttribute('data-text', title);
  ui.overlayMsg.textContent = msg;
  if (btnLabel) ui.restart.textContent = btnLabel;
  ui.overlay.classList.add('show');
}

function hideOverlay() {
  ui.overlay.classList.remove('show');
}

// 게임 오버 콜백 (game.js 에서 호출)
function onGameOver() {
  sfxGameOver();
  showOverlay('GAME OVER', `최종 점수: ${State.score.toLocaleString()}`, '다시 시작');
}

// 시작 오버레이 — 사용자 클릭으로 오디오 컨텍스트 활성화
function showStartOverlay() {
  showOverlay('NEON HANGUL', '클릭해서 시작 (BGM 켜기)', 'START');
}

// ---------- 메인 루프 ----------
function loop(now) {
  tickGame(now);
  drawAll();
  updateHUD();
  State.lastTickTime = now;
  requestAnimationFrame(loop);
}

// ---------- 부트 ----------
window.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  initRender();
  bindInput();
  resetGame();
  // 일시정지 상태로 시작해서 클릭 후 시작
  State.paused = true;
  showStartOverlay();
  updateDictStatus();
  requestAnimationFrame(loop);
});

function updateDictStatus() {
  if (!ui.dictStatus) return;
  const full = window.DICT_SETS_FULL;
  if (!full) {
    ui.dictStatus.textContent = '⚠ 기본 사전 (dict.js 미로드)';
    console.warn('[dict] FULL dict not loaded; fallback to small built-in');
    return;
  }
  let n = 0;
  for (const k of Object.keys(full)) n += full[k].size;
  ui.dictStatus.textContent = `표준국어대사전 ${n.toLocaleString()}개`;
  console.log(`[dict] loaded: ${n.toLocaleString()} entries, sizes:`,
              Object.fromEntries(Object.entries(full).map(([k, v]) => [k, v.size])));
}
