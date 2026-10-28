(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const views = { welcome: $('welcome'), exam: $('exam'), result: $('result') };
  const questions = [
    { q: 'Which practice most directly helps protect a user account from unauthorized access?', a: ['Reusing a familiar password', 'Using a unique password with multi-factor authentication', 'Sharing credentials with a teammate', 'Turning off sign-in notifications'], correct: 1 },
    { q: 'A colleague sends an unexpected link asking you to sign in. What is the safest first step?', a: ['Open it in a private window', 'Forward it to your team', 'Verify the request through a trusted channel', 'Reply with your username'], correct: 2 },
    { q: 'What does a strong data-minimization practice mean?', a: ['Collect only the information needed for a purpose', 'Keep every record forever', 'Share data with all teams', 'Store copies in personal email'], correct: 0 },
    { q: 'You notice a file containing sensitive information shared with the wrong person. What should you do?', a: ['Delete the notification', 'Report it promptly through the approved channel', 'Wait to see if they open it', 'Post about it publicly'], correct: 1 },
    { q: 'Which connection is generally safest for accessing a work account?', a: ['An unknown public hotspot', 'A trusted network with current security updates', 'Any network with a password', 'A network shared by strangers'], correct: 1 },
    { q: 'Why should software updates be installed promptly?', a: ['They always add new features', 'They can fix known security weaknesses', 'They remove the need for backups', 'They make passwords unnecessary'], correct: 1 },
    { q: 'What is the best response to a multi-factor prompt you did not initiate?', a: ['Approve it to clear the alert', 'Ignore it and report the unexpected request', 'Send the code to your manager', 'Disable multi-factor authentication'], correct: 1 },
    { q: 'Which is a good way to handle confidential information?', a: ['Use approved storage and share access only as needed', 'Save it to a public folder', 'Send it to a personal email account', 'Leave printed copies in a shared area'], correct: 0 },
    { q: 'You are unsure whether an email is legitimate. Which clue deserves extra attention?', a: ['A familiar logo', 'A sender address that does not match the organization', 'A polite greeting', 'A short subject line'], correct: 1 },
    { q: 'When stepping away from an unlocked workstation, what should you do?', a: ['Leave it open for convenience', 'Lock the screen', 'Ask a visitor to watch it', 'Close only the browser'], correct: 1 }
  ];
  let stream = null, active = false, warnings = 0, questionIndex = 0, answers = Array(questions.length).fill(null), seconds = 45 * 60, tick = null, faceTimer = null, faceDetector = null, lastFaceWarning = 0, toastTimer = null, ended = false, fullscreenRequested = false;
  function setView(view) { Object.values(views).forEach((node) => node.classList.add('hidden')); views[view].classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function showToast(message, kind = '') { const toast = $('toast'); toast.textContent = message; toast.className = `toast show ${kind}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.className = 'toast', 3400); }
  function faceSupported() { return typeof window.FaceDetector === 'function'; }
  function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { $('notice').textContent = 'Camera access requires HTTPS or localhost in a supported browser.'; $('notice').style.color = '#b34e43'; return; }
    $('cameraButton').disabled = true; $('cameraButton').textContent = 'Connecting…';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }).then((media) => {
      stream = media; $('preview').srcObject = stream; $('preview').classList.remove('hidden'); $('cameraPlaceholder').classList.add('hidden'); $('cameraLive').classList.add('visible'); $('cameraStatus').textContent = 'Ready'; $('cameraStatus').className = 'status ready'; $('cameraButton').classList.add('hidden'); $('notice').textContent = 'Camera ready. Enter your name to run the system check.'; $('notice').style.color = '#548264'; updateStartButton();
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (active && !ended) addWarning('Camera turned off'); });
    }).catch((error) => { $('cameraButton').disabled = false; $('cameraButton').textContent = 'Try camera again'; $('notice').textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in your browser settings to continue.' : 'Could not start the camera. Check that it is connected and try again.'; $('notice').style.color = '#b34e43'; });
  }
  function updateStartButton() { $('startButton').disabled = !($('nameInput').value.trim() && stream?.active); }
  function startAssessment() {
    if (!stream?.active || !$('nameInput').value.trim()) { $('notice').textContent = 'Enter your name and enable the camera first.'; return; }
    $('startButton').disabled = true; $('startButton').textContent = 'Checking your setup…';
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(() => { fullscreenRequested = true; }).catch(() => { showToast('Fullscreen is unavailable. You can still continue.', 'warning'); });
    $('candidateLabel').textContent = $('nameInput').value.trim(); $('avatar').textContent = [...$('nameInput').value.trim()][0].toUpperCase(); $('examVideo').srcObject = stream; $('examCameraFallback').classList.add('hidden');
    active = true; setView('exam'); renderQuestion(); startFaceChecks(); tick = setInterval(countdown, 1000);
  }
  function countdown() { seconds--; const m = String(Math.floor(seconds / 60)).padStart(2, '0'), s = String(seconds % 60).padStart(2, '0'); $('timer').textContent = `${m}:${s}`; if (seconds <= 0) finish('time'); }
  function renderQuestion() {
    const item = questions[questionIndex]; $('questionCount').innerHTML = `QUESTION ${String(questionIndex + 1).padStart(2, '0')} <span>/ ${questions.length}</span>`; $('progressBar').style.width = `${(questionIndex + 1) / questions.length * 100}%`; $('questionText').textContent = item.q; $('answers').replaceChildren();
    item.a.forEach((answer, index) => { const label = document.createElement('label'); label.className = `answer${answers[questionIndex] === index ? ' selected' : ''}`; const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = index; input.checked = answers[questionIndex] === index; input.addEventListener('change', () => { answers[questionIndex] = index; renderQuestion(); }); const text = document.createElement('span'); text.textContent = answer; label.append(input, text); $('answers').append(label); });
    $('prevButton').disabled = questionIndex === 0; $('nextButton').innerHTML = questionIndex === questions.length - 1 ? 'Submit assessment <span>✓</span>' : 'Next question <span>→</span>';
  }
  function addWarning(reason) {
    if (!active || ended) return; warnings++; $('warningCount').innerHTML = `${warnings} <small>/ 5</small>`; $('warningPips').querySelectorAll('i').forEach((pip, i) => { pip.className = i < warnings ? (warnings >= 4 ? 'danger' : 'on') : ''; }); $('lastEvent').classList.remove('hidden'); $('lastEventText').textContent = reason; showToast(`Warning ${warnings} of 5: ${reason}`, warnings >= 5 ? 'danger' : 'warning');
    if (warnings >= 5) finish('integrity');
  }
  function startFaceChecks() {
    if (!faceSupported()) { $('faceMessage').textContent = 'Face detection unavailable in this browser'; return; }
    try { faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }); } catch { $('faceMessage').textContent = 'Face detection is unavailable'; return; }
    $('faceMessage').textContent = 'Looking for one face in frame';
    faceTimer = setInterval(async () => { if (!active || ended || $('examVideo').readyState < 2) return; try { const faces = await faceDetector.detect($('examVideo')); const now = Date.now(); if (faces.length === 0 && now - lastFaceWarning > 30000) { lastFaceWarning = now; $('faceMessage').textContent = 'No face detected — return to the camera view'; addWarning('Face not visible'); } else if (faces.length > 1 && now - lastFaceWarning > 30000) { lastFaceWarning = now; $('faceMessage').textContent = 'More than one face detected'; addWarning('Multiple faces detected'); } else if (faces.length === 1) { $('faceMessage').textContent = 'One face in view'; } } catch { $('faceMessage').textContent = 'Face detection unavailable'; clearInterval(faceTimer); } }, 5000);
  }
  function finish(reason) {
    if (ended) return; ended = true; active = false; clearInterval(tick); clearInterval(faceTimer); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); setView('result');
    const score = answers.reduce((n, answer, i) => n + (answer === questions[i].correct ? 1 : 0), 0); const integrity = reason === 'integrity'; $('resultIcon').className = `result-icon${integrity ? ' failed' : ''}`; $('resultIcon').textContent = integrity ? '!' : '✓'; $('resultTitle').textContent = integrity ? 'Session ended' : reason === 'manual' ? 'Assessment ended' : reason === 'time' ? 'Time is up' : 'Assessment submitted'; $('resultMessage').textContent = integrity ? 'This session reached five integrity warnings and was ended. Your responses are kept in this browser.' : 'Your responses are saved for this demo session on this device.'; $('resultSummary').innerHTML = `<div><strong>${score}/${questions.length}</strong><span>Correct answers</span></div><div><strong>${warnings}/5</strong><span>Integrity alerts</span></div><div><strong>${answers.filter(x => x !== null).length}</strong><span>Answered</span></div>`;
  }
  $('cameraButton').addEventListener('click', enableCamera); $('nameInput').addEventListener('input', updateStartButton); $('startButton').addEventListener('click', startAssessment);
  $('nextButton').addEventListener('click', () => { if (questionIndex < questions.length - 1) { questionIndex++; renderQuestion(); } else finish('submit'); }); $('prevButton').addEventListener('click', () => { if (questionIndex > 0) { questionIndex--; renderQuestion(); } }); $('endButton').addEventListener('click', () => finish('manual'));
  document.addEventListener('visibilitychange', () => { if (active && document.hidden) addWarning('You left the assessment tab'); }); document.addEventListener('fullscreenchange', () => { if (active && fullscreenRequested && !document.fullscreenElement) { fullscreenRequested = false; addWarning('You exited fullscreen'); } });
  $('restartButton').addEventListener('click', () => { location.reload(); }); $('policyLink').addEventListener('click', (event) => { event.preventDefault(); $('rulesModal').classList.remove('hidden'); }); $('closeModal').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('ackRules').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('rulesModal').addEventListener('click', (event) => { if (event.target === $('rulesModal')) $('rulesModal').classList.add('hidden'); });
})();
