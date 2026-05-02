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
  document.addEventListener('keydown', (e) => {
    if (State.gameOver) return;

    switch (e.key) {
      case 'ArrowLeft':  moveActive(0, -1); e.preventDefault(); break;
      case 'ArrowRight': moveActive(0,  1); e.preventDefault(); break;
      case 'ArrowDown':
        if (!moveActive(1, 0)) landActive();
        State.lastFall = performance.now();
        e.preventDefault();
        break;
      case ' ':
        hardDrop();
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
    ui.itemBtns[t].addEventListener('click', () => useItem(t));
  }
  ui.restart.addEventListener('click', () => {
    hideOverlay();
    resetGame();
  });
}

// ---------- 오버레이 제어 ----------
function showOverlay(title, msg) {
  ui.overlayTitle.textContent = title;
  ui.overlayTitle.setAttribute('data-text', title);
  ui.overlayMsg.textContent = msg;
  ui.overlay.classList.add('show');
}

function hideOverlay() {
  ui.overlay.classList.remove('show');
}

// 게임 오버 콜백 (game.js 에서 호출)
function onGameOver() {
  showOverlay('GAME OVER', `최종 점수: ${State.score.toLocaleString()}`);
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
  hideOverlay();
  requestAnimationFrame(loop);
});
