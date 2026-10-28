# test-website

An adaptive browser-based learning assessment for SQL, pandas, NumPy, Python fundamentals, data engineering, and general problem solving. It uses an original question bank, shows explanations after answers, and remembers each topic's adaptive level locally on the device.

## Run locally

From this folder, run:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173. Camera access requires browser permission and is generally available on `localhost` or HTTPS.

## Integrity and prototype limitations

The camera stream stays in the browser and is not uploaded or recorded. Leaving the assessment tab, exiting fullscreen, or stopping camera access adds a warning; the session ends at five warnings. Repeated multiple-face detections end a session immediately where the browser supports the experimental `FaceDetector` API. This detection may be inaccurate or unavailable, and browser-only controls can be bypassed. The project is a learning prototype, not a tamper-proof or production proctoring system.

Questions are original practice material covering common data skills interview topics. They are not copied from HackerRank or other proprietary question banks.
