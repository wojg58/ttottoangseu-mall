# Clerk 관련 코드 위치 가이드

이 문서는 프로젝트에서 Clerk 인증 관련 코드가 어디에 있는지 정리한 문서입니다.

## 📁 주요 디렉토리 구조

```
프로젝트 루트/
├── app/
│   ├── layout.tsx                    # ClerkProvider 설정
│   ├── sign-in/[[...rest]]/          # 로그인 페이지
│   ├── sign-up/[[...rest]]/          # 회원가입 페이지
│   └── api/
│       ├── sync-user/route.ts         # Clerk → Supabase 사용자 동기화 API
│       └── log-oauth-callback/route.ts # OAuth 콜백 로그 API
├── components/
│   ├── auth-session-sync.tsx          # OAuth 콜백 후 세션 동기화
│   ├── providers/
│   │   └── sync-user-provider.tsx    # 사용자 동기화 프로바이더
│   └── shop-header.tsx                # 헤더 (로그인 상태 표시)
├── hooks/
│   └── use-sync-user.ts               # Clerk → Supabase 동기화 훅
├── lib/
│   ├── supabase/
│   │   ├── clerk-client.ts           # 클라이언트용 Supabase 클라이언트 (Clerk 토큰 사용)
│   │   ├── server.ts                 # 서버용 Supabase 클라이언트 (Clerk 인증)
│   │   └── service-role.ts           # 관리자 권한 Supabase 클라이언트
│   └── api-utils.ts                  # API 인증 헬퍼
├── middleware.ts                      # Clerk 미들웨어 (인증 라우트 보호)
└── scripts/
    └── clerk-userinfo-proxy.js        # 네이버 OAuth UserInfo 프록시 서버
```

## 🔑 핵심 파일 설명

### 1. 인증 설정

#### `app/layout.tsx`
- **역할**: ClerkProvider 설정 및 한국어 로컬라이제이션
- **주요 내용**:
  - `ClerkProvider`로 앱 전체를 감싸기
  - 한국어 로컬라이제이션 커스터마이징
  - `SyncUserProvider` 통합
  - `AuthSessionSync` 컴포넌트 추가

#### `middleware.ts`
- **역할**: Clerk 미들웨어로 인증이 필요한 라우트 보호
- **주요 내용**:
  - 공개 라우트와 보호된 라우트 구분
  - 인증되지 않은 사용자 리다이렉트

### 2. 사용자 동기화

#### `hooks/use-sync-user.ts`
- **역할**: Clerk 사용자를 Supabase DB에 자동 동기화하는 훅
- **주요 내용**:
  - `useAuth`, `useUser` 훅 사용
  - 로그인 상태 확인 후 `/api/sync-user` 호출
  - OAuth 로그인 시 사용자 정보 로딩 대기
  - 강제 동기화 재시도 메커니즘

#### `components/providers/sync-user-provider.tsx`
- **역할**: `useSyncUser` 훅을 루트 레벨에서 실행하는 프로바이더
- **주요 내용**:
  - RootLayout에서 사용
  - 모든 페이지에서 자동으로 사용자 동기화 실행

#### `app/api/sync-user/route.ts`
- **역할**: Clerk 사용자 정보를 Supabase `users` 테이블에 저장/업데이트
- **주요 내용**:
  - Clerk 인증 확인 (`auth()`)
  - Clerk에서 사용자 정보 가져오기 (`clerkClient().users.getUser()`)
  - External Accounts 확인 (OAuth 연결 여부)
  - Supabase에 사용자 정보 저장/업데이트
  - Sentry 로깅 통합

### 3. OAuth 콜백 처리

#### `components/auth-session-sync.tsx`
- **역할**: OAuth 콜백 후 Clerk 세션 동기화 및 검증
- **주요 내용**:
  - OAuth 콜백 URL 감지 (`__clerk_redirect_url`, `__clerk_status`)
  - 세션 생성 여부 검증 (`isSignedIn`, `userId`, `sessionId`)
  - External Account 연결 확인
  - 서버로 로그 전송 (`/api/log-oauth-callback`)
  - Sentry 에러 리포팅
  - 리다이렉션 제어 (Network 탭 확인 시간 확보)

#### `app/api/log-oauth-callback/route.ts`
- **역할**: OAuth 콜백 결과를 서버에 로깅
- **주요 내용**:
  - 클라이언트에서 세션 상태 수신
  - 서버 콘솔에 상세 로그 출력
  - 세션 생성 성공/실패 추적

### 4. Supabase 클라이언트 (Clerk 통합)

#### `lib/supabase/clerk-client.ts`
- **역할**: 클라이언트 컴포넌트용 Supabase 클라이언트
- **주요 내용**:
  - `useClerkSupabaseClient` 훅 제공
  - Clerk 세션 토큰을 Supabase JWT로 변환
  - RLS 정책이 `auth.jwt()->>'sub'`로 Clerk user ID 확인

#### `lib/supabase/server.ts`
- **역할**: 서버 컴포넌트/Server Action용 Supabase 클라이언트
- **주요 내용**:
  - `createClerkSupabaseClient` 함수 제공
  - 서버 사이드에서 Clerk 인증 사용
  - RLS 정책 적용

#### `lib/supabase/service-role.ts`
- **역할**: 관리자 권한 작업용 Supabase 클라이언트
- **주요 내용**:
  - `SUPABASE_SERVICE_ROLE_KEY` 사용
  - RLS 우회
  - 서버 사이드 전용

### 5. 로그인/회원가입 페이지

#### `app/sign-in/[[...rest]]/sign-in-content.tsx`
- **역할**: 로그인 페이지 UI 및 네이버 OAuth 로그인 처리
- **주요 내용**:
  - Clerk 기본 로그인 UI 커스터마이징
  - 네이버 로그인 버튼 (`authenticateWithRedirect`)
  - 로그인 성공 후 리다이렉트 처리

#### `app/sign-up/[[...rest]]/sign-up-content.tsx`
- **역할**: 회원가입 페이지 UI
- **주요 내용**:
  - Clerk 기본 회원가입 UI 커스터마이징

### 6. 네이버 OAuth 프록시 서버

#### `scripts/clerk-userinfo-proxy.js`
- **역할**: 네이버 UserInfo API 응답을 Clerk 형식으로 변환
- **주요 내용**:
  - 네이버의 중첩된 JSON 응답을 평탄화
  - `sub` 필드를 base64url로 인코딩
  - OAuth 2.0 표준 필드 매핑
  - AWS EC2에서 PM2로 실행

### 7. 헤더 및 UI 컴포넌트

#### `components/shop-header.tsx`
- **역할**: 쇼핑몰 헤더 (로그인 상태 표시)
- **주요 내용**:
  - `useAuth` 훅으로 로그인 상태 확인
  - Clerk `UserButton` 사용
  - 로그인/로그아웃 상태에 따른 UI 변경

## 🔍 Clerk 훅 및 API 사용 위치

### `useAuth()` 사용 위치
- `hooks/use-sync-user.ts`
- `components/auth-session-sync.tsx`
- `components/shop-header.tsx`
- `app/sign-in/[[...rest]]/sign-in-content.tsx`
- 기타 인증 상태가 필요한 컴포넌트들

### `useUser()` 사용 위치
- `hooks/use-sync-user.ts`
- `components/auth-session-sync.tsx`
- 사용자 정보가 필요한 컴포넌트들

### `auth()` (서버) 사용 위치
- `app/api/sync-user/route.ts`
- `lib/api-utils.ts`
- 서버 사이드에서 인증이 필요한 API 라우트들

### `clerkClient()` 사용 위치
- `app/api/sync-user/route.ts`
- 서버 사이드에서 Clerk 사용자 정보를 가져와야 하는 곳

## 📝 주요 설정 파일

### 환경 변수 (`.env`)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

### `next.config.ts`
- Sentry 설정 포함
- Clerk 관련 설정은 없음 (Clerk는 자체 설정 사용)

## 🐛 디버깅 관련 파일

### `네이버로그인검증`
- 네이버 OAuth 로그인 검증 체크리스트
- 각 단계별 확인 사항 정리
- 문제 해결 가이드

### Sentry 통합
- `components/auth-session-sync.tsx`: OAuth 콜백 에러 리포팅
- `app/api/sync-user/route.ts`: 동기화 실패 에러 리포팅
- Sentry 대시보드: https://ttottoangseu.sentry.io/

## 🔄 데이터 흐름

1. **로그인 흐름**:
   ```
   사용자 클릭 → Clerk authenticateWithRedirect
   → 네이버 로그인 → 네이버 → Clerk 콜백
   → Clerk 서버 처리 → Proxy 서버 호출
   → Clerk 사용자 생성 → 앱으로 리다이렉트
   → AuthSessionSync (세션 검증)
   → SyncUserProvider (Supabase 동기화)
   ```

2. **사용자 동기화 흐름**:
   ```
   useSyncUser 훅 실행
   → 로그인 상태 확인
   → /api/sync-user 호출
   → Clerk에서 사용자 정보 가져오기
   → Supabase에 저장/업데이트
   ```

## 📚 참고 문서

- `docs/naver-oauth-flow.md`: 네이버 OAuth 플로우 상세 설명
- `AGENTS.md`: 프로젝트 아키텍처 및 Clerk + Supabase 통합 설명
- `네이버로그인검증`: 네이버 로그인 검증 체크리스트

