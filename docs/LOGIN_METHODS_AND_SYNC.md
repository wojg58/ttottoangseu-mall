# 로그인 방식 및 Supabase 사용자 연동 가이드

이 문서는 프로젝트에서 지원하는 로그인 방식과 Supabase 사용자 연동 메커니즘을 설명합니다.

## 📋 목차

1. [Supabase 사용자 연동](#supabase-사용자-연동)
2. [지원하는 로그인 방식](#지원하는-로그인-방식)
3. [각 로그인 방식별 상세 설명](#각-로그인-방식별-상세-설명)
4. [데이터 흐름](#데이터-흐름)

---

## 🔄 Supabase 사용자 연동

### 개요

프로젝트는 **Clerk 인증**과 **Supabase 데이터베이스**를 함께 사용합니다:
- **Clerk**: 사용자 인증 처리 (OAuth, 이메일/비밀번호 등)
- **Supabase**: 사용자 정보 저장 및 비즈니스 로직 데이터 관리

### 연동 메커니즘

#### 1. 자동 동기화 훅 (`hooks/use-sync-user.ts`)

**역할**: Clerk 사용자가 로그인하면 자동으로 Supabase `users` 테이블에 동기화

**동작 방식**:
```typescript
// 로그인 상태 확인
if (isLoaded && isSignedIn && userId && userLoaded && user) {
  // /api/sync-user 호출
  await fetch("/api/sync-user", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

**특징**:
- OAuth 로그인 시 사용자 정보 로딩 대기
- 강제 동기화 재시도 메커니즘 (최대 5회, 2초 간격)
- 이미 동기화된 사용자는 건너뜀

#### 2. 동기화 API (`app/api/sync-user/route.ts`)

**역할**: Clerk 사용자 정보를 Supabase에 저장/업데이트

**처리 과정**:
1. Clerk 인증 확인 (`auth()`)
2. Clerk에서 사용자 정보 가져오기 (`clerkClient().users.getUser()`)
3. External Accounts 확인 (OAuth 연결 여부)
4. Supabase `users` 테이블 조회:
   - `clerk_user_id`로 먼저 조회
   - 없으면 `email`로 조회
5. 기존 사용자면 업데이트, 없으면 생성
6. 신규 가입 시 1,000원 환영 쿠폰 발급

**저장되는 데이터**:
```typescript
{
  clerk_user_id: string,  // Clerk 사용자 ID
  email: string,          // 이메일
  name: string,           // 이름
  role: "customer"        // 역할 (기본값: customer)
}
```

#### 3. 동기화 프로바이더 (`components/providers/sync-user-provider.tsx`)

**역할**: 루트 레벨에서 `useSyncUser` 훅 실행

**위치**: `app/layout.tsx`에서 사용
```tsx
<SyncUserProvider>
  {children}
</SyncUserProvider>
```

### Supabase users 테이블 구조

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL,  -- Clerk 사용자 ID
    email TEXT NOT NULL,
    name TEXT,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'customer',
    deleted_at TIMESTAMPTZ,  -- Soft Delete
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## 🔐 지원하는 로그인 방식

### 1. 구글 로그인 (Google)

**타입**: Clerk 기본 제공 (Social Provider)

**구현 위치**: 
- Clerk가 자동으로 처리
- `app/sign-in/[[...rest]]/sign-in-content.tsx`에서 UI만 표시

**특징**:
- 별도 설정 없이 Clerk Dashboard에서 활성화만 하면 됨
- 프록시 서버 불필요
- OAuth 2.0 표준 준수

**Clerk 전략**: `oauth_google` (Clerk 내부 처리)

---

### 2. 카카오 로그인 (Kakao)

**타입**: Clerk Custom OAuth Provider

**구현 위치**: `app/sign-in/[[...rest]]/sign-in-content.tsx` (1596-1742 라인)

**특징**:
- Custom OAuth Provider로 구현
- 여러 전략 시도 (fallback 메커니즘)
- 프록시 서버 불필요 (카카오가 표준 OAuth 2.0 제공)

**시도하는 전략** (순서대로):
```typescript
const possibleStrategies = [
  "oauth_custom_kakao",        // 가장 일반적
  "oauth_custom_custom_kakao", // 이중 custom 접두사
  "oauth_kakao",               // Social provider 형식
  "kakao",                     // 단순 형식
];
```

**Clerk Dashboard 설정**:
- Provider Type: Custom OAuth Provider
- Provider Key: `kakao` (또는 설정한 값)
- Discovery Endpoint: `https://kauth.kakao.com/.well-known/openid-configuration`
- Client ID / Secret: 카카오 개발자 콘솔에서 발급

**카카오 개발자 콘솔 설정**:
- Redirect URI: Clerk에서 제공하는 URL
- 동의 항목: 이메일 (필수)

---

### 3. 네이버 로그인 (Naver)

**타입**: Clerk Custom OAuth Provider + 프록시 서버

**구현 위치**: 
- `app/sign-in/[[...rest]]/sign-in-content.tsx` (1744-1956 라인)
- `scripts/clerk-userinfo-proxy.js` (프록시 서버)

**특징**:
- **프록시 서버 필요** (네이버 UserInfo 응답 형식 변환)
- 네이버의 중첩된 JSON 응답을 평탄화
- `sub` 필드를 base64url로 인코딩

**시도하는 전략**:
```typescript
const possibleStrategies = [
  "oauth_custom_naver_auth",   // 문서 권장
  "oauth_custom_naver",        // Key가 "naver"인 경우
  "oauth_naver",               // Social provider 형식
  "naver",                     // 단순 형식
];
```

**프록시 서버** (`scripts/clerk-userinfo-proxy.js`):
- **위치**: AWS EC2에서 PM2로 실행
- **포트**: 3001
- **역할**:
  1. 네이버 UserInfo API 호출 (`https://openapi.naver.com/v1/nid/me`)
  2. 중첩된 JSON 응답 평탄화
  3. `sub` 필드 base64url 인코딩
  4. Clerk가 기대하는 형식으로 변환

**네이버 응답 변환 예시**:
```json
// 네이버 원본 응답
{
  "response": {
    "id": "WhNLW9CXcPmXkEpk-e8vs4pRRgRrhSj009HXFo-2mbQ",
    "email": "user@naver.com",
    "name": "홍길동"
  }
}

// 프록시 서버 변환 후
{
  "sub": "V2hOTFc5Q1hjUG1Ya0Vway1lOHZzNHBSUmdScGhTajAwOUhYRm8tMm1iUQ",  // base64url 인코딩
  "email": "user@naver.com",
  "name": "홍길동",
  "email_verified": true
}
```

**Clerk Dashboard 설정**:
- Provider Type: Custom OAuth Provider
- Provider Key: `naver_auth` (또는 설정한 값)
- UserInfo URL: `http://15.165.148.244:3001/` (프록시 서버)
- Client ID / Secret: 네이버 개발자 센터에서 발급

**Attribute Mapping**:
- User ID / Subject → `sub`
- Email → `email`
- First Name → `given_name` 또는 `name`

---

### 4. 이메일/비밀번호 로그인

**타입**: Clerk 기본 제공

**구현 위치**: 
- Clerk 기본 UI 사용
- `app/sign-in/[[...rest]]/sign-in-content.tsx`에서 커스터마이징

**특징**:
- Clerk가 자동으로 처리
- 이메일 인증 필요 (선택적)
- 비밀번호 재설정 기능 포함

---

## 📊 데이터 흐름

### 전체 로그인 → 동기화 흐름

```
1. 사용자 로그인 시도
   ↓
2. Clerk 인증 처리
   ├─ 구글: Clerk 내부 처리
   ├─ 카카오: Custom OAuth Provider
   └─ 네이버: Custom OAuth Provider + 프록시 서버
   ↓
3. Clerk 사용자 생성/인증
   ↓
4. 앱으로 리다이렉트
   ↓
5. AuthSessionSync 컴포넌트
   - OAuth 콜백 검증
   - 세션 생성 확인
   - Sentry 에러 리포팅
   ↓
6. SyncUserProvider (useSyncUser 훅)
   - 로그인 상태 확인
   - /api/sync-user 호출
   ↓
7. /api/sync-user API
   - Clerk에서 사용자 정보 가져오기
   - Supabase users 테이블에 저장/업데이트
   - 신규 가입 시 쿠폰 발급
   ↓
8. 완료 ✅
```

### OAuth별 상세 흐름

#### 구글 로그인
```
사용자 클릭 → Clerk Google OAuth
→ 구글 로그인 → 구글 → Clerk 콜백
→ Clerk 사용자 생성 → 앱 리다이렉트
→ Supabase 동기화
```

#### 카카오 로그인
```
사용자 클릭 → Clerk Custom OAuth (kakao)
→ 카카오 로그인 → 카카오 → Clerk 콜백
→ Clerk가 카카오 UserInfo 직접 호출
→ Clerk 사용자 생성 → 앱 리다이렉트
→ Supabase 동기화
```

#### 네이버 로그인
```
사용자 클릭 → Clerk Custom OAuth (naver)
→ 네이버 로그인 → 네이버 → Clerk 콜백
→ Clerk가 프록시 서버로 UserInfo 요청
→ 프록시 서버가 네이버 UserInfo 호출
→ 프록시 서버가 응답 변환 (평탄화 + base64url)
→ Clerk 사용자 생성 → 앱 리다이렉트
→ Supabase 동기화
```

---

## 🔍 각 로그인 방식별 확인 사항

### 구글 로그인
- ✅ Clerk Dashboard에서 활성화 여부
- ✅ Redirect URI 설정 확인

### 카카오 로그인
- ✅ Clerk Dashboard Custom OAuth Provider 설정
- ✅ Provider Key 확인 (`kakao` 또는 설정한 값)
- ✅ 카카오 개발자 콘솔 Redirect URI 설정
- ✅ 이메일 동의 항목 필수 설정

### 네이버 로그인
- ✅ Clerk Dashboard Custom OAuth Provider 설정
- ✅ Provider Key 확인 (`naver_auth` 또는 설정한 값)
- ✅ UserInfo URL: 프록시 서버 주소 (`http://15.165.148.244:3001/`)
- ✅ Attribute Mapping 설정 (`sub`, `email`)
- ✅ 프록시 서버 실행 상태 확인 (PM2)
- ✅ 네이버 개발자 센터 Redirect URI 설정
- ✅ 이메일 동의 항목 필수 설정

---

## 🐛 문제 해결

### Supabase 동기화 실패

**증상**: 로그인은 성공했지만 Supabase에 사용자가 생성되지 않음

**확인 사항**:
1. `hooks/use-sync-user.ts` 로그 확인
2. `/api/sync-user` API 호출 여부 확인
3. Clerk 인증 상태 확인 (`isSignedIn`, `userId`)
4. External Accounts 연결 여부 확인

**해결 방법**:
- 브라우저 콘솔에서 `[useSyncUser]` 로그 확인
- Network 탭에서 `/api/sync-user` 요청 확인
- 서버 로그에서 에러 메시지 확인

### OAuth 로그인 실패

**증상**: OAuth 로그인 버튼 클릭 시 에러 발생

**확인 사항**:
1. Clerk Dashboard에서 Provider 설정 확인
2. Provider Key와 코드의 전략 이름 일치 여부
3. Redirect URI 설정 확인
4. (네이버만) 프록시 서버 실행 상태 확인

**해결 방법**:
- Clerk Dashboard → SSO Connections 확인
- Provider Key 확인 후 코드의 전략 이름 수정
- 네이버의 경우 프록시 서버 로그 확인: `pm2 logs clerk-userinfo-proxy`

---

## 📚 참고 문서

- `docs/CLERK_CODE_LOCATIONS.md`: Clerk 관련 코드 위치
- `docs/naver-oauth-flow.md`: 네이버 OAuth 플로우 상세 설명
- `네이버로그인검증`: 네이버 로그인 검증 체크리스트
- `네이버.MD`: 네이버 로그인 구현 가이드

