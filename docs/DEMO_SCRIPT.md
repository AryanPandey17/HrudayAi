# HrudayAI: demo video script

Target length: about 7 minutes (allowed range 3 to 10). Record at 1600 x 1000 or larger.

## Before recording

1. `make serve` in one terminal, `make web` in another. Open `http://localhost:3000`.
2. Check the header shows "API connected".
3. Start in the light theme, with nothing loaded.
4. Keep a terminal and an editor open for the last section.

All numbers quoted below are the saved results; if you retrain, read them from the app.

## Script

| Time | Screen | What to do | What to say |
|---|---|---|---|
| 0:00 to 0:30 | Empty app | Point at the disclaimer strip, the three zones and the grey vessels on the heart. | "HrudayAI estimates coronary artery disease and stenosis in the three main coronary arteries, and shows it on a 3D heart. It is a decision-support prototype trained on 303 patients, not a diagnostic device, and the app says so on every screen." |
| 0:30 to 1:15 | Example patient | Click "Borderline predicted risk". Let the vessels colour in. Read the Overall CAD tile. | "This is a real held-out patient the model never saw. Overall CAD comes out at 62%, with a range of 46 to 82%. Each tile shows the probability, the range, the predicted label from a tuned threshold, and what angiography actually found." |
| 1:15 to 2:15 | 3D heart | Drag to rotate, scroll to zoom. Hover the LAD, then click it. Click "Reset view". Toggle a vessel off and on, toggle "Torso", then "Labels". | "The anatomy is BodyParts3D, an open-licensed model, and the LAD, circumflex and right coronary are separate meshes. Each maps one-to-one to a model output. Colour is a single-hue scale, darker means higher here, and the numbers are always beside it. Clicking a vessel selects it everywhere and moves the camera." |
| 2:15 to 3:00 | Reliability | Point at the "Lower reliability" tags on LCX and RCA. Hover one to show the tooltip. Point out that those vessels are drawn more translucent. | "We do not hide weak models. The circumflex and right coronary models have hold-out AUC around 0.67 to 0.69, so they carry this tag and are drawn fainter. The LCX prediction for this patient is in fact wrong, and the tile says 'differs'." |
| 3:00 to 4:00 | Explanation | Select LAD, click "Explain". Read the summary sentence and the top bars. Scroll to the measurements table. Switch target to CAD inside the dialog. Close. | "This is why the model gave 46% for the LAD. Each bar is one measurement's contribution, from exact SHAP values. Regions with wall-motion abnormality push it up; no typical chest pain pulls it down. Every one of the 54 inputs is listed with its value and contribution. These describe the model, not cause and effect." |
| 4:00 to 5:15 | Test ladder | Click step 3 "Laboratory". Turn on "This test was not done". Click "Done". Watch the results change to step 2. Click "By step". Close. Reopen step 3 and turn the switch off. | "Clinics get information in stages, so there is a separate validated model for each stage. If labs were not done, the estimate comes from history, examination and ECG. 'By step' shows how each estimate and its range moved as tests were added." |
| 5:15 to 6:00 | Model performance | Click "Metrics". Point at the CV AUC table and the single marked gain. Select LCX to show its detail rows. Close. | "Here is the honest part. History and examination alone reach 0.91 AUC for CAD. Of twelve step-to-step changes, only one is distinguishable from noise: echo for the LAD. We report that, we do not pretend that more tests always help." |
| 6:00 to 6:25 | Themes and layout | Click the sun/moon toggle. Drag the divider between panels. Optionally narrow the window to show the mobile layout. | "Light and dark themes share one set of design tokens, including the risk colours. Panels resize, and on a phone they become slide-in sheets." |
| 6:25 to 7:15 | Technical implementation | Show `backend/ml/feature_schema.json`. Show `reports/metrics.json`. In a terminal run `make test`, then `curl -s localhost:8000/ladder \| head -c 400`. | "One schema file defines every input and the ladder steps; preprocessing, API validation and this form are generated from it. Training is seeded and writes every metric you saw to these files. The four angiography columns can never reach a model, and a test checks it. Everything runs locally on CPU." |
| 7:15 to 7:30 | App | Return to the app with the high-risk example loaded. | "HrudayAI: an honest second opinion before angiography. It shows what the evidence supports, how sure it is, and where it is weak." |

## Shorter cut (about 3.5 minutes)

Keep rows 0:00, 0:30, 1:15 (rotate and click only), 3:00 (LAD explanation only), 4:00 (mark labs not done only) and 5:15, and close with the last line.

## If something goes wrong

- **"API unreachable":** start `make serve`, then click Retry.
- **Heart does not appear:** reload the page; check that `frontend/public/models/heart.glb` exists.
- **Rotation is choppy:** turn off "Rotate" and close other GPU-heavy tabs.
