/**
 * @file playwright.config.ts
 * @description Playwright E2E 테스트 설정 (Clerk Testing Token 적용)
 *
 * 주요 기능:
 * 1. 글로벌 셋업 프로젝트 실행
 * 2. 인증 상태(storageState) 재사용
 * 3. 로컬/배포 환경 baseURL 설정
 */

import path from "path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const authStatePath = path.join(__dirname, "playwright/.clerk/user.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "global setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "authenticated",
      testMatch: /.*authenticated\.spec\.ts/,
      dependencies: ["global setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: authStatePath,
      },
    },
  ],
});
