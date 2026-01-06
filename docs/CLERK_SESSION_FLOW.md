# Clerk 세션 관련 로직 전체 분석

## 📋 목차
1. [전체 흐름 다이어그램](#전체-흐름-다이어그램)
2. [주요 컴포넌트 및 파일](#주요-컴포넌트-및-파일)
3. [세션 생성 및 활성화](#세션-생성-및-활성화)
4. [토큰 관리](#토큰-관리)
5. [External Accounts 연결 문제](#external-accounts-연결-문제)
6. [문제 진단 체크리스트](#문제-진단-체크리스트)

---

## 전체 흐름 다이어그램

```
[사용자] 네이버 로그인 버튼 클릭
    ↓
[클라이언트] signIn.authenticateWithRedirect() 호출
    ↓
[네이버] 로그인 페이지로 리다이렉트
    ↓
[네이버] 사용자 인증 완료
    ↓
[네이버] Clerk 콜백 URL로 리다이렉트 (Authorization Code 전달)
    ↓
[Clerk 서버] OAuth 콜백 처리
    ├─ Authorization Code로 Access Token 요청
    ├─ Proxy 서버로 UserInfo 요청 (Bearer Token 전달)
    │   └─ [Proxy 서버] 네이버 UserInfo API 호출
    │       └─ 중첩 JSON 평탄화 → Clerk에 반환
    ├─ Attribute Mapping으로 사용자 정보 매핑
    ├─ 사용자 생성 또는 기존 사용자와 연결
    └─ External Account 연결 (⚠️ 여기서 실패 가능)
    ↓
[Clerk] 앱의 redirectUrl로 리다이렉트
    ↓
[Next.js] 미들웨어 처리 (middleware.ts)
    ├─ Clerk 세션 확인
    └─ 인증 필요 시 보호
    ↓
[클라이언트] AuthSessionSync 컴포넌트
    ├─ 세션 생성 여부 확인
    ├─ External Accounts 확인
    └─ 문제 발견 시 로그 및 Sentry 전송
    ↓
[클라이언트] SyncUserProvider (useSyncUser 훅)
    ├─ Clerk 사용자 정보 로드 대기
    └─ /api/sync-user 호출 → Supabase 동기화
    ↓
[서버] /api/sync-user
    ├─ auth()로 Clerk 세션 확인
    ├─ clerkClient().users.getUser()로 사용자 정보 조회
    ├─ External Accounts 확인 (⚠️ 여기서 경고 발생)
    └─ Supabase users 테이블에 동기화
```

---

## 주요 컴포넌트 및 파일

### 1. **로그인 시작: `app/sign-in/[[...rest]]/sign-in-content.tsx`**

**위치**: 1938-2143 라인

**역할**:
- 네이버 로그인 버튼 클릭 처리
- `signIn.authenticateWithRedirect()` 호출
- 여러 전략 시도 (oauth_custom_naver_auth, oauth_custom_naver 등)

**핵심 코드**:
```typescript
await signIn.authenticateWithRedirect({
  strategy: "oauth_custom_naver_auth",
  redirectUrl: redirectUrl,
  redirectUrlComplete: redirectUrl,
});
```

**이메일/비밀번호 로그인 세션 활성화**: 934-1002 라인
- `clerk.setActive()` 호출로 세션 활성화
- 최대 3회 재시도 로직 포함

---

### 2. **OAuth 콜백 후 세션 검증: `components/auth-session-sync.tsx`**

**역할**:
- OAuth 콜백 후 Clerk 세션이 제대로 생성되었는지 확인
- External Accounts 연결 여부 확인
- 문제 발견 시 상세 로그 및 Sentry 전송

**검증 항목**:
- `isSignedIn`, `userId`, `sessionId` 확인
- `user.externalAccounts` 확인 (⚠️ 핵심!)
- 세션 토큰 존재 여부 확인

**핵심 로직** (88-99 라인):
```typescript
if (!user.externalAccounts || user.externalAccounts.length === 0) {
  console.error("❌ [중요] External Account가 없습니다!");
  // Sentry 전송 및 상세 로그
}
```

---

### 3. **사용자 동기화 훅: `hooks/use-sync-user.ts`**

**역할**:
- Clerk 사용자를 Supabase DB에 자동 동기화
- OAuth 로그인 후 사용자 정보가 완전히 로드될 때까지 대기

**조건 확인**:
- `isLoaded`, `isSignedIn`, `userId` 확인
- `userLoaded`, `user` 존재 확인
- 1초 대기 후 `/api/sync-user` 호출

**핵심 로직** (82-88 라인):
```typescript
if (user) {
  console.log("👤 Clerk 사용자 정보:", {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    name: user.fullName || user.username,
    externalAccounts: user.externalAccounts?.length || 0, // ⚠️ 확인
  });
}
```

---

### 4. **사용자 동기화 API: `app/api/sync-user/route.ts`**

**역할**:
- Clerk 사용자 정보를 Supabase users 테이블에 동기화
- External Accounts 확인 및 경고 로그

**핵심 로직** (84-132 라인):
```typescript
// External Accounts 상세 로그 (핵심: 네이버 로그인 연결 여부 확인)
if (clerkUser.externalAccounts && clerkUser.externalAccounts.length > 0) {
  console.log("✅ External Accounts 연결됨:", ...);
} else {
  console.error("❌ [중요] External Accounts가 없습니다!");
  console.error("   → 네이버 로그인이 Clerk에 연결되지 않았습니다.");
  // 가능한 원인 및 해결 방법 안내
}
```

---

### 5. **Proxy 서버: `scripts/clerk-userinfo-proxy.js`**

**위치**: AWS EC2에서 PM2로 실행 (`pm2 start scripts/clerk-userinfo-proxy.js`)

**역할**:
- Clerk가 네이버 UserInfo를 요청할 때 중간 프록시 역할
- 네이버의 중첩된 JSON 응답을 평탄화
- `sub` 필드 인코딩 (base64url 또는 원본)

**핵심 로직** (38-141 라인):
```javascript
function flattenNaverResponse(raw) {
  // 네이버 응답 구조:
  // { "response": { "id": "...", "email": "...", ... } }
  
  const naverId = get(raw, ["response", "id"]);
  let safeSub = naverId;
  
  // base64url 인코딩 또는 원본 사용
  if (encodingMethod === "base64url") {
    safeSub = Buffer.from(naverId, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
  
  return {
    sub: safeSub, // ⚠️ Clerk가 이 값을 사용하여 External Account 연결
    email: get(raw, ["response", "email"]),
    email_verified: true,
    // ...
  };
}
```

---

### 6. **Clerk Provider 설정: `app/layout.tsx`**

**역할**:
- RootLayout에서 ClerkProvider 설정
- SyncUserProvider, AuthSessionSync 컴포넌트 포함

**핵심 코드** (107-126 라인):
```typescript
<ClerkProviderWrapper
  localization={customKoKR}
  {...(clerkDomain ? { domain: clerkDomain } : {})}
>
  <SyncUserProvider>
    <Suspense fallback={null}>
      <AuthSessionSync />
    </Suspense>
    {/* ... */}
  </SyncUserProvider>
</ClerkProviderWrapper>
```

---

### 7. **미들웨어: `middleware.ts`**

**역할**:
- 모든 요청에 대해 Clerk 인증 확인
- 공개 경로는 인증 불필요
- 보안 헤더 추가

**핵심 로직** (24-31 라인):
```typescript
const clerkMiddlewareHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect(); // 인증 필요
  }
});
```

---

### 8. **Supabase 클라이언트: `lib/supabase/server.ts`, `lib/supabase/clerk-client.ts`**

**역할**:
- Clerk 토큰을 Supabase 인증에 사용
- Server Component용: `createClient()` - `auth().getToken()` 사용
- Client Component용: `useClerkSupabaseClient()` - `useAuth().getToken()` 사용

**핵심 코드** (`lib/supabase/server.ts` 24-33 라인):
```typescript
export async function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await auth()).getToken(); // ⚠️ Clerk 세션 토큰
    },
  });
}
```

---

## 세션 생성 및 활성화

### 이메일/비밀번호 로그인

**위치**: `app/sign-in/[[...rest]]/sign-in-content.tsx` (934-1002 라인)

**흐름**:
1. 폼 제출 가로채기 (`interceptClerkFormSubmit`)
2. `signIn.create()` 호출
3. `result.status === "complete"` 확인
4. `clerk.setActive({ session: result.createdSessionId })` 호출
5. 최대 3회 재시도 로직

**핵심 코드**:
```typescript
if (result.createdSessionId && clerk.setActive) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await clerk.setActive({
        session: result.createdSessionId,
      });
      setActiveSuccess = true;
      break;
    } catch (retryError) {
      // 재시도...
    }
  }
}
```

### OAuth 로그인 (네이버)

**흐름**:
1. `signIn.authenticateWithRedirect()` 호출
2. 네이버 로그인 페이지로 리다이렉트
3. 네이버 인증 완료 → Clerk 콜백
4. **Clerk 서버에서 자동 처리**:
   - Proxy 서버로 UserInfo 요청
   - 사용자 생성/연결
   - External Account 연결 (⚠️ 여기서 실패 가능)
   - 세션 생성
5. 앱으로 리다이렉트
6. `AuthSessionSync` 컴포넌트가 세션 확인

---

## 토큰 관리

### 클라이언트 사이드

**위치**: `lib/supabase/clerk-client.ts`

```typescript
export function useClerkSupabaseClient() {
  const { getToken } = useAuth();
  
  return createClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await getToken()) ?? null; // ⚠️ Clerk 세션 토큰
    },
  });
}
```

### 서버 사이드

**위치**: `lib/supabase/server.ts`

```typescript
export async function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await auth()).getToken(); // ⚠️ Clerk 세션 토큰
    },
  });
}
```

### 토큰 사용 위치

1. **Supabase 인증**: `accessToken()` 콜백으로 자동 전달
2. **API 요청**: `Authorization: Bearer ${token}` 헤더로 수동 전달
3. **PGRST301 에러**: 토큰이 없거나 유효하지 않을 때 발생

---

## External Accounts 연결 문제

### 문제 증상

```
❌ [중요] External Accounts가 없습니다!
→ 네이버 로그인이 Clerk에 연결되지 않았습니다.
```

### 발생 위치

1. **`app/api/sync-user/route.ts`** (97-105 라인)
   - `clerkUser.externalAccounts`가 비어있을 때 경고

2. **`components/auth-session-sync.tsx`** (88-99 라인)
   - OAuth 콜백 후 `user.externalAccounts` 확인

3. **`hooks/use-sync-user.ts`** (87 라인)
   - 사용자 정보 로그에 `externalAccounts` 개수 표시

### 가능한 원인

#### 1. Proxy 서버 응답 문제

**확인 방법**:
```bash
# AWS EC2에 SSH 접속
ssh -i "aws_server.pem" ubuntu@15.165.148.244

# Proxy 서버 로그 확인
pm2 logs clerk-userinfo-proxy --lines 50
```

**확인 사항**:
- `[INFO] 최종 응답 JSON`에서 `sub`와 `email` 필드 확인
- `sub` 값이 올바른 형식인지 확인 (base64url 또는 원본)
- 네이버 응답이 정상적으로 수신되었는지 확인

**예상 로그**:
```
[INFO] 최종 응답 JSON: {
  "sub": "V2hOTFc5Q1hjUG1Ya0Vway1lOHZzNHBSUmdScGhTajAwOUhYRm8tMm1iUQ",
  "email": "user@naver.com",
  "email_verified": true,
  ...
}
```

#### 2. Clerk Dashboard Attribute Mapping 설정 문제

**확인 위치**: Clerk Dashboard → SSO Connections → 네이버 provider → Attribute Mapping

**필수 매핑**:
- **User ID / Subject** → `sub` (⚠️ 대소문자 주의, 반드시 소문자 'sub')
- **Email** → `email`

**잘못된 예시**:
- User ID / Subject → `Sub` (대문자)
- User ID / Subject → `SUB`
- User ID / Subject → `response.id` (중첩 경로)

**올바른 예시**:
- User ID / Subject → `sub` ✅
- Email → `email` ✅

#### 3. Proxy 서버가 Clerk에 도달하지 못함

**확인 방법**:
1. 브라우저 개발자 도구 → Network 탭
2. "Preserve log" 옵션 활성화
3. 네이버 로그인 시도
4. `15.165.148.244:3001` 또는 `clerk-userinfo-proxy` 검색

**예상 요청**:
- URL: `http://15.165.148.244:3001/` 또는 `http://15.165.148.244:3001/v1/oauth/userinfo`
- Method: GET 또는 POST
- Headers: `Authorization: Bearer <token>`

**문제 상황**:
- 요청이 없음 → Clerk가 Proxy 서버를 호출하지 못함
- 405 Method Not Allowed → Proxy 서버가 해당 메서드를 지원하지 않음
- 401 Unauthorized → Authorization 헤더 문제

#### 4. `sub` 값이 이미 다른 사용자와 연결됨

**확인 방법**:
- Clerk Dashboard → Users
- 네이버 계정 이메일로 검색
- 기존 사용자가 있는지 확인

**해결 방법**:
- 기존 사용자 삭제 또는 External Account 연결 해제
- 또는 기존 사용자에 네이버 계정 연결

---

## 문제 진단 체크리스트

### 1단계: Proxy 서버 확인

- [ ] Proxy 서버가 실행 중인가? (`pm2 list`)
- [ ] Proxy 서버 로그에 Clerk 요청이 들어오는가?
- [ ] Proxy 서버가 네이버 UserInfo를 정상적으로 받는가?
- [ ] Proxy 서버 응답에 `sub`와 `email`이 포함되어 있는가?

**명령어**:
```bash
pm2 logs clerk-userinfo-proxy --lines 50
```

### 2단계: Clerk Dashboard 설정 확인

- [ ] SSO Connections → 네이버 provider가 활성화되어 있는가?
- [ ] UserInfo URL이 올바른가? (`http://15.165.148.244:3001/`)
- [ ] Attribute Mapping이 올바른가?
  - [ ] User ID / Subject → `sub` (소문자)
  - [ ] Email → `email`
- [ ] Provider Key가 코드와 일치하는가? (`naver_auth`)

### 3단계: 네트워크 확인

- [ ] 브라우저 Network 탭에서 Proxy 서버 요청이 있는가?
- [ ] 요청이 성공했는가? (200 OK)
- [ ] 응답 본문에 `sub`와 `email`이 있는가?

### 4단계: 세션 확인

- [ ] OAuth 콜백 후 `isSignedIn`이 `true`인가?
- [ ] `userId`가 존재하는가?
- [ ] `sessionId`가 존재하는가?
- [ ] `user.externalAccounts`가 비어있지 않은가?

**확인 위치**:
- 브라우저 콘솔: `AuthSessionSync` 컴포넌트 로그
- 서버 로그: `/api/sync-user` API 로그

---

## 현재 문제 분석

### 로그 분석

```
❌ [중요] External Accounts가 없습니다!
→ 네이버 로그인이 Clerk에 연결되지 않았습니다.
```

이 로그는 다음 위치에서 발생:
1. `app/api/sync-user/route.ts` (97 라인)
2. `components/auth-session-sync.tsx` (88 라인)

### 가능한 원인 (우선순위 순)

1. **Proxy 서버 응답의 `sub` 값 문제** (가장 가능성 높음)
   - `sub` 값이 Clerk가 기대하는 형식과 다름
   - base64url 인코딩 문제
   - 특수 문자 포함 문제

2. **Clerk Dashboard Attribute Mapping 설정 문제**
   - User ID / Subject → `sub` 매핑이 잘못됨
   - 대소문자 문제 (`Sub` vs `sub`)

3. **Proxy 서버가 Clerk에 도달하지 못함**
   - 네트워크 문제
   - HTTPS/HTTP 문제
   - CORS 문제

4. **`sub` 값이 이미 다른 사용자와 연결됨**
   - 중복 연결 문제

---

## 해결 방법

### 즉시 확인 사항

1. **Proxy 서버 로그 확인**
   ```bash
   ssh -i "aws_server.pem" ubuntu@15.165.148.244
   pm2 logs clerk-userinfo-proxy --lines 100
   ```
   - `[INFO] 최종 응답 JSON` 확인
   - `sub` 값 확인
   - 네이버 응답 확인

2. **Clerk Dashboard 확인**
   - SSO Connections → 네이버 provider
   - Attribute Mapping:
     - User ID / Subject → `sub` (소문자)
     - Email → `email`

3. **브라우저 Network 탭 확인**
   - Proxy 서버 요청 존재 여부
   - 응답 본문 확인

### 근본적인 해결

1. **Proxy 서버 `sub` 값 형식 확인**
   - 현재: base64url 또는 원본
   - Clerk가 기대하는 형식과 일치하는지 확인

2. **Clerk Dashboard Attribute Mapping 재설정**
   - User ID / Subject → `sub` (정확히 소문자)
   - Email → `email`

3. **Proxy 서버 응답 검증 강화**
   - `sub` 값 URL-safe 확인
   - 필수 필드 검증 로직 추가

---

## 관련 파일 위치

| 파일 | 경로 | 역할 |
|------|------|------|
| 로그인 버튼 | `app/sign-in/[[...rest]]/sign-in-content.tsx` | 네이버 로그인 시작 |
| 세션 검증 | `components/auth-session-sync.tsx` | OAuth 콜백 후 세션 확인 |
| 사용자 동기화 훅 | `hooks/use-sync-user.ts` | Supabase 동기화 |
| 동기화 API | `app/api/sync-user/route.ts` | 서버 사이드 동기화 |
| Proxy 서버 | `scripts/clerk-userinfo-proxy.js` | 네이버 UserInfo 프록시 |
| Clerk Provider | `app/layout.tsx` | ClerkProvider 설정 |
| 미들웨어 | `middleware.ts` | 인증 보호 |
| Supabase 클라이언트 | `lib/supabase/server.ts` | 서버 사이드 클라이언트 |
| Supabase 클라이언트 | `lib/supabase/clerk-client.ts` | 클라이언트 사이드 클라이언트 |

---

## 다음 단계

1. **Proxy 서버 로그 확인** (가장 중요)
2. **Clerk Dashboard Attribute Mapping 확인**
3. **브라우저 Network 탭에서 Proxy 요청 확인**
4. **`sub` 값 형식 검증**

