# test-website

An adaptive browser-based learning assessment for SQL, pandas, NumPy, Python fundamentals, data engineering, and general problem solving. It includes Easy and Medium difficulty choices plus an adaptive Easy-to-Medium path, shows explanations after answers, and remembers adaptive progress locally on the device. The assessment labels its browser safeguards as Strict monitoring mode.

## Run locally

From this folder, run:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173. Camera access requires browser permission and is generally available on `localhost` or HTTPS.

## Integrity and prototype limitations

The camera stream stays in the browser and is not uploaded or recorded. The microphone check measures volume in-browser; it does not record or transcribe audio. Leaving the assessment window or hiding its tab adds a warning, pauses the timer, and blurs the question until the candidate resumes; the session ends at five warnings. Exiting fullscreen pauses the timer and locks the assessment behind a re-entry button. Copy/paste actions and context-menu use inside the page are blocked and counted as warnings. Repeated multiple-face detections end a session immediately where the browser supports the experimental `FaceDetector` API.

Camera motion is displayed as a movement signal only; it cannot reliably determine gaze direction or detect a phone. Browser code cannot block operating-system screenshots or observe actions in other apps. Face detection may be inaccurate or unavailable, and browser-only controls can be bypassed. The project is a learning prototype, not a tamper-proof or production proctoring system.

Questions are original practice material covering common data skills interview topics. They are not copied from HackerRank or other proprietary question banks.
