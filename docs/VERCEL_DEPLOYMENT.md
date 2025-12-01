# Vercel 배포 가이드

## 환경 변수 설정

Vercel에 배포할 때는 반드시 다음 환경 변수들을 설정해야 합니다.

### Vercel 대시보드에서 환경 변수 설정하기

1. **Vercel 프로젝트 대시보드** 접속
2. **Settings** → **Environment Variables** 메뉴 선택
3. 아래 환경 변수들을 모두 추가:

#### Clerk 환경 변수

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

#### Supabase 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_STORAGE_BUCKET=uploads
```

### 환경 변수 값 확인 방법

#### Clerk 키 확인
1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. **API Keys** 메뉴 선택
3. **Publishable Key**와 **Secret Key** 복사

#### Supabase 키 확인
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택 → **Settings** → **API** 메뉴
3. **Project URL**, **anon public** 키, **service_role** 키 복사

### 중요 사항

⚠️ **주의사항**:
- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에 노출됩니다
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출되면 안 됩니다
- 환경 변수 추가 후 **반드시 재배포**해야 합니다

### 재배포 방법

환경 변수를 추가/수정한 후:
1. Vercel 대시보드에서 **Deployments** 탭 선택
2. 최신 배포의 **⋯** 메뉴 클릭
3. **Redeploy** 선택

또는 Git에 푸시하면 자동으로 재배포됩니다.

## 문제 해결

### MIDDLEWARE_INVOCATION_FAILED 에러

이 에러가 발생하는 경우:

1. **환경 변수 확인**: 위의 모든 환경 변수가 설정되었는지 확인
2. **재배포**: 환경 변수 추가 후 재배포했는지 확인
3. **로그 확인**: Vercel 대시보드의 **Functions** 탭에서 에러 로그 확인

### 환경 변수가 설정되지 않은 경우

미들웨어는 환경 변수가 없어도 사이트가 다운되지 않도록 설계되었습니다. 하지만 인증 기능은 작동하지 않습니다.

## 배포 후 확인 사항

배포가 완료되면 다음을 확인하세요:

1. ✅ 홈페이지가 정상적으로 로드되는가?
2. ✅ 로그인 버튼이 표시되는가?
3. ✅ 로그인 후 인증이 정상 작동하는가?
4. ✅ `/auth-test` 페이지에서 에러가 없는가?

