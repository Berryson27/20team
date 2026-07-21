import { onRequest } from "firebase-functions/v2/https";

export const verify = onRequest({ region: "us-central1", cors: true }, (_req, res) => {
  res.json({ ok: true, stub: true });
});
