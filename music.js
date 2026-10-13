// ===== 배경음악 (Web Audio API로 직접 연주) =====
// 드럼 "붕붕팍 붕붕팍" + 베이스 + 화음 + 아르페지오
// 화음 진행: Am → F → G → E (단조 + 마지막 E 화음이 긴장감을 만듦)
const BGM = (() => {
  let ctx = null;
  let out = null;          // 음악 전체 음량 (게임의 전체 볼륨으로 연결)
  let noiseBuffer = null;  // 스네어/하이햇용 잡음
  let bpm = 120;
  let timer = null;
  let step = 0;            // 8분음표 단위 위치 (한 마디 = 8칸)
  let nextTime = 0;        // 다음 칸을 연주할 시각

  // MIDI 번호 → 주파수 (69 = 라 440Hz)
  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // 한 마디씩 바뀌는 화음: [베이스, 화음 3음]
  const CHORDS = [
    { bass: 45, notes: [57, 60, 64] }, // Am
    { bass: 41, notes: [53, 57, 60] }, // F
    { bass: 43, notes: [55, 59, 62] }, // G
    { bass: 40, notes: [52, 56, 59] }, // E (솔#이 들어가 긴장감)
  ];

  // 한 마디 8칸의 드럼 패턴: 붕 붕 팍 _ 붕 붕 팍 _
  const KICK  = [1, 1, 0, 0, 1, 1, 0, 0];
  const SNARE = [0, 0, 1, 0, 0, 0, 1, 0];
  const HAT   = [0, 0, 0, 1, 0, 0, 0, 1];

  function init(audioCtx, destination) {
    if (ctx) return;
    ctx = audioCtx;
    out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(destination);
    // 1초 분량의 무작위 잡음
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // 붕: 높은 음에서 낮은 음으로 뚝 떨어지는 사인파
  function kick(t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 잡음을 필터로 깎아서 짧게 끊음 (팍 / 칙)
  function noise(t, duration, volume, filterType, filterFreq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + duration);
  }

  // 팍: 잡음 + 짧은 몸통 소리
  function snare(t) {
    noise(t, 0.18, 0.5, 'highpass', 1200);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  const hat = (t) => noise(t, 0.04, 0.15, 'highpass', 7000);

  // 음 하나: 파형, 길이, 음량, 저역 필터(소리를 둥글게)
  function tone(t, note, duration, type, volume, cutoff = 2000) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq(note);
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(filter).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + duration);
  }

  // 8분음표 한 칸 연주
  function playStep(s, t) {
    const eighth = 60 / bpm / 2;
    const pos = s % 8;
    const chord = CHORDS[Math.floor(s / 8) % CHORDS.length];

    if (KICK[pos]) {
      kick(t);
      tone(t, chord.bass, eighth * 0.9, 'sawtooth', 0.25, 500); // 붕에 맞춰 베이스
    }
    if (SNARE[pos]) snare(t);
    if (HAT[pos]) hat(t);

    // 마디 첫 박에 화음을 길게 깔기
    if (pos === 0) chord.notes.forEach((n) => tone(t, n, eighth * 8, 'triangle', 0.06, 1500));

    // 화음 음을 위아래로 짚는 아르페지오 (긴장감 있는 반복 멜로디)
    const arp = [0, 1, 2, 1, 0, 1, 2, 1];
    tone(t, chord.notes[arp[pos]] + 12, eighth * 0.8, 'square', 0.035, 2500);
  }

  // 조금 앞서서 미리 예약해 두면 타이머가 늦어도 박자가 흔들리지 않음
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.12) {
      playStep(step, nextTime);
      nextTime += 60 / bpm / 2;
      step++;
    }
  }

  return {
    init,
    get playing() { return timer !== null; },
    start() {
      if (!ctx || timer) return;
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      timer = setInterval(scheduler, 25);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    setTempo(value) { bpm = value; },
    setVolume(value) { if (out) out.gain.value = value; },
  };
})();
