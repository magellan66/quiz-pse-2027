"use strict";

const CSV_PATH = "./questions.csv";
const STORAGE_KEY = "quiz-pse-best-scores-v1";

/*
 * Formule de démonstration :
 * 1000 points moins 10 points par seconde, avec un minimum de 1 point.
 * Une mauvaise réponse vaut 0.
 *
 * À adapter si tu préfères une autre formule.
 */
const POINTS_DEPART = 1000;
const POINTS_PAR_SECONDE = 10;
const POINTS_MINIMUM = 1;

const homeScreen = document.querySelector("#home-screen");
const quizScreen = document.querySelector("#quiz-screen");
const resultScreen = document.querySelector("#result-screen");
const startForm = document.querySelector("#start-form");
const pseudoInput = document.querySelector("#pseudo");
const loadStatus = document.querySelector("#load-status");
const loadError = document.querySelector("#load-error");
const playerLabel = document.querySelector("#player-label");

const questionCounter = document.querySelector("#question-counter");
const timerDisplay = document.querySelector("#timer");
const progressBar = document.querySelector("#progress-bar");
const questionText = document.querySelector("#question-text");
const answersElement = document.querySelector("#answers");
const feedback = document.querySelector("#feedback");
const nextButton = document.querySelector("#next-button");

const leaderboardBody = document.querySelector("#leaderboard-body");
const emptyLeaderboard = document.querySelector("#empty-leaderboard");

let allQuestions = [];
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentPseudo = "";
let currentCategory = 10;
let correctAnswers = 0;
let totalPoints = 0;
let questionStartedAt = 0;
let timerInterval = null;
let lastResult = null;

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ";" && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

function loadQuestions() {
  fetch(CSV_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Impossible de charger ${CSV_PATH} (${response.status}).`);
      }
      return response.text();
    })
    .then((text) => {
      const rows = parseSemicolonCsv(text.replace(/^\uFEFF/, ""));
      const dataRows = rows.slice(1);

      allQuestions = dataRows
        .filter((row) => row.length >= 6 && row[0].trim() && row[1].trim())
        .map((row) => ({
          question: row[0].trim(),
          correct: row[1].trim(),
          incorrect: row.slice(2, 5).map((answer) => answer.trim()).filter(Boolean),
          source: row[5].trim()
        }))
        .filter((item) => item.incorrect.length === 3);

      if (allQuestions.length === 0) {
        throw new Error("Aucune question valide n’a été trouvée dans le CSV.");
      }

      loadStatus.textContent = `${allQuestions.length} questions chargées.`;
      startForm.querySelector("button[type='submit']").disabled = false;
    })
    .catch((error) => {
      loadStatus.hidden = true;
      loadError.hidden = false;
      loadError.textContent =
        `${error.message} Vérifie que questions.csv est dans le même dossier que le site.`;
      startForm.querySelector("button[type='submit']").disabled = true;
    });
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function formatTime(milliseconds) {
  const centiseconds = Math.floor(milliseconds / 10);
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const fraction = centiseconds % 100;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function calculatePoints(milliseconds) {
  const elapsedSeconds = milliseconds / 1000;
  return Math.max(
    POINTS_MINIMUM,
    Math.floor(POINTS_DEPART - elapsedSeconds * POINTS_PAR_SECONDE)
  );
}

function startTimer() {
  clearInterval(timerInterval);
  questionStartedAt = performance.now();
  timerDisplay.textContent = "00:00.00";

  timerInterval = window.setInterval(() => {
    timerDisplay.textContent = formatTime(performance.now() - questionStartedAt);
  }, 10);
}

function startGame(pseudo, questionCount) {
  currentPseudo = pseudo;
  currentCategory = questionCount;
  currentQuestions = shuffle(allQuestions).slice(0, questionCount);
  currentQuestionIndex = 0;
  correctAnswers = 0;
  totalPoints = 0;

  playerLabel.textContent = `Joueur : ${currentPseudo}`;
  homeScreen.hidden = true;
  resultScreen.hidden = true;
  quizScreen.hidden = false;

  showQuestion();
}

function showQuestion() {
  const question = currentQuestions[currentQuestionIndex];
  const questionNumber = currentQuestionIndex + 1;

  questionCounter.textContent = `Question ${questionNumber} / ${currentQuestions.length}`;
  progressBar.style.width = `${(currentQuestionIndex / currentQuestions.length) * 100}%`;
  questionText.textContent = question.question;
  answersElement.replaceChildren();
  feedback.hidden = true;
  feedback.replaceChildren();
  nextButton.hidden = true;

  const choices = shuffle([
    { text: question.correct, correct: true },
    ...question.incorrect.map((text) => ({ text, correct: false }))
  ]);

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = choice.text;
    button.addEventListener("click", () => chooseAnswer(button, choice, question));
    answersElement.append(button);
  });

  startTimer();
}

function chooseAnswer(selectedButton, selectedChoice, question) {
  clearInterval(timerInterval);

  const elapsed = performance.now() - questionStartedAt;
  const gainedPoints = selectedChoice.correct ? calculatePoints(elapsed) : 0;

  if (selectedChoice.correct) {
    correctAnswers += 1;
    totalPoints += gainedPoints;
  }

  [...answersElement.children].forEach((button) => {
    button.disabled = true;
    if (button.textContent === question.correct) {
      button.classList.add("correct");
    }
  });

  if (!selectedChoice.correct) {
    selectedButton.classList.add("incorrect");
  }

  feedback.hidden = false;
  feedback.replaceChildren();

  const resultLine = document.createElement("strong");
  resultLine.textContent = selectedChoice.correct
    ? `Bonne réponse ! +${gainedPoints} points`
    : "Mauvaise réponse : 0 point";

  const sourceLine = document.createElement("p");
  sourceLine.textContent = `Source : ${question.source || "non renseignée"}`;

  feedback.append(resultLine, sourceLine);

  nextButton.textContent =
    currentQuestionIndex === currentQuestions.length - 1
      ? "Voir mon résultat"
      : "Question suivante";
  nextButton.hidden = false;
}

function getScores() {
  try {
    const scores = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(scores) ? scores : [];
  } catch {
    return [];
  }
}

function saveBestScore(result) {
  const scores = getScores();
  const existingIndex = scores.findIndex(
    (score) =>
      score.pseudo.toLocaleLowerCase("fr") === result.pseudo.toLocaleLowerCase("fr") &&
      score.category === result.category
  );

  const isNewBest =
    existingIndex === -1 || result.points > scores[existingIndex].points;

  if (isNewBest) {
    if (existingIndex !== -1) scores.splice(existingIndex, 1);
    scores.push(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  return isNewBest;
}

function renderLeaderboard() {
  const scores = getScores().sort(
    (a, b) => b.points - a.points || b.correct - a.correct
  );

  leaderboardBody.replaceChildren();
  emptyLeaderboard.hidden = scores.length > 0;

  scores.slice(0, 50).forEach((score) => {
    const row = document.createElement("tr");
    const values = [
      score.pseudo,
      `${score.category} questions`,
      `${score.correct} / ${score.category}`,
      score.points.toLocaleString("fr-FR")
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });

    leaderboardBody.append(row);
  });
}

function finishGame() {
  clearInterval(timerInterval);
  progressBar.style.width = "100%";

  lastResult = {
    pseudo: currentPseudo,
    category: currentCategory,
    correct: correctAnswers,
    points: totalPoints,
    completedAt: new Date().toISOString()
  };

  const isNewBest = saveBestScore(lastResult);

  quizScreen.hidden = true;
  resultScreen.hidden = false;
  document.querySelector("#result-pseudo").textContent = currentPseudo;
  document.querySelector("#result-summary").textContent =
    `${correctAnswers} bonne(s) réponse(s) sur ${currentCategory} — ${totalPoints.toLocaleString("fr-FR")} points.`;
  document.querySelector("#best-message").textContent = isNewBest
    ? "Nouveau meilleur score pour ce pseudo et cette catégorie !"
    : "Ton meilleur score pour cette catégorie reste inchangé.";

  renderLeaderboard();
}

startForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (allQuestions.length === 0) return;

  const pseudo = pseudoInput.value.trim().replace(/\s+/g, " ");
  const questionCount = Number(
    document.querySelector('input[name="question-count"]:checked').value
  );

  if (!pseudo) {
    pseudoInput.focus();
    return;
  }

  if (allQuestions.length < questionCount) {
    loadError.hidden = false;
    loadError.textContent =
      `Il n’y a que ${allQuestions.length} questions valides dans le CSV.`;
    return;
  }

  startGame(pseudo, questionCount);
});

nextButton.addEventListener("click", () => {
  currentQuestionIndex += 1;

  if (currentQuestionIndex >= currentQuestions.length) {
    finishGame();
  } else {
    showQuestion();
  }
});

document.querySelector("#replay-button").addEventListener("click", () => {
  startGame(currentPseudo, currentCategory);
});

document.querySelector("#home-button").addEventListener("click", () => {
  resultScreen.hidden = true;
  homeScreen.hidden = false;
  playerLabel.textContent = "Non connecté";
});

renderLeaderboard();
loadQuestions();
