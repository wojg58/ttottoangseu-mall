# Clerk 이메일/비밀번호 회원가입 설정 가이드

## 문제 상황

소셜 로그인(구글/카카오/네이버)은 정상 작동하지만, 이메일/비밀번호 회원가입이 작동하지 않는 문제가 발생했습니다.

## 확인 사항

### 1. Clerk Dashboard 설정 확인

**Clerk Dashboard에서 Email/Password 활성화:**
1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. 프로젝트 선택
3. **Configure** → **User & authentication** 메뉴 이동
4. **Email, Phone, Username** 섹션 확인
5. **Email address** 옵션 활성화 확인:
   - ✅ **Email address** 체크박스 활성화
   - ✅ **Email address** → **Email address verification** 활성화 (선택사항)
   - ✅ **Password** 체크박스 활성화

**설정 경로:**
```
Clerk Dashboard
  → Configure
    → User & authentication
      → Email, Phone, Username
        → Email address ✅
        → Password ✅
```

### 2. Next.js 라우트 확인

**현재 라우트 구조:**
- ✅ `/sign-up/[[...rest]]/page.tsx` - 회원가입 페이지 존재
- ✅ `/sign-up/[[...rest]]/sign-up-content.tsx` - SignUp 컴포넌트 구현
- ✅ `middleware.ts`에서 `/sign-up(.*)` 경로 public 처리

**라우트 파일 확인:**
```
app/
  sign-up/
    [[...rest]]/
      page.tsx              ✅ 존재
      sign-up-content.tsx   ✅ 존재
```

### 3. middleware.ts 설정 확인

**현재 설정:**
```typescript
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",  // ✅ 이미 public으로 설정됨
  // ...
]);
```

✅ `/sign-up` 경로는 이미 public으로 설정되어 있습니다.

### 4. SignIn 컴포넌트 설정 확인

**현재 설정:**
```typescript
<SignIn
  routing="path"
  path="/sign-in"
  signUpUrl="/sign-up"  // ✅ 설정됨
  // ...
/>
```

✅ `signUpUrl="/sign-up"` 설정이 되어 있습니다.

### 5. SignUp 컴포넌트 설정 확인

**현재 설정:**
```typescript
<SignUp
  routing="path"
  path="/sign-up"
  signInUrl="/sign-in"
  afterSignUpUrl={redirectUrl}
  forceRedirectUrl={redirectUrl}
  // ...
/>
```

✅ 설정이 올바르게 되어 있습니다.

## 문제 해결 체크리스트

### Step 1: Clerk Dashboard 확인

- [ ] Clerk Dashboard → Configure → User & authentication
- [ ] Email address 옵션 활성화 확인
- [ ] Password 옵션 활성화 확인
- [ ] Email address verification 설정 확인 (선택사항)

### Step 2: 코드 확인

- [x] `/sign-up` 라우트 존재 확인
- [x] `middleware.ts`에서 `/sign-up(.*)` public 처리 확인
- [x] `SignIn` 컴포넌트에 `signUpUrl="/sign-up"` 설정 확인
- [x] `SignUp` 컴포넌트 설정 확인

### Step 3: 테스트

1. **회원가입 페이지 접속:**
   - `www.ttottoangseu.co.kr/sign-up` 접속
   - 이메일/비밀번호 입력 필드가 보이는지 확인

2. **회원가입 시도:**
   - 이메일과 비밀번호 입력
   - 회원가입 버튼 클릭
   - 정상 작동 확인

3. **에러 발생 시:**
   - 브라우저 개발자 도구 콘솔 확인
   - 에러 메시지 확인
   - Clerk Dashboard → Logs 확인

## 추가 확인 사항

### Email Verification 설정

**Clerk Dashboard에서 확인:**
1. **Configure** → **Email, Phone, Username**
2. **Email address verification** 설정 확인:
   - **Required**: 이메일 인증 필수
   - **Optional**: 이메일 인증 선택사항
   - **Off**: 이메일 인증 없음

**권장 설정:**
- 개발 환경: **Optional** 또는 **Off**
- 프로덕션 환경: **Required** (보안 강화)

### Password Requirements 설정

**Clerk Dashboard에서 확인:**
1. **Configure** → **User & authentication**
2. **Password** 섹션에서 비밀번호 요구사항 확인:
   - 최소 길이
   - 특수 문자 요구사항
   - 대소문자 요구사항

## 문제 해결 방법

### 문제 1: 이메일/비밀번호 입력 필드가 보이지 않음

**원인:** Clerk Dashboard에서 Email/Password 옵션이 비활성화됨

**해결:**
1. Clerk Dashboard → Configure → User & authentication
2. Email address 옵션 활성화
3. Password 옵션 활성화
4. 변경 사항 저장

### 문제 2: 회원가입 버튼 클릭 시 에러 발생

**원인:** Email verification 설정 문제

**해결:**
1. Clerk Dashboard에서 Email verification 설정 확인
2. 개발 환경에서는 **Optional** 또는 **Off**로 설정
3. 프로덕션 환경에서는 **Required**로 설정

### 문제 3: 회원가입 후 리다이렉트 안 됨

**원인:** `afterSignUpUrl` 또는 `forceRedirectUrl` 설정 문제

**해결:**
1. `sign-up-content.tsx`에서 `afterSignUpUrl` 확인
2. `forceRedirectUrl` 확인
3. 리다이렉트 URL이 올바른지 확인

## 참고 자료

- [Clerk Email/Password Setup](https://clerk.com/docs/authentication/email-password)
- [Clerk SignUp Component](https://clerk.com/docs/components/authentication/sign-up)
- [Clerk Email Verification](https://clerk.com/docs/authentication/email-verification)

