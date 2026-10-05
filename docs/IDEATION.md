# CardioVis 3D: product ideation

Ideation only. Nothing in this document is implemented, and no code was changed to write it.

**What we have today:** 54 clinical / ECG / lab / echo inputs, the 303-patient Z-Alizadeh Sani extension dataset, calibrated logistic regression for CAD, LAD, LCX and RCA, exact SHAP, a procedural 3D heart with selectable vessels, and a FastAPI backend.

**Limits every idea must respect:**

- Hold-out ROC-AUC is 0.87 for CAD and 0.82 for LAD, but only 0.69 for LCX and 0.67 for RCA (61 test patients, wide intervals).
- 303 patients from one centre. To my knowledge the dataset was collected at a single cardiovascular centre in Tehran, Iran, so it is not an Indian population.
- Every patient in it was already referred for angiography. The model estimates "CAD on angiography among referred patients", not risk in the general population and not acute coronary syndrome.
- No imaging, no lesion location within a vessel, no outcomes (heart attack, death), no treatment data, no follow-up.

---

## 1. Pain points by stakeholder

### How to read the sources

- **[S1]–[S6]** are sources I opened and read in this session (listed in section 8).
- **GK** means "from general knowledge": widely described in clinical practice and literature, but not verified against a source here. No numbers are attached to GK rows on purpose.
- Several primary papers were found by search but could not be opened (PubMed and PMC returned a bot check or rate limit). They are listed in section 8 as unread. Nothing is quoted from them.

### 1.1 Patients and families

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| P1 | Results are in jargon ("LAD", "EF 40%", "70% block") and nobody has time to explain | Nearly every patient | Anxiety, poor decisions, mistrust | Ask relatives, search online, ask the nurse | GK; over 40% of elective angioplasty patients said they did not understand or remember the information given [S4] |
| P2 | Wrong beliefs about what a stent does | Very common | Consent that is not really informed; disappointment later | Rely on the cardiologist's word | 95% believed elective angioplasty would cut future heart-attack risk, 91% that it would lengthen life, 60% that it would cure the disease; trial evidence says it mainly relieves symptoms [S4] |
| P3 | Fear before an invasive angiogram, decided under family and time pressure | Every referred patient | Delay or refusal, or agreeing without understanding | Second opinions, "doctor shopping" | GK |
| P4 | Late arrival after symptoms start; chest pain blamed on acidity or gas | Common in India | Lost heart muscle, higher mortality | Home remedies, local clinic first | Median 5 hours to presentation; about one third arrived after 12 hours [S3] |
| P5 | Getting to hospital | Common | Delay, cost | Taxi or private vehicle; ambulances are rarely used | Only 5.5% of heart-attack patients used an ambulance; 84% came by taxi or private vehicle [S3] |
| P6 | Cost: tests, angiogram, stent or surgery paid largely out of pocket | Most uninsured families | Borrowing, asset sales, treatment abandoned | Government schemes, public hospitals with long queues | GK (source found but unread) |
| P7 | Stopping medicines after discharge | Majority over time | Repeat events | Little structured follow-up | In low-income countries including India, only about 21–28% of people with cardiovascular disease were taking any secondary-prevention medicine [S5] |
| P8 | "Was my angiogram / stent really needed?" | Common, especially after a normal angiogram | Mistrust of the whole system | Second opinion | GK |

### 1.2 Cardiologists and interventional cardiologists

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| C1 | Very high outpatient volume; minutes per patient | Daily | Shallow history, missed detail | Triage by juniors, pattern recognition | GK |
| C2 | Patient data is scattered: paper ECG, echo report from another lab, labs on a phone photo | Daily | Time, transcription errors | Read everything again by hand | GK |
| C3 | Pre-test probability of CAD is estimated informally | Every new chest-pain patient | Over- and under-referral | Clinical gestalt; guideline tables used inconsistently | GK |
| C4 | Many elective angiograms find no obstructive disease | Regular | Procedure risk and cost without benefit; cath lab slot used | Accept it as the price of not missing disease | 24% of 2,984 elective angiograms at a Karachi centre showed no obstructive disease; women and under-50s were the strongest predictors [S2]. In our own dataset 87 of 303 referred patients (29%) had normal coronaries |
| C5 | Explaining anatomy and the plan again and again | Every procedure | Time; inconsistent explanations | Hand sketches, plastic models, the angiogram screen | GK |
| C6 | Women, younger patients and diabetics present atypically | Regular | Missed or late diagnosis, or needless angiograms | Lower threshold for testing | [S2] for predictors of normal angiograms; otherwise GK |
| C7 | Black-box risk scores are not trusted; alert fatigue | Whenever a tool is introduced | Tools ignored | Ignore the score | GK |
| C8 | Prioritising a waiting list in public hospitals | Weekly | Sickest patient may wait longest | First come first served, plus judgement | GK |

### 1.3 Cardiac surgeons

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| S1 | Bypass versus stent decisions often made without a formal heart-team discussion | Common | Possibly the wrong strategy for multi-vessel disease | Informal phone call; cardiologist decides | GK |
| S2 | Anatomy scoring from the angiogram is slow and varies between readers | Every multi-vessel case | Time, inconsistency | Eyeballing | GK |
| S3 | Explaining multi-vessel disease and grafts to a frightened family | Every case | Time; consent quality | Sketches, models | GK |
| S4 | Surgical risk numbers are not intuitive to families | Every case | Misjudged risk | Verbal reassurance | GK |
| S5 | Referrals arrive with an incomplete work-up (missing echo, kidney function) | Regular | Delay, repeated tests | Repeat the tests | GK |

### 1.4 Emergency / triage doctors and general physicians

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| E1 | Rule out or refer, under time pressure | Every chest-pain patient | A missed heart attack, or a needless transfer | Serial ECG and troponin, observation | About 2% of patients with acute heart attack or unstable angina were mistakenly sent home, with higher risk of death [S1] |
| E2 | Atypical presentations | Regular | Missed diagnosis | Low threshold to observe | GK |
| E3 | ECG interpretation by non-cardiologists; subtle changes missed | Daily | Missed or over-called findings | WhatsApp the ECG to a cardiologist | GK |
| E4 | Troponin unavailable or slow in smaller hospitals | Common outside big centres | Decisions on history and ECG alone | Refer everything doubtful | GK |
| E5 | Risk scores need recall and manual arithmetic, and often go undocumented | Daily | Inconsistent care, weak medico-legal record | Gestalt | GK |
| E6 | Defensive over-referral | Daily | Crowded tertiary centres, family cost | Refer "to be safe" | GK |

### 1.5 Nurses and technicians

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| N1 | Re-typing vitals, labs and history into several registers and forms | Every patient | Time, transcription errors | Paper plus partial electronic records | GK |
| N2 | Information lost at shift and ward handovers | Every shift | Repeated questions, safety risk | Verbal handover, sometimes structured (SBAR) | GK |
| N3 | Cath lab cancelled on the day because something is missing (kidney function, consent, blood thinner status) | Regular | Wasted slot, patient distress | Paper checklists | GK |
| N4 | Patients ask nurses questions they have no material to answer | Daily | Anxiety, inconsistent answers | "Ask the doctor" | GK; ties to [S4] |
| N5 | Echo and ECG reports are free text in different formats | Daily | Hard to find the one number needed | Read the whole report | GK |

### 1.6 Hospital administrators and payers

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| A1 | Cath lab time is scarce and expensive | Continuous | Capital and staffing | Scheduling by seniority or arrival | India has roughly 1.5–1.75 cath labs per million people versus 5–10 in developed markets (trade publication, no primary source cited) [S6] |
| A2 | Normal angiograms use slots that sicker patients need | Regular | Lost capacity | Little systematic review | [S2] |
| A3 | Insurers and public schemes ask why an invasive test was justified | Every claim | Rejected or delayed claims | Free-text justification | GK |
| A4 | Reputational and legal risk from perceived unnecessary procedures | Ongoing | Trust, litigation | Audits after the fact | GK |
| A5 | No structured, auditable record of the reasoning before angiography | Systemic | Cannot audit appropriateness | Case-note review | GK |

### 1.7 Rural and low-resource clinics

| # | Pain point | How often | What it costs | What people do today | Source |
|---|---|---|---|---|---|
| R1 | No cardiologist; a medical officer decides who travels | Every chest-pain patient | Over- or under-referral | Refer anyone doubtful, or reassure | [S6] qualitatively; GK |
| R2 | A referral means long travel, lost wages and an uprooted family | Every referral | Money, delay, refusal | Delay until symptoms worsen | [S3] for transport |
| R3 | Few tests available: often an ECG, rarely echo, limited labs | Systemic | Tools that need 50 inputs are useless here | Decide on history and examination | GK |
| R4 | Unreliable power and connectivity | Common | Cloud tools fail | Paper | GK |
| R5 | Patients arrive at the city hospital with no usable summary | Common | Repeat tests | Hand-written slip | GK |
| R6 | Loss to follow-up and stopped medicines | Majority | Repeat events | Community health workers where available | [S5] |

---

## 2. Gap analysis against what we have

**Legend:** NOW = directly addressable with current assets. MODEST = addressable with a modest addition on our own data. NO = not honestly addressable with our data.

| Pain | Status | Why |
|---|---|---|
| P1 jargon | NOW | The 3D heart plus SHAP already turn numbers into something visible. A plain-language layer is missing. |
| P2 wrong beliefs about stents | NO | We have no treatment or outcome data. We can link to neutral education, not model it. |
| P3 fear before angiography | MODEST | A patient view can explain why a test is being suggested. It must not tell anyone to skip one. |
| P4, P5 delay and transport | NO | Outside the product. |
| P6 cost | NO | No cost data. |
| P7 adherence | NO | No follow-up data. A "what-if" on risk factors would imply treatment effects we cannot support. |
| P8 "was it needed?" | MODEST | A structured record of the pre-test reasoning helps, but our model cannot adjudicate appropriateness. |
| C1, C2 volume and scattered data | MODEST | One screen for 54 inputs and a printable summary. No integration with hospital records. |
| C3 informal pre-test probability | NOW | This is exactly what the CAD model estimates, with calibration and explanation. |
| C4 normal angiograms | MODEST | We can show, on held-out patients, what a threshold would have avoided and missed. We cannot claim it would reduce angiograms in practice. |
| C5 explaining anatomy | NOW | The 3D viewer. |
| C6 atypical groups | MODEST | We can audit performance by sex and age on our data. Samples are small. |
| C7 black-box distrust | NOW | Linear model, exact SHAP, visible metrics. Uncertainty per patient is missing. |
| C8 waiting-list order | NO (as a real tool) | Ranking real patients for an invasive test on a 303-patient model would be overclaiming. A simulation on test data is the honest limit. |
| S1, S2 bypass versus stent, anatomy scoring | NO | Needs the angiogram. We have no lesion anatomy. |
| S3, S4 explaining to families | MODEST | The viewer helps explain which vessel supplies what. It cannot show the patient's real lesions. |
| S5 incomplete work-up | MODEST | An input completeness check is easy. |
| E1–E4 acute rule-out, ECG reading, troponin | NO | The dataset is referred, mostly stable patients with pre-coded ECG findings. This is not an acute chest-pain tool and must never be presented as one. |
| E5 undocumented scores | MODEST | Automatic, documented estimate with reasons, for the stable setting only. |
| E6 defensive over-referral | MODEST | Same caveat as C4. |
| N1, N2 transcription and handover | MODEST | Structured summary export. |
| N3 cath lab checklist | NO | Different problem; no data. |
| N4 patient questions | MODEST | Patient-friendly view. |
| N5 free-text reports | NO | We take structured inputs only. |
| A1, A2 cath lab capacity | MODEST | Threshold simulation on held-out data only. |
| A3, A5 justification record | MODEST | Exportable record of inputs, estimate, reasons and caveats. |
| A4 reputational risk | NO | Organisational. |
| R1 no cardiologist | MODEST | Only if the model works with the tests a clinic has. Today it needs all 52 inputs. |
| R2 travel cost of referral | NO directly | Indirectly via better referral decisions, unproven. |
| R3 few tests available | MODEST | Train models on reduced input sets and report honestly how much weaker they are. |
| R4 connectivity | MODEST | Logistic regression is small enough to run in the browser with no server. |
| R5 no summary on arrival | MODEST | Printable referral summary. |
| R6 follow-up | NO | No data. |

**What the gap analysis says:** our honest territory is the *stable, pre-angiography conversation*: estimating pre-test probability, showing how sure we are, explaining it, and documenting it. Acute triage, treatment choice, lesion anatomy, cost and adherence are out of reach.

---

## 3. Idea table (all candidates)

Rubric columns score expected lift from 0 (none) to 3 (strong): **P** predictive performance (30%), **3D** visualization (25%), **I** interpretability (20%), **S** system integration (15%), **T** technical implementation (10%). Effort: S under half a day, M 1–2 days, L 3+ days. ★ marks the non-obvious ideas.

| # | Idea | Effort | P | 3D | I | S | T | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | ★ Test ladder: models per level of available tests | M | 3 | 1 | 2 | 2 | 2 | Shortlist |
| 2 | ★ Uncertainty-aware anatomy | M | 2 | 3 | 3 | 1 | 1 | Shortlist |
| 3 | Patients like this (similar real cases) | S–M | 1 | 1 | 3 | 2 | 1 | Shortlist |
| 4 | Threshold explorer on held-out patients | S–M | 2 | 0 | 2 | 1 | 1 | Strong support |
| 5 | ★ Guess first, then reveal | S | 0 | 0 | 2 | 1 | 0 | Cheap support |
| 6 | ★ Offline in-browser model | M | 0 | 0 | 0 | 3 | 3 | Stretch |
| 7 | Patient view and clinician view | M | 0 | 1 | 3 | 1 | 0 | Later |
| 8 | Guided 3D explanation tour | M | 0 | 3 | 2 | 1 | 0 | Later |
| 9 | Territory shading on selection | S | 0 | 2 | 1 | 0 | 0 | Cheap support |
| 10 | ★ Physiology-driven heartbeat | S | 0 | 2 | 0 | 1 | 0 | Risky |
| 11 | Input plausibility and "unlike our data" guard | S | 1 | 0 | 2 | 2 | 1 | Cheap support |
| 12 | Calibration in plain words | S | 1 | 0 | 2 | 0 | 0 | Fold into 2 |
| 13 | Model sensitivity explorer (what-if) | M | 0 | 1 | 2 | 1 | 0 | Risky |
| 14 | One-page handover / referral summary | S | 0 | 0 | 1 | 2 | 1 | Cheap support |
| 15 | Subgroup audit (sex, age, diabetes) | S | 2 | 0 | 1 | 0 | 1 | Cheap support |
| 16 | In-app model card and data sheet | S | 1 | 0 | 1 | 0 | 1 | Fold into docs |
| 17 | Multi-patient triage worklist | M | 0 | 0 | 1 | 2 | 1 | Do not build |
| 18 | Hindi / Marathi patient summary | M | 0 | 0 | 1 | 1 | 0 | Later |
| 19 | External sanity check on UCI Cleveland | M | 2 | 0 | 0 | 0 | 1 | Optional |
| 20 | Number-of-diseased-vessels estimate | M | 1 | 1 | 1 | 0 | 0 | Do not build |

### Idea details

**1. ★ Test ladder.**
- *Pitch and pain:* show what can be said with history and examination alone, then with ECG, then labs, then echo, and how much each step sharpens the estimate. Solves R1, R3, E5 (clinics that lack tests) and A1 (which test is worth ordering).
- *Why novel:* typical dashboards demand every field or silently impute. This makes "what evidence do you have?" the organising idea and reports each level's accuracy.
- *Feasibility:* high. Four nested feature sets through the existing pipeline; training takes seconds. Each level gets its own cross-validated and hold-out metrics.
- *Risk:* lower rungs will be clearly weaker and vessel-level rungs may be near chance. Show that openly; a rung that is not better than chance is labelled "not informative" and not shown as a probability. Never suggest skipping a test.

**2. ★ Uncertainty-aware anatomy.**
- *Pitch and pain:* every probability gets a plausible range, and the heart shows it: a confident vessel is solid, an uncertain one is visibly hatched or translucent. Solves C7 (distrust) and P1.
- *Why novel:* almost every heart-risk demo paints a single colour as if it were certain. Here the anatomy itself says "we are less sure about this vessel".
- *Feasibility:* high. Refit the logistic regression on a few hundred bootstrap resamples (seconds on CPU) to get a per-patient range; ranges for SHAP values come from the same refits. Rendering is a material change, no new geometry.
- *Risk:* a bootstrap range reflects model instability, not all uncertainty (it cannot see that the patient differs from the Tehran cohort). Say so. LCX and RCA will look uncertain for almost everyone, which is the honest picture.

**3. Patients like this.**
- *Pitch and pain:* "Of the 10 most similar patients in the dataset, 7 had LAD stenosis on angiography." Solves C7 and P1; clinicians reason by cases.
- *Why novel:* grounds a model output in real outcomes, and gives a second, model-independent check that can disagree with the model.
- *Feasibility:* high. Nearest neighbours among the 242 training patients, weighted by what the model considers important. The data is public and de-identified.
- *Risk:* ten neighbours is a small sample and neighbours in a 303-patient set may not be very close. Show how similar they actually are, and call it "what happened in the dataset", not a prediction.

**4. Threshold explorer on held-out patients.**
- *Pitch and pain:* drag a referral threshold and read, in people: "of the 61 held-out patients, X normal angiograms flagged as low risk, Y patients with CAD missed". Solves C4, A2, E6.
- *Why novel:* turns a confusion matrix into the actual trade-off a department argues about; optionally a decision curve (net benefit versus "refer everyone").
- *Feasibility:* high. Pure computation on saved test predictions.
- *Risk:* 61 patients, 17 of them normal: numbers are tiny and must be shown as counts with that caveat. At the current threshold the model misses 9 of 44 CAD patients, so the honest message may be "few angiograms are safely avoidable". That is acceptable; it is the truth.

**5. ★ Guess first, then reveal.**
- *Pitch and pain:* the clinician enters their own estimate before the model's appears; the app then shows the gap and which factors explain it. Solves C7 and automation bias.
- *Why novel:* treats disagreement as the interesting event instead of hiding it.
- *Feasibility:* high; a small interface change, session-only storage.
- *Risk:* could feel like a quiz. Make it optional.

**6. ★ Offline in-browser model.**
- *Pitch and pain:* export the logistic regression (scaler, weights, calibration) to a small file and compute predictions and exact SHAP in the browser, with no server. Solves R4.
- *Why novel:* only possible because we chose a linear model; shows the simplicity paying off.
- *Feasibility:* good. For a linear model SHAP has a closed form. Needs a parity check against the backend.
- *Risk:* two implementations can drift; the parity check is mandatory. "Runs offline" must not become "ready for rural deployment".

**7. Patient view and clinician view.**
- *Pitch and pain:* one toggle. Patient view uses plain words, "about 6 in 10 people like this" icon arrays, and "questions to ask your doctor". Solves P1, P3, N4.
- *Why novel:* icon arrays are an established way to communicate risk, rarely seen in hackathon dashboards.
- *Feasibility:* medium; mostly writing and layout.
- *Risk:* patients acting on it alone. Keep the framing "to discuss with your doctor", hide vessel-level numbers for LCX and RCA in this view.

**8. Guided 3D explanation tour.**
- *Pitch and pain:* one button; the camera moves from the whole heart to each vessel while a template-written sentence explains the top factors. Solves C5, P1.
- *Why novel:* the anatomy carries the explanation in sequence.
- *Feasibility:* medium; camera glide already exists. Text is template-based, not generated by a language model.
- *Risk:* scripted text can sound more certain than the model is; include the reliability tag in the script.

**9. Territory shading.**
- *Pitch and pain:* selecting a vessel tints the region of heart muscle it usually supplies. Solves C5, S3.
- *Feasibility:* high; regions fall out of the same surface function.
- *Risk:* coronary territories vary between people; label "typical territory".

**10. ★ Physiology-driven heartbeat.**
- *Pitch and pain:* the heart beats at the entered pulse rate and contracts more weakly when the ejection fraction is low, so two inputs become visible.
- *Feasibility:* high; a scale animation.
- *Risk:* high gimmick risk and it implies patient-specific imaging. It also forces continuous rendering. Only with an "illustrative" label and an off switch.

**11. Input plausibility and "unlike our data" guard.**
- *Pitch and pain:* flag contradictory inputs (typical and atypical chest pain both "yes"; lymphocytes plus neutrophils above 100%) and patients outside the range the model saw. Solves S5, C7.
- *Feasibility:* high.
- *Risk:* low; too many warnings would be ignored, so keep to a few clear rules.

**12. Calibration in plain words.**
- *Pitch:* "When the model said around 70%, N of M held-out patients actually had CAD."
- *Feasibility:* high. *Risk:* bins are tiny; show counts.

**13. Model sensitivity explorer (what-if).**
- *Pitch:* move a slider and see how the model's estimate responds.
- *Risk:* high. The model is associational. In our own example a *lower* body-mass index and a *higher* potassium raised the CAD estimate; a patient-facing "what would lower my risk" would produce advice like "gain weight". Only acceptable as a clinician-facing "how sensitive is this estimate to one input" tool, never as lifestyle guidance.

**14. One-page handover / referral summary.**
- *Pitch and pain:* print or save inputs, estimates, top reasons and caveats on one page. Solves N2, R5, A5.
- *Feasibility:* high (print stylesheet). *Risk:* a printed page loses the interactive caveats; the disclaimer and reliability tags must print too.

**15. Subgroup audit.**
- *Pitch and pain:* performance for women versus men, under versus over 55, diabetic versus not. Solves C6.
- *Feasibility:* high, from cross-validation predictions. *Risk:* small groups (127 women); intervals will be wide and must be shown.

**16. In-app model card.** Data source, intended use, not-intended use, metrics. Belongs in the documentation and a small "about" panel.

**17. Multi-patient triage worklist.** A ranked queue of patients. See critique: overclaims.

**18. Hindi / Marathi patient summary.** Useful for the Indian context but only after idea 7 exists, and translations of medical terms need a native reviewer.

**19. External check on UCI Cleveland.** Would strengthen validation, but only a handful of features overlap and it needs a second dataset. Likely result: a noticeably lower AUC, which is still worth reporting.

**20. Number-of-diseased-vessels estimate.** Would speak to bypass-versus-stent, but multiplying three weak vessel probabilities is not valid (they are correlated) and a dedicated model would be weak.

---

## 4. Critique

**Gimmicks**
- 10 (heartbeat) is eye-catching but explains nothing the numbers do not. Worth it only if the 3D score needs a lift and everything else is done.
- 8 (tour) is strong for the demo video, weak as a product feature.

**Could embarrass us in front of clinician judges**
- 13 (what-if) presented to patients. The model's coefficients include associations that are not causal and some that run against clinical intuition. This is the single most dangerous idea on the list.
- 17 (triage worklist). Ranking patients for an invasive test with a 303-patient, single-centre model invites the question "would you let this order your list?".
- 20 (vessel count) and anything hinting at bypass-versus-stent. We have no anatomy.
- Any acute chest-pain framing. The dataset is not an emergency cohort.
- Any India-specific accuracy claim. The data is not Indian.

**Redundant**
- 12 is a small piece of 2. 16 belongs in the docs. 4 and 17 solve the same pain; 4 is the honest version.
- 7 and 18 are one feature in two steps.

**Weak-vessel check.** Ideas 1, 2, 3 and 4 all make LCX and RCA look *less* impressive: wider ranges, mixed neighbours, uninformative rungs. That is a feature. A product whose headline is honesty about confidence turns our weakest numbers into the demonstration.

**What not to build**
- A language-model chatbot that explains results. Hallucination risk, an external dependency, and no way to audit it.
- Drawn plaques or narrowings at a location on a vessel. The dataset has no lesion positions.
- Heart-attack or mortality risk, or treatment recommendations. No outcome or treatment data.
- ECG or echo image upload. We have no image data and the brief excludes it.
- Longitudinal tracking, reminders or adherence features. No follow-up data.
- A patient-facing lifestyle what-if (see 13).
- A live triage queue (17) and vessel-count estimate (20).
- More charts for their own sake.

---

## 5. Recommended shortlist

One story: **"an honest second opinion before angiography: what the available evidence supports, how sure we are, and what happened to similar real patients."**

### A. Uncertainty-aware anatomy (ideas 2 + 12 + 11)

- *Why it wins on the rubric:* lifts 3D visualization (the anatomy encodes confidence, not just a colour) and interpretability (ranges on probabilities and on each factor), and adds validation depth to predictive performance.
- *Two-minute demo moment:* load the borderline patient. LAD is solid amber with a tight range; LCX and RCA are visibly hatched. "Most dashboards would paint all three the same. Ours shows you which one to believe."
- *Main risk:* judges may read uncertainty as weakness. Counter by stating the hold-out numbers up front.

### B. Patients like this (idea 3)

- *Why it wins:* interpretability a clinician recognises immediately; system integration (model, dataset and interface working together).
- *Demo moment:* "The model says 62%. Of the ten most similar patients in the dataset, six had CAD on angiography. Here they are." Then a case where neighbours and model disagree, shown openly.
- *Main risk:* neighbours that are not very similar. Show the similarity and the sample size.

### C. Test ladder (idea 1)

- *Why it wins:* the only shortlist item that directly adds to predictive performance (30%), through four separately validated models, and it answers the rural and general-physician pain with our own data.
- *Demo moment:* enter only history and examination; the estimate appears with a wide range. Add ECG, then labs, then echo, and watch the range narrow and the heart firm up. "This is what each test buys you."
- *Main risk:* lower rungs perform poorly. Then the finding is "history alone is not enough for vessel-level prediction", reported as such.

### Stretch: offline in-browser model (idea 6)

- *Why:* pairs with the test ladder for the low-resource story, and scores on system integration and technical implementation.
- *Demo moment:* stop the backend on camera; the app keeps predicting, with identical numbers.
- *Main risk:* drift between the two implementations; needs an automated parity check.

### Cheap supporting items, if time allows

4 (threshold explorer), 14 (one-page summary), 15 (subgroup audit), 9 (territory shading), 5 (guess first). Each is under half a day and fits the same story.

---

## 6. Product narrative

CardioVis 3D is a pre-angiography conversation tool, not a diagnosis machine. For a patient already being considered for coronary angiography, it takes whatever clinical, ECG, lab and echo findings are available and shows, on a 3D heart, the estimated chance of coronary disease overall and in each main artery. What sets it apart is that it shows its confidence as plainly as its estimate: arteries the model is unsure about look unsure, every probability comes with a range and the reasons behind it, and each estimate is set beside what actually happened to the most similar real patients in the data. It tells a clinic with only a stethoscope and an ECG what can and cannot be said, and what the next test would add. It is built on 303 patients from one centre and says so on every screen.

---

## 7. Open questions for you

1. How many working days are left before submission? The shortlist is about 4–6 days as scoped.
2. Will the judges include practising clinicians? That decides how much weight goes on honesty features versus visual impact.
3. Is the demo aimed at clinicians, patients or both? The patient view (idea 7) only makes sense if patients are in the story.
4. The test ladder means training and reporting extra models. Are you happy for the metrics tables and the 6-page document to grow to cover them?
5. Is a second public dataset (UCI Cleveland) allowed, for an external check?
6. Do you want Indian-language text? If so, who can review the translations?
7. Does the submission need a hosted demo, or is a local run plus video enough? That changes the value of the offline stretch idea.
8. Should the two things flagged in Phase 4 (mid-range colours look similar; faint selection outline) be fixed before or alongside these?

---

## 8. Sources

**Opened and read**

- [S1] Pope et al., "Missed diagnoses of acute cardiac ischemia in the emergency department", NEJM 2000, as summarised by AHRQ PSNet: https://psnet.ahrq.gov/issue/missed-diagnoses-acute-cardiac-ischemia-emergency-department
- [S2] "Predictors of non-obstructive coronary artery disease in patients undergoing elective coronary angiography", Global Heart (Tabba Heart Institute, Karachi): https://globalheartjournal.com/articles/10.5334/gh.1204
- [S3] "Changing management of acute MI: perspectives from India", EuroIntervention (reports CREATE and Kerala ACS registry figures): https://eurointervention.pcronline.com/article/changing-management-of-acute-mi-ndash-perspectives-from-india/pdf
- [S4] News report of Astin et al., European Journal of Cardiovascular Nursing 2019, on patient beliefs about elective angioplasty: https://www.dicardiology.com/content/study-patients-overestimate-benefits-pci
- [S5] American College of Cardiology journal scan of the PURE study (secondary-prevention medicine use in 17 countries): https://www.acc.org/Latest-in-Cardiology/Journal-Scans/2025/02/03/16/20/PURE-Secondary-Prevention-Medications-For-CVD-Underused-Globally
- [S6] Medical Buyer, "Cath labs: where capital meets cardiac care" (trade publication; figures not attributed to a primary source): https://medicalbuyer.co.in/cath-labs-where-capital-meets-cardiac-care/

**Found by search but not opened (bot check, 403 or rate limit). Nothing is quoted from these; read them before citing.**

- Patel et al., "Low diagnostic yield of elective coronary angiography", NEJM 2010: https://pubmed.ncbi.nlm.nih.gov/20220183/
- "Bridging the gap: geographic and socioeconomic inequities in access to cardiac catheterization in India", JSCAI: https://www.jscai.org/article/S2772-9303(26)00012-8/fulltext
- "Choosing the right model for STEMI care in India": https://pmc.ncbi.nlm.nih.gov/articles/PMC9903390/
- Rothberg et al., "Patients overestimate the potential benefits of elective PCI": https://pubmed.ncbi.nlm.nih.gov/22428453/
- "The household-level economic burden of heart disease in India": https://pubmed.ncbi.nlm.nih.gov/24612174/
- PURE study original paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC3861210/

**Internal figures** (hold-out AUCs, 87 of 303 normal angiograms, 9 of 44 CAD patients missed at the current threshold, 127 women) come from `reports/metrics.json` and `reports/data_audit.json` in this repository.
