/** Product-level constants. The product name lives here and nowhere else in the frontend. */
export const APP_NAME = "HrudayAI";
export const APP_TAGLINE = "Coronary risk explorer";

export const FALLBACK_DISCLAIMER =
  "For decision support and educational purposes only. Not a substitute for formal diagnostic imaging or clinical judgement.";

export const HEART_MODEL_URL = "/models/heart.glb";
export const HEART_MODEL_CREDIT =
  "Anatomy: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan";

/** Hold-out ROC-AUC below this gets a "lower reliability" tag. */
export const RELIABILITY_AUC_FLOOR = 0.75;
