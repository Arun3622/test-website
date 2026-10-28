# test-website

An adaptive browser-based learning assessment for SQL, pandas, NumPy, Python fundamentals, data engineering, and general problem solving. It includes Easy and Medium difficulty choices plus an adaptive Easy-to-Medium path, shows explanations after answers, and remembers adaptive progress locally on the device. The assessment labels its browser safeguards as Strict monitoring mode.

## Run locally

From this folder, run:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173. Camera access requires browser permission and is generally available on `localhost` or HTTPS.

## Integrity and prototype limitations

The camera stream stays in the browser and is not uploaded or recorded. The microphone check measures volume in-browser; it does not record or transcribe audio. Leaving the assessment window or hiding its tab adds a warning, pauses the timer, and blurs the question until the candidate resumes; the session ends at five warnings. Exiting fullscreen pauses the timer and locks the assessment behind a re-entry button. Copy/paste actions and context-menu use inside the page are blocked and counted as warnings. The app loads pinned TensorFlow.js face-landmark and COCO-SSD models, then runs inference in the browser. Three consecutive missing-face checks add a warning; sustained absence, repeated multiple faces, a persistent visible phone, or sustained gaze deviation can end the session. Eye direction is an approximate calibrated cue; object detection only recognizes phones visible in the frame.

Camera motion is displayed as a movement signal only; it cannot reliably determine gaze direction or detect a phone. Browser code cannot block operating-system screenshots or observe actions in other apps. Face, eye-direction, and phone detections can be inaccurate; if either model cannot load, the assessment cannot start. The eye cue is not proof that a person is looking at a phone, and phones outside the camera view cannot be detected. Browser-only controls can still be bypassed. The project is a learning prototype, not a tamper-proof or production proctoring system.

Questions are original practice material covering common data skills interview topics. They are not copied from HackerRank or other proprietary question banks.
