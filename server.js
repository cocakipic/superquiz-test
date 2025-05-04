
const express = require('express');
const cors = require("cors");
const app = express();
app.use(cors({
  origin: "https://superquiz-test-ozsg-liv3qeebc-cocakipics-projects.vercel.app"
}));

const fs = require('fs');
const path = require('path');
const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "https://superquiz-test-ozsg-liv3qeebc-cocakipics-projects.vercel.app",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  transports: ["websocket"] // ⬅️ force WebSocket au lieu de fallback polling
});

app.use(express.static('public'));

app.get('/questions', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'questions.json'));
  const questions = JSON.parse(data);
  res.json(questions.sort(() => 0.5 - Math.random()).slice(0, 15));
});

const rooms = {};

io.on('connection', socket => {
  console.log('Nouvelle connexion : ' + socket.id);

  socket.on('createRoom', ({ pseudo }) => {
    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    rooms[roomCode] = {
      players: [{ id: socket.id, pseudo, score: 0 }],
      hostId: socket.id,
      started: false,
      pendingAnswers: [],
      questions: [],
      currentIndex: 0
    };
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', ({ pseudo, roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.players.length < 8) {
      room.players.push({ id: socket.id, pseudo, score: 0 });
      socket.join(roomCode);
      socket.emit('roomJoined', roomCode);
      io.to(roomCode).emit('playersUpdate', room.players.map(p => p.pseudo));
    } else {
      socket.emit('roomError', 'Salle pleine ou inexistante.');
    }
  });

  socket.on('launchGame', roomCode => {
    const room = rooms[roomCode];
    if (room && socket.id === room.hostId) {
      const data = fs.readFileSync(path.join(__dirname, 'questions.json'));
      const allQuestions = JSON.parse(data);
      room.questions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 15);
      room.currentIndex = 0;
      io.to(roomCode).emit('startGame');
    }
  });

  socket.on('nextQuestion', roomCode => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.hostId) return;
    if (room.currentIndex < room.questions.length) {
      const q = room.questions[room.currentIndex];
      room.pendingAnswers = []; // reset for new question
      io.to(roomCode).emit('showQuestionToAll', { question: q, index: room.currentIndex + 1 });
      room.currentIndex++;
    } else {
      io.to(room.hostId).emit('showValidationPanel', room.pendingAnswers);
    }
  });

  socket.on('answer', ({ roomCode, playerId, answerText }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const alreadyAnswered = room.pendingAnswers.some(p => p.playerId === playerId);
    if (alreadyAnswered) return;

    room.pendingAnswers.push({ playerId, pseudo: player.pseudo, answerText });

    if (room.pendingAnswers.length === room.players.length) {
      io.to(room.hostId).emit('showValidationPanel', room.pendingAnswers);
    }
  });

  socket.on('validateAnswer', ({ roomCode, playerId, isCorrect }) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.hostId) return;
    const player = room.players.find(p => p.id === playerId);
    if (player && isCorrect) {
      player.score += 1;
    }
    // Remove validated answer from pendingAnswers
    room.pendingAnswers = room.pendingAnswers.filter(r => r.playerId !== playerId);
  });

  socket.on('showScores', roomCode => {
    const room = rooms[roomCode];
    if (room) {
      io.to(roomCode).emit("updateScores", room.players);
    }
  });

  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        io.to(code).emit('playersUpdate', room.players.map(p => p.pseudo));
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Serveur en ligne sur http://localhost:${PORT}`));
