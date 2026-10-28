# test-website

A browser-based assessment demo with camera preview, timed multiple-choice questions, fullscreen and tab-change warnings, and a five-warning session limit.

## Run locally

From this folder, run:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173. Camera access requires browser permission and is generally available on `localhost` or HTTPS.

## Prototype limitations

The camera stream stays in the browser and is not uploaded or recorded. Face detection is available only in browsers that implement the experimental `FaceDetector` API. This demo is not a reliable cheating detector or a production proctoring system.
