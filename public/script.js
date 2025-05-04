
let socket;
let pseudo = "";
let roomCode = "";
let isMultiplayer = false;
let isHost = false;
let validatedCount = 0;

function startSolo() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  document.body.innerHTML = `
    <div class="container" id="quiz">
      <h2 id="question">Chargement...</h2>
      <input type="text" id="answerInput" placeholder="Votre réponse">
      <button onclick="submitAnswer()">Valider</button>
    </div>
  `;
  fetch('https://superquiz-test.onrender.com/questions')
    .then(res => res.json())
    .then(data => {
      window.questions = data;
      window.current = 0;
      window.score = 0;
      showQuestion();
    });
}

function goToMultiplayer() {
  pseudo = document.getElementById("pseudo").value;
  if (!pseudo) return alert("Entre ton pseudo !");
  isMultiplayer = true;
  socket = io("https://superquiz-test.onrender.com");

  socket.on("connect", () => console.log("✅ Connecté"));

  socket.on("roomCreated", code => {
    isHost = true;
    roomCode = code;
    document.body.innerHTML = `
      <div class="container" id="waiting">
        <h2>Salle ${code}</h2>
        <p id="waitingMessage">En attente d'autres joueurs...</p>
        <button onclick="launchGame()">Lancer le quiz</button>
      </div>
    `;
  });

  socket.on("roomJoined", code => {
    roomCode = code;
    document.body.innerHTML = `
      <div class="container"><h2>Tu as rejoint la salle ${code}</h2><p>En attente du lancement...</p></div>
    `;
  });

  socket.on("playersUpdate", players => {
    const msg = "Joueurs : " + players.join(", ");
    const el = document.getElementById("waitingMessage");
    if (el) el.innerText = msg;
  });

  socket.on("startGame", () => {
    document.body.innerHTML = `
      <div class="container" id="quiz">
        <h2 id="question">En attente de la question...</h2>
        <input type="text" id="answerInput" placeholder="Votre réponse">
        <button onclick="submitAnswer()">Valider</button>
      </div>
    `;
  });

  socket.on("showQuestionToAll", data => {
    const q = data.question;
    window.currentQuestion = q;
    const el = document.getElementById("question");
    if (el) el.innerText = `Question ${data.index} : ${q.question}`;
    const input = document.getElementById("answerInput");
    if (input) input.value = "";

    // Retirer bouton s'il existait
    const oldBtn = document.getElementById("nextBtn");
    if (oldBtn) oldBtn.remove();
  });

  socket.on("showValidationPanel", answers => {
    validatedCount = 0;
    const panel = document.createElement("div");
    panel.innerHTML = "<h2>Validation des réponses</h2>";
    answers.forEach(ans => {
      const block = document.createElement("div");
      block.innerHTML = `
        <p>${ans.pseudo} a répondu : "${ans.answerText}"</p>
        <button onclick="validateAnswer('${ans.playerId}', true, this)">✔️</button>
        <button onclick="validateAnswer('${ans.playerId}', false, this)">❌</button>
      `;
      panel.appendChild(block);
    });
    const container = document.createElement("div");
    container.id = "validationPanel";
    container.appendChild(panel);
    document.body.innerHTML = "";
    document.body.appendChild(container);
  });

  socket.on("updateScores", players => {
    document.body.innerHTML = `
      <div class="container">
        <h2>🎉 Fin du quiz 🎉</h2>
        <table><thead><tr><th>Joueur</th><th>Score</th></tr></thead><tbody id="scoreTable"></tbody></table>
      </div>
    `;
    const table = document.getElementById("scoreTable");
    players.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${p.pseudo}</td><td>${p.score}</td>`;
      table.appendChild(row);
    });
  });

  document.body.innerHTML = `
    <div class="container" id="createJoin">
      <h2>Multijoueur</h2>
      <button onclick="createRoom()">Créer une salle</button>
      <input type="text" id="roomCodeInput" placeholder="Code de salle">
      <button onclick="joinRoom()">Rejoindre</button>
    </div>
  `;
}

function createRoom() {
  socket.emit("createRoom", { pseudo });
}

function joinRoom() {
  const code = document.getElementById("roomCodeInput").value.toUpperCase();
  if (!code) return alert("Code requis !");
  socket.emit("joinRoom", { pseudo, roomCode: code });
}

function launchGame() {
  socket.emit("launchGame", roomCode);
}

function nextQuestion() {
  socket.emit("nextQuestion", roomCode);
}

function submitAnswer() {
  const input = document.getElementById("answerInput").value.trim();
  if (!isMultiplayer) {
    const q = questions[current];
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
  }
}

function showQuestion() {
  if (current >= questions.length) {
    document.getElementById("question").textContent = "Fin du quiz";
    return;
  }
  const q = questions[current];
  document.getElementById("question").textContent = q.question;
  document.getElementById("answerInput").value = "";
}

function validateAnswer(playerId, isCorrect, btn) {
  socket.emit("validateAnswer", { roomCode, playerId, isCorrect });
  btn.parentElement.style.opacity = 0.5;
  validatedCount++;

  if (validatedCount >= document.querySelectorAll("#validationPanel button").length / 2) {
    const nextBtn = document.createElement("button");
    nextBtn.id = "nextBtn";
    nextBtn.textContent = "Question suivante";
    nextBtn.onclick = nextQuestion;
    document.getElementById("validationPanel").appendChild(nextBtn);
  }
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function isAnswerCorrect(input, correctAnswer) {
  const a = normalize(input);
  const b = normalize(correctAnswer);
  return a === b || a.includes(b) || b.includes(a);
}
