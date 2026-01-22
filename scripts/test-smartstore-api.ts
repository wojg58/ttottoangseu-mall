/**
 * @file scripts/test-smartstore-api.ts
 * @description 스마트스토어 토큰 발급 단독 검증 스크립트
 *
 * 실행:
 * - pnpm tsx scripts/test-smartstore-api.ts
 *
 * 필수 환경 변수:
 * - NAVER_COMMERCE_CLIENT_ID (권장, 네이버 커머스/스마트스토어 API 전용)
 * - NAVER_COMMERCE_CLIENT_SECRET (권장)
 * - NAVER_SMARTSTORE_CLIENT_ID (기존 호환)
 * - NAVER_SMARTSTORE_CLIENT_SECRET (기존 호환)
 *
 * 주의: 네이버 로그인(OAuth)용 키가 아닙니다.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { createRequire } from "module";

const BASE_URL = "https://api.commerce.naver.com/external";
const CLIENT_ID =
  process.env.NAVER_COMMERCE_CLIENT_ID ||
  process.env.NAVER_SMARTSTORE_CLIENT_ID;
const CLIENT_SECRET =
  process.env.NAVER_COMMERCE_CLIENT_SECRET ||
  process.env.NAVER_SMARTSTORE_CLIENT_SECRET;
const require = createRequire(import.meta.url);
const bcryptPkg = require("bcrypt/package.json") as { name: string; version: string };

const LOGIN_CLIENT_ID_KEYS = [
  "NAVER_LOGIN_CLIENT_ID",
  "NAVER_OAUTH_CLIENT_ID",
  "NAVER_SOCIAL_CLIENT_ID",
  "NAVER_CLIENT_ID",
] as const;

function normalizeEnvValue(value: string) {
  return value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
}

function mask(value: string, visible: number = 4) {
  if (value.length <= visible) return "*".repeat(value.length);
  return `${value.slice(0, visible)}***`;
}

function describeValueForLog(value: string) {
  const normalized = normalizeEnvValue(value);
  const prefix = normalized.slice(0, 4);
  const suffix = normalized.slice(-4);
  return {
    length: normalized.length,
    trimmed: normalized !== value,
    prefix,
    suffix,
  };
}

function getCommonPrefixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[count] === b[count]) count += 1;
  return count;
}

function getCommonSuffixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[a.length - 1 - count] === b[b.length - 1 - count]) {
    count += 1;
  }
  return count;
}

function warnIfLoginKeySuspected(clientId: string) {
  const normalized = normalizeEnvValue(clientId);
  const matchedEnvKeys: string[] = [];

  for (const key of LOGIN_CLIENT_ID_KEYS) {
    const candidate = process.env[key];
    if (!candidate) continue;
    const candidateNormalized = normalizeEnvValue(candidate);
    const sameValue = candidateNormalized === normalized;
    const prefixMatch = getCommonPrefixLength(
      candidateNormalized,
      normalized,
    ) >= 6;
    const suffixMatch = getCommonSuffixLength(
      candidateNormalized,
      normalized,
    ) >= 4;
    if (sameValue || (prefixMatch && suffixMatch)) {
      matchedEnvKeys.push(key);
    }
  }

  if (matchedEnvKeys.length > 0) {
    const info = describeValueForLog(clientId);
    console.warn(
      "[WARN] client_id가 네이버 로그인(OAuth) 키와 유사해 보입니다.",
      {
        matchedEnvKeys,
        clientIdLength: info.length,
        clientIdPrefix: info.prefix,
        clientIdSuffix: info.suffix,
      },
    );
  }
}

function ensureEnv(name: string, value?: string) {
  if (!value) {
    throw new Error(`환경 변수 누락: ${name}`);
  }
  return value;
}

function ensureSmartstoreEnv(
  primaryName: string,
  fallbackName: string,
  value?: string,
) {
  if (!value) {
    throw new Error(
      `환경 변수 누락: ${primaryName} (또는 ${fallbackName})`,
    );
  }
  return value;
}

function toBase64Url(value: string) {
  const base64 = Buffer.from(value, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken(): Promise<string> {
  const clientIdRaw = ensureSmartstoreEnv(
    "NAVER_COMMERCE_CLIENT_ID",
    "NAVER_SMARTSTORE_CLIENT_ID",
    CLIENT_ID,
  );
  const clientSecret = ensureSmartstoreEnv(
    "NAVER_COMMERCE_CLIENT_SECRET",
    "NAVER_SMARTSTORE_CLIENT_SECRET",
    CLIENT_SECRET,
  );
  const clientId = normalizeEnvValue(clientIdRaw);
  const timestamp = Date.now();
  const password = `${clientId}_${timestamp}`;
  const clientIdInfo = describeValueForLog(clientIdRaw);
  const clientSecretInfo = describeValueForLog(clientSecret);

  // #region agent log
  fetch(
    "http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "scripts/test-smartstore-api.ts:getAccessToken",
        message: "token request inputs (sanitized)",
        data: {
          timestampLength: String(timestamp).length,
          clientIdLength: clientIdInfo.length,
          clientIdTrimmed: clientIdInfo.trimmed,
          clientIdPrefix: clientIdInfo.prefix,
          clientIdSuffix: clientIdInfo.suffix,
          clientSecretLength: clientSecretInfo.length,
          clientSecretTrimmed: clientSecretInfo.trimmed,
          clientSecretPrefix: clientSecretInfo.prefix,
          clientSecretSuffix: clientSecretInfo.suffix,
        },
        timestamp: Date.now(),
      }),
    },
  ).catch(() => {});
  // #endregion agent log

  let hashed: string;
  try {
    hashed = bcrypt.hashSync(password, clientSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`서명 생성 실패: ${message}`);
  }
  const signature =
    typeof Buffer.from(hashed, "utf-8").toString === "function"
      ? Buffer.from(hashed, "utf-8").toString("base64url")
      : toBase64Url(hashed);
  const hashedPrefix = hashed.slice(0, 4);
  const hashedSuffix = hashed.slice(-4);
  const signaturePrefix = signature.slice(0, 4);
  const signatureSuffix = signature.slice(-4);

  // #region agent log
  fetch(
    "http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "scripts/test-smartstore-api.ts:getAccessToken",
        message: "bcrypt hash and signature lengths",
        data: {
          hashLength: hashed.length,
          hashPrefix: hashedPrefix,
          hashSuffix: hashedSuffix,
          signatureLength: signature.length,
          signaturePrefix,
          signatureSuffix,
          signatureEncoding: "base64url",
        },
        timestamp: Date.now(),
      }),
    },
  ).catch(() => {});
  // #endregion agent log

  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      timestamp: timestamp.toString(),
      client_secret_sign: signature,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ERROR] 토큰 발급 실패", {
      status: response.status,
      statusText: response.statusText,
      responseText: errorText,
    });
    throw new Error(
      `토큰 발급 실패: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  return data.access_token;
}

async function main() {
  console.log("🚀 스마트스토어 토큰 발급 테스트 시작");
  console.log(
    "[INFO] bcrypt package:",
    `${bcryptPkg.name}@${bcryptPkg.version}`,
  );
  console.log(
    "[INFO] 문서 Node.js 예제 확인: bcrypt hash + base64",
  );
  const clientIdRaw = ensureSmartstoreEnv(
    "NAVER_COMMERCE_CLIENT_ID",
    "NAVER_SMARTSTORE_CLIENT_ID",
    CLIENT_ID,
  );
  const clientSecretRaw = ensureSmartstoreEnv(
    "NAVER_COMMERCE_CLIENT_SECRET",
    "NAVER_SMARTSTORE_CLIENT_SECRET",
    CLIENT_SECRET,
  );
  const clientIdInfo = describeValueForLog(clientIdRaw);
  const clientSecretInfo = describeValueForLog(clientSecretRaw);

  console.log("[ENV] client_id:", mask(clientIdRaw));
  console.log("[ENV] client_id.length:", clientIdInfo.length);
  console.log("[ENV] client_id.trimmed:", clientIdInfo.trimmed);
  console.log(
    "[ENV] client_id.prefix/suffix:",
    `${clientIdInfo.prefix}...${clientIdInfo.suffix}`,
  );
  console.log("[ENV] client_secret:", mask(clientSecretRaw));
  console.log("[ENV] client_secret.length:", clientSecretInfo.length);
  console.log("[ENV] client_secret.trimmed:", clientSecretInfo.trimmed);
  console.log(
    "[ENV] client_secret.prefix/suffix:",
    `${clientSecretInfo.prefix}...${clientSecretInfo.suffix}`,
  );

  warnIfLoginKeySuspected(clientIdRaw);

  console.log("\n--- 토큰 발급 테스트 ---");
  const token = await getAccessToken();
  console.log("✅ 토큰 발급 성공 (token 길이:", token.length, ")");
  console.log("✅ access_token(앞 6자):", token.slice(0, 6) + "***");
  console.log("✅ expires_in: 응답 본문에 포함");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ 실패:", message);
  process.exit(1);
});
