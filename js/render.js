/* ============================================================
   render.js
   - 캔버스 초기화
   - 보드 배경/격자선/음절 그리기
   - 네온 글로우 효과 (text-shadow 대신 ctx.shadow* 활용)
   - STOP / 일시정지 오버레이
   ============================================================ */

// ---------- 캔버스 핸들 ----------
let canvas, ctx;

function initRender() {
  canvas = document.getElementById('board');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  ctx = canvas.getContext('2d');
}

// ---------- 색상 / 폰트 ----------
const COLOR_BG       = '#04060f';
const COLOR_GRID     = 'rgba(0, 200, 255, 0.10)';
const COLOR_GRID_ACC = 'rgba(0, 240, 255, 0.18)';
const COLOR_NEON     = '#a8f0ff';
const COLOR_NEON_HOT = '#ffffff';
const COLOR_GLOW     = '#00f0ff';
const COLOR_DEEP     = '#2a7bff';
const COLOR_WILD     = '#ffd0ff';
const COLOR_WILD_GLW = '#c878ff';
const COLOR_ACTIVE_BG = 'rgba(0, 60, 120, 0.45)';

// CELL 이 동적으로 바뀌므로 폰트는 매 프레임 갱신
function fontSyl() { return `bold ${CELL - 6}px 'Noto Sans KR', sans-serif`; }
const FONT_BIG = `bold 28px 'Orbitron', 'Noto Sans KR', sans-serif`;

// ---------- 매 프레임 그리기 ----------
function drawAll() {
  drawBackground();
  drawGrid();
  drawFixed();
  drawActive();
  drawOverlayEffects();
}

function drawBackground() {
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 상단 잔잔한 글로우 (장식)
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(42, 123, 255, 0.10)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(42, 123, 255, 0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR_GRID;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(canvas.width, r * CELL + 0.5);
    ctx.stroke();
  }

  // 5행마다 강조선
  ctx.strokeStyle = COLOR_GRID_ACC;
  for (let r = 5; r < ROWS; r += 5) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(canvas.width, r * CELL + 0.5);
    ctx.stroke();
  }
}

function drawFixed() {
  ctx.font = fontSyl();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = State.grid[r][c];
      if (ch !== null) drawNeonCell(r, c, ch, false);
    }
  }
}

function drawActive() {
  for (const a of State.active) {
    if (a.row >= 0) drawNeonCell(a.row, a.col, a.ch, true);
  }
}

// ---------- 네온 셀 그리기 ----------
function drawNeonCell(r, c, ch, isActive) {
  const x = c * CELL;
  const y = r * CELL;

  if (isActive) {
    // 활성 블록: 푸른 빛 배경 + 강한 외곽선
    ctx.fillStyle = COLOR_ACTIVE_BG;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLOR_GLOW;
    ctx.shadowColor = COLOR_GLOW;
    ctx.shadowBlur = 10;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    ctx.shadowBlur = 0;
  }

  const isWild = ch === WILD;
  const fillColor = isWild ? COLOR_WILD : COLOR_NEON;
  const glowColor = isWild ? COLOR_WILD_GLW : COLOR_GLOW;

  ctx.font = fontSyl();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 외곽 글로우
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isActive ? 14 : 8;
  ctx.fillStyle = fillColor;
  ctx.fillText(ch, x + CELL / 2, y + CELL / 2 + 1);

  // 강조 코어 (한 번 더 덮어 밝게)
  ctx.shadowBlur = isActive ? 4 : 2;
  ctx.fillStyle = COLOR_NEON_HOT;
  ctx.fillText(ch, x + CELL / 2, y + CELL / 2 + 1);

  ctx.shadowBlur = 0;
}

// ---------- 오버레이 ----------
function drawOverlayEffects() {
  if (State.stopTimer > 0) drawStopOverlay();
  if (State.comboFlash > 0 && State.lastCombo >= 2) drawComboOverlay();
  if (State.paused) drawPauseOverlay();
}

function drawComboOverlay() {
  const t = State.comboFlash / 1200; // 1 → 0
  const scale = 1 + (1 - t) * 0.8;
  const alpha = Math.min(1, t * 1.6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.font = `bold 48px 'Orbitron', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff5fe0';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fff8ff';
  ctx.fillText(`COMBO ×${State.lastCombo}`, 0, 0);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawStopOverlay() {
  ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_BIG;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = COLOR_GLOW;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLOR_NEON_HOT;
  const txt = `STOP  ${(State.stopTimer / 1000).toFixed(1)}s`;
  ctx.fillText(txt, canvas.width / 2, 40);
  ctx.shadowBlur = 0;
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 5, 15, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = FONT_BIG;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = COLOR_GLOW;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLOR_NEON_HOT;
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
}
