const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// In-memory state: roomId -> room data
const rooms = new Map();

// --- Utility ---

function generateRoomId() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id;
    do {
        id = '';
        for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    } while (rooms.has(id));
    return id;
}

function generateSessionId() {
    return 'sess-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function send(ws, data) {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

function broadcastToPlayers(room, data) {
    const msg = JSON.stringify(data);
    for (const player of room.players.values()) {
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(msg);
        }
    }
}

function getConnectedPlayerCount(room) {
    let count = 0;
    for (const p of room.players.values()) {
        if (p.isConnected) count++;
    }
    return count;
}

// --- HTTP Server (health check) ---

const httpServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end();
});

// --- WebSocket Server ---

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case 'create_room': handleCreateRoom(ws, msg); break;
            case 'reconnect_host': handleReconnectHost(ws, msg); break;
            case 'restore_room': handleRestoreRoom(ws, msg); break;
            case 'join': handleJoin(ws, msg); break;
            case 'submit_answer': handleSubmitAnswer(ws, msg); break;
            case 'start_question': handleStartQuestion(ws, msg); break;
            case 'send_results': handleSendResults(ws, msg); break;
            case 'terminate': handleTerminate(ws, msg); break;
        }
    });

    ws.on('close', () => handleDisconnect(ws));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
});

// --- Handlers ---

function handleCreateRoom(ws, msg) {
    const roomId = generateRoomId();
    const hostSessionId = generateSessionId();

    rooms.set(roomId, {
        hostWs: ws,
        hostSessionId: hostSessionId,
        players: new Map(),
        createdAt: Date.now(),
        hostDisconnectTimer: null
    });

    ws.roomId = roomId;
    ws.sessionId = hostSessionId;
    ws.role = 'host';

    send(ws, { type: 'room_created', roomId, sessionId: hostSessionId });
    console.log(`Room ${roomId} created by host ${hostSessionId}`);
}

function handleReconnectHost(ws, msg) {
    const roomId = (msg.roomId || '').toUpperCase();
    const room = rooms.get(roomId);

    // If room not found but host sends a session ID, they might be able to restore it
    if (!room) {
        if (msg.sessionId) {
            send(ws, { type: 'room_not_found_try_restore', roomId, sessionId: msg.sessionId });
            console.log(`Host tried to reconnect to missing room ${roomId}, suggesting restoration`);
        } else {
            send(ws, { type: 'error', message: 'Raum nicht gefunden.' });
        }
        return;
    }

    if (room.hostSessionId !== msg.sessionId) {
        send(ws, { type: 'error', message: 'Ungültige Session-ID für diesen Raum.' });
        return;
    }

    // Clear disconnect timer if pending
    if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = null;
    }

    room.hostWs = ws;
    ws.roomId = roomId;
    ws.sessionId = msg.sessionId;
    ws.role = 'host';

    // Send current room state back to host
    const playerList = [];
    for (const [sid, p] of room.players) {
        // Only send what's necessary
        playerList.push({
            sessionId: sid,
            name: p.name,
            score: p.score,
            isConnected: p.isConnected
        });
    }

    send(ws, { type: 'host_reconnected', roomId, players: playerList });
    console.log(`Host reconnected to room ${roomId}`);
}

function handleRestoreRoom(ws, msg) {
    // msg should contain: roomId, sessionId, gameState (optional players list etc.)
    const roomId = (msg.roomId || '').toUpperCase();
    const hostSessionId = msg.sessionId;

    if (!roomId || !hostSessionId) {
        send(ws, { type: 'error', message: 'Wiederherstellung fehlgeschlagen: Fehlende Daten.' });
        return;
    }

    if (rooms.has(roomId)) {
        // Room actually exists, maybe created by someone else or race condition?
        // Check if it matches this host
        const existingRoom = rooms.get(roomId);
        if (existingRoom.hostSessionId === hostSessionId) {
            // It's this host's room, just reconnect normally
            handleReconnectHost(ws, msg);
            return;
        } else {
            // Room ID taken by someone else (unlikely with random IDs but possible)
            send(ws, { type: 'error', message: 'Raum-ID bereits vergeben. Bitte neues Quiz starten.' });
            return;
        }
    }

    // Re-create the room
    const room = {
        hostWs: ws,
        hostSessionId: hostSessionId,
        players: new Map(),
        createdAt: Date.now(),
        hostDisconnectTimer: null
    };

    // Restore players if provided
    if (msg.players && Array.isArray(msg.players)) {
        for (const p of msg.players) {
            // p: { id, name, score, ... }
            if (p.id && p.name) {
                room.players.set(p.id, {
                    name: p.name,
                    score: p.score || 0,
                    ws: null,       // WebSocket connection is lost, they must reconnect
                    isConnected: false
                });
            }
        }
    }

    rooms.set(roomId, room);

    ws.roomId = roomId;
    ws.sessionId = hostSessionId;
    ws.role = 'host';

    send(ws, { type: 'host_reconnected', roomId, players: msg.players || [], isRestored: true });
    console.log(`Room ${roomId} RESTORED by host ${hostSessionId}`);
}

function handleJoin(ws, msg) {
    const roomCode = (msg.roomCode || '').replace(/\s/g, '').toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
        send(ws, { type: 'error', message: 'Raum nicht gefunden.' });
        return;
    }

    let sessionId = msg.sessionId;
    let player = sessionId ? room.players.get(sessionId) : null;

    if (player) {
        // Reconnecting existing player
        player.ws = ws;
        player.isConnected = true;
        ws.sessionId = sessionId;
        ws.roomId = roomCode;
        ws.role = 'player';

        send(ws, { type: 'joined', sessionId, score: player.score, playerName: player.name, isReconnect: true });

        if (room.hostWs && room.hostWs.readyState === 1) {
            send(room.hostWs, {
                type: 'player_reconnected',
                sessionId,
                name: player.name,
                score: player.score,
                playerCount: getConnectedPlayerCount(room)
            });
        }
        console.log(`Player "${player.name}" reconnected to room ${roomCode}`);
    } else {
        // New player
        sessionId = generateSessionId();
        const name = msg.playerName || 'Spieler';
        player = { name, score: 0, ws, isConnected: true };
        room.players.set(sessionId, player);

        ws.sessionId = sessionId;
        ws.roomId = roomCode;
        ws.role = 'player';

        send(ws, { type: 'joined', sessionId, score: 0, playerName: name, isReconnect: false });

        if (room.hostWs && room.hostWs.readyState === 1) {
            send(room.hostWs, {
                type: 'player_joined',
                sessionId,
                name,
                playerCount: getConnectedPlayerCount(room)
            });
        }
        console.log(`Player "${name}" joined room ${roomCode} (${getConnectedPlayerCount(room)} players)`);
    }
}

function handleSubmitAnswer(ws, msg) {
    const room = rooms.get(ws.roomId);
    if (!room) return;

    const player = room.players.get(ws.sessionId);
    if (!player) return;

    if (room.hostWs && room.hostWs.readyState === 1) {
        send(room.hostWs, {
            type: 'player_answered',
            sessionId: ws.sessionId,
            name: player.name,
            answerData: msg.answerData,
            answerTime: msg.answerTime
        });
    }
}

function handleStartQuestion(ws, msg) {
    const room = rooms.get(ws.roomId);
    if (!room || ws.role !== 'host') return;

    // Relay to all players, stripping correct answers for security
    broadcastToPlayers(room, {
        type: 'question',
        question: msg.question,
        options: msg.options,
        index: msg.index,
        total: msg.total,
        startTime: msg.startTime,
        duration: msg.duration
    });
}

function handleSendResults(ws, msg) {
    const room = rooms.get(ws.roomId);
    if (!room || ws.role !== 'host') return;

    // Update stored scores from host
    if (msg.playerScores) {
        for (const [sid, score] of Object.entries(msg.playerScores)) {
            const player = room.players.get(sid);
            if (player) player.score = score;
        }
    }

    // Send personalized results to each player
    for (const [sid, player] of room.players) {
        if (player.ws && player.ws.readyState === 1) {
            send(player.ws, {
                type: 'result',
                correct: msg.correct,
                isFinal: msg.isFinal,
                // options removed for security/bandwidth - client uses local copy
                leaderboard: msg.leaderboard,
                playerScore: player.score
            });
        }
    }
}

function handleTerminate(ws, msg) {
    const room = rooms.get(ws.roomId);
    if (!room || ws.role !== 'host') return;

    broadcastToPlayers(room, { type: 'quiz_terminated' });
    rooms.delete(ws.roomId);
    console.log(`Room ${ws.roomId} terminated by host`);
}

function handleDisconnect(ws) {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;

    if (ws.role === 'host') {
        room.hostWs = null;
        console.log(`Host disconnected from room ${ws.roomId}, grace period started`);

        // Grace period: terminate room if host doesn't reconnect within 5 minutes
        room.hostDisconnectTimer = setTimeout(() => {
            if (!room.hostWs) {
                broadcastToPlayers(room, { type: 'quiz_terminated' });
                rooms.delete(ws.roomId);
                console.log(`Room ${ws.roomId} terminated (host timeout)`);
            }
        }, 5 * 60 * 1000);
    } else if (ws.role === 'player') {
        const player = room.players.get(ws.sessionId);
        if (player) {
            player.isConnected = false;
            player.ws = null;

            if (room.hostWs && room.hostWs.readyState === 1) {
                send(room.hostWs, {
                    type: 'player_left',
                    sessionId: ws.sessionId,
                    name: player.name,
                    playerCount: getConnectedPlayerCount(room)
                });
            }
            console.log(`Player "${player.name}" disconnected from room ${ws.roomId}`);
        }
    }
}

// --- Heartbeat: detect dead connections ---

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// --- Room cleanup: remove stale rooms older than 2 hours ---

const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
        if (now - room.createdAt > 2 * 60 * 60 * 1000) {
            broadcastToPlayers(room, { type: 'quiz_terminated' });
            rooms.delete(id);
            console.log(`Room ${id} cleaned up (expired)`);
        }
    }
}, 60000);

// --- Graceful shutdown ---

process.on('SIGTERM', () => {
    clearInterval(heartbeatInterval);
    clearInterval(cleanupInterval);
    wss.close(() => {
        httpServer.close(() => {
            console.log('Server shut down gracefully');
            process.exit(0);
        });
    });
});

// --- Start ---

httpServer.listen(PORT, () => {
    console.log(`Qlash WebSocket server listening on port ${PORT}`);
});
