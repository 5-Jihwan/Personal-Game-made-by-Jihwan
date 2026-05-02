/* ============================================================
   audio.js
   - Web Audio API 기반 신디사이저 BGM + SFX
   - 외부 음원 파일 없이 모든 사운드 즉석 합성
   - 사용자 첫 입력 후 자동 재시작 (브라우저 자동재생 정책)
   ============================================================ */

const Audio = {
  ctx: null,
  master: null,
  bgmGain: null,
  sfxGain: null,
  bgmTimer: null,
  bgmEnabled: true,
  sfxEnabled: true,
  started: false,
};

function audioInit() {
  if (Audio.started) {
    // 이미 시작된 컨텍스트가 다시 suspended 상태가 되면 resume
    if (Audio.ctx && Audio.ctx.state === 'suspended') {
      Audio.ctx.resume().then(() => console.log('[audio] resumed'));
    }
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] AudioContext not supported'); return; }
    Audio.ctx = new AC();

    // 브라우저 자동재생 정책: 사용자 제스처 직후 resume 호출 필수
    if (Audio.ctx.state === 'suspended') {
      Audio.ctx.resume().then(
        () => console.log('[audio] resumed, state =', Audio.ctx.state),
        (err) => console.warn('[audio] resume failed', err)
      );
    }

    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = 1.0;
    Audio.master.connect(Audio.ctx.destination);

    Audio.bgmGain = Audio.ctx.createGain();
    Audio.bgmGain.gain.value = Audio.bgmEnabled ? 0.30 : 0;
    Audio.bgmGain.connect(Audio.master);

    Audio.sfxGain = Audio.ctx.createGain();
    Audio.sfxGain.gain.value = Audio.sfxEnabled ? 0.7 : 0;
    Audio.sfxGain.connect(Audio.master);

    Audio.started = true;
    console.log('[audio] init ok, state =', Audio.ctx.state);
    if (Audio.bgmEnabled) startBGM();
  } catch (e) {
    console.warn('[audio] init failed', e);
  }
}

// ---------- 공용 보이스 빌더 ----------
function makeOsc(type, freq, dest) {
  const o = Audio.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  return o;
}

function envGain(attack, hold, release, peak = 1.0) {
  const g = Audio.ctx.createGain();
  const t = Audio.ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return { node: g, dur: attack + hold + release };
}

// ---------- SFX ----------
function sfxBlip(freq = 700, dur = 0.07, type = 'square') {
  if (!Audio.started) return;
  const env = envGain(0.005, 0.02, dur, 0.6);
  env.node.connect(Audio.sfxGain);
  const o = makeOsc(type, freq, env.node);
  const now = Audio.ctx.currentTime;
  o.start(now);
  o.stop(now + env.dur + 0.05);
}

function sfxMove() { sfxBlip(420, 0.04, 'square'); }
function sfxLand() {
  if (!Audio.started) return;
  const env = envGain(0.005, 0.02, 0.12, 0.5);
  env.node.connect(Audio.sfxGain);
  const o = makeOsc('triangle', 180, env.node);
  o.frequency.exponentialRampToValueAtTime(80, Audio.ctx.currentTime + 0.12);
  o.start();
  o.stop(Audio.ctx.currentTime + 0.2);
}

function sfxItem() { sfxBlip(1200, 0.08, 'sawtooth'); }
function sfxStop() {
  sfxBlip(660, 0.18, 'sine');
  setTimeout(() => sfxBlip(440, 0.18, 'sine'), 80);
}

// 단어 클리어 — 콤보가 클수록 음정 상승
function sfxClear(combo = 1, len = 2) {
  if (!Audio.started) return;
  const baseFreq = 440 + Math.min(combo, 8) * 60;
  const env = envGain(0.005, 0.05, 0.25, 0.6);
  env.node.connect(Audio.sfxGain);
  const o1 = makeOsc('triangle', baseFreq, env.node);
  const o2 = makeOsc('sine', baseFreq * 1.5, env.node);
  o1.frequency.exponentialRampToValueAtTime(
    baseFreq * (1 + len * 0.15), Audio.ctx.currentTime + 0.2
  );
  o1.start();
  o2.start();
  o1.stop(Audio.ctx.currentTime + 0.32);
  o2.stop(Audio.ctx.currentTime + 0.32);
}

function sfxCombo(combo) {
  if (!Audio.started || combo < 2) return;
  const seq = [660, 880, 1100, 1320];
  const n = Math.min(combo - 1, seq.length);
  for (let i = 0; i < n; i++) {
    setTimeout(() => sfxBlip(seq[i], 0.08, 'square'), i * 70);
  }
}

function sfxGameOver() {
  if (!Audio.started) return;
  const env = envGain(0.01, 0.1, 1.2, 0.7);
  env.node.connect(Audio.sfxGain);
  const o = makeOsc('sawtooth', 440, env.node);
  o.frequency.exponentialRampToValueAtTime(60, Audio.ctx.currentTime + 1.2);
  o.start();
  o.stop(Audio.ctx.currentTime + 1.4);
}

// ---------- BGM (간단한 신디 루프) ----------
//   D 단조 느낌, 8분음표 기준 130 BPM
const BGM_PATTERN = [
  // (semitone offset from A3=0, beats)
  // 베이스 라인
  { freq: 110.0, beats: 1 }, // A2
  { freq: 130.8, beats: 1 }, // C3
  { freq: 146.8, beats: 1 }, // D3
  { freq: 164.8, beats: 1 }, // E3
  { freq: 174.6, beats: 1 }, // F3
  { freq: 164.8, beats: 1 },
  { freq: 146.8, beats: 1 },
  { freq: 130.8, beats: 1 },
];
const BGM_BEAT_MS = 460; // 130 BPM 약간 느림
let bgmStep = 0;

function startBGM() {
  stopBGM();
  Audio.bgmTimer = setInterval(playBgmStep, BGM_BEAT_MS);
}
function stopBGM() {
  if (Audio.bgmTimer) {
    clearInterval(Audio.bgmTimer);
    Audio.bgmTimer = null;
  }
}

function playBgmStep() {
  if (!Audio.started) return;
  const note = BGM_PATTERN[bgmStep % BGM_PATTERN.length];
  bgmStep++;

  // 베이스 + 화음 패드 + 짧은 아르페지오
  const t = Audio.ctx.currentTime;
  const env1 = envGain(0.02, 0.3, 0.4, 0.5);
  env1.node.connect(Audio.bgmGain);
  const bass = makeOsc('triangle', note.freq, env1.node);
  bass.start(t); bass.stop(t + env1.dur + 0.05);

  const env2 = envGain(0.05, 0.15, 0.3, 0.25);
  env2.node.connect(Audio.bgmGain);
  const chord = makeOsc('sine', note.freq * 2.5, env2.node);
  chord.start(t); chord.stop(t + env2.dur + 0.05);

  // 4비트마다 반짝이는 하이톤
  if (bgmStep % 4 === 0) {
    const env3 = envGain(0.005, 0.01, 0.18, 0.18);
    env3.node.connect(Audio.bgmGain);
    const sparkle = makeOsc('sine', note.freq * 5, env3.node);
    sparkle.start(t); sparkle.stop(t + env3.dur + 0.05);
  }
}

// ---------- 토글 ----------
function toggleBGM() {
  Audio.bgmEnabled = !Audio.bgmEnabled;
  if (!Audio.started) audioInit();
  if (Audio.bgmGain) Audio.bgmGain.gain.value = Audio.bgmEnabled ? 0.30 : 0;
  if (Audio.bgmEnabled && !Audio.bgmTimer) startBGM();
  if (!Audio.bgmEnabled) stopBGM();
  return Audio.bgmEnabled;
}

function toggleSFX() {
  Audio.sfxEnabled = !Audio.sfxEnabled;
  if (Audio.sfxGain) Audio.sfxGain.gain.value = Audio.sfxEnabled ? 0.7 : 0;
  return Audio.sfxEnabled;
}
