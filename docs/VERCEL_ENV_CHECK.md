# Vercel 환경 변수 검증 가이드

## 배포 환경 Clerk 세션 문제 해결을 위한 체크리스트

### 1. Clerk Production 키 확인

**Vercel 대시보드에서 확인:**
1. Vercel 프로젝트 → **Settings** → **Environment Variables**
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 값 확인
3. `CLERK_SECRET_KEY` 값 확인

**올바른 키 형식:**
- ✅ Production: `pk_live_...` / `sk_live_...`
- ❌ Test/Dev: `pk_test_...` / `sk_test_...` (운영 환경에서 사용 금지)

**Clerk Dashboard에서 Production 키 확인:**
1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. 프로젝트 선택
3. **API Keys** 메뉴
4. **Production** 탭에서 키 확인

### 2. Clerk 도메인 설정 확인

**Clerk Dashboard에서 확인:**
1. **Domains** 메뉴 이동
2. **Production** 환경에 다음 도메인 추가:
   - `www.ttottoangseu.co.kr` (필수)
   - `ttottoangseu.co.kr` (선택사항)

**Custom Domain 사용 시:**
- Custom Domain을 설정한 경우 `NEXT_PUBLIC_CLERK_DOMAIN` 환경 변수 추가
- 예: `NEXT_PUBLIC_CLERK_DOMAIN=clerk.ttottoangseu.co.kr`

### 3. 환경 변수 전체 목록

**Vercel에 설정해야 할 환경 변수 (Production):**

```bash
# Clerk (Production 키 사용)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Clerk Custom Domain (선택사항)
NEXT_PUBLIC_CLERK_DOMAIN=clerk.ttottoangseu.co.kr

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_STORAGE_BUCKET=uploads

# 토스페이먼츠
NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY=...
TOSS_PAYMENTS_SECRET_KEY=...
```

### 4. 쿠키 설정 확인 방법

**브라우저 개발자 도구에서 확인:**
1. `www.ttottoangseu.co.kr` 접속
2. 개발자 도구 열기 (F12)
3. **Application** 탭 → **Cookies** → `https://www.ttottoangseu.co.kr`
4. 다음 쿠키 확인:
   - `__clerk_db_jwt`
   - `__session` (Clerk 관련)

**확인 사항:**
- ✅ **Domain**: `.ttottoangseu.co.kr` 또는 `www.ttottoangseu.co.kr`
- ✅ **Secure**: `true` (HTTPS 환경)
- ✅ **SameSite**: `Lax` 또는 `None` (Secure가 true인 경우)

### 5. 서버 세션 확인 API 테스트

**브라우저 콘솔에서 테스트:**
```javascript
// 로그인 후 실행
fetch('/api/auth/check-session', {
  method: 'GET',
  credentials: 'include'
})
.then(r => r.json())
.then(data => console.log('세션 상태:', data));
```

**예상 결과:**
```json
{
  "success": true,
  "isAuthenticated": true,
  "userId": "user_...",
  "sessionId": "sess_..."
}
```

**문제가 있는 경우:**
```json
{
  "success": true,
  "isAuthenticated": false,
  "userId": null,
  "sessionId": null
}
```

### 6. 문제 해결 순서

1. **Clerk Production 키 확인 및 설정**
   - Vercel 환경 변수에 Production 키 설정
   - Test 키가 아닌 Production 키인지 확인

2. **Clerk 도메인 설정 확인**
   - Clerk Dashboard에서 Production 도메인 추가
   - `www.ttottoangseu.co.kr` 도메인 확인

3. **환경 변수 재배포**
   - Vercel에서 환경 변수 수정 후 **Redeploy** 실행

4. **브라우저 쿠키 확인**
   - 개발자 도구에서 Clerk 쿠키 확인
   - 쿠키가 올바르게 설정되었는지 확인

5. **서버 세션 확인 API 테스트**
   - 로그인 후 `/api/auth/check-session` 호출
   - 서버에서 세션을 인식하는지 확인

6. **콘솔 로그 확인**
   - 브라우저 개발자 도구 콘솔 확인
   - `🔍 서버 세션 확인 시작...` 로그 확인
   - `서버 세션 확인 결과:` 로그 확인

### 7. 추가 디버깅

**문제가 계속 발생하는 경우:**

1. **Vercel 로그 확인:**
   - Vercel 대시보드 → **Functions** → **Logs**
   - `[CheckSessionAPI]` 로그 확인
   - `[getCurrentUserId]` 로그 확인

2. **Clerk Dashboard 확인:**
   - **Sessions** 메뉴에서 활성 세션 확인
   - 세션이 생성되고 유지되는지 확인

3. **네트워크 탭 확인:**
   - 개발자 도구 → **Network** 탭
   - `/api/auth/check-session` 요청 확인
   - 요청 헤더에 쿠키가 포함되는지 확인

## 참고 자료

- [Clerk Production Setup](https://clerk.com/docs/deployments/overview)
- [Clerk Domain Configuration](https://clerk.com/docs/deployments/domains)
- [Clerk Cookie Settings](https://clerk.com/docs/deployments/cookies)

