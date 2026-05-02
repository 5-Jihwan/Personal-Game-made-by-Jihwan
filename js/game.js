/* ============================================================
   game.js
   - 게임 상태 (그리드, 활성 블록, 점수, 레벨, 아이템 등)
   - 블록 스폰/이동/충돌/낙하/고정
   - 단어 매칭(가로) 및 중력 적용
   - 아이템 적용 로직
   ============================================================ */

// ---------- 게임 상태 (전역) ----------
const State = {
  grid: [],           // [row][col] 고정된 음절
  active: [],         // 현재 떨어지는 음절 [{row, col, ch}]
  score: 0,
  level: 1,
  wordCount: 0,
  dropCount: 1,       // 동시 낙하 개수
  fallInterval: FALL_BASE_MS,
  lastFall: 0,
  lastTickTime: 0,
  stopTimer: 0,       // STOP 아이템 잔여 시간
  paused: false,
  gameOver: false,
  recentWords: [],
  items: { ...INIT_ITEMS },
};

// ---------- 초기화 / 리셋 ----------
function resetGame() {
  State.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  State.active = [];
  State.score = 0;
  State.level = 1;
  State.wordCount = 0;
  State.dropCount = 1;
  State.fallInterval = FALL_BASE_MS;
  State.lastFall = 0;
  State.stopTimer = 0;
  State.paused = false;
  State.gameOver = false;
  State.recentWords = [];
  State.items = { ...INIT_ITEMS };
  spawn();
}

// ---------- 블록 스폰 ----------
function spawn() {
  const usedCols = new Set();
  State.active = [];

  for (let i = 0; i < State.dropCount; i++) {
    let col;
    let tries = 0;
    do {
      col = Math.floor(Math.random() * COLS);
      tries++;
    } while (usedCols.has(col) && tries < 30);
    usedCols.add(col);

    if (State.grid[0][col] !== null) {
      triggerGameOver();
      return;
    }
    State.active.push({ row: 0, col, ch: randomSyllable() });
  }
}

function triggerGameOver() {
  State.gameOver = true;
  if (typeof onGameOver === 'function') onGameOver();
}

// ---------- 충돌 / 이동 ----------
function canMove(dr, dc) {
  for (const a of State.active) {
    const nr = a.row + dr;
    const nc = a.col + dc;
    if (nc < 0 || nc >= COLS || nr >= ROWS) return false;
    if (nr < 0) continue;
    // 다른 활성 블록과는 겹쳐도 OK (한꺼번에 이동)
    const overlapsActive = State.active.some(b => b.row === nr && b.col === nc);
    if (State.grid[nr][nc] !== null && !overlapsActive) return false;
  }
  return true;
}

function moveActive(dr, dc) {
  if (State.gameOver || State.paused) return false;
  if (!canMove(dr, dc)) return false;
  for (const a of State.active) {
    a.row += dr;
    a.col += dc;
  }
  return true;
}

// ---------- 블록 고정 ----------
function landActive() {
  // 아래쪽부터 그리드에 고정 (같은 칸 충돌 방지)
  const sorted = [...State.active].sort((a, b) => b.row - a.row);
  for (const a of sorted) {
    if (a.row < 0) {
      triggerGameOver();
      return;
    }
    State.grid[a.row][a.col] = a.ch;
  }
  State.active = [];
  checkWords();

  if (!State.gameOver) {
    advanceDifficulty();
    spawn();
  }
}

function advanceDifficulty() {
  const wc = State.wordCount;
  if (wc > 0 && wc % 5 === 0) {
    State.level = 1 + Math.floor(wc / 5);
    State.dropCount = Math.min(1 + Math.floor(wc / 8), MAX_DROP_COUNT);
    State.fallInterval = Math.max(
      FALL_MIN_MS,
      FALL_BASE_MS - State.level * FALL_PER_LEVEL
    );
  }
}

// ---------- 단어 매칭 (가로) ----------
function matchAt(row, startCol, len) {
  if (startCol + len > COLS) return null;
  let s = '';
  for (let c = startCol; c < startCol + len; c++) {
    const ch = State.grid[row][c];
    if (ch === null) return null;
    s += ch;
  }

  const set = DICT_SETS[len];
  if (!set) return null;

  // 만능 글자(★)가 포함된 경우, 사전에서 패턴 매칭
  if (s.includes(WILD)) {
    for (const word of set) {
      let ok = true;
      for (let i = 0; i < len; i++) {
        if (s[i] !== WILD && s[i] !== word[i]) { ok = false; break; }
      }
      if (ok) return word;
    }
    return null;
  }

  return set.has(s) ? s : null;
}

function checkWords() {
  let cleared = false;
  do {
    cleared = false;
    outer:
    for (let r = 0; r < ROWS; r++) {
      for (const len of DICT_LENGTHS) {
        for (let c = 0; c <= COLS - len; c++) {
          const word = matchAt(r, c, len);
          if (word) {
            clearMatch(r, c, len, word);
            cleared = true;
            break outer;
          }
        }
      }
    }
    if (cleared) applyGravity();
  } while (cleared);
}

function clearMatch(row, col, len, word) {
  for (let k = 0; k < len; k++) State.grid[row][col + k] = null;

  const points = len * len * 100;
  State.score += points;
  State.wordCount++;

  State.recentWords.unshift(`${word} +${points}`);
  if (State.recentWords.length > RECENT_LIMIT) State.recentWords.pop();

  rewardItems(len);
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (State.grid[r][c] !== null) {
        const v = State.grid[r][c];
        State.grid[r][c] = null;
        State.grid[writeRow][c] = v;
        writeRow--;
      }
    }
  }
}

// ---------- 아이템 ----------
function rewardItems(len) {
  if (len >= 2) {
    if (Math.random() < 0.5) State.items.cho++;
    if (Math.random() < 0.5) State.items.jung++;
  }
  if (len >= 3) {
    if (Math.random() < 0.4) State.items.stop++;
    if (Math.random() < 0.25) State.items.wild++;
  }
}

function useItem(type) {
  if (State.gameOver || State.paused) return;
  if ((State.items[type] || 0) <= 0) return;
  if (State.active.length === 0) return;

  const target = State.active[0];
  const decomposed = decompose(target.ch);

  switch (type) {
    case 'cho':
      if (!decomposed) return;
      target.ch = compose(
        randomDifferentIndex(decomposed.cho, CHO.length),
        decomposed.jung,
        decomposed.jong
      );
      State.items.cho--;
      break;

    case 'jung':
      if (!decomposed) return;
      target.ch = compose(
        decomposed.cho,
        randomDifferentIndex(decomposed.jung, JUNG.length),
        decomposed.jong
      );
      State.items.jung--;
      break;

    case 'stop':
      State.stopTimer = STOP_DURATION_MS;
      State.items.stop--;
      break;

    case 'wild':
      target.ch = WILD;
      State.items.wild--;
      break;
  }
}

function randomDifferentIndex(current, total) {
  // current 와 다른 무작위 인덱스
  return (current + 1 + Math.floor(Math.random() * (total - 1))) % total;
}

// ---------- 시간 진행 ----------
function tickGame(now) {
  if (State.gameOver) return;
  if (State.paused) return;

  if (State.stopTimer > 0) {
    State.stopTimer -= now - State.lastTickTime;
    if (State.stopTimer < 0) State.stopTimer = 0;
    return;
  }

  if (now - State.lastFall > State.fallInterval) {
    if (!moveActive(1, 0)) landActive();
    State.lastFall = now;
  }
}

// ---------- 즉시 낙하 (스페이스) ----------
function hardDrop() {
  if (State.gameOver || State.paused) return;
  while (moveActive(1, 0)) {}
  landActive();
  State.lastFall = performance.now();
}
