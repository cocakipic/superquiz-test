const express = require('express');
const cors = require("cors");
const app = express();              // ← Ici d'abord
app.use(cors());                    // ← Puis ici

const fs = require('fs');
const path = require('path');
const http = require('http');
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "*",                    // ← autorise les requêtes depuis n'importe où
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

app.get('/questions', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'questions.json'));
  const questions = JSON.parse(data);
  res.json(questions.sort(() => 0.5 - Math.random()));
});

const rooms = {};

io.on('connection', socket => {
  console.log('Nouvelle connexion : ' + socket.id);

  socket.on('createRoom', ({ pseudo }) => {
    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    rooms[roomCode] = {
      players: [{ id: socket.id, pseudo, score: 0 }],
      hostId: socket.id,
      started: false
    };
    
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', ({ pseudo, roomCode }) => {
    const room = rooms[roomCode];
    if (room && room.players.length < 8) {
      room.players.push({ id: socket.id, pseudo, score: 0 });
      socket.join(roomCode);
      io.to(roomCode).emit('playersUpdate', room.players.map(p => p.pseudo));
      if (room.players.length === 2) {
        io.to(roomCode).emit('startGame');
      }
    } else {
      socket.emit('roomError', 'Salle pleine ou inexistante.');
    }
  });

  socket.on('buzz', roomCode => {
    io.to(roomCode).emit('buzzed', socket.id);
  });

  socket.on('answer', ({ roomCode, playerId, isCorrect }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (player && isCorrect) {
      player.score += 1;
    }
    io.to(roomCode).emit('updateScores', room.players);
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

  socket.on('launchGame', roomCode => {
    const room = rooms[roomCode];
    if (room && socket.id === room.hostId) {
      io.to(roomCode).emit('startGame');
    }
  });



});



const PORT = 3000;
server.listen(PORT, () => console.log(`Serveur en ligne sur http://localhost:${PORT}`));