(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const views = { welcome: $('welcome'), exam: $('exam'), result: $('result') };
  const bank = window.QUESTION_BANK || [];
  const tracks = { mixed: 'Mixed data skills', sql: 'SQL', pandas: 'Pandas', numpy: 'NumPy', engineering: 'Data engineering', problem: 'Problem solving', python: 'Python fundamentals' };
  const levels = ['Easy', 'Medium'];
  const questionLevel = { easy: 'Foundation', medium: 'Intermediate' };
  let stream = null, micStream = null, audioContext = null, analyser = null, micReady = false, micFrame = null, motionTimer = null, previousFrame = null, active = false, warnings = 0, questionIndex = 0, questions = [], answers = [], reviewed = [], seconds = 30 * 60, tick = null, faceTimer = null, faceDetector = null, toastTimer = null, ended = false, fullscreenRequested = false, fullscreenSuspended = false, multipleFaceRuns = 0, lastClipboardAction = 0, currentTrack = 'mixed', currentLevel = 0, currentDifficulty = 'adaptive';
  const readProgress = () => { try { return JSON.parse(localStorage.getItem('northstar-progress') || '{}'); } catch { return {}; } };
  function setView(view) { Object.values(views).forEach((node) => node.classList.add('hidden')); views[view].classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
  function showToast(message, kind = '') { const toast = $('toast'); toast.textContent = message; toast.className = `toast show ${kind}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.className = 'toast', 3400); }
  function refreshLevel() { const topic = $('topicSelect').value; const progress = readProgress(); const level = Math.min(1, Math.max(0, progress[topic]?.level ?? 0)); $('levelBadge').innerHTML = `<span>Next adaptive test: ${levels[level]}</span><small>PROGRESS SAVED ON THIS DEVICE</small>`; }
  function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { $('notice').textContent = 'Camera access requires HTTPS or localhost in a supported browser.'; $('notice').style.color = '#b34e43'; return; }
    $('cameraButton').disabled = true; $('cameraButton').textContent = 'Connecting…';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }).then((media) => {
      stream = media; $('preview').srcObject = stream; $('preview').classList.remove('hidden'); $('cameraPlaceholder').classList.add('hidden'); $('cameraLive').classList.add('visible'); $('cameraStatus').textContent = 'Ready'; $('cameraStatus').className = 'status ready'; $('cameraButton').classList.add('hidden'); $('notice').textContent = 'Camera ready. Enter your name and choose a track.'; $('notice').style.color = '#548264'; updateStartButton();
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (active && !ended) addWarning('Camera feed stopped'); });
    }).catch((error) => { $('cameraButton').disabled = false; $('cameraButton').textContent = 'Try camera again'; $('notice').textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in browser settings to continue.' : 'Could not start the camera. Check that it is connected and try again.'; $('notice').style.color = '#b34e43'; });
  }
  function updateStartButton() { $('startButton').disabled = !($('nameInput').value.trim() && stream?.active && micReady); }
  async function testMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) { $('micHelp').textContent = 'Microphone access requires HTTPS or localhost.'; return; }
    $('micButton').disabled = true; $('micButton').textContent = 'Requesting…';
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Audio level monitoring is unavailable in this browser.');
      audioContext = new AudioCtx(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; audioContext.createMediaStreamSource(micStream).connect(analyser);
      $('micButton').textContent = 'Speak to test'; $('micHelp').textContent = 'Measuring microphone level for 4 seconds…';
      const samples = new Uint8Array(analyser.fftSize); const checkStarted = performance.now(); let heard = false;
      const sample = () => { if (!analyser) return; analyser.getByteTimeDomainData(samples); let sum = 0; for (const value of samples) { const v = (value - 128) / 128; sum += v * v; } const level = Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 450)); $('setupMicMeter').style.width = `${level}%`; heard ||= level > 2; if (performance.now() - checkStarted < 4000) micFrame = requestAnimationFrame(sample); else { micReady = true; $('micButton').textContent = 'Microphone ready'; $('micButton').disabled = false; $('micHelp').textContent = heard ? 'Level check complete. Audio is not recorded.' : 'Mic is available; no sound detected. Audio is not recorded.'; updateStartButton(); } };
      sample(); micStream.getAudioTracks()[0]?.addEventListener('ended', () => { micReady = false; if (active) addWarning('Microphone disconnected'); updateStartButton(); });
    } catch (error) { micStream?.getTracks().forEach((track) => track.stop()); micStream = null; analyser = null; audioContext?.close().catch(() => {}); audioContext = null; $('micButton').disabled = false; $('micButton').textContent = 'Try microphone again'; $('micHelp').textContent = error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow access and retry.' : error.message || 'Microphone check failed. Retry.'; }
  }
  function prepareQuestions() {
    currentTrack = $('topicSelect').value; currentDifficulty = $('difficultySelect').value; const progress = readProgress(); currentLevel = Math.min(1, Math.max(0, progress[currentTrack]?.level ?? 0));
    let pool = bank.filter((item) => currentTrack === 'mixed' || item.topic === currentTrack);
    if (currentDifficulty === 'easy' || currentDifficulty === 'medium') pool = shuffle(pool.filter((item) => item.level === questionLevel[currentDifficulty]));
    else {
      // Adaptive practice stays within Easy and Medium, favoring the learner's current step.
      pool = pool.filter((item) => item.level === 'Foundation' || item.level === 'Intermediate');
      const preferred = pool.filter((item) => item.level === questionLevel[currentLevel === 0 ? 'easy' : 'medium']);
      const remaining = shuffle(pool.filter((item) => item.level !== questionLevel[currentLevel === 0 ? 'easy' : 'medium']));
      pool = [...shuffle(preferred), ...remaining];
    }
    questions = pool.slice(0, Math.min(10, pool.length)); answers = Array(questions.length).fill(null); reviewed = Array(questions.length).fill(false); questionIndex = 0;
  }
  async function startAssessment() {
    if (!stream?.active || !micReady || !$('nameInput').value.trim()) { $('notice').textContent = 'Enter your name, enable the camera, and complete the microphone test.'; return; }
    if (!document.documentElement.requestFullscreen) { $('notice').textContent = 'This browser cannot enter full screen, so the assessment cannot start.'; return; }
    prepareQuestions(); if (!questions.length) { $('notice').textContent = 'Question bank unavailable. Reload the page and try again.'; return; }
    try { await document.documentElement.requestFullscreen(); fullscreenRequested = true; } catch { $('notice').textContent = 'Full screen could not be started. Use a supported desktop browser and try again.'; return; }
    $('candidateLabel').textContent = $('nameInput').value.trim(); $('avatar').textContent = [...$('nameInput').value.trim()][0].toUpperCase(); $('examVideo').srcObject = stream; $('examCameraFallback').classList.add('hidden'); $('examTrack').textContent = tracks[currentTrack].toUpperCase(); $('examSubtitle').textContent = `${questions.length} original questions · ${currentDifficulty === 'adaptive' ? `Adaptive (${levels[currentLevel]} first)` : `${currentDifficulty[0].toUpperCase()}${currentDifficulty.slice(1)} difficulty`} · explanations after each answer`;
    active = true; fullscreenSuspended = false; setView('exam'); renderQuestion(); startFaceChecks(); startMotionMonitor(); startExamMicMeter(); tick = setInterval(countdown, 1000);
  }
  function countdown() { if (fullscreenSuspended || document.hidden) return; seconds--; const m = String(Math.floor(seconds / 60)).padStart(2, '0'), s = String(seconds % 60).padStart(2, '0'); $('timer').textContent = `${m}:${s}`; if (seconds <= 0) finish('time'); }
  function revealAnswer() {
    if (answers[questionIndex] === null) { showToast('Choose an answer first.', 'warning'); return false; }
    if (!reviewed[questionIndex]) { reviewed[questionIndex] = true; const item = questions[questionIndex]; const correct = answers[questionIndex] === item.correct; $('explanation').className = `explanation ${correct ? 'correct' : 'incorrect'}`; $('explanation').innerHTML = `<strong>${correct ? 'Correct — nice work.' : `Not quite. The answer is: ${item.a[item.correct]}`}</strong><p>${item.why}</p>`; $('savedLabel').textContent = 'Reasoning revealed · continue when ready'; }
    return true;
  }
  function renderQuestion() {
    const item = questions[questionIndex]; const isReviewed = reviewed[questionIndex];
    $('questionCount').innerHTML = `QUESTION ${String(questionIndex + 1).padStart(2, '0')} <span>/ ${questions.length}</span>`; $('progressBar').style.width = `${(questionIndex + 1) / questions.length * 100}%`; $('questionText').textContent = item.q; $('questionLevel').textContent = item.level === 'Foundation' ? 'EASY' : item.level === 'Intermediate' ? 'MEDIUM' : 'CHALLENGE';
    if (item.code) { $('questionCode').textContent = item.code; $('questionCode').classList.remove('hidden'); } else { $('questionCode').classList.add('hidden'); $('questionCode').textContent = ''; }
    $('answers').replaceChildren(); item.a.forEach((answer, index) => { const label = document.createElement('label'); label.className = `answer${answers[questionIndex] === index ? ' selected' : ''}${isReviewed && index === item.correct ? ' answer-correct' : ''}${isReviewed && answers[questionIndex] === index && index !== item.correct ? ' answer-incorrect' : ''}`; const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = index; input.checked = answers[questionIndex] === index; input.disabled = isReviewed; input.addEventListener('change', () => { answers[questionIndex] = index; renderQuestion(); }); const text = document.createElement('span'); text.textContent = answer; label.append(input, text); $('answers').append(label); });
    if (isReviewed) { const correct = answers[questionIndex] === item.correct; $('explanation').className = `explanation ${correct ? 'correct' : 'incorrect'}`; $('explanation').innerHTML = `<strong>${correct ? 'Correct — nice work.' : `Not quite. The answer is: ${item.a[item.correct]}`}</strong><p>${item.why}</p>`; $('savedLabel').textContent = 'Reasoning revealed · continue when ready'; } else { $('explanation').className = 'explanation hidden'; $('savedLabel').textContent = 'Choose an answer to reveal the reasoning'; }
    $('prevButton').disabled = questionIndex === 0; $('nextButton').innerHTML = isReviewed ? (questionIndex === questions.length - 1 ? 'Finish test <span>✓</span>' : 'Next question <span>→</span>') : 'Check answer <span>✓</span>';
  }
  function addWarning(reason) {
    if (!active || ended) return; warnings++; $('warningCount').innerHTML = `${warnings} <small>/ 5</small>`; $('warningPips').querySelectorAll('i').forEach((pip, i) => { pip.className = i < warnings ? (warnings >= 4 ? 'danger' : 'on') : ''; }); $('lastEvent').classList.remove('hidden'); $('lastEventText').textContent = reason; showToast(`Warning ${warnings} of 5: ${reason}`, warnings >= 5 ? 'danger' : 'warning'); if (warnings >= 5) finish('integrity');
  }
  function registerClipboardAttempt(event, reason) { event.preventDefault(); const now = Date.now(); if (now - lastClipboardAction > 700) { lastClipboardAction = now; addWarning(reason); } }
  function startFaceChecks() {
    if (typeof window.FaceDetector !== 'function') { $('faceMessage').textContent = 'Face detection is not supported in this browser'; return; }
    try { faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }); } catch { $('faceMessage').textContent = 'Face detection is unavailable'; return; }
    $('faceMessage').textContent = 'Checking for one face in frame';
    faceTimer = setInterval(async () => { if (!active || ended || $('examVideo').readyState < 2) return; try { const faces = await faceDetector.detect($('examVideo')); if (faces.length > 1) { multipleFaceRuns++; $('faceMessage').textContent = 'Multiple faces detected — session ending'; if (multipleFaceRuns >= 2) finish('multiple-faces'); } else { multipleFaceRuns = 0; $('faceMessage').textContent = faces.length === 1 ? 'One face in view' : 'No face detected — return to camera view'; } } catch { $('faceMessage').textContent = 'Face detection unavailable'; clearInterval(faceTimer); } }, 4000);
  }
  function startMotionMonitor() {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24; const ctx = canvas.getContext('2d', { willReadFrequently: true }); previousFrame = null;
    motionTimer = setInterval(() => { const video = $('examVideo'); if (!active || fullscreenSuspended || video.readyState < 2) return; try { ctx.drawImage(video, 0, 0, 32, 24); const frame = ctx.getImageData(0, 0, 32, 24).data; if (!previousFrame) { previousFrame = frame; return; } let diff = 0; for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - previousFrame[i]) + Math.abs(frame[i + 1] - previousFrame[i + 1]) + Math.abs(frame[i + 2] - previousFrame[i + 2]); const motion = Math.min(100, Math.round(diff / (32 * 24 * 3) * 1.8)); previousFrame = frame; $('motionMeter').style.width = `${motion}%`; $('motionLabel').textContent = motion > 30 ? 'Movement detected' : 'Steady'; $('motionLabel').style.color = motion > 30 ? '#ab7831' : '#63806f'; } catch { $('motionLabel').textContent = 'Camera motion unavailable'; clearInterval(motionTimer); } }, 650);
  }
  function startExamMicMeter() {
    if (!analyser) { $('examMicLabel').textContent = 'Not available'; return; }
    const samples = new Uint8Array(analyser.fftSize);
    const sample = () => { if (!active || ended || !analyser) return; analyser.getByteTimeDomainData(samples); let sum = 0; for (const value of samples) { const v = (value - 128) / 128; sum += v * v; } const level = Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 450)); $('examMicMeter').style.width = `${level}%`; $('examMicLabel').textContent = level > 2 ? 'Signal detected' : 'Listening'; micFrame = requestAnimationFrame(sample); };
    sample();
  }
  function finish(reason) {
    if (ended) return; ended = true; active = false; clearInterval(tick); clearInterval(faceTimer); clearInterval(motionTimer); if (micFrame) cancelAnimationFrame(micFrame); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); stream?.getTracks().forEach((track) => track.stop()); micStream?.getTracks().forEach((track) => track.stop()); audioContext?.close().catch(() => {}); stream = null; micStream = null; analyser = null; audioContext = null; setView('result');
    const correctCount = answers.reduce((n, answer, i) => n + (answer === questions[i].correct ? 1 : 0), 0); const integrity = reason === 'integrity' || reason === 'multiple-faces';
    $('resultIcon').className = `result-icon${integrity ? ' failed' : ''}`; $('resultIcon').textContent = integrity ? '!' : '✓'; $('resultTitle').textContent = integrity ? 'Session ended' : reason === 'manual' ? 'Test ended' : reason === 'time' ? 'Time is up' : 'Practice complete';
    $('resultMessage').textContent = integrity ? (reason === 'multiple-faces' ? 'Repeated multiple-face detections ended this session.' : 'The session reached five integrity warnings and was ended.') : 'Review your score and the explanations to reinforce what you learned.';
    $('resultSummary').innerHTML = `<div><strong>${correctCount}/${questions.length}</strong><span>Correct answers</span></div><div><strong>${Math.round(correctCount / questions.length * 100)}%</strong><span>Score</span></div><div><strong>${warnings}/5</strong><span>Integrity warnings</span></div>`;
    const progress = readProgress(); let moved = false; let next = currentLevel;
    if (!integrity && reason !== 'manual' && questions.length && currentDifficulty === 'adaptive') { if (correctCount / questions.length >= .8 && next < levels.length - 1) { next++; moved = true; } else if (correctCount / questions.length < .4 && next > 0) { next--; moved = true; } progress[currentTrack] = { level: next, best: Math.max(progress[currentTrack]?.best || 0, correctCount / questions.length), tests: (progress[currentTrack]?.tests || 0) + 1 }; try { localStorage.setItem('northstar-progress', JSON.stringify(progress)); } catch { /* Learning state is optional when browser storage is unavailable. */ } }
    $('nextLevel').classList.toggle('hidden', integrity || !questions.length); $('nextLevel').textContent = integrity ? '' : currentDifficulty !== 'adaptive' ? `You practiced ${currentDifficulty} questions. Choose Adaptive to follow your Easy → Medium progress.` : moved ? `Adaptive level updated: ${levels[next]}. Your progress stays on this device.` : `Current adaptive level: ${levels[next]}. Score 80% to advance; revisit Easy if you score below 40%.`;
  }
  $('cameraButton').addEventListener('click', enableCamera); $('micButton').addEventListener('click', testMicrophone); $('nameInput').addEventListener('input', updateStartButton); $('topicSelect').addEventListener('change', refreshLevel); $('difficultySelect').addEventListener('change', refreshLevel); $('startButton').addEventListener('click', startAssessment);
  $('nextButton').addEventListener('click', () => { if (!reviewed[questionIndex]) { if (!revealAnswer()) return; if (questionIndex === questions.length - 1) $('nextButton').innerHTML = 'Finish test <span>✓</span>'; return; } if (questionIndex < questions.length - 1) { questionIndex++; renderQuestion(); } else finish('submit'); }); $('prevButton').addEventListener('click', () => { if (questionIndex > 0) { questionIndex--; renderQuestion(); } }); $('endButton').addEventListener('click', () => finish('manual'));
  document.addEventListener('visibilitychange', () => { if (active && document.hidden) addWarning('Assessment tab left'); if (active && !document.hidden && !document.fullscreenElement) { fullscreenSuspended = true; $('fullscreenShield').classList.remove('hidden'); } });
  document.addEventListener('fullscreenchange', () => { if (!active || !fullscreenRequested) return; if (!document.fullscreenElement) { fullscreenSuspended = true; $('fullscreenShield').classList.remove('hidden'); } else { fullscreenSuspended = false; $('fullscreenShield').classList.add('hidden'); } });
  $('resumeFullscreen').addEventListener('click', async () => { try { await document.documentElement.requestFullscreen(); fullscreenRequested = true; fullscreenSuspended = false; $('fullscreenShield').classList.add('hidden'); } catch { showToast('Full screen could not be restored. Try the button again.', 'warning'); } }); $('shieldEnd').addEventListener('click', () => finish('manual'));
  for (const type of ['copy', 'cut', 'paste']) document.addEventListener(type, (event) => { if (active) registerClipboardAttempt(event, `Blocked ${type} action`); }, true);
  document.addEventListener('keydown', (event) => { if (!active) return; const key = event.key.toLowerCase(); const mod = event.ctrlKey || event.metaKey; if (mod && ['c', 'x', 'v'].includes(key)) registerClipboardAttempt(event, 'Blocked clipboard shortcut'); else if (event.key === 'F12' || (mod && event.shiftKey && key === 'i') || (mod && ['p', 's'].includes(key))) registerClipboardAttempt(event, 'Blocked restricted keyboard shortcut'); });
  document.addEventListener('contextmenu', (event) => { if (active) registerClipboardAttempt(event, 'Blocked context-menu action'); }, true);
  $('restartButton').addEventListener('click', () => { ended = false; active = false; warnings = 0; seconds = 30 * 60; fullscreenRequested = false; fullscreenSuspended = false; micReady = false; if (micFrame) cancelAnimationFrame(micFrame); $('fullscreenShield').classList.add('hidden'); $('startButton').disabled = true; $('startButton').innerHTML = 'Run system check <span>→</span>'; $('cameraButton').classList.remove('hidden'); $('cameraButton').disabled = false; $('cameraButton').textContent = 'Enable camera'; $('cameraStatus').textContent = 'Required'; $('cameraStatus').className = 'status pending'; $('cameraLive').classList.remove('visible'); $('preview').srcObject = null; $('preview').classList.add('hidden'); $('cameraPlaceholder').classList.remove('hidden'); stream = null; micStream = null; analyser = null; audioContext = null; $('micButton').disabled = false; $('micButton').textContent = 'Test microphone'; $('micHelp').textContent = 'A brief live level check; no audio is recorded.'; $('setupMicMeter').style.width = '0'; refreshLevel(); setView('welcome'); }); $('policyLink').addEventListener('click', (event) => { event.preventDefault(); $('rulesModal').classList.remove('hidden'); }); $('closeModal').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('ackRules').addEventListener('click', () => $('rulesModal').classList.add('hidden')); $('rulesModal').addEventListener('click', (event) => { if (event.target === $('rulesModal')) $('rulesModal').classList.add('hidden'); });
  refreshLevel();
})();
