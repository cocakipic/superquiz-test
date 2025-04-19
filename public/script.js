let socket = io();
let roomCode = "";
let pseudo = "";
let playerId = "";
let isMyTurn = false;
let questions = [];
let current = 0;

function startSolo() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entrez un pseudo !");
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("createJoin").classList.remove("hidden");
}

function createRoom() {
  socket.emit('createRoom', { pseudo });
}

function joinRoom() {
  const code = document.getElementById("roomCodeInput").value.toUpperCase();
  if (!code) return alert("Entrez un code de salle.");
  socket.emit('joinRoom', { pseudo, roomCode: code });
}

socket.on('roomCreated', code => {
  roomCode = code;
  document.getElementById("createJoin").classList.add("hidden");
  document.getElementById("waiting").innerText = "Salle créée : " + code + " — En attente d'un autre joueur...";
  document.getElementById("waiting").classList.remove("hidden");
});

socket.on('playersUpdate', players => {
  document.getElementById("waiting").innerText = "Joueurs dans la salle : " + players.join(" & ");
});

socket.on('startGame', () => {
  fetch('/questions')
    .then(res => res.json())
    .then(data => {
      questions = data.slice(0, 15);
      document.getElementById("waiting").classList.add("hidden");
      document.getElementById("quiz").classList.remove("hidden");
      showQuestion();
    });
});

function showQuestion() {
  if (current >= questions.length) {
    document.getElementById("question").textContent = "Quiz terminé !";
    document.getElementById("answerInput").style.display = "none";
    return;
  }
  const q = questions[current];
  document.getElementById("question").textContent = q.question;
  document.getElementById("answerInput").value = "";
}

function buzz() {
  socket.emit("buzz", roomCode);
}

socket.on("buzzed", id => {
  if (id === socket.id) {
    isMyTurn = true;
    alert("À toi de répondre !");
  } else {
    isMyTurn = false;
    alert("L'autre joueur répond.");
  }
});

function submitAnswer() {
  if (!isMyTurn) return alert("Ce n'est pas à toi de répondre !");
  const input = document.getElementById("answerInput").value.trim();
  const q = questions[current];
  const correct = normalize(input) === normalize(q.answer);
  socket.emit("answer", { roomCode, playerId: socket.id, isCorrect: correct });
  current++;
  showQuestion();
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

socket.on("updateScores", players => {
  let scoreTxt = players.map(p => p.pseudo + " : " + p.score).join(" | ");
  document.getElementById("score").textContent = scoreTxt;
});
