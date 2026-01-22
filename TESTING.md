---
title: Testing Guide
description: Playwright + Clerk Testing Token 설정 및 실행 방법
---

# Testing Guide

이 문서는 Clerk bot detection 이슈를 피하기 위한
Playwright E2E 테스트 설정을 설명합니다.

## 변경 파일 목록

- `playwright.config.ts`
- `tests/global.setup.ts`
- `tests/e2e/admin-inventory.authenticated.spec.ts`
- `package.json`
- `.gitignore`

## 필수 환경 변수

테스트 러너 환경에서만 아래 값을 주입하세요.
Secret Key는 **절대 브라우저 번들에 노출되면 안 됩니다.**

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `E2E_CLERK_USER_USERNAME`
- `E2E_CLERK_USER_PASSWORD`
- `PLAYWRIGHT_BASE_URL` (기본값: `http://localhost:3000`)

> 테스트 계정은 **관리자 권한**이 있어야 합니다.

## .env.test.local 사용 (선택)

아래 파일이 있으면 `tests/global.setup.ts`에서 자동으로 로드합니다.

- `./.env.test.local` (권장)
- `./types/.env.test.local` (현재 위치도 지원)

예시:
```
E2E_CLERK_USER_USERNAME=e2e-admin@example.com
E2E_CLERK_USER_PASSWORD=Test1234!
```

## 설치

```bash
pnpm add -D @clerk/testing @playwright/test
```

## 실행

```bash
pnpm exec playwright test
```

## 동작 방식 요약

1. `tests/global.setup.ts`에서 `clerkSetup()`로 Testing Token 준비
2. `clerk.signIn()`으로 테스트 계정 로그인 후 storageState 저장
3. 각 테스트에서 `setupClerkTestingToken({ page })` 호출
4. 보호된 페이지(`/admin/inventory`) 접근 확인
