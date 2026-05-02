/* ============================================================
   cloud.js
   - Firebase Realtime Database 기반 글로벌 랭킹
   - 설정이 안 되어 있거나 Firebase SDK 로드 실패 시
     모든 함수는 안전하게 false / [] 를 반환 → 게임은 정상 진행
   ============================================================ */

const Cloud = {
  ready: false,
  db: null,
  ref: null,
  unsub: null,
};

function cloudInit() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'REPLACE_ME') {
    console.log('[cloud] Firebase 미설정 → 글로벌 랭킹 비활성');
    return false;
  }
  if (typeof firebase === 'undefined') {
    console.warn('[cloud] firebase SDK 로드 실패');
    return false;
  }
  try {
    firebase.initializeApp(cfg);
    Cloud.db  = firebase.database();
    Cloud.ref = Cloud.db.ref('rankings/v1');
    Cloud.ready = true;
    console.log('[cloud] 초기화 완료, DB =', cfg.databaseURL);
    return true;
  } catch (e) {
    console.error('[cloud] 초기화 실패', e);
    return false;
  }
}

// ---------- 점수 등록 ----------
async function cloudSaveScore(name, score) {
  if (!Cloud.ready) return false;
  try {
    await Cloud.ref.push({
      name:  String(name).slice(0, 10),
      score: Math.floor(score),
      ts:    Date.now(),
    });
    console.log(`[cloud] 점수 저장: ${name} ${score}`);
    return true;
  } catch (e) {
    console.error('[cloud] 저장 실패', e);
    return false;
  }
}

// ---------- TOP N 한 번 가져오기 ----------
async function cloudFetchTopScores(limit = 30) {
  if (!Cloud.ready) return [];
  try {
    const snap = await Cloud.ref
      .orderByChild('score')
      .limitToLast(limit)
      .once('value');
    const arr = [];
    snap.forEach(child => arr.push(child.val()));
    arr.sort((a, b) => b.score - a.score);
    return arr;
  } catch (e) {
    console.error('[cloud] fetch 실패', e);
    return [];
  }
}

// ---------- TOP N 실시간 구독 ----------
//   다른 사람이 올린 새 점수가 즉시 반영됨.
function cloudSubscribeTopScores(limit, callback) {
  if (!Cloud.ready) return null;
  const q = Cloud.ref.orderByChild('score').limitToLast(limit);
  const handler = q.on('value', snap => {
    const arr = [];
    snap.forEach(child => arr.push(child.val()));
    arr.sort((a, b) => b.score - a.score);
    callback(arr);
  });
  // 해제 함수 반환
  return () => q.off('value', handler);
}

function cloudIsReady() { return Cloud.ready; }
