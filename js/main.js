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
  ui.bestScore = document.getElementById('bestScore');
  ui.ranking = document.getElementById('ranking');
  ui.rankTabs = document.querySelectorAll('.rank-tab');
  ui.nameInputRow = document.getElementById('nameInputRow');
  ui.nameInput = document.getElementById('nameInput');
  ui.saveScoreBtn = document.getElementById('saveScoreBtn');
}

// 현재 활성 탭 ('local' | 'global')
let activeRankTab = 'local';
// 글로벌 데이터 캐시 (실시간 구독으로 업데이트)
let globalRankCache = [];
let cloudUnsubscribe = null;

// ============================================================
// 랭킹 (localStorage 기반, 디바이스 별 영구 저장)
// ============================================================
const RANK_KEY = 'neon-hangul-ranking-v1';
const NAME_KEY = 'neon-hangul-last-name';
const RANK_LIMIT = 20;

function loadRanking() {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function saveRanking(list) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(list.slice(0, RANK_LIMIT))); }
  catch (e) { console.warn('[rank] save failed', e); }
}

function addToRanking(name, score) {
  const list = loadRanking();
  list.push({
    name: name.slice(0, 10),
    score,
    date: new Date().toISOString().slice(0, 10),
  });
  list.sort((a, b) => b.score - a.score);
  saveRanking(list);
  return list;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function updateRankingUI() {
  const localList = loadRanking();
  // 최고 점수: 로컬 + 글로벌 중 큰 값
  if (ui.bestScore) {
    const localBest  = localList[0]  ? localList[0].score  : 0;
    const globalBest = globalRankCache[0] ? globalRankCache[0].score : 0;
    ui.bestScore.textContent = Math.max(localBest, globalBest).toLocaleString();
  }
  if (!ui.ranking) return;

  const list = activeRankTab === 'global' ? globalRankCache : localList;
  if (list.length === 0) {
    const msg = activeRankTab === 'global'
      ? (cloudIsReady() ? '— 로딩 중 —' : '— Firebase 미설정 —')
      : '— 아직 없음 —';
    ui.ranking.innerHTML = `<li class="empty">${msg}</li>`;
    return;
  }
  ui.ranking.innerHTML = list.slice(0, 10).map((e, i) => `
    <li>
      <span class="rk-rank">${i + 1}</span>
      <span class="rk-name">${escapeHTML(e.name)}</span>
      <span class="rk-score">${e.score.toLocaleString()}</span>
    </li>
  `).join('');
}

function bindRankTabs() {
  for (const btn of ui.rankTabs) {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === activeRankTab) return;
      // 글로벌 탭은 Cloud 가 활성화된 경우에만 전환
      if (tab === 'global' && !cloudIsReady()) {
        // 클릭은 허용하되 안내만 표시
        activeRankTab = 'global';
      } else {
        activeRankTab = tab;
      }
      for (const b of ui.rankTabs) b.classList.toggle('active', b === btn);
      updateRankingUI();
    });
  }
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

  // 점수 저장 버튼
  if (ui.saveScoreBtn) {
    ui.saveScoreBtn.addEventListener('click', () => saveCurrentScore());
  }
  if (ui.nameInput) {
    ui.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveCurrentScore();
      }
    });
  }

  bindTouchControls(ensureAudio);
}

// ---------- 터치 컨트롤 (모바일) ----------
// 누르고 있으면 일정 간격으로 반복 (좌/우/아래만), 즉시 낙하는 1회.
function bindTouchControls(ensureAudio) {
  const tc = document.getElementById('touchControls');
  if (!tc) return;

  const actionMap = {
    left:  () => moveActive(0, -1) && sfxMove(),
    right: () => moveActive(0,  1) && sfxMove(),
    down:  () => {
      if (!moveActive(1, 0)) { landActive(); sfxLand(); }
      State.lastFall = performance.now();
    },
    drop:  () => { hardDrop(); sfxLand(); },
  };

  for (const btn of tc.querySelectorAll('.tc-btn')) {
    const action = actionMap[btn.dataset.action];
    if (!action) continue;

    let repeatTimer = null;
    let repeatStart = null;

    const start = (e) => {
      e.preventDefault();
      ensureAudio();
      if (State.gameOver || State.paused) return;
      action();
      // 즉시 낙하(drop)는 반복 안 함
      if (btn.dataset.action === 'drop') return;
      // 250ms 후부터 100ms 간격으로 반복
      repeatStart = setTimeout(() => {
        repeatTimer = setInterval(action, 100);
      }, 250);
    };
    const stop = () => {
      if (repeatStart) { clearTimeout(repeatStart); repeatStart = null; }
      if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   stop);
    btn.addEventListener('touchcancel',stop);
    btn.addEventListener('mousedown',  start);
    btn.addEventListener('mouseup',    stop);
    btn.addEventListener('mouseleave', stop);
  }
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
//   점수가 0보다 크면 이름 입력 폼을 띄워 랭킹 등록 가능.
function onGameOver() {
  sfxGameOver();
  const score = State.score;
  ui.overlayTitle.textContent = 'GAME OVER';
  ui.overlayTitle.setAttribute('data-text', 'GAME OVER');
  ui.overlayMsg.textContent = `최종 점수: ${score.toLocaleString()}`;
  ui.restart.textContent = '다시 시작';

  if (score > 0) {
    const lastName = localStorage.getItem(NAME_KEY) || '';
    ui.nameInput.value = lastName;
    ui.nameInputRow.style.display = 'flex';
    setTimeout(() => ui.nameInput.focus(), 100);
  } else {
    ui.nameInputRow.style.display = 'none';
  }
  ui.overlay.classList.add('show');
}

// 시작 오버레이 — 사용자 클릭으로 오디오 컨텍스트 활성화
function showStartOverlay() {
  ui.nameInputRow.style.display = 'none';
  showOverlay('NEON HANGUL', '클릭해서 시작 (BGM 켜기)', 'START');
}

// 점수 저장 (이름 입력 후 저장 버튼 또는 Enter)
//   로컬 랭킹은 즉시, 글로벌 랭킹은 비동기로 시도.
async function saveCurrentScore() {
  const raw = (ui.nameInput.value || '').trim();
  const name = (raw.slice(0, 10) || '익명');
  localStorage.setItem(NAME_KEY, name);
  addToRanking(name, State.score);
  updateRankingUI();
  ui.nameInputRow.style.display = 'none';

  if (cloudIsReady()) {
    ui.overlayMsg.textContent = `${name} ${State.score.toLocaleString()}점 등록 중...`;
    const ok = await cloudSaveScore(name, State.score);
    ui.overlayMsg.textContent = ok
      ? `${name} ${State.score.toLocaleString()}점 등록 완료! (글로벌)`
      : `${name} ${State.score.toLocaleString()}점 로컬에만 등록`;
  } else {
    ui.overlayMsg.textContent = `${name} ${State.score.toLocaleString()}점 등록 완료!`;
  }
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
  detectMobile();
  cacheDom();
  resizeBoard();        // CELL 결정 (initRender 보다 먼저)
  initRender();
  bindInput();
  resetGame();
  bindRankTabs();
  updateRankingUI();        // 로컬 랭킹 즉시 표시

  // 글로벌 랭킹 (Firebase) 초기화 + 실시간 구독
  if (cloudInit()) {
    cloudUnsubscribe = cloudSubscribeTopScores(20, (list) => {
      globalRankCache = list;
      updateRankingUI();
    });
  } else {
    // Firebase 미설정이면 GLOBAL 탭 비활성 표시
    for (const b of ui.rankTabs) {
      if (b.dataset.tab === 'global') b.title = 'Firebase 미설정';
    }
  }

  // 일시정지 상태로 시작해서 클릭 후 시작
  State.paused = true;
  showStartOverlay();
  updateDictStatus();
  window.addEventListener('resize', onViewportResize);
  window.addEventListener('orientationchange', onViewportResize);
  requestAnimationFrame(loop);
});

// ---------- 모바일 감지 ----------
function detectMobile() {
  const forceMobile = new URLSearchParams(location.search).get('mobile') === '1';
  const ua = /Mobi|Android|iPhone|iPad|iPod|Tablet|Touch/i.test(navigator.userAgent);
  const narrow = window.innerWidth <= 850;
  const isMobile = forceMobile || ua || narrow;
  document.body.classList.toggle('is-mobile', isMobile);
  return isMobile;
}

// ---------- 보드 크기를 화면에 맞춤 ----------
function resizeBoard() {
  const isMobile = document.body.classList.contains('is-mobile');

  if (!isMobile) {
    CELL = 22;
  } else {
    // 가로/세로 모두 고려해 CELL 결정
    const availableW = window.innerWidth - 30;
    // 위쪽 UI(제목/점수/사운드) + 아이템 패널 + D-pad + 여백
    const reservedH = 380;
    const availableH = Math.max(window.innerHeight - reservedH, 240);
    const byW = Math.floor(availableW / COLS);
    const byH = Math.floor(availableH / ROWS);
    CELL = Math.max(14, Math.min(byW, byH, 28));
  }

  // 캔버스가 이미 만들어졌으면 사이즈 갱신
  if (typeof canvas !== 'undefined' && canvas) {
    canvas.width  = COLS * CELL;
    canvas.height = ROWS * CELL;
  }
}

function onViewportResize() {
  detectMobile();
  resizeBoard();
}

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
