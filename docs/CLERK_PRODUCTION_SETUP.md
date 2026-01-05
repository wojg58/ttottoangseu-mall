# Clerk 프로덕션 환경 설정 가이드

## 문제 상황

배포 환경(`www.ttottoangseu.co.kr`)에서 로그인 후 바로 구매 버튼 클릭 시 "로그인 세션이 만료되었습니다" 팝업이 나타나는 문제가 발생했습니다.

## 원인 분석

1. **클라이언트와 서버 세션 동기화 문제**
   - 클라이언트에서 `isSignedIn`이 `true`이지만 서버에서 세션을 인식하지 못함
   - 배포 환경에서만 발생 (로컬에서는 정상 작동)

2. **가능한 원인**
   - Clerk Production 키와 Test 키 혼용
   - Clerk 도메인 설정 불일치
   - 쿠키 설정 문제 (secure, sameSite, domain)
   - 환경 변수 설정 오류

## 해결 방법

### 1. Clerk Production 키 확인

**Clerk Dashboard에서 확인:**
1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. 프로젝트 선택
3. **API Keys** 메뉴 이동
4. **Production** 환경의 키 확인

**키 형식:**
- Production Publishable Key: `pk_live_...` (❌ `pk_test_...` 아님)
- Production Secret Key: `sk_live_...` (❌ `sk_test_...` 아님)

**Vercel 환경 변수 설정:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  # Production 키 사용
CLERK_SECRET_KEY=sk_live_...  # Production 키 사용
```

### 2. Clerk 도메인 설정

**Clerk Dashboard에서 설정:**
1. **Domains** 메뉴 이동
2. **Production** 도메인 추가:
   - `www.ttottoangseu.co.kr`
   - `ttottoangseu.co.kr` (선택사항)

**환경 변수 추가 (선택사항):**
```
NEXT_PUBLIC_CLERK_DOMAIN=clerk.ttottoangseu.co.kr
```

**참고:** Custom Domain을 사용하지 않는 경우 이 변수는 설정하지 않아도 됩니다.

### 3. 쿠키 설정 확인

Clerk는 자동으로 쿠키를 설정하지만, 배포 환경에서 문제가 발생할 수 있습니다.

**확인 사항:**
- 쿠키가 `Secure` 플래그로 설정되는지 (HTTPS 환경)
- 쿠키의 `SameSite` 설정이 올바른지
- 쿠키의 `Domain` 설정이 올바른지

**디버깅 방법:**
1. 브라우저 개발자 도구 → Application → Cookies
2. `__clerk_db_jwt` 쿠키 확인
3. 쿠키의 Domain, Secure, SameSite 속성 확인

### 4. 환경 변수 검증

**Vercel 대시보드에서 확인:**
1. **Settings** → **Environment Variables**
2. 다음 변수들이 **Production** 환경에 설정되어 있는지 확인:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Production 키)
   - `CLERK_SECRET_KEY` (Production 키)
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/`

**주의:** 
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`는 클라이언트에 노출되므로 Production 키를 사용해야 합니다.
- Test 키를 Production 환경에서 사용하면 세션 문제가 발생할 수 있습니다.

### 5. 코드 수정 사항

다음 수정 사항이 적용되었습니다:

1. **서버 세션 확인 API 추가** (`app/api/auth/check-session/route.ts`)
   - 클라이언트에서 서버 세션 상태를 확인할 수 있는 API
   - 실제 서버 세션이 있는지 확인

2. **클라이언트 세션 확인 로직 개선**
   - 클라이언트 `isSignedIn`만 확인하지 않고 서버 세션도 확인
   - 서버에서 세션이 없으면 로그인 페이지로 리다이렉트

3. **ClerkProvider 도메인 설정 추가**
   - `app/layout.tsx`에서 `NEXT_PUBLIC_CLERK_DOMAIN` 환경 변수 지원

4. **에러 메시지 개선**
   - 서버 응답 기반으로 에러 메시지 표시
   - 클라이언트 오판이 아닌 실제 서버 응답 확인

## 테스트 방법

1. **로컬 환경에서 테스트:**
   ```bash
   pnpm dev
   ```
   - 로그인 후 바로 구매 버튼 클릭
   - 정상 작동 확인

2. **배포 환경에서 테스트:**
   - Vercel에 배포
   - `www.ttottoangseu.co.kr`에서 로그인
   - 브라우저 개발자 도구 콘솔 확인:
     - `🔍 서버 세션 확인 시작...`
     - `서버 세션 확인 결과:`
   - 바로 구매 버튼 클릭
   - 정상 작동 확인

## 문제 해결 체크리스트

- [ ] Clerk Dashboard에서 Production 키 확인 (`pk_live_...`, `sk_live_...`)
- [ ] Vercel 환경 변수에 Production 키 설정
- [ ] Clerk Dashboard에서 Production 도메인 설정 (`www.ttottoangseu.co.kr`)
- [ ] 브라우저 개발자 도구에서 쿠키 확인 (`__clerk_db_jwt`)
- [ ] 서버 세션 확인 API 테스트 (`/api/auth/check-session`)
- [ ] 배포 후 재테스트

## 추가 디버깅

문제가 계속 발생하는 경우:

1. **브라우저 콘솔 로그 확인:**
   - `[ProductDetailOptions]` 또는 `[AddToCartButton]` 로그 확인
   - 서버 세션 확인 결과 확인

2. **서버 로그 확인:**
   - Vercel 대시보드 → Functions → Logs
   - `[CheckSessionAPI]` 로그 확인
   - `[getCurrentUserId]` 로그 확인

3. **Clerk Dashboard 확인:**
   - **Sessions** 메뉴에서 활성 세션 확인
   - 세션이 생성되고 유지되는지 확인

## 참고 자료

- [Clerk Production Setup Guide](https://clerk.com/docs/deployments/overview)
- [Clerk Domain Configuration](https://clerk.com/docs/deployments/domains)
- [Clerk Cookie Settings](https://clerk.com/docs/deployments/cookies)

