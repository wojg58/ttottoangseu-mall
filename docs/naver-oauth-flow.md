# 네이버 OAuth 로그인 콜백 처리 흐름

## 전체 흐름 다이어그램

```
1. 사용자 클릭
   ↓
2. Clerk authenticateWithRedirect 호출
   ↓
3. 네이버 로그인 페이지로 리다이렉트
   ↓
4. 네이버 로그인 완료
   ↓
5. 네이버 → Clerk 콜백 URL로 리다이렉트
   ↓
6. Clerk 서버에서 처리
   ├─ 네이버에서 Authorization Code 받음
   ├─ 네이버 Token URL로 Access Token 요청
   ├─ 프록시 서버로 UserInfo 요청 (Bearer Token 전달)
   └─ 프록시 서버 → 네이버 UserInfo API 호출
   └─ 프록시 서버 → 중첩 JSON 평탄화 → Clerk에 반환
   ↓
7. Clerk가 사용자 생성/업데이트
   ├─ Attribute Mapping으로 사용자 정보 매핑
   └─ 사용자 생성 또는 기존 사용자와 연결
   ↓
8. Clerk → 앱의 redirectUrl로 리다이렉트
   ↓
9. Next.js 미들웨어 처리
   ↓
10. 클라이언트 사이드 처리
    ├─ AuthSessionSync 컴포넌트
    └─ SyncUserProvider (useSyncUser 훅)
    ↓
11. Supabase에 사용자 동기화
```

## 단계별 상세 설명

### 1단계: 네이버 로그인 버튼 클릭

**파일**: `app/sign-in/[[...rest]]/sign-in-content.tsx`

```typescript
// 네이버 로그인 버튼 onClick 핸들러
await signIn.authenticateWithRedirect({
  strategy: "oauth_custom_naver_auth",
  redirectUrl: redirectUrl,
  redirectUrlComplete: redirectUrl,
});
```

**동작**:
- Clerk의 `authenticateWithRedirect` 메서드 호출
- 네이버 OAuth 인증 페이지로 리다이렉트

---

### 2단계: 네이버 로그인 페이지

**위치**: 네이버 서버 (`https://nid.naver.com/oauth2.0/authorize`)

**동작**:
- 사용자가 네이버 계정으로 로그인
- 권한 동의 (이메일, 이름 등)
- 네이버가 Authorization Code를 생성

---

### 3단계: 네이버 → Clerk 콜백

**URL**: `https://your-app.clerk.accounts.dev/v1/oauth_callback?code=...&state=...`

**동작**:
- 네이버가 Clerk의 콜백 URL로 리다이렉트
- Authorization Code와 state 파라미터 전달

---

### 4단계: Clerk 서버에서 처리 (서버 사이드)

**위치**: Clerk 서버 (외부)

**처리 순서**:

1. **Authorization Code로 Access Token 요청**
   ```
   POST https://nid.naver.com/oauth2.0/token
   - grant_type: authorization_code
   - code: [네이버에서 받은 코드]
   - client_id: [Clerk에 설정된 Client ID]
   - client_secret: [Clerk에 설정된 Client Secret]
   - redirect_uri: [Clerk 콜백 URL]
   ```

2. **Access Token으로 UserInfo 요청**
   ```
   GET http://15.165.148.244:3001/  (프록시 서버)
   Authorization: Bearer [네이버 Access Token]
   ```

3. **프록시 서버 처리** (`scripts/clerk-userinfo-proxy.js`)
   - 네이버 UserInfo API 호출: `https://openapi.naver.com/v1/nid/me`
   - 중첩된 JSON 응답을 평탄화:
     ```json
     {
       "response": { "id": "...", "email": "...", "name": "..." }
     }
     ```
     ↓
     ```json
     {
       "sub": "...",
       "email": "...",
       "name": "..."
     }
     ```
   - Clerk에 flat JSON 반환

4. **Clerk가 사용자 생성/업데이트**
   - Attribute Mapping으로 사용자 정보 매핑:
     - `sub` → Identifier / User ID
     - `email` → Email
     - `name` → First Name
   - 사용자가 없으면 생성, 있으면 업데이트

---

### 5단계: Clerk → 앱으로 리다이렉트

**URL**: `https://your-app.com/?__clerk_redirect_url=...&__clerk_status=...`

**동작**:
- Clerk가 설정한 `redirectUrl`로 리다이렉트
- URL에 Clerk 관련 파라미터 포함

---

### 6단계: Next.js 미들웨어 처리

**파일**: `middleware.ts`

**동작**:
```typescript
// 모든 요청에 대해 실행
export default async function middleware(req: NextRequest) {
  // Clerk 미들웨어 실행
  const clerkResponse = await clerkMiddlewareHandler(req, event);
  
  // Clerk가 세션 쿠키 설정
  // 인증 상태 확인
  // 보안 헤더 추가
}
```

**처리 내용**:
- ✅ Clerk 세션 쿠키 확인
- ✅ 인증 상태 검증
- ✅ 보안 헤더 추가 (CSP 등)
- ✅ 요청을 다음 단계로 전달

**미들웨어를 타는지?**
- ✅ **예, 모든 요청에 대해 실행됩니다**
- `config.matcher`에 따라 정적 파일 제외하고 모든 요청 처리

---

### 7단계: 클라이언트 사이드 처리

**파일**: `app/layout.tsx`

**컴포넌트 구조**:
```tsx
<ClerkProvider>
  <SyncUserProvider>  {/* useSyncUser 훅 실행 */}
    <AuthSessionSync />  {/* OAuth 콜백 처리 */}
    {children}
  </SyncUserProvider>
</ClerkProvider>
```

#### 7-1. AuthSessionSync 컴포넌트

**파일**: `components/auth-session-sync.tsx`

**동작**:
```typescript
// OAuth 콜백 감지
const isOAuthCallback = 
  searchParams.has("__clerk_redirect_url") || 
  searchParams.has("__clerk_status") ||
  currentUrl.includes("oauth_callback");

if (isOAuthCallback) {
  // 1초 대기 후 URL 정리하고 페이지 새로고침
  setTimeout(() => {
    window.location.href = cleanUrl || "/";
  }, 1000);
}
```

**처리 내용**:
- ✅ OAuth 콜백 URL 파라미터 감지
- ✅ Clerk 관련 파라미터 제거
- ✅ 세션 동기화를 위해 페이지 새로고침

#### 7-2. SyncUserProvider 컴포넌트

**파일**: `components/providers/sync-user-provider.tsx`

**동작**:
```typescript
export function SyncUserProvider({ children }) {
  useSyncUser();  // 사용자 동기화 훅 실행
  return <>{children}</>;
}
```

---

### 8단계: useSyncUser 훅 실행

**파일**: `hooks/use-sync-user.ts`

**동작 순서**:

1. **사용자 정보 로딩 대기**
   ```typescript
   const { user, isLoaded: userLoaded } = useUser();
   
   // 사용자 정보가 완전히 로드될 때까지 대기
   if (!userLoaded || !user) {
     return;  // 대기
   }
   ```

2. **1초 대기** (Clerk 세션 완전 준비)
   ```typescript
   await new Promise((resolve) => setTimeout(resolve, 1000));
   ```

3. **Clerk 토큰 가져오기**
   ```typescript
   const token = await getToken();
   ```

4. **Supabase 동기화 API 호출**
   ```typescript
   const response = await fetch("/api/sync-user", {
     method: "POST",
     headers: {
       "Authorization": `Bearer ${token}`,
     },
   });
   ```

---

### 9단계: /api/sync-user API 처리

**파일**: `app/api/sync-user/route.ts`

**처리 순서**:

1. **Clerk 인증 확인**
   ```typescript
   const { userId } = await auth();
   ```

2. **Clerk에서 사용자 정보 가져오기**
   ```typescript
   const clerkUser = await clerkClient().users.getUser(userId);
   ```

3. **Supabase에 사용자 동기화**
   ```typescript
   // 기존 사용자 확인
   const existingUser = await supabase
     .from("users")
     .eq("clerk_user_id", clerkUser.id)
     .maybeSingle();
   
   if (existingUser) {
     // 업데이트
   } else {
     // 새 사용자 생성
     // 신규 가입 쿠폰 발급
   }
   ```

---

## 중요 포인트

### 1. 미들웨어는 모든 요청에 실행됨

- ✅ **모든 요청**에 대해 `middleware.ts` 실행
- Clerk 세션 쿠키 확인 및 인증 상태 검증
- 정적 파일은 제외 (`config.matcher`)

### 2. OAuth 콜백은 Clerk 서버에서 처리

- ❌ **앱 서버에서 직접 처리하지 않음**
- Clerk 서버가 네이버와 통신
- 프록시 서버는 Clerk가 호출 (UserInfo 요청 시)

### 3. 사용자 정보는 두 단계로 처리

1. **Clerk 서버** (OAuth 콜백 시):
   - 네이버에서 사용자 정보 받음
   - 프록시 서버에서 평탄화된 JSON 받음
   - Clerk 사용자 생성/업데이트

2. **앱 서버** (`/api/sync-user`):
   - Clerk 사용자 정보를 Supabase에 동기화
   - 신규 가입 시 쿠폰 발급

### 4. 클라이언트 사이드 처리 순서

```
페이지 로드
  ↓
AuthSessionSync (OAuth 콜백 감지)
  ↓
SyncUserProvider (useSyncUser 훅)
  ↓
useSyncUser (사용자 정보 로딩 대기)
  ↓
/api/sync-user 호출
  ↓
Supabase 동기화 완료
```

---

## 로그 확인 포인트

### 1. 프록시 서버 로그
```bash
ssh -i "aws_server.pem" ubuntu@15.165.148.244 "pm2 logs clerk-userinfo-proxy --lines 50"
```

**확인 사항**:
- `[INFO] 네이버 응답 수신 완료`
- `[INFO] 필수 필드 확인 완료 - sub: ... email: ...`
- `[DEBUG] 최종 응답 JSON: {...}`

### 2. 브라우저 콘솔 로그

**확인 사항**:
- `[AuthSessionSync] OAuth 콜백 감지`
- `🔄 사용자 동기화 시작`
- `👤 Clerk 사용자 정보: {...}`
- `✅ 동기화 성공`

### 3. 서버 사이드 로그 (터미널)

**확인 사항**:
- `🔐 API: 사용자 동기화 요청`
- `✅ Clerk 사용자 정보: {...}`
- `🔗 External Accounts: [...]`
- `✅ Supabase 동기화 완료`

---

## 문제 발생 시 확인 체크리스트

1. **프록시 서버가 호출되는가?**
   - 프록시 서버 로그 확인
   - Clerk 대시보드의 User Info URL 설정 확인

2. **Clerk가 사용자를 생성하는가?**
   - Clerk Dashboard → Users에서 사용자 확인
   - External Accounts 탭에서 네이버 계정 확인

3. **사용자 동기화가 실행되는가?**
   - 브라우저 콘솔에서 `🔄 사용자 동기화 시작` 로그 확인
   - `/api/sync-user` API 호출 확인 (Network 탭)

4. **Supabase에 사용자가 생성되는가?**
   - Supabase Dashboard에서 users 테이블 확인
   - `clerk_user_id`로 조회

