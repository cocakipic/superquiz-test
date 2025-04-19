let socket;
let pseudo = "";
let questions = [];
let current = 0;
let score = 0;
let isMultiplayer = false;

function startSolo() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  isMultiplayer = false;
  document.querySelector(".container").classList.add("hidden");
  document.getElementById("quiz").classList.remove("hidden");
  fetch('https://superquiz-test.onrender.com/questions')
    .then(res => res.json())
    .then(data => {
      questions = data.slice(0, 15);
      current = 0;
      score = 0;
      showQuestion();
    });
.catch(error => {
      console.error("Erreur lors du chargement des questions :", error);
    });
}
function goToMultiplayer() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  isMultiplayer = true;
  socket = io("https://superquiz-test.onrender.com");
  document.querySelector(".container").classList.add("hidden");
  document.getElementById("createJoin").classList.remove("hidden");
}

function createRoom() {
  socket.emit('createRoom', { pseudo });
}

function joinRoom() {
  const code = document.getElementById("roomCodeInput").value.toUpperCase();
  if (!code) return alert("Code de salle requis !");
  socket.emit('joinRoom', { pseudo, roomCode: code });
}

function showQuestion() {
  if (current >= questions.length) {
    document.getElementById("question").textContent = "Quiz terminé ! Score : " + score + "/15";
    document.getElementById("answerInput").style.display = "none";
    document.getElementById("buzzBtn").style.display = "none";
    return;
  }

  const q = questions[current];
  document.getElementById("question").textContent = q.question;
  document.getElementById("answerInput").value = "";
  document.getElementById("answerInput").style.display = "inline-block";
  if (!isMultiplayer) {
    document.getElementById("buzzBtn").style.display = "none";
  } else {
    document.getElementById("buzzBtn").style.display = "inline-block";
  }
}

function buzz() {
  if (socket) socket.emit("buzz", roomCode);
}

function submitAnswer() {
  const input = document.getElementById("answerInput").value.trim();
  const q = questions[current];
  const correct = normalize(input) === normalize(q.answer);

  if (!isMultiplayer) {
    if (correct) score++;
    current++;
    showQuestion();
  } else {
    socket.emit("answer", {
      roomCode,
      playerId: socket.id,
      isCorrect: correct
    });
    current++;
    showQuestion();
  }
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

socket?.on('roomCreated', code => {
  document.getElementById("createJoin").classList.add("hidden");
  document.getElementById("waiting").innerText = "Salle créée : " + code + " — En attente d'autres joueurs...";
  document.getElementById("waiting").classList.remove("hidden");
});

socket?.on('playersUpdate', players => {
  document.getElementById("waiting").innerText = "Joueurs : " + players.join(" & ");
});

socket?.on('startGame', () => {
  fetch('https://superquiz-test.onrender.com/questions')
    .then(res => res.json())
    .then(data => {
      questions = data.slice(0, 15);
      current = 0;
      document.getElementById("waiting").classList.add("hidden");
      document.getElementById("quiz").classList.remove("hidden");
      showQuestion();
    });
});

socket?.on("updateScores", players => {
  const table = document.getElementById("scoreTable");
  table.innerHTML = "";
  players.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${p.pseudo}</td><td>${p.score}</td>`;
    table.appendChild(row);
  });
});
