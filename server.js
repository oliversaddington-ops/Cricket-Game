const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false }
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'six-ball-showdown', version: '3.0.0' }));

const { BOWLER_TYPES, VALID_STYLES, VALID_DIRECTIONS, VALID_KITS, simulateDelivery, resultDescription } = require('./gameLogic');

function sanitizeName(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 20) || 'Player';
}

function sanitizeKit(value) {
  return VALID_KITS.includes(value) ? value : 'royal';
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeToken() {
  return crypto.randomBytes(18).toString('hex');
}

function blankGame() {
  return {
    phase: 'lobby',
    toss: null,
    innings: 0,
    battingPlayerId: null,
    bowlingPlayerId: null,
    selectedBowlerType: null,
    ball: 1,
    scores: {},
    wickets: {},
    extras: {},
    ballLog: [],
    deliverySeq: 0,
    pending: { bowl: null, bat: null },
    winnerId: null,
    resultText: null
  };
}

function roomForSocket(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}

function playerBySocket(room, socket) {
  return room.players.find(p => p.id === socket.data.playerId);
}

function publicRoomState(room, viewerId = null) {
  const g = room.game;
  const viewer = room.players.find(p => p.id === viewerId);
  const opponent = room.players.find(p => p.id !== viewerId);
  const battingPlayer = room.players.find(p => p.id === g.battingPlayerId);
  const bowlingPlayer = room.players.find(p => p.id === g.bowlingPlayerId);
  const viewerIsBatting = viewerId && viewerId === g.battingPlayerId;
  const viewerIsBowling = viewerId && viewerId === g.bowlingPlayerId;

  return {
    roomCode: room.code,
    players: room.players.map(p => ({ id: p.id, name: p.name, kit: p.kit, connected: !!p.socketId })),
    you: viewer ? { id: viewer.id, name: viewer.name, kit: viewer.kit } : null,
    opponent: opponent ? { id: opponent.id, name: opponent.name, kit: opponent.kit, connected: !!opponent.socketId } : null,
    phase: g.phase,
    toss: g.toss,
    innings: g.innings,
    battingPlayer: battingPlayer ? { id: battingPlayer.id, name: battingPlayer.name, kit: battingPlayer.kit } : null,
    bowlingPlayer: bowlingPlayer ? { id: bowlingPlayer.id, name: bowlingPlayer.name, kit: bowlingPlayer.kit } : null,
    viewerRole: viewerIsBatting ? 'batting' : viewerIsBowling ? 'bowling' : null,
    selectedBowlerType: g.selectedBowlerType,
    selectedBowlerLabel: g.selectedBowlerType ? BOWLER_TYPES[g.selectedBowlerType]?.label : null,
    availableDeliveries: viewerIsBowling && g.selectedBowlerType ? BOWLER_TYPES[g.selectedBowlerType].deliveries : [],
    ball: g.ball,
    scores: g.scores,
    wickets: g.wickets,
    extras: g.extras,
    ballLog: g.ballLog,
    yourLocked: viewerIsBatting ? !!g.pending.bat : viewerIsBowling ? !!g.pending.bowl : false,
    opponentLocked: viewerIsBatting ? !!g.pending.bowl : viewerIsBowling ? !!g.pending.bat : false,
    winnerId: g.winnerId,
    resultText: g.resultText
  };
}

function emitRoom(room) {
  room.players.forEach(player => {
    if (!player.socketId) return;
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) socket.emit('state', publicRoomState(room, player.id));
  });
}

function startGame(room) {
  const [p1, p2] = room.players;
  const tossWinner = crypto.randomInt(0, 2) === 0 ? p1 : p2;
  const tossLoser = tossWinner.id === p1.id ? p2 : p1;
  const coin = crypto.randomInt(0, 2) === 0 ? 'Heads' : 'Tails';

  room.game = blankGame();
  room.game.phase = 'choose-bowler';
  room.game.toss = {
    id: makeToken().slice(0, 10),
    coin,
    winnerId: tossWinner.id,
    winnerName: tossWinner.name,
    text: `${coin}! ${tossWinner.name} wins the toss and will bat first.`
  };
  room.game.innings = 1;
  room.game.battingPlayerId = tossWinner.id;
  room.game.bowlingPlayerId = tossLoser.id;
  room.game.scores[p1.id] = 0;
  room.game.scores[p2.id] = 0;
  room.game.wickets[p1.id] = 0;
  room.game.wickets[p2.id] = 0;
  room.game.extras[p1.id] = 0;
  room.game.extras[p2.id] = 0;
  room.game.ball = 1;
}

function resolveBall(room) {
  const g = room.game;
  if (!g.pending.bowl || !g.pending.bat) return;

  const { delivery } = g.pending.bowl;
  const { style, direction } = g.pending.bat;
  const result = simulateDelivery(delivery, style, direction);
  const battingId = g.battingPlayerId;
  const currentLegalBall = g.ball;
  g.deliverySeq += 1;

  g.scores[battingId] += result.scoreDelta;
  g.extras[battingId] += result.extras;
  if (result.wicket) g.wickets[battingId] += 1;

  const entry = {
    innings: g.innings,
    ball: currentLegalBall,
    deliverySeq: g.deliverySeq,
    legalBall: result.legalBall,
    batterId: battingId,
    bowlerId: g.bowlingPlayerId,
    delivery,
    style,
    direction,
    outcome: result.outcome,
    scoreDelta: result.scoreDelta,
    batRuns: result.batRuns,
    extras: result.extras,
    extraType: result.extraType,
    wicket: result.wicket,
    dismissalType: result.dismissalType,
    boundary: result.boundary,
    text: resultDescription(result, style, direction, delivery)
  };
  g.ballLog.push(entry);
  g.pending = { bowl: null, bat: null };

  // Wides and no-balls add runs but do not consume one of the six legal balls.
  if (!result.legalBall) {
    g.phase = 'playing';
    return;
  }

  if (g.ball >= 6) {
    if (g.innings === 1) {
      const oldBatter = g.battingPlayerId;
      g.innings = 2;
      g.battingPlayerId = g.bowlingPlayerId;
      g.bowlingPlayerId = oldBatter;
      g.selectedBowlerType = null;
      g.ball = 1;
      g.deliverySeq = 0;
      g.phase = 'innings-break';
      setTimeout(() => {
        const liveRoom = rooms.get(room.code);
        if (!liveRoom || liveRoom.game.phase !== 'innings-break') return;
        liveRoom.game.phase = 'choose-bowler';
        emitRoom(liveRoom);
      }, 2600);
    } else {
      g.phase = 'finished';
      const [p1, p2] = room.players;
      const s1 = g.scores[p1.id];
      const s2 = g.scores[p2.id];
      if (s1 > s2) {
        g.winnerId = p1.id;
        g.resultText = `${p1.name} wins by ${s1 - s2} run${s1 - s2 === 1 ? '' : 's'}!`;
      } else if (s2 > s1) {
        g.winnerId = p2.id;
        g.resultText = `${p2.name} wins by ${s2 - s1} run${s2 - s1 === 1 ? '' : 's'}!`;
      } else {
        g.winnerId = null;
        g.resultText = `It's a tie at ${s1} runs each!`;
      }
    }
  } else {
    g.ball += 1;
    g.phase = 'playing';
  }
}

io.on('connection', socket => {
  socket.on('create-room', ({ name, token, kit } = {}, ack = () => {}) => {
    try {
      const roomCode = makeRoomCode();
      const playerToken = token || makeToken();
      const player = { id: makeToken(), token: playerToken, name: sanitizeName(name), kit: sanitizeKit(kit), socketId: socket.id };
      const room = { code: roomCode, players: [player], game: blankGame(), createdAt: Date.now() };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = player.id;
      ack({ ok: true, roomCode, token: playerToken, playerId: player.id });
      emitRoom(room);
    } catch (error) {
      ack({ ok: false, error: 'Could not create room.' });
    }
  });

  socket.on('join-room', ({ roomCode, name, token, kit } = {}, ack = () => {}) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: 'Room not found. Check the code.' });

    // Reconnect existing player by token.
    if (token) {
      const existing = room.players.find(p => p.token === token);
      if (existing) {
        existing.socketId = socket.id;
        socket.join(code);
        socket.data.roomCode = code;
        socket.data.playerId = existing.id;
        ack({ ok: true, roomCode: code, token: existing.token, playerId: existing.id, reconnected: true });
        emitRoom(room);
        return;
      }
    }

    if (room.players.length >= 2) return ack({ ok: false, error: 'This room already has two players.' });

    const playerToken = token || makeToken();
    const player = { id: makeToken(), token: playerToken, name: sanitizeName(name), kit: sanitizeKit(kit), socketId: socket.id };
    room.players.push(player);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerId = player.id;
    startGame(room);
    ack({ ok: true, roomCode: code, token: playerToken, playerId: player.id });
    emitRoom(room);
  });

  socket.on('reconnect-room', ({ roomCode, token } = {}, ack = () => {}) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    const player = room?.players.find(p => p.token === token);
    if (!room || !player) return ack({ ok: false });
    player.socketId = socket.id;
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerId = player.id;
    ack({ ok: true, roomCode: code, playerId: player.id });
    emitRoom(room);
  });

  socket.on('choose-bowler-type', ({ type } = {}, ack = () => {}) => {
    const room = roomForSocket(socket);
    if (!room) return ack({ ok: false, error: 'Room unavailable.' });
    const g = room.game;
    if (g.phase !== 'choose-bowler') return ack({ ok: false, error: 'Not ready for bowler selection.' });
    if (socket.data.playerId !== g.bowlingPlayerId) return ack({ ok: false, error: 'Only the bowler can choose the bowling type.' });
    if (!BOWLER_TYPES[type]) return ack({ ok: false, error: 'Invalid bowler type.' });
    g.selectedBowlerType = type;
    g.phase = 'playing';
    ack({ ok: true });
    emitRoom(room);
  });

  socket.on('lock-bowl', ({ delivery } = {}, ack = () => {}) => {
    const room = roomForSocket(socket);
    if (!room) return ack({ ok: false, error: 'Room unavailable.' });
    const g = room.game;
    if (g.phase !== 'playing') return ack({ ok: false, error: 'That ball is not active.' });
    if (socket.data.playerId !== g.bowlingPlayerId) return ack({ ok: false, error: 'You are not bowling.' });
    if (g.pending.bowl) return ack({ ok: false, error: 'Delivery already locked.' });
    const allowed = BOWLER_TYPES[g.selectedBowlerType]?.deliveries || [];
    if (!allowed.includes(delivery)) return ack({ ok: false, error: 'That delivery is not available for this bowler.' });
    g.pending.bowl = { delivery };
    ack({ ok: true });
    resolveBall(room);
    emitRoom(room);
  });

  socket.on('lock-bat', ({ style, direction } = {}, ack = () => {}) => {
    const room = roomForSocket(socket);
    if (!room) return ack({ ok: false, error: 'Room unavailable.' });
    const g = room.game;
    if (g.phase !== 'playing') return ack({ ok: false, error: 'That ball is not active.' });
    if (socket.data.playerId !== g.battingPlayerId) return ack({ ok: false, error: 'You are not batting.' });
    if (g.pending.bat) return ack({ ok: false, error: 'Shot already locked.' });
    if (!VALID_STYLES.includes(style) || !VALID_DIRECTIONS.includes(direction)) {
      return ack({ ok: false, error: 'Choose a valid shot and direction.' });
    }
    g.pending.bat = { style, direction };
    ack({ ok: true });
    resolveBall(room);
    emitRoom(room);
  });

  socket.on('rematch', (_payload, ack = () => {}) => {
    const room = roomForSocket(socket);
    if (!room || room.players.length !== 2) return ack({ ok: false, error: 'Both players are required.' });
    if (room.game.phase !== 'finished') return ack({ ok: false, error: 'Finish the current match first.' });
    startGame(room);
    ack({ ok: true });
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    const room = roomForSocket(socket);
    if (!room) return;
    const player = playerBySocket(room, socket);
    if (player && player.socketId === socket.id) player.socketId = null;
    emitRoom(room);
  });
});

// Clear abandoned rooms after 4 hours.
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.createdAt < cutoff && room.players.every(p => !p.socketId)) rooms.delete(code);
  }
}, 30 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Mobile Cricket Duel listening on port ${PORT}`);
  });
}

module.exports = { server };
