(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const views = { welcome: $('welcome'), exam: $('exam'), result: $('result') };
  const bank = window.QUESTION_BANK || [];
  const tracks = { mixed: 'Mixed data skills', sql: 'SQL', pandas: 'Pandas', numpy: 'NumPy', engineering: 'Data engineering', problem: 'Problem solving', python: 'Python fundamentals' };
  const levels = ['Foundation', 'Intermediate', 'Advanced'];
  let stream = null, active = false, warnings = 0, questionIndex = 0, questions = [], answers = [], reviewed = [], seconds = 30 * 60, tick = null, faceTimer = null, faceDetector = null, toastTimer = null, ended = false, fullscreenRequested = false, multipleFaceRuns = 0, currentTrack = 'mixed', currentLevel = 0;
  const readProgress = () => { try { return JSON.parse(localStorage.getItem('northstar-progress') || '{}'); } catch { return {}; } };
  function setView(view) { Object.values(views).forEach((node) => node.classList.add('hidden')); views[view].classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
  function showToast(message, kind = '') { const toast = $('toast'); toast.textContent = message; toast.className = `toast show ${kind}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.className = 'toast', 3400); }
  function refreshLevel() { const topic = $('topicSelect').value; const progress = readProgress(); const level = progress[topic]?.level ?? 0; $('levelBadge').innerHTML = `<span>${levels[level] || levels[0]}</span><small>ADAPTIVE · LOCAL TO THIS DEVICE</small>`; }
  function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { $('notice').textContent = 'Camera access requires HTTPS or localhost in a supported browser.'; $('notice').style.color = '#b34e43'; return; }
    $('cameraButton').disabled = true; $('cameraButton').textContent = 'Connecting…';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }).then((media) => {
      stream = media; $('preview').srcObject = stream; $('preview').classList.remove('hidden'); $('cameraPlaceholder').classList.add('hidden'); $('cameraLive').classList.add('visible'); $('cameraStatus').textContent = 'Ready'; $('cameraStatus').className = 'status ready'; $('cameraButton').classList.add('hidden'); $('notice').textContent = 'Camera ready. Enter your name and choose a track.'; $('notice').style.color = '#548264'; updateStartButton();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (active && !ended) addWarning('Camera feed stopped'); });
    }).catch((error) => { $('cameraButton').disabled = false; $('cameraButton').textContent = 'Try camera again'; $('notice').textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in browser settings to continue.' : 'Could not start the camera. Check that it is connected and try again.'; $('notice').style.color = '#b34e43'; });
  }
  function updateStartButton() { $('startButton').disabled = !($('nameInput').value.trim() && stream?.active); }
  function prepareQuestions() {
    currentTrack = $('topicSelect').value; const progress = readProgress(); currentLevel = progress[currentTrack]?.level ?? 0;
    let pool = bank.filter((item) => currentTrack === 'mixed' || item.topic === currentTrack);
    // Adaptive sessions favor the current level, then include other levels for variety.
    if (currentTrack !== 'mixed') {
      const preferred = pool.filter((item) => item.level === levels[currentLevel]);
      const remaining = shuffle(pool.filter((item) => item.level !== levels[currentLevel]));
      pool = [...shuffle(preferred), ...remaining];
    } else pool = shuffle(pool);
    questions = pool.slice(0, Math.min(10, pool.length)); answers = Array(questions.length).fill(null); reviewed = Array(questions.length).fill(false); questionIndex = 0;
  }
  function startAssessment() {
    if (!stream?.active || !$('nameInput').value.trim()) { $('notice').textContent = 'Enter your name and enable the camera first.'; return; }
    prepareQuestions(); if (!questions.length) { $('notice').textContent = 'Question bank unavailable. Reload the page and try again.'; return; }
    $('candidateLabel').textContent = $('nameInput').value.trim(); $('avatar').textContent = [...$('nameInput').value.trim()][0].toUpperCase(); $('examVideo').srcObject = stream; $('examCameraFallback').classList.add('hidden'); $('examTrack').textContent = tracks[currentTrack].toUpperCase(); $('examSubtitle').textContent = `${questions.length} original questions · ${levels[currentLevel]} adaptive level · explanations after each answer`;
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => { fullscreenRequested = true; }).catch(() => showToast('Fullscreen is unavailable. You can still continue.', 'warning'));
    active = true; setView('exam'); renderQuestion(); startFaceChecks(); tick = setInterval(countdown, 1000);
  }
  function countdown() { seconds--; const m = String(Math.floor(seconds / 60)).padStart(2, '0'), s = String(seconds % 60).padStart(2, '0'); $('timer').textContent = `${m}:${s}`; if (seconds <= 0) finish('time'); }
  function revealAnswer() {
    if (answers[questionIndex] === null) { showToast('Choose an answer first.', 'warning'); return false; }
    if (!reviewed[questionIndex]) { reviewed[questionIndex] = true; const item = questions[questionIndex]; const correct = answers[questionIndex] === item.correct; $('explanation').className = `explanation ${correct ? 'correct' : 'incorrect'}`; $('explanation').innerHTML = `<strong>${correct ? 'Correct — nice work.' : `Not quite. The answer is: ${item.a[item.correct]}`}</strong><p>${item.why}</p>`; $('savedLabel').textContent = 'Reasoning revealed · continue when ready'; }
    return true;
  }
  function renderQuestion() {
    const item = questions[questionIndex]; const isReviewed = reviewed[questionIndex];
    $('questionCount').innerHTML = `QUESTION ${String(questionIndex + 1).padStart(2, '0')} <span>/ ${questions.length}</span>`; $('progressBar').style.width = `${(questionIndex + 1) / questions.length * 100}%`; $('questionText').textContent = item.q; $('questionLevel').textContent = item.level.toUpperCase();
    if (item.code) { $('questionCode').textContent = item.code; $('questionCode').classList.remove('hidden'); } else { $('questionCode').classList.add('hidden'); $('questionCode').textContent = ''; }
    $('answers').replaceChildren(); item.a.forEach((answer, index) => { const label = document.createElement('label'); label.className = `answer${answers[questionIndex] === index ? ' selected' : ''}${isReviewed && index === item.correct ? ' answer-correct' : ''}${isReviewed && answers[questionIndex] === index && index !== item.correct ? ' answer-incorrect' : ''}`; const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = index; input.checked = answers[questionIndex] === index; input.disabled = isReviewed; input.addEventListener('change', () => { answers[questionIndex] = index; renderQuestion(); }); const text = document.createElement('span'); text.textContent = answer; label.append(input, text); $('answers').append(label); });
    if (isReviewed) { const correct = answers[questionIndex] === item.correct; $('explanation').className = `explanation ${correct ? 'correct' : 'incorrect'}`; $('explanation').innerHTML = `<strong>${correct ? 'Correct — nice work.' : `Not quite. The answer is: ${item.a[item.correct]}`}</strong><p>${item.why}</p>`; $('savedLabel').textContent = 'Reasoning revealed · continue when ready'; } else { $('explanation').className = 'explanation hidden'; $('savedLabel').textContent = 'Choose an answer to reveal the reasoning'; }
    $('prevButton').disabled = questionIndex === 0; $('nextButton').innerHTML = isReviewed ? (questionIndex === questions.length - 1 ? 'Finish test <span>✓</span>' : 'Next question <span>→</span>') : 'Check answer <span>✓</span>';
  }
  function addWarning(reason) {
    if (!active || ended) return; warnings++; $('warningCount').innerHTML = `${warnings} <small>/ 5</small>`; $('warningPips').querySelectorAll('i').forEach((pip, i) => { pip.className = i < warnings ? (warnings >= 4 ? 'danger' : 'on') : ''; }); $('lastEvent').classList.remove('hidden'); $('lastEventText').textContent = reason; showToast(`Warning ${warnings} of 5: ${reason}`, warnings >= 5 ? 'danger' : 'warning'); if (warnings >= 5) finish('integrity');
  }
  function startFaceChecks() {
    if (typeof window.FaceDetector !== 'function') { $('faceMessage').textContent = 'Face detection is not supported in this browser'; return; }
    try { faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }); } catch { $('faceMessage').textContent = 'Face detection is unavailable'; return; }
    $('faceMessage').textContent = 'Checking for one face in frame';
    faceTimer = setInterval(async () => { if (!active || ended || $('examVideo').readyState < 2) return; try { const faces = await faceDetector.detect($('examVideo')); if (faces.length > 1) { multipleFaceRuns++; $('faceMessage').textContent = 'Multiple faces detected — session ending'; if (multipleFaceRuns >= 2) finish('multiple-faces'); } else { multipleFaceRuns = 0; $('faceMessage').textContent = faces.length === 1 ? 'One face in view' : 'No face detected — return to camera view'; } } catch { $('faceMessage').textContent = 'Face detection unavailable'; clearInterval(faceTimer); } }, 4000);
  }
  function finish(reason) {
    if (ended) return; ended = true; active = false; clearInterval(tick); clearInterval(faceTimer); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); stream?.getTracks().forEach((track) => track.stop()); setView('result');
    const correctCount = answers.reduce((n, answer, i) => n + (answer === questions[i].correct ? 1 : 0), 0); const integrity = reason === 'integrity' || reason === 'multiple-faces';
    $('resultIcon').className = `result-icon${integrity ? ' failed' : ''}`; $('resultIcon').textContent = integrity ? '!' : '✓'; $('resultTitle').textContent = integrity ? 'Session ended' : reason === 'manual' ? 'Test ended' : reason === 'time' ? 'Time is up' : 'Practice complete';
    $('resultMessage').textContent = integrity ? (reason === 'multiple-faces' ? 'Repeated multiple-face detections ended this session.' : 'The session reached five integrity warnings and was ended.') : 'Review your score and the explanations to reinforce what you learned.';
    $('resultSummary').innerHTML = `<div><strong>${correctCount}/${questions.length}</strong><span>Correct answers</span></div><div><strong>${Math.round(correctCount / questions.length * 100)}%</strong><span>Score</span></div><div><strong>${warnings}/5</strong><span>Integrity warnings</span></div>`;
    const progress = readProgress(); let moved = false; let next = currentLevel;
    if (!integrity && reason !== 'manual' && questions.length) { if (correctCount / questions.length >= .8 && next < levels.length - 1) { next++; moved = true; } else if (correctCount / questions.length < .4 && next > 0) { next--; moved = true; } progress[currentTrack] = { level: next, best: Math.max(progress[currentTrack]?.best || 0, correctCount / questions.length), tests: (progress[currentTrack]?.tests || 0) + 1 }; try { localStorage.setItem('northstar-progress', JSON.stringify(progress)); } catch { /* Learning state is optional when browser storage is unavailable. */ } }
    $('nextLevel').classList.toggle('hidden', integrity || !questions.length); $('nextLevel').textContent = integrity ? '' : moved ? `Adaptive level updated: ${levels[next]}. Your progress stays on this device.` : `Current adaptive level: ${levels[next]}. Score 80% to advance; revisit foundations if you score below 40%.`;
  }
  $('cameraButton').addEventListener('click', enableCamera); $('nameInput').addEventListener('input', updateStartButton); $('topicSelect').addEventListener('change', refreshLevel); $('startButton').addEventListener('click', startAssessment);
  $('nextButton').addEventListener('click', () => { if (!reviewed[questionIndex]) { if (!revealAnswer()) return; if (questionIndex === questions.length - 1) $('nextButton').innerHTML = 'Finish test <span>✓</span>'; return; } if (questionIndex < questions.length - 1) { questionIndex++; renderQuestion(); } else finish('submit'); }); $('prevButton').addEventListener('click', () => { if (questionIndex > 0) { questionIndex--; renderQuestion(); } }); $('endButton').addEventListener('click', () => finish('manual'));
  document.addEventListener('visibilitychange', () => { if (active && document.hidden) addWarning('Assessment tab left'); }); document.addEventListener('fullscreenchange', () => { if (active && fullscreenRequested && !document.fullscreenElement) { fullscreenRequested = false; addWarning('Fullscreen exited'); } });
  $('restartButton').addEventListener('click', () => { ended = false; active = false; warnings = 0; seconds = 30 * 60; $('startButton').disabled = true; $('startButton').innerHTML = 'Run system check <span>→</span>'; $('cameraButton').classList.remove('hidden'); $('cameraButton').disabled = false; $('cameraButton').textContent = 'Enable camera'; $('cameraStatus').textContent = 'Required'; $('cameraStatus').className = 'status pending'; $('cameraLive').classList.remove('visible'); $('preview').srcObject = null; $('preview').classList.add('hidden'); $('cameraPlaceholder').classList.remove('hidden'); stream = null; refreshLevel(); setView('welcome'); }); $('policyLink').addEventListener('click', (event) => { event.preventDefault(); $('rulesModal').classList.remove('hidden'); }); $('closeModal').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('ackRules').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('rulesModal').addEventListener('click', (event) => { if (event.target === $('rulesModal')) $('rulesModal').classList.add('hidden'); });
  refreshLevel();
})();
