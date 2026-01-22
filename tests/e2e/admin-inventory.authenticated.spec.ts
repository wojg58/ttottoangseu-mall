/**
 * @file tests/e2e/admin-inventory.authenticated.spec.ts
 * @description 관리자 재고 페이지 접근 E2E 테스트 (Clerk Testing Token)
 *
 * 주요 기능:
 * 1. setupClerkTestingToken()으로 bot detection 우회 후 접근
 * 2. 관리자 재고 페이지 렌더링 확인
 */

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test("admin inventory page loads without Clerk bot detection", async ({
  page,
}) => {
  await setupClerkTestingToken({ page });
  await page.goto("/admin/inventory");

  await expect(page.getByRole("heading", { name: "재고 관리" })).toBeVisible();
});
