const socket = io();
const $ = (id) => document.getElementById(id);

const homeScreen = $('homeScreen');
const gameScreen = $('gameScreen');
const playerName = $('playerName');
const roomCodeInput = $('roomCodeInput');
const homeError = $('homeError');
const createBtn = $('createBtn');
const joinBtn = $('joinBtn');
const controlsPanel = $('controlsPanel');
const stadiumView = $('stadiumView');
const ballSprite = $('ballSprite');
const shotTrail = $('shotTrail');
const impactPulse = $('impactPulse');
const bowlerAvatar = $('bowlerAvatar');
const batterAvatar = $('batterAvatar');
const stumpsTop = $('stumpsTop');
const stumpsBottom = $('stumpsBottom');
const shotResultBadge = $('shotResultBadge');
const fielderSprite = $('fielderSprite');
const cinematicOverlay = $('cinematicOverlay');
const cinematicKicker = $('cinematicKicker');
const cinematicMain = $('cinematicMain');
const cinematicSub = $('cinematicSub');
const tossOverlay = $('tossOverlay');
const animatedCoin = $('animatedCoin');
const tossResult = $('tossResult');
const tossSub = $('tossSub');
const replayBtn = $('replayBtn');
const soundToggle = $('soundToggle');

let state = null;
let selectedStyle = null;
let selectedDirection = null;
let selectedDelivery = null;
let selectedKit = localStorage.getItem('sixBallKit') || 'royal';
let lastBallLogLength = 0;
let animationToken = 0;
let hydrated = false;
let lastAnimatedBallKey = '';
let lastTossId = '';
let audioCtx = null;
let soundEnabled = localStorage.getItem('sixBallSound') !== 'off';

const BOWLER_INFO = {
  pace: ['Fast / Pace', 'Raw speed, bounce and yorkers'],
  swing: ['Swing', 'Move the ball through the air'],
  seam: ['Seam', 'Hit the pitch and create movement'],
  offspin: ['Off Spin', 'Turn it away from a right-hander'],
  legspin: ['Leg Spin', 'Big turn, googlies and flippers']
};

const DELIVERY_LABELS = {
  yorker: 'Yorker', bouncer: 'Bouncer', 'good-length': 'Good Length', 'slower-ball': 'Slower Ball', 'wide-yorker': 'Wide Yorker',
  inswinger: 'Inswinger', outswinger: 'Outswinger', 'full-swing': 'Full Swinger', 'cross-seam': 'Cross Seam',
  'back-of-length': 'Back of Length', 'off-cutter': 'Off Cutter', 'leg-cutter': 'Leg Cutter',
  'off-break': 'Off Break', 'arm-ball': 'Arm Ball', 'top-spinner': 'Top Spinner', 'quicker-ball': 'Quicker Ball', flighted: 'Flighted Ball',
  'leg-break': 'Leg Break', googly: 'Googly', flipper: 'Flipper'
};

const STYLE_INFO = {
  defensive: ['Defensive', 'Lowest risk · fewer boundaries'],
  safe: ['Safe', 'Balanced rotation of strike'],
  aggressive: ['Aggressive', 'More boundaries · more danger'],
  unorthodox: ['Unorthodox', 'Unpredictable · highest variance']
};

const DIR_LABELS = {
  straight: 'Straight', cover: 'Cover', point: 'Point', third: 'Third',
  'fine-leg': 'Fine Leg', midwicket: 'Midwicket', 'square-leg': 'Square Leg', 'long-on': 'Long On'
};

const KIT_PALETTE = {
  royal: ['#5ab6ff', '#2258c2', '#0f2440'],
  scarlet: ['#ff8b72', '#c93333', '#531515'],
  emerald: ['#66df9a', '#187542', '#0f3a27'],
  gold: ['#ffe582', '#cb8d13', '#684808'],
  violet: ['#cf94ff', '#6f38b6', '#32185b'],
  teal: ['#5ee7dc', '#177a83', '#0d4147']
};

const FIELD_POSITIONS = {
  straight: { x: 50, y: 12 }, cover: { x: 79, y: 24 }, point: { x: 86, y: 47 }, third: { x: 76, y: 72 },
  'fine-leg': { x: 24, y: 72 }, midwicket: { x: 21, y: 24 }, 'square-leg': { x: 14, y: 47 }, 'long-on': { x: 50, y: 88 }
};

const DELIVERY_PATHS = {
  yorker: { midX: 50, midY: 42, impactX: 50, impactY: 74 }, bouncer: { midX: 50, midY: 32, impactX: 52, impactY: 64 },
  'good-length': { midX: 49, midY: 44, impactX: 50, impactY: 70 }, 'slower-ball': { midX: 47, midY: 46, impactX: 49, impactY: 70 },
  'wide-yorker': { midX: 62, midY: 43, impactX: 61, impactY: 72 }, inswinger: { midX: 58, midY: 43, impactX: 48, impactY: 70 },
  outswinger: { midX: 42, midY: 43, impactX: 54, impactY: 70 }, 'full-swing': { midX: 45, midY: 41, impactX: 51, impactY: 71 },
  'cross-seam': { midX: 54, midY: 43, impactX: 52, impactY: 71 }, 'back-of-length': { midX: 48, midY: 39, impactX: 49, impactY: 67 },
  'off-cutter': { midX: 55, midY: 44, impactX: 51, impactY: 70 }, 'leg-cutter': { midX: 45, midY: 44, impactX: 49, impactY: 70 },
  'off-break': { midX: 54, midY: 46, impactX: 48, impactY: 72 }, 'arm-ball': { midX: 50, midY: 43, impactX: 50, impactY: 70 },
  'top-spinner': { midX: 50, midY: 39, impactX: 50, impactY: 67 }, 'quicker-ball': { midX: 49, midY: 42, impactX: 50, impactY: 69 },
  flighted: { midX: 46, midY: 34, impactX: 50, impactY: 72 }, 'leg-break': { midX: 45, midY: 46, impactX: 54, impactY: 72 },
  googly: { midX: 57, midY: 46, impactX: 48, impactY: 72 }, flipper: { midX: 51, midY: 45, impactX: 49, impactY: 73 }
};

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function setScreen(which) {
  homeScreen.classList.toggle('active', which === 'home');
  gameScreen.classList.toggle('active', which === 'game');
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('sixBallSession') || 'null'); } catch { return null; }
}
function saveSession(session) { localStorage.setItem('sixBallSession', JSON.stringify(session)); }
function clearSession() { localStorage.removeItem('sixBallSession'); }

function setBusy(isBusy) {
  createBtn.disabled = isBusy;
  joinBtn.disabled = isBusy;
}

function applyKitPicker() {
  document.querySelectorAll('.kit-swatch').forEach(btn => btn.classList.toggle('selected', btn.dataset.kit === selectedKit));
}

function unlockAudio() {
  if (!soundEnabled) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function tone(freq = 440, duration = .1, type = 'sine', gain = .04, delay = 0) {
  if (!soundEnabled) return;
  unlockAudio();
  if (!audioCtx) return;
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(gain, start + .01);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(vol).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + .02);
}

function noise(duration = .15, gain = .025, delay = 0) {
  if (!soundEnabled) return;
  unlockAudio();
  if (!audioCtx) return;
  const frames = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const vol = audioCtx.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = 1300;
  vol.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(vol).connect(audioCtx.destination);
  src.start(audioCtx.currentTime + delay);
}

const SFX = {
  tap() { tone(520, .045, 'square', .018); },
  ball() { noise(.055, .018); tone(150, .06, 'triangle', .02); },
  bat() { noise(.08, .05); tone(180, .05, 'square', .025); },
  wicket() { noise(.18, .055); tone(105, .28, 'sawtooth', .035); tone(76, .32, 'square', .02, .04); },
  extra() { tone(710, .12, 'sine', .03); tone(910, .16, 'sine', .024, .11); },
  boundary() { tone(392, .18, 'triangle', .03); tone(523, .22, 'triangle', .035, .12); tone(659, .30, 'triangle', .03, .25); noise(.5, .018, .12); },
  six() { tone(392, .22, 'triangle', .035); tone(523, .24, 'triangle', .04, .1); tone(659, .28, 'triangle', .04, .2); tone(784, .42, 'triangle', .035, .3); noise(.65, .023, .1); },
  coin() { tone(1046, .08, 'sine', .025); tone(1318, .08, 'sine', .02, .14); tone(1568, .12, 'sine', .018, .3); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, .35, 'triangle', .028, i * .12)); noise(.8, .018, .2); }
};

function updateSoundButton() {
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.classList.toggle('muted', !soundEnabled);
}

function submitCreate() {
  unlockAudio();
  const name = playerName.value.trim();
  if (!name) return showHomeError('Enter your name first.');
  setBusy(true);
  socket.emit('create-room', { name, kit: selectedKit }, response => {
    setBusy(false);
    if (!response?.ok) return showHomeError(response?.error || 'Could not create match.');
    saveSession({ roomCode: response.roomCode, token: response.token });
    setScreen('game');
  });
}

function submitJoin() {
  unlockAudio();
  const name = playerName.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!name) return showHomeError('Enter your name first.');
  if (roomCode.length !== 5) return showHomeError('Enter the five-character room code.');
  setBusy(true);
  socket.emit('join-room', { name, roomCode, kit: selectedKit }, response => {
    setBusy(false);
    if (!response?.ok) return showHomeError(response?.error || 'Could not join match.');
    saveSession({ roomCode: response.roomCode, token: response.token });
    setScreen('game');
  });
}

function showHomeError(message) { homeError.textContent = message; }

createBtn.addEventListener('click', submitCreate);
joinBtn.addEventListener('click', submitJoin);
roomCodeInput.addEventListener('input', () => roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
roomCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitJoin(); });
playerName.addEventListener('keydown', e => { if (e.key === 'Enter' && roomCodeInput.value.trim()) submitJoin(); });

document.querySelectorAll('.kit-swatch').forEach(btn => btn.addEventListener('click', () => {
  unlockAudio();
  SFX.tap();
  selectedKit = btn.dataset.kit;
  localStorage.setItem('sixBallKit', selectedKit);
  applyKitPicker();
}));

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sixBallSound', soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) { unlockAudio(); SFX.tap(); }
});

$('leaveBtn').addEventListener('click', () => {
  clearSession();
  location.reload();
});

$('roomCodeDisplay').addEventListener('click', async () => {
  if (!state?.roomCode) return;
  try {
    await navigator.clipboard.writeText(state.roomCode);
    showToast('Room code copied');
  } catch {
    showToast(`Room: ${state.roomCode}`);
  }
});

replayBtn.addEventListener('click', () => {
  const latest = state?.ballLog?.[state.ballLog.length - 1];
  if (!latest) return;
  unlockAudio();
  playBallAnimation(latest, true);
});

socket.on('connect', () => {
  $('connectionPill').textContent = 'Online';
  $('connectionPill').classList.add('online');
  const session = getSession();
  if (session?.roomCode && session?.token) {
    socket.emit('reconnect-room', session, response => {
      if (response?.ok) setScreen('game');
      else clearSession();
    });
  }
});

socket.on('disconnect', () => {
  $('connectionPill').textContent = 'Reconnecting';
  $('connectionPill').classList.remove('online');
});

socket.on('state', nextState => {
  const wasFinished = state?.phase === 'finished';
  const newBallHappened = hydrated && nextState.ballLog.length > lastBallLogLength;
  const latestBall = newBallHappened ? nextState.ballLog[nextState.ballLog.length - 1] : null;
  const tossIsNew = !!nextState.toss?.id && nextState.toss.id !== lastTossId;

  state = nextState;
  if (newBallHappened) {
    selectedStyle = null;
    selectedDirection = null;
    selectedDelivery = null;
  }
  lastBallLogLength = nextState.ballLog.length;
  hydrated = true;
  setScreen('game');
  render();

  if (tossIsNew) {
    lastTossId = nextState.toss.id;
    setTimeout(() => playTossAnimation(nextState.toss), 120);
  }

  if (nextState.phase === 'finished' && !wasFinished) {
    setTimeout(() => SFX.win(), 2350);
  }

  if (latestBall) {
    const ballKey = `${latestBall.innings}-${latestBall.deliverySeq}-${latestBall.outcome}-${latestBall.dismissalType || ''}`;
    if (ballKey !== lastAnimatedBallKey) {
      lastAnimatedBallKey = ballKey;
      playBallAnimation(latestBall, false);
    }
  }
});

function render() {
  if (!state) return;
  $('roomCodeDisplay').textContent = state.roomCode;
  $('inningsChip').textContent = state.phase === 'finished' ? 'FULL TIME' : state.innings ? `INNINGS ${state.innings}` : 'LOBBY';
  renderScores();
  renderStatus();
  renderVisualizer();
  renderBalls();
  renderControls();
  renderCommentary();
  $('roleBadge').textContent = state.viewerRole ? (state.viewerRole === 'batting' ? 'You are batting' : 'You are bowling') : 'Waiting';
  replayBtn.disabled = !state.ballLog.length;
}

function renderScores() {
  const players = state.players || [];
  const cards = [$('playerOneCard'), $('playerTwoCard')];
  cards.forEach((card, index) => {
    const p = players[index];
    if (!p) {
      card.querySelector('.player-name').textContent = 'Waiting…';
      card.querySelector('.score').textContent = '—';
      card.querySelector('.wickets').textContent = 'not joined';
      card.classList.remove('active-player');
      return;
    }
    const extras = state.extras?.[p.id] ?? 0;
    card.querySelector('.player-name').textContent = `${p.name}${p.id === state.you?.id ? ' · You' : ''}`;
    card.querySelector('.score').textContent = state.scores?.[p.id] ?? 0;
    card.querySelector('.wickets').textContent = `${state.wickets?.[p.id] ?? 0} wkt${(state.wickets?.[p.id] ?? 0) === 1 ? '' : 's'} · ${extras} extra${extras === 1 ? '' : 's'}${p.connected ? '' : ' · offline'}`;
    card.classList.toggle('active-player', p.id === state.battingPlayer?.id && state.phase !== 'finished');
    const palette = KIT_PALETTE[p.kit] || KIT_PALETTE.royal;
    card.style.boxShadow = p.id === state.battingPlayer?.id && state.phase !== 'finished' ? `inset 4px 0 0 ${palette[0]}` : '';
  });
}

function setStatus(icon, title, text) {
  $('statusIcon').textContent = icon;
  $('statusTitle').textContent = title;
  $('statusText').textContent = text;
}

function renderStatus() {
  if (state.players.length < 2) {
    setStatus('📱', 'Waiting for opponent', `Share room ${state.roomCode}. The match starts automatically when player two joins.`);
    return;
  }
  if (state.phase === 'choose-bowler') {
    if (state.viewerRole === 'bowling') setStatus('🎯', 'Choose your bowler type', `You are bowling to ${state.battingPlayer.name}. Pick one style for all six legal balls.`);
    else setStatus('🏏', 'Get ready to bat', `${state.bowlingPlayer.name} is choosing their bowling style.`);
    return;
  }
  if (state.phase === 'innings-break') {
    setStatus('🔄', 'Change of innings', `${state.battingPlayer.name} will now chase the target.`);
    return;
  }
  if (state.phase === 'playing') {
    const score = state.scores[state.battingPlayer.id] || 0;
    if (state.viewerRole === 'batting') {
      setStatus('🏏', `Legal ball ${state.ball} of 6 · You bat`, `${state.selectedBowlerLabel}. Choose intent and direction, then lock your shot.`);
    } else {
      setStatus('⚡', `Legal ball ${state.ball} of 6 · You bowl`, `${state.selectedBowlerLabel}. Pick a delivery and lock it in.`);
    }
    if (state.innings === 2) {
      const opponentId = state.players.find(p => p.id !== state.battingPlayer.id)?.id;
      const target = (state.scores[opponentId] || 0) + 1;
      $('statusText').textContent += ` Target: ${target}. Current: ${score}.`;
    }
    return;
  }
  if (state.phase === 'finished') {
    const icon = state.winnerId ? (state.winnerId === state.you?.id ? '🏆' : '🤝') : '⚖️';
    setStatus(icon, state.resultText || 'Match over', state.winnerId === state.you?.id ? 'You won the Six Ball Showdown!' : state.winnerId ? 'Good game — time for a rematch?' : 'Nothing between you after twelve legal balls.');
  }
}

function setResultBadge(text, tone = '') {
  shotResultBadge.textContent = text;
  shotResultBadge.className = 'shot-result-badge';
  if (tone) shotResultBadge.classList.add(tone);
}

function formatCaptionPlayer(prefix, player, extras = '') {
  if (!player) return `${prefix}: waiting…`;
  return `${prefix}: ${player.name}${extras ? ` · ${extras}` : ''}`;
}

function resultTone(entry) {
  if (entry.wicket || entry.outcome === 'W') return 'wicket';
  if (entry.extraType) return 'runs';
  if (entry.boundary || entry.outcome === 4 || entry.outcome === 6) return 'boundary';
  if (Number(entry.scoreDelta ?? entry.outcome) > 0) return 'runs';
  return '';
}

function outcomeLabel(entry) {
  if (entry.extraType === 'wide') return 'WIDE';
  if (entry.extraType === 'no-ball') return entry.batRuns ? `NO-BALL + ${entry.batRuns}` : 'NO-BALL';
  if (entry.wicket || entry.outcome === 'W') return (entry.dismissalType || 'wicket').toUpperCase();
  if (entry.outcome === 0) return 'DOT';
  if (entry.outcome === 1) return '1 RUN';
  if (entry.outcome === 2) return '2 RUNS';
  if (entry.outcome === 3) return '3 RUNS';
  if (entry.outcome === 4) return 'FOUR';
  if (entry.outcome === 6) return 'SIX';
  return String(entry.outcome);
}

function ballSummary(entry) {
  const direction = DIR_LABELS[entry.direction] || entry.direction;
  const style = STYLE_INFO[entry.style]?.[0] || entry.style;
  if (entry.extraType === 'wide') return `Wide · +1 extra · ball rebowled`;
  if (entry.extraType === 'no-ball') return `${outcomeLabel(entry)} · +${entry.scoreDelta} total · ball rebowled`;
  if (entry.wicket || entry.outcome === 'W') return `${outcomeLabel(entry)} · ${DELIVERY_LABELS[entry.delivery] || entry.delivery}`;
  if (entry.outcome === 0) return `Dot ball · ${style} to ${direction}`;
  return `${outcomeLabel(entry)} · ${style} through ${direction}`;
}

function applyAvatarKits(batterOverride = null, bowlerOverride = null) {
  const batterPlayer = batterOverride || state?.battingPlayer;
  const bowlerPlayer = bowlerOverride || state?.bowlingPlayer;
  const batterKit = KIT_PALETTE[batterPlayer?.kit] || KIT_PALETTE.royal;
  const bowlerKit = KIT_PALETTE[bowlerPlayer?.kit] || KIT_PALETTE.scarlet;
  const bowlerTorso = bowlerAvatar.querySelector('.torso');
  const batterTorso = batterAvatar.querySelector('.torso');
  bowlerTorso.style.background = `linear-gradient(180deg, ${bowlerKit[0]}, ${bowlerKit[1]})`;
  batterTorso.style.background = `linear-gradient(180deg, ${batterKit[0]}, ${batterKit[1]})`;
  bowlerTorso.dataset.initial = (bowlerPlayer?.name || 'B').slice(0, 1).toUpperCase();
  batterTorso.dataset.initial = (batterPlayer?.name || 'B').slice(0, 1).toUpperCase();
  batterAvatar.querySelector('.helmet').style.background = `linear-gradient(180deg, ${batterKit[2]}, ${batterKit[1]})`;
  fielderSprite.querySelector('.fielder-body').style.background = `linear-gradient(180deg, ${bowlerKit[0]}, ${bowlerKit[1]})`;
}

function renderVisualizer() {
  applyAvatarKits();
  const battingPlayer = state?.battingPlayer;
  const bowlingPlayer = state?.bowlingPlayer;
  const batterScore = battingPlayer ? (state.scores?.[battingPlayer.id] ?? 0) : null;
  const batterWickets = battingPlayer ? (state.wickets?.[battingPlayer.id] ?? 0) : null;
  const typeLabel = state?.selectedBowlerLabel || 'Not chosen';

  $('bowlerCaption').textContent = formatCaptionPlayer('Bowler', bowlingPlayer, typeLabel);
  let batterExtras = battingPlayer ? `${batterScore}/${batterWickets}` : '';
  if (state?.innings === 2 && battingPlayer && state.players?.length === 2) {
    const opponentId = state.players.find(p => p.id !== battingPlayer.id)?.id;
    const target = (state.scores?.[opponentId] || 0) + 1;
    batterExtras += ` · needs ${Math.max(target - batterScore, 0)}`;
  }
  $('batterCaption').textContent = formatCaptionPlayer('Batter', battingPlayer, batterExtras);
  stadiumView.classList.toggle('finished-glow', state?.phase === 'finished');

  if (!state?.ballLog?.length) {
    if (state?.phase === 'choose-bowler') setResultBadge('Select bowling type to begin');
    else if (state?.phase === 'finished') setResultBadge(state.resultText || 'Match over', state.winnerId ? 'boundary' : 'runs');
    else setResultBadge('Waiting for first ball');
    return;
  }
  const latest = state.ballLog[state.ballLog.length - 1];
  if (state?.phase === 'finished') setResultBadge(state.resultText || ballSummary(latest), state.winnerId ? 'boundary' : resultTone(latest));
  else setResultBadge(ballSummary(latest), resultTone(latest));
}

function inningsEntries() {
  const displayInnings = state.phase === 'innings-break' && state.ballLog.length ? state.ballLog[state.ballLog.length - 1].innings : state.innings;
  return state.ballLog.filter(x => x.innings === displayInnings);
}

function renderBalls() {
  const entries = inningsEntries();
  $('ballTracker').innerHTML = Array.from({ length: 6 }, (_, i) => {
    const ballNo = i + 1;
    const entry = entries.find(e => e.ball === ballNo && e.legalBall !== false);
    let label = ballNo;
    let cls = 'ball-dot';
    if (entry) {
      label = entry.wicket ? 'W' : entry.outcome;
      cls += ' done';
      if (entry.wicket || entry.outcome === 'W') cls += ' wicket';
      if (entry.boundary || entry.outcome === 4 || entry.outcome === 6) cls += ' boundary';
    } else if (ballNo === state.ball && ['playing', 'choose-bowler'].includes(state.phase)) {
      cls += ' current';
    }
    return `<div class="${cls}">${esc(label)}</div>`;
  }).join('');
}

function renderControls() {
  if (state.players.length < 2) {
    controlsPanel.innerHTML = `<div class="waiting-lock"><div><b>Room ready</b>Open this site on the second phone and join with <strong>${esc(state.roomCode)}</strong>.</div></div>`;
    return;
  }

  if (state.phase === 'choose-bowler') {
    if (state.viewerRole !== 'bowling') {
      controlsPanel.innerHTML = tossBlock() + `<div class="waiting-lock"><div><b>${esc(state.bowlingPlayer.name)} is choosing</b>You’ll see the bowling type before ball one.</div></div>`;
      return;
    }
    controlsPanel.innerHTML = tossBlock() + `
      <h3 class="controls-title">Choose bowling style</h3>
      <p class="controls-sub">This locks the delivery family for the whole over. Wides and no-balls add an extra and must be bowled again.</p>
      <div class="choice-grid five">
        ${Object.entries(BOWLER_INFO).map(([key, info]) => `<button class="choice-btn bowler-type" data-type="${key}"><strong>${info[0]}</strong><small>${info[1]}</small></button>`).join('')}
      </div>`;
    controlsPanel.querySelectorAll('.bowler-type').forEach(btn => btn.addEventListener('click', () => {
      unlockAudio(); SFX.tap();
      socket.emit('choose-bowler-type', { type: btn.dataset.type }, response => {
        if (!response?.ok) showToast(response?.error || 'Could not select bowler.');
      });
    }));
    return;
  }

  if (state.phase === 'innings-break') {
    controlsPanel.innerHTML = `<div class="waiting-lock"><div><b>Innings complete</b>Roles are switching. Get ready for the chase.</div></div>`;
    return;
  }

  if (state.phase === 'finished') {
    const p1 = state.players[0], p2 = state.players[1];
    controlsPanel.innerHTML = `
      <h3 class="controls-title">${esc(state.resultText)}</h3>
      <p class="controls-sub">Twelve legal balls complete.</p>
      <div class="final-score">
        <div class="final-box"><strong>${state.scores[p1.id]}</strong><span>${esc(p1.name)} · ${state.wickets[p1.id]} wkts · ${state.extras?.[p1.id] || 0} extras</span></div>
        <div class="final-box"><strong>${state.scores[p2.id]}</strong><span>${esc(p2.name)} · ${state.wickets[p2.id]} wkts · ${state.extras?.[p2.id] || 0} extras</span></div>
      </div>
      <button id="rematchBtn" class="primary-btn">Play rematch</button>`;
    $('rematchBtn').addEventListener('click', () => {
      unlockAudio(); SFX.tap();
      socket.emit('rematch', {}, response => { if (!response?.ok) showToast(response?.error || 'Could not start rematch.'); });
    });
    return;
  }

  if (state.phase !== 'playing') return;
  if (state.yourLocked) {
    controlsPanel.innerHTML = `<div class="waiting-lock"><div><b>Choice locked ✓</b>${state.opponentLocked ? 'Resolving the ball…' : `Waiting for ${esc(state.opponent.name)} to lock in.`}</div></div>`;
    return;
  }
  if (state.viewerRole === 'bowling') renderBowlingControls();
  else renderBattingControls();
}

function tossBlock() {
  if (state.innings !== 1 || !state.toss) return '';
  return `<p class="controls-sub" style="text-align:center"><b>${esc(state.toss.coin)}</b> · ${esc(state.toss.winnerName)} won the toss and bats first.</p>`;
}

function renderBowlingControls() {
  controlsPanel.innerHTML = `
    <h3 class="controls-title">What will you bowl?</h3>
    <p class="controls-sub">${esc(state.selectedBowlerLabel)} · Legal ball ${state.ball} of 6. Your exact delivery remains hidden until the batter locks their shot.</p>
    <span class="section-label">Delivery</span>
    <div class="choice-grid five" id="deliveryGrid">
      ${state.availableDeliveries.map(key => `<button class="choice-btn delivery-choice ${selectedDelivery === key ? 'selected' : ''}" data-delivery="${key}"><strong>${esc(DELIVERY_LABELS[key] || key)}</strong><small>Tap to select</small></button>`).join('')}
    </div>
    <button id="lockBowlBtn" class="primary-btn lock-btn" ${selectedDelivery ? '' : 'disabled'}>Lock delivery</button>`;

  controlsPanel.querySelectorAll('.delivery-choice').forEach(btn => btn.addEventListener('click', () => {
    unlockAudio(); SFX.tap();
    selectedDelivery = btn.dataset.delivery;
    renderControls();
  }));
  $('lockBowlBtn').addEventListener('click', () => {
    if (!selectedDelivery) return;
    unlockAudio(); SFX.tap();
    socket.emit('lock-bowl', { delivery: selectedDelivery }, response => { if (!response?.ok) showToast(response?.error || 'Could not lock delivery.'); });
  });
}

function renderBattingControls() {
  controlsPanel.innerHTML = `
    <h3 class="controls-title">Choose your shot</h3>
    <p class="controls-sub">You know the bowler is using <b>${esc(state.selectedBowlerLabel)}</b>, but the exact delivery is hidden.</p>
    <span class="section-label">Intent</span>
    <div class="choice-grid" id="styleGrid">
      ${Object.entries(STYLE_INFO).map(([key, info]) => `<button class="choice-btn style-choice ${selectedStyle === key ? 'selected' : ''}" data-style="${key}"><strong>${info[0]}</strong><small>${info[1]}</small></button>`).join('')}
    </div>
    <span class="section-label">Direction</span>
    <div class="pitch-picker">
      ${Object.entries(DIR_LABELS).map(([key, label]) => `<button class="direction-btn ${selectedDirection === key ? 'selected' : ''}" data-dir="${key}">${label}</button>`).join('')}
    </div>
    <button id="lockBatBtn" class="primary-btn lock-btn" ${selectedStyle && selectedDirection ? '' : 'disabled'}>Lock shot</button>`;

  controlsPanel.querySelectorAll('.style-choice').forEach(btn => btn.addEventListener('click', () => {
    unlockAudio(); SFX.tap();
    selectedStyle = btn.dataset.style;
    renderControls();
  }));
  controlsPanel.querySelectorAll('.direction-btn').forEach(btn => btn.addEventListener('click', () => {
    unlockAudio(); SFX.tap();
    selectedDirection = btn.dataset.dir;
    renderControls();
  }));
  $('lockBatBtn').addEventListener('click', () => {
    if (!selectedStyle || !selectedDirection) return;
    unlockAudio(); SFX.tap();
    socket.emit('lock-bat', { style: selectedStyle, direction: selectedDirection }, response => { if (!response?.ok) showToast(response?.error || 'Could not lock shot.'); });
  });
}

function renderCommentary() {
  const list = $('commentaryList');
  if (!state.ballLog.length) {
    list.innerHTML = `<div class="empty-commentary">The first delivery will appear here.</div>`;
    return;
  }
  list.innerHTML = [...state.ballLog].reverse().map(entry => {
    const outcomeClass = entry.wicket ? 'style="color:var(--red)"' : (entry.boundary ? 'style="color:var(--gold)"' : entry.extraType ? 'style="color:#8cecff"' : '');
    const label = entry.legalBall === false ? `${entry.innings}.${entry.ball}*` : `${entry.innings}.${entry.ball}`;
    const detail = `${DELIVERY_LABELS[entry.delivery] || entry.delivery} · ${STYLE_INFO[entry.style]?.[0] || entry.style} · ${DIR_LABELS[entry.direction] || entry.direction}${entry.dismissalType ? ` · ${entry.dismissalType.toUpperCase()}` : ''}`;
    return `<div class="commentary-item ${entry.extraType ? 'extra-row' : ''}">
      <div class="ball-number">${esc(label)}</div>
      <div class="commentary-copy"><b>${esc(entry.text)}</b><span>${esc(detail)}</span></div>
      <div class="outcome-badge" ${outcomeClass}>${esc(entry.outcome)}</div>
    </div>`;
  }).join('');
}

function clearTrail() {
  shotTrail.className = 'shot-trail';
  shotTrail.style.width = '0px';
  shotTrail.style.left = '0px';
  shotTrail.style.top = '0px';
  shotTrail.style.transform = 'translateY(-50%) rotate(0deg)';
}
function clearImpact() { impactPulse.className = 'impact-pulse'; }

function resetAnimationSurface() {
  animationToken += 1;
  bowlerAvatar.classList.remove('runup');
  batterAvatar.classList.remove('ready', 'swing', 'lbw');
  stumpsTop.classList.remove('hit');
  stumpsBottom.classList.remove('hit');
  fielderSprite.classList.remove('show', 'catch');
  clearTrail();
  clearImpact();
  ballSprite.getAnimations().forEach(a => a.cancel());
  ballSprite.classList.remove('live', 'sixer');
  ballSprite.style.opacity = '0';
  cinematicOverlay.className = 'cinematic-overlay';
  moveBallInstant(50, 14);
}

function moveBallInstant(x, y) {
  ballSprite.style.transition = 'none';
  ballSprite.style.left = `${x}%`;
  ballSprite.style.top = `${y}%`;
  void ballSprite.offsetWidth;
}

function moveBallTo(x, y, duration = 450, easing = 'cubic-bezier(.2,.7,.2,1)') {
  ballSprite.style.transition = `left ${duration}ms ${easing}, top ${duration}ms ${easing}, opacity 120ms ease`;
  ballSprite.style.left = `${x}%`;
  ballSprite.style.top = `${y}%`;
}

function arcBallTo(start, end, duration = 860) {
  const midX = (start.x + end.x) / 2;
  const peakY = Math.max(5, Math.min(start.y, end.y) - 28);
  ballSprite.style.transition = 'none';
  ballSprite.animate([
    { left: `${start.x}%`, top: `${start.y}%`, transform: 'scale(1)' },
    { left: `${midX}%`, top: `${peakY}%`, transform: 'scale(.78)' },
    { left: `${end.x}%`, top: `${end.y}%`, transform: 'scale(.52)' }
  ], { duration, easing: 'cubic-bezier(.18,.8,.2,1)', fill: 'forwards' });
  setTimeout(() => { ballSprite.style.left = `${end.x}%`; ballSprite.style.top = `${end.y}%`; }, duration - 10);
}

function showImpactAt(x, y, wicket = false) {
  impactPulse.className = `impact-pulse active${wicket ? ' wicket' : ''}`;
  impactPulse.style.left = `calc(${x}% - 8px)`;
  impactPulse.style.top = `calc(${y}% - 8px)`;
}

function showTrailBetween(start, end, tone = '') {
  const rect = stadiumView.getBoundingClientRect();
  const startX = rect.width * start.x / 100;
  const startY = rect.height * start.y / 100;
  const endX = rect.width * end.x / 100;
  const endY = rect.height * end.y / 100;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 12);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  shotTrail.className = `shot-trail active${tone ? ` ${tone}` : ''}`;
  shotTrail.style.left = `${startX}px`;
  shotTrail.style.top = `${startY}px`;
  shotTrail.style.width = `${length}px`;
  shotTrail.style.transform = `translateY(-50%) rotate(${angle}deg)`;
}

function shotDestination(direction, outcome) {
  const base = FIELD_POSITIONS[direction] || FIELD_POSITIONS.straight;
  if (outcome === 6 || outcome === 'NB+6') return { x: base.x, y: Math.max(8, base.y - 8) };
  if (outcome === 4 || outcome === 'NB+4') return { x: base.x, y: base.y };
  const runs = typeof outcome === 'number' ? outcome : Number(String(outcome).split('+')[1]) || 0;
  const scale = runs >= 3 ? .82 : runs === 2 ? .58 : runs === 1 ? .34 : .18;
  return { x: 50 + ((base.x - 50) * scale), y: 70 + ((base.y - 70) * scale) };
}

function showCinematic(entry) {
  let toneClass = '';
  if (entry.wicket) toneClass = 'wicket';
  else if (entry.extraType) toneClass = 'extra';
  else if (entry.boundary) toneClass = 'boundary';

  cinematicKicker.textContent = entry.wicket ? 'WICKET' : entry.extraType ? 'EXTRA' : `BALL ${entry.innings}.${entry.ball}`;
  cinematicMain.textContent = outcomeLabel(entry);
  cinematicSub.textContent = entry.wicket ? `${entry.dismissalType?.toUpperCase() || 'OUT'} · ${DELIVERY_LABELS[entry.delivery] || entry.delivery}` : ballSummary(entry);
  cinematicOverlay.className = `cinematic-overlay${toneClass ? ` ${toneClass}` : ''}`;
  void cinematicOverlay.offsetWidth;
  cinematicOverlay.classList.add('show');
}

function playEntrySound(entry) {
  if (entry.extraType === 'no-ball' && entry.batRuns === 6) { SFX.six(); SFX.extra(); return; }
  if (entry.extraType === 'no-ball' && entry.batRuns === 4) { SFX.boundary(); SFX.extra(); return; }
  if (entry.extraType) { SFX.extra(); return; }
  if (entry.wicket) { SFX.wicket(); return; }
  if (entry.outcome === 6) { SFX.six(); return; }
  if (entry.outcome === 4) { SFX.boundary(); return; }
  if (entry.outcome > 0) SFX.bat();
  else SFX.ball();
}

function playTossAnimation(toss) {
  if (!toss) return;
  unlockAudio();
  tossResult.textContent = `${toss.coin}!`;
  tossSub.textContent = `${toss.winnerName} wins the toss and will bat first.`;
  animatedCoin.querySelector('span').textContent = toss.coin === 'Heads' ? 'H' : 'T';
  tossOverlay.classList.remove('show');
  void tossOverlay.offsetWidth;
  tossOverlay.classList.add('show');
  SFX.coin();
}

function caughtPoint(direction) {
  const base = FIELD_POSITIONS[direction] || FIELD_POSITIONS.cover;
  return { x: 50 + ((base.x - 50) * .58), y: 70 + ((base.y - 70) * .58) };
}

function playBallAnimation(entry, replay = false) {
  resetAnimationSurface();
  const entryBatter = state?.players?.find(p => p.id === entry.batterId);
  const entryBowler = state?.players?.find(p => p.id === entry.bowlerId);
  applyAvatarKits(entryBatter, entryBowler);
  const token = animationToken;
  const path = DELIVERY_PATHS[entry.delivery] || { midX: 50, midY: 44, impactX: 50, impactY: 70 };
  const start = { x: 50, y: 18 };
  const mid = { x: path.midX, y: path.midY };
  const impact = { x: path.impactX, y: path.impactY };
  const isNoBall = entry.extraType === 'no-ball';
  const isWide = entry.extraType === 'wide';
  const effectiveOutcome = isNoBall && entry.batRuns ? entry.batRuns : entry.outcome;
  const end = shotDestination(entry.direction, effectiveOutcome);

  setResultBadge(`${replay ? 'Replay · ' : ''}${DELIVERY_LABELS[entry.delivery] || entry.delivery}`, entry.extraType ? 'runs' : '');
  moveBallInstant(start.x, start.y);
  ballSprite.classList.add('live');
  ballSprite.style.opacity = '1';
  bowlerAvatar.classList.add('runup');
  SFX.ball();

  setTimeout(() => {
    if (token !== animationToken) return;
    if (!isWide) batterAvatar.classList.add('ready');
    moveBallTo(mid.x, mid.y, 430);
  }, 60);

  setTimeout(() => {
    if (token !== animationToken) return;
    moveBallTo(impact.x, impact.y, 420);
  }, 530);

  setTimeout(() => {
    if (token !== animationToken) return;
    if (!isWide) {
      batterAvatar.classList.add('swing');
      SFX.bat();
    }
    showImpactAt(impact.x, impact.y, !!entry.wicket);
  }, 970);

  setTimeout(() => {
    if (token !== animationToken) return;

    if (isWide) {
      const wideEnd = { x: Math.min(92, impact.x + 21), y: 76 };
      showTrailBetween(impact, wideEnd, '');
      moveBallTo(wideEnd.x, wideEnd.y, 420);
      setResultBadge(ballSummary(entry), 'runs');
      showCinematic(entry);
      playEntrySound(entry);
      return;
    }

    if (entry.wicket) {
      if (entry.dismissalType === 'bowled') {
        showTrailBetween(impact, { x: 50, y: 78 }, 'wicket');
        moveBallTo(50, 78, 210);
        stumpsBottom.classList.add('hit');
      } else if (entry.dismissalType === 'lbw') {
        batterAvatar.classList.add('lbw');
        moveBallTo(50, 72, 180);
        showImpactAt(50, 72, true);
      } else {
        const catchAt = caughtPoint(entry.direction);
        fielderSprite.style.left = `${catchAt.x}%`;
        fielderSprite.style.top = `${catchAt.y}%`;
        fielderSprite.classList.add('show');
        showTrailBetween(impact, catchAt, 'wicket');
        moveBallTo(catchAt.x, catchAt.y, 520);
        setTimeout(() => {
          if (token !== animationToken) return;
          fielderSprite.classList.add('catch');
          ballSprite.style.opacity = '0';
        }, 470);
      }
      setResultBadge(ballSummary(entry), 'wicket');
      showCinematic(entry);
      playEntrySound(entry);
      return;
    }

    if (isNoBall && !entry.batRuns) {
      const nbEnd = { x: 53, y: 78 };
      moveBallTo(nbEnd.x, nbEnd.y, 300);
      setResultBadge(ballSummary(entry), 'runs');
      showCinematic(entry);
      playEntrySound(entry);
      return;
    }

    if (effectiveOutcome === 6) {
      ballSprite.classList.add('sixer');
      showTrailBetween(impact, end, 'boundary');
      arcBallTo(impact, end, 940);
    } else {
      showTrailBetween(impact, end, (effectiveOutcome === 4) ? 'boundary' : '');
      moveBallTo(end.x, end.y, effectiveOutcome === 4 ? 640 : 470);
    }
    setResultBadge(ballSummary(entry), entry.boundary ? 'boundary' : entry.extraType ? 'runs' : resultTone(entry));
    showCinematic(entry);
    playEntrySound(entry);
  }, 1110);

  setTimeout(() => {
    if (token !== animationToken) return;
    bowlerAvatar.classList.remove('runup');
    batterAvatar.classList.remove('ready');
  }, 1600);

  setTimeout(() => {
    if (token !== animationToken) return;
    batterAvatar.classList.remove('swing', 'lbw');
    if (effectiveOutcome !== 6) ballSprite.style.opacity = '.15';
  }, 2250);
}

applyKitPicker();
updateSoundButton();
resetAnimationSurface();
