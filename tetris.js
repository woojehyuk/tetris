// ===== 1단계: 보드 =====
const COLS = 10;        // 가로 칸 수
const ROWS = 20;        // 세로 칸 수
const BLOCK = 30;       // 한 칸의 픽셀 크기

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

// 0 = 빈칸, 1~7 = 블록 색 번호
const COLORS = [null, '#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'];

// ROWS x COLS 크기의 0으로 채운 2차원 배열
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

let board = createBoard();

// 한 칸 그리기 (context를 받아서 미리보기 캔버스에도 재사용)
function drawCell(x, y, colorIndex, context = ctx) {
  context.fillStyle = COLORS[colorIndex];
  context.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  context.strokeStyle = '#222';
  context.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
}

// 보드 전체 그리기
function drawBoard() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 0) drawCell(x, y, board[y][x]);
    }
  }
}

// ===== 2단계: 블록 7종 =====
// 각 블록은 작은 2차원 배열. 숫자는 COLORS의 색 번호
const SHAPES = {
  I: [[0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0]],
  O: [[2,2],
      [2,2]],
  T: [[0,3,0],
      [3,3,3],
      [0,0,0]],
  S: [[0,4,4],
      [4,4,0],
      [0,0,0]],
  Z: [[5,5,0],
      [0,5,5],
      [0,0,0]],
  J: [[6,0,0],
      [6,6,6],
      [0,0,0]],
  L: [[0,0,7],
      [7,7,7],
      [0,0,0]],
};

// 랜덤 블록 생성: 모양 + 보드 위 위치(x, y)
function createPiece() {
  const keys = Object.keys(SHAPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const shape = SHAPES[type];
  return {
    shape: shape,
    x: Math.floor((COLS - shape[0].length) / 2), // 가운데 정렬
    y: 0,
  };
}

let piece = createPiece();

// 블록 그리기: 모양 배열의 (c, r) 칸은 보드의 (piece.x + c, piece.y + r)
function drawPiece(p, context = ctx) {
  p.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) drawCell(p.x + c, p.y + r, value, context);
    });
  });
}

function draw() {
  drawBoard();
  drawGhost();
  drawPiece(piece);
}

// ===== 3단계: 충돌 판정 + 키보드 이동 =====
// 블록 p를 (dx, dy)만큼 옮겼을 때 부딪히면 true
function collides(p, dx, dy) {
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (p.shape[r][c] === 0) continue;   // 빈칸은 검사 안 함
      const x = p.x + c + dx;
      const y = p.y + r + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true; // 벽/바닥
      if (y >= 0 && board[y][x] !== 0) return true;     // 쌓인 블록
    }
  }
  return false;
}

// 움직일 수 있으면 옮기고 true, 아니면 그대로 false
function move(dx, dy) {
  if (collides(piece, dx, dy)) return false;
  piece.x += dx;
  piece.y += dy;
  return true;
}

// ===== 4단계: 회전 (+ 추가 기능: 월 킥) =====
// 시계 방향 90° 회전: 새 배열의 (r, c) = 원래 배열의 (n-1-c, r)
function rotateMatrix(m) {
  const n = m.length;
  return m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
}

// 제자리에서 막히면 좌우로 밀어보며 회전 시도 (월 킥)
const KICKS = [0, -1, 1, -2, 2];

function rotate() {
  const rotated = { ...piece, shape: rotateMatrix(piece.shape) };
  for (const dx of KICKS) {
    if (!collides(rotated, dx, 0)) {
      rotated.x += dx;
      piece = rotated;
      sfx.rotate();
      return;
    }
  }
  // 모든 위치에서 막히면 회전하지 않음
}

// 키보드와 터치 버튼이 함께 쓰는 동작들
const actions = {
  left:     () => { if (move(-1, 0)) sfx.move(); },
  right:    () => { if (move(1, 0)) sfx.move(); },
  down:     () => { drop(); dropTimer = 0; },
  rotate:   () => rotate(),
  hardDrop: () => { hardDrop(); dropTimer = 0; },
};

function doAction(name) {
  if (gameOver || inMenu) return;
  actions[name]();
  draw();
}

const KEY_ACTIONS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', ' ': 'hardDrop' };

document.addEventListener('keydown', (e) => {
  initAudio(); // 브라우저 정책상 사용자 입력이 있어야 소리를 켤 수 있음
  if (e.key === 'm' || e.key === 'M') { muted = !muted; return; }
  if (e.key === 'Enter') {
    if (gameOver) showMenu();
    else if (inMenu && currentPlayer) startGame();
    return;
  }
  const name = KEY_ACTIONS[e.key];
  if (!name) return;
  e.preventDefault(); // 방향키·스페이스로 페이지가 스크롤되는 것 방지
  doAction(name);
});

// ===== 추가 기능 6: 모바일 터치 버튼 =====
// 이동·내리기 버튼은 누르고 있으면 반복 (키보드를 꾹 누르는 것처럼)
const REPEATABLE = ['left', 'right', 'down'];

document.querySelectorAll('#controls button').forEach((btn) => {
  const name = btn.dataset.action;
  let delayTimer = null;
  let repeatTimer = null;

  const stop = () => {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
  };

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initAudio();
    doAction(name);
    if (REPEATABLE.includes(name)) {
      // 0.2초 뒤부터 0.06초마다 반복
      delayTimer = setTimeout(() => {
        repeatTimer = setInterval(() => doAction(name), 60);
      }, 200);
    }
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
});

// 게임 오버 화면을 탭하면 선수 선택 화면으로
canvas.addEventListener('pointerdown', () => {
  initAudio();
  if (gameOver) showMenu();
});

// ===== 6단계: 블록 고정 + 줄 삭제 =====
let score = 0;
const scoreEl = document.getElementById('score');

// 현재 블록을 board 배열에 써 넣기
function lockPiece() {
  piece.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value !== 0) board[piece.y + r][piece.x + c] = value;
    });
  });
}

// 꽉 찬 줄을 지우고, 지운 줄 수를 돌려줌
function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      board.splice(y, 1);                // 꽉 찬 줄 제거
      board.unshift(Array(COLS).fill(0)); // 맨 위에 빈 줄 추가
      cleared++;
      y++; // 줄이 한 칸씩 내려왔으니 같은 y를 다시 검사
    }
  }
  return cleared;
}

const LINE_SCORES = [0, 100, 300, 500, 800]; // 한 번에 지운 줄 수별 점수

// 한 칸 내리기. 못 내려가면 고정 → 줄 삭제 → 새 블록
function drop() {
  if (move(0, 1)) return;
  lockPiece();
  const cleared = clearLines();
  lines += cleared;
  score += LINE_SCORES[cleared] * level; // 레벨이 높을수록 점수도 많이
  const prevLevel = level;
  level = Math.floor(lines / 10) + 1;    // 10줄마다 레벨 업
  updateInfo();

  if (level > prevLevel) sfx.levelUp();
  else if (cleared > 0) sfx.clear(cleared);
  else sfx.lock();
  spawnPiece();
}

// ===== 추가 기능 1: 하드 드롭 =====
// 바닥까지 한 번에 내린 뒤 바로 고정. 떨어진 칸 수 × 2점 보너스
function hardDrop() {
  let distance = 0;
  while (move(0, 1)) distance++;
  score += distance * 2;
  drop(); // 더 못 내려가니 drop()이 고정 처리
}

// ===== 추가 기능 2: 고스트 블록 =====
// 현재 블록을 바닥까지 내렸을 때의 위치를 반투명하게 표시
function drawGhost() {
  let dy = 0;
  while (!collides(piece, 0, dy + 1)) dy++;
  ctx.globalAlpha = 0.25;
  drawPiece({ ...piece, y: piece.y + dy });
  ctx.globalAlpha = 1;
}

// ===== 추가 기능 3: 다음 블록 미리보기 =====
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
nextCanvas.width = 4 * BLOCK;
nextCanvas.height = 4 * BLOCK;

let nextPiece = createPiece();

// 미리 뽑아둔 블록을 내보내고, 그 다음 블록을 새로 뽑음
function spawnPiece() {
  piece = nextPiece;
  nextPiece = createPiece();
  drawNext();
  if (collides(piece, 0, 0)) {  // 나오자마자 겹치면 게임 오버
    gameOver = true;
    sfx.gameOver();
    checkBestScore();
  }
}

function drawNext() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = nextPiece.shape.length;
  const offset = (4 - size) / 2; // 미리보기 칸 가운데에 오도록
  drawPiece({ shape: nextPiece.shape, x: offset, y: offset }, nextCtx);
}

// ===== 추가 기능 4: 레벨 + 속도 증가 =====
let lines = 0;
let level = 1;
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');

// 레벨 1: 1000ms, 레벨이 오를 때마다 100ms씩 빨라짐 (최소 100ms)
function getDropInterval() {
  return Math.max(100, 1000 - (level - 1) * 100);
}

function updateInfo() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ===== 추가 기능 5: 효과음 (Web Audio API) =====
// 소리 파일 없이 코드로 직접 소리를 만들어 냄
let audioCtx = null;
let masterGain = null; // 모든 소리가 거쳐 가는 전체 볼륨 조절기
let muted = false;

// 슬라이더 0~100 → 전체 볼륨 배율 0~3배
const volumeSlider = document.getElementById('volume');
const volumeLabel = document.getElementById('volume-label');
function getMasterVolume() {
  return (volumeSlider.value / 100) * 3;
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = getMasterVolume();
  masterGain.connect(audioCtx.destination);
}

volumeSlider.addEventListener('input', () => {
  volumeLabel.textContent = volumeSlider.value;
  if (masterGain) masterGain.gain.value = getMasterVolume();
});
volumeSlider.addEventListener('change', () => {
  volumeSlider.blur(); // 포커스가 남아 있으면 방향키가 슬라이더를 건드림
  initAudio();
  sfx.rotate();        // 조절한 크기를 바로 들어볼 수 있게
});

// 소리 하나 재생: 주파수(Hz), 길이(초), 파형, 음량, 끝 주파수(음높이 미끄러짐)
function playTone(freq, duration, type = 'square', volume = 0.1, endFreq = freq, delay = 0) {
  if (!audioCtx || muted) return;
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator(); // 소리를 만드는 발진기
  const gain = audioCtx.createGain();      // 음량 조절기
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration); // 점점 작아지게
  osc.connect(gain).connect(masterGain);  // 발진기 → 개별 음량 → 전체 볼륨 → 스피커
  osc.start(start);
  osc.stop(start + duration);
}

const sfx = {
  move:   () => playTone(200, 0.05, 'square', 0.05),
  rotate: () => playTone(400, 0.08, 'square', 0.06, 600),
  lock:   () => playTone(120, 0.1, 'triangle', 0.15, 60),
  // 지운 줄 수만큼 올라가는 음 (4줄이면 도-미-솔-높은 도)
  clear: (n) => [523, 659, 784, 1047].slice(0, n)
    .forEach((f, i) => playTone(f, 0.12, 'square', 0.08, f, i * 0.07)),
  levelUp: () => [523, 659, 784, 1047, 1319]
    .forEach((f, i) => playTone(f, 0.1, 'square', 0.08, f, i * 0.06)),
  gameOver: () => playTone(400, 1.0, 'sawtooth', 0.1, 50),
};

// ===== 7단계: 게임 오버 + 재시작 =====
let gameOver = false;

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  ctx.font = '16px sans-serif';
  ctx.fillText('Enter 또는 화면 탭으로 계속', canvas.width / 2, canvas.height / 2 + 36);
  ctx.fillText(`${currentPlayer} ${score}점`, canvas.width / 2, canvas.height / 2 - 40);
  if (isNewBest) {
    ctx.fillStyle = '#f0f000';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`🏆 ${currentPlayer} 최고 기록!`, canvas.width / 2, canvas.height / 2 - 70);
  }
}

// ===== 추가 기능 7: 선수별 최고 점수 저장 (localStorage) =====
// 브라우저에 저장되므로 창을 닫아도 남음 (기기·브라우저마다 따로 저장됨)
const PLAYERS = ['홍지', '횩이', '도순', '똥겸'];
const BEST_KEY = 'tetris-best-scores'; // { 홍지: 1200, 횩이: 800, ... } 형태로 저장
const bestEl = document.getElementById('best');
const bestLabelEl = document.getElementById('best-label');
let isNewBest = false;

function loadBestScores() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    return {}; // 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 0점부터
  }
}

let bestScores = loadBestScores();

function getBest(name) {
  return bestScores[name] || 0;
}

function checkBestScore() {
  if (score <= getBest(currentPlayer)) return;
  bestScores[currentPlayer] = score;
  isNewBest = true;
  bestEl.textContent = score;
  saveLocalScores();
  window.submitScore?.(currentPlayer, score); // 가족 랭킹에도 올림 (ranking.js)
}

function saveLocalScores() {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(bestScores));
  } catch {
    // 저장 실패해도 이번 접속 동안은 기록 유지
  }
}

// 가족 랭킹 기록이 도착하면: 이 기기 기록과 합쳐서 더 높은 쪽을 사용
let rankingReady = false;
window.onRemoteScores = (remote) => {
  rankingReady = true;
  PLAYERS.forEach((name) => {
    const local = getBest(name);
    const shared = remote[name] || 0;
    if (shared > local) bestScores[name] = shared;
    // 랭킹 기능 전에 이 기기에서 세운 기록이 더 높으면 공용 저장소로 올림
    else if (local > shared) window.submitScore?.(name, local);
  });
  saveLocalScores();
  if (inMenu) renderPlayers();
  if (currentPlayer && !inMenu) bestEl.textContent = getBest(currentPlayer);
};
window.onRankingError = () => {
  rankingReady = false;
  if (inMenu) renderPlayers();
};

// ===== 추가 기능 8: 시작 화면 + 선수 선택 =====
const menuEl = document.getElementById('menu');
const playerListEl = document.getElementById('players');
const startBtn = document.getElementById('start');
let inMenu = true;
let currentPlayer = null;

// 선수 버튼 4개를 만들고, 각 선수의 최고 점수를 함께 표시
function renderPlayers() {
  playerListEl.innerHTML = '';
  PLAYERS.forEach((name) => {
    const btn = document.createElement('button');
    btn.className = 'player' + (name === currentPlayer ? ' selected' : '');
    btn.innerHTML = `<span class="name">${name}</span><span class="best">🏆 ${getBest(name)}</span>`;
    btn.addEventListener('click', () => {
      initAudio();
      currentPlayer = name;
      sfx.move();
      renderPlayers();
    });
    playerListEl.appendChild(btn);
  });
  renderRanking();
  startBtn.disabled = !currentPlayer;
  startBtn.textContent = currentPlayer ? `${currentPlayer} 게임 시작` : '선수를 고르세요';
}

// 점수 높은 순으로 가족 랭킹 표시
const rankingEl = document.getElementById('ranking');
function renderRanking() {
  const sorted = [...PLAYERS].sort((a, b) => getBest(b) - getBest(a));
  const medals = ['🥇', '🥈', '🥉', '4위'];
  rankingEl.innerHTML =
    `<div class="title">🏆 가족 랭킹${rankingReady ? '' : ' <small>(이 기기 기록)</small>'}</div>` +
    sorted.map((name, i) =>
      `<div class="row"><span>${medals[i]} ${name}</span><span>${getBest(name).toLocaleString()}</span></div>`
    ).join('');
}

function showMenu() {
  gameOver = false;
  inMenu = true;
  renderPlayers();
  menuEl.hidden = false;
}

function startGame() {
  inMenu = false;
  menuEl.hidden = true;
  document.activeElement.blur(); // 버튼에 포커스가 남아 Space/Enter가 버튼을 누르지 않게
  bestLabelEl.textContent = `최고 점수 (${currentPlayer})`;
  bestEl.textContent = getBest(currentPlayer);
  restart();
}

startBtn.addEventListener('click', () => {
  initAudio();
  if (currentPlayer) startGame();
});

function restart() {
  isNewBest = false;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  updateInfo();
  dropTimer = 0;
  gameOver = false;
  nextPiece = createPiece();
  spawnPiece();
}

// ===== 5단계: 자동 낙하 (게임 루프) =====
let dropTimer = 0;          // 마지막 낙하 후 쌓인 시간
let lastTime = 0;           // 직전 프레임 시각

// 브라우저가 화면을 그릴 때마다(보통 초당 60번) 호출됨
function gameLoop(time) {
  const delta = time - lastTime; // 지난 프레임부터 흐른 시간(ms)
  lastTime = time;

  if (!gameOver && !inMenu) {
    dropTimer += delta;
    if (dropTimer >= getDropInterval()) {
      drop();
      dropTimer = 0;
    }
  }

  draw();
  if (gameOver) drawGameOver();
  requestAnimationFrame(gameLoop); // 다음 프레임 예약
}

drawNext();
showMenu();
requestAnimationFrame(gameLoop);
