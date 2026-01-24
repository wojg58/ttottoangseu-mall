require("dotenv").config();

function normalizeEnvValue(value) {
  if (!value) return "";
  return value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
}

const clientIdRaw =
  process.env.NAVER_SMARTSTORE_CLIENT_ID ||
  process.env.NAVER_COMMERCE_CLIENT_ID ||
  "";
const clientSecretRaw =
  process.env.NAVER_SMARTSTORE_CLIENT_SECRET ||
  process.env.NAVER_COMMERCE_CLIENT_SECRET ||
  "";

const clientId = normalizeEnvValue(clientIdRaw);
const clientSecret = normalizeEnvValue(clientSecretRaw);

console.log("[CHECK] CLIENT_ID:");
console.log("  Length:", clientId.length);
console.log("  First 10:", clientId.substring(0, 10));
console.log("  Last 10:", clientId.substring(Math.max(0, clientId.length - 10)));

console.log("\n[CHECK] CLIENT_SECRET:");
console.log("  Length:", clientSecret.length);
console.log("  First 10:", clientSecret.substring(0, 10));
console.log("  Last 10:", clientSecret.substring(Math.max(0, clientSecret.length - 10)));
console.log(
  "  Has bcrypt format:",
  clientSecret.startsWith("$2a$") || clientSecret.startsWith("$2b$"),
);

// 테스트: 실제 서명 생성 시도
const bcrypt = require("bcrypt");
const timestamp = Date.now();
const password = `${clientId}_${timestamp}`;

console.log("\n[TEST] 서명 생성 테스트:");
console.log("  Password format:", `${clientId.substring(0, 10)}..._${timestamp}`);

try {
  const hashed = bcrypt.hashSync(password, clientSecret);
  const signature = Buffer.from(hashed, "utf-8").toString("base64");
  console.log("  ✅ 서명 생성 성공");
  console.log("  Hashed length:", hashed.length);
  console.log("  Signature length:", signature.length);
  console.log("  Signature first 30:", signature.substring(0, 30));
} catch (error) {
  console.error("  ❌ 서명 생성 실패:", error.message);
  console.error("  Error:", error);
}
