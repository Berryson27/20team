import { defineSecret } from "firebase-functions/params";

/**
 * 배포 시 Secret Manager 로 주입되는 시크릿.
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set HANQ_SIGNING_SECRET
 * 로컬 에뮬레이터는 functions/.env 값을 사용.
 * 바인딩된 함수에서는 process.env.<이름> 으로 접근된다(config.ts 참조).
 */
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
export const HANQ_SIGNING_SECRET = defineSecret("HANQ_SIGNING_SECRET");
