
let socket;
let pseudo = "";
let questions = [];
let current = 0;
let score = 0;
let isMultiplayer = false;
let roomCode = "";

function startSolo() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  isMultiplayer = false;
  document.querySelector(".container").classList.add("hidden");
  document.getElementById("quiz").classList.remove("hidden");

  fetch('https://superquiz-test.onrender.com/questions')
    .then(res => res.json())
    .then(data => {
      questions = data;
      current = 0;
      score = 0;
      showQuestion();
    });
}

function goToMultiplayer() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  isMultiplayer = true;
  socket = io("https://superquiz-test.onrender.com");

  socket.on("connect", () => {
    console.log("✅ Connecté au serveur Socket.IO");
  });

  socket.on('roomCreated', code => {
    roomCode = code;
    document.getElementById("createJoin").classList.add("hidden");
    document.getElementById("waitingMessage").innerText = "Salle créée : " + code + " — En attente d'autres joueurs...";
    document.getElementById("waiting").classList.remove("hidden");
    document.getElementById("launchBtn").classList.remove("hidden");
  });

  socket.on('playersUpdate', players => {
    document.getElementById("waitingMessage").innerText = "Joueurs : " + players.join(" & ");
  });

  socket.on('startGame', questionList => {
    questions = questionList;
    current = 0;
    score = 0;

    document.body.innerHTML = `
      <div id="quiz" class="container">
        <h2 id="question"></h2>
        <input type="text" id="answerInput" placeholder="Votre réponse">
        <button onclick="submitAnswer()">Valider</button>
      </div>
    `;
    showQuestion();
  });

  socket.on("updateScores", players => {
    document.body.innerHTML = `
      <div id="scoreBoard" class="container">
        <h2>🎉 Fin du quiz 🎉</h2>
        <table>
          <thead><tr><th>Joueur</th><th>Score</th></tr></thead>
          <tbody id="scoreTable"></tbody>
        </table>
      </div>
    `;
    const table = document.getElementById("scoreTable");
    table.innerHTML = "";
    players.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${p.pseudo}</td><td>${p.score}</td>`;
      table.appendChild(row);
    });
  });

  socket.on("showValidationPanel", answers => {
    const panel = document.createElement("div");
    panel.innerHTML = `<h2>Validation des réponses</h2>`;
    answers.forEach(({ playerId, pseudo, answerText }) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <p><strong>${pseudo}</strong> a répondu : "${answerText}"</p>
        <button onclick="validateAnswer('${playerId}', true)">✔️ Accepter</button>
        <button onclick="validateAnswer('${playerId}', false)">❌ Refuser</button>
      `;
      panel.appendChild(div);
    });
    const finalBtn = document.createElement("button");
    finalBtn.textContent = "Valider les scores";
    finalBtn.onclick = () => {
      socket.emit("showScores", roomCode);
    };
    panel.appendChild(finalBtn);
    document.body.innerHTML = "";
    document.body.appendChild(panel);
  });

  socket.on("roomJoined", code => {
    document.body.innerHTML = `
      <div class="container">
        <h2>Tu as rejoint la salle ${code}</h2>
        <p>En attente que l’hôte lance la partie…</p>
      </div>
    `;
  });

  document.querySelector(".container").classList.add("hidden");
  document.getElementById("createJoin").classList.remove("hidden");
}

function validateAnswer(playerId, isCorrect) {
  socket.emit("validateAnswer", { roomCode, playerId, isCorrect });
}

function createRoom() {
  socket.emit('createRoom', { pseudo });
}

function joinRoom() {
  const code = document.getElementById("roomCodeInput").value.toUpperCase();
  if (!code) return alert("Code de salle requis !");
  roomCode = code;
  socket.emit('joinRoom', { pseudo, roomCode: code });
}

function launchGame() {
  if (socket && roomCode) {
    socket.emit("launchGame", roomCode);
  }
}

function showQuestion() {
  if (current >= questions.length) {
    document.getElementById("question").textContent = "Quiz terminé ! En attente de validation...";
    document.getElementById("answerInput").style.display = "none";
    return;
  }

  const q = questions[current];
  document.getElementById("question").textContent = q.question;
  document.getElementById("answerInput").value = "";
}

function submitAnswer() {
  const input = document.getElementById("answerInput").value.trim();
  const q = questions[current];

  if (!isMultiplayer) {
    const correct = isAnswerCorrect(input, q.answer);
    if (correct) score++;
    current++;
    showQuestion();
  } else {
    socket.emit("answer", {
      roomCode,
      playerId: socket.id,
      answerText: input
    });
    current++;
    showQuestion();
  }
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function isAnswerCorrect(input, correctAnswer) {
  const cleanedInput = normalize(input);
  const cleanedCorrect = normalize(correctAnswer);
  if (cleanedInput === cleanedCorrect) return true;
  if (cleanedCorrect.includes(cleanedInput) || cleanedInput.includes(cleanedCorrect)) return true;
  return false;
}
