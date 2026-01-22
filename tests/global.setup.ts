/**
 * @file tests/global.setup.ts
 * @description Clerk 테스트 토큰 셋업 + 인증 상태 저장
 *
 * 주요 기능:
 * 1. clerkSetup() 호출로 Testing Token 준비
 * 2. 테스트 계정으로 로그인 후 storageState 저장
 *
 * @dependencies
 * - @clerk/testing/playwright
 * - @playwright/test
 */

import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import {
  clerk,
  clerkSetup,
  setupClerkTestingToken,
} from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");
const envPathCandidates = [
  path.join(__dirname, "../.env.test.local"),
  path.join(__dirname, "../types/.env.test.local"),
];

const envPath = envPathCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  loadEnv({ path: envPath });
  console.log(`[global.setup] 테스트 환경 변수 로드: ${envPath}`);
} else {
  console.log("[global.setup] .env.test.local 파일을 찾지 못했습니다.");
}

setup("global setup", async () => {
  console.log("[global.setup] Clerk Testing Token 준비 시작");
  await clerkSetup();
  console.log("[global.setup] Clerk Testing Token 준비 완료");
});

setup("authenticate and save state", async ({ page }) => {
  console.log("[global.setup] 인증 상태 저장 시작");
  await setupClerkTestingToken({ page });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clerk.loaded({ page });

  const emailAddress = process.env.E2E_CLERK_USER_USERNAME;
  if (!emailAddress) {
    throw new Error(
      "[global.setup] E2E_CLERK_USER_USERNAME 환경 변수가 없습니다.",
    );
  }

  await clerk.signIn({
    page,
    emailAddress,
  });

  await page.goto("/debug-auth", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=✅ 로그인됨", { timeout: 30_000 });
  const isAdminDenied =
    (await page.locator("text=❌ 관리자 권한 없음").count()) > 0;
  if (isAdminDenied) {
    throw new Error(
      "[global.setup] 관리자 권한 없음: Clerk publicMetadata에 isAdmin=true 또는 role=admin 필요",
    );
  }

  await page.goto("/admin/inventory", { waitUntil: "domcontentloaded" });
  const currentUrl = page.url();
  if (currentUrl.includes("/sign-in")) {
    throw new Error(
      "[global.setup] /admin/inventory 접근 실패: 로그인 화면으로 리다이렉트됨 (관리자 권한/세션 확인 필요)",
    );
  }

  await page.waitForSelector("text=재고 관리", { timeout: 30_000 });
  await page.context().storageState({ path: authFile });
  console.log("[global.setup] 인증 상태 저장 완료");
});
