# 관리자 권한 설정 가이드

이 문서는 `/admin` 경로에 대한 관리자 권한 설정 방법을 설명합니다.

## 개요

`/admin` 전체 라우트는 관리자만 접근 가능하도록 보호됩니다. 권한 확인은 **middleware 레벨**에서 수행되며, 비관리자는 자동으로 홈(`/`)으로 리다이렉트됩니다.

## 권한 확인 우선순위

관리자 권한은 다음 순서로 확인됩니다:

1. **Clerk Role** (`role === 'admin'`)
2. **Clerk Public Metadata** (`isAdmin === true`)
3. **이메일 기반** (하위 호환성, `ADMIN_EMAILS` 환경 변수)

## 설정 방법

### 방법 1: Clerk Role 사용 (권장)

Clerk Dashboard에서 사용자에게 `admin` role을 부여합니다.

1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. **Users** → 대상 사용자 선택
3. **Roles** 탭에서 `admin` role 추가
4. 사용자의 `publicMetadata`에 자동으로 `role: "admin"`이 설정됨

**장점:**
- Clerk의 표준 RBAC 기능 사용
- 역할 관리가 명확함
- 여러 역할을 동시에 관리 가능

### 방법 2: Clerk Public Metadata 사용

Clerk Dashboard에서 사용자의 `publicMetadata`에 `isAdmin: true`를 설정합니다.

1. [Clerk Dashboard](https://dashboard.clerk.com) 접속
2. **Users** → 대상 사용자 선택
3. **Metadata** 탭 → **Public metadata** 섹션
4. 다음 JSON 추가:
   ```json
   {
     "isAdmin": true
   }
   ```

**중요:** Session Token Claims에 metadata를 포함해야 합니다.

1. Clerk Dashboard → **Sessions** → **Customize session token**
2. **Claims Editor**에서 다음 추가:
   ```json
   {
     "metadata": "{{user.public_metadata}}"
   }
   ```

**장점:**
- 유연한 메타데이터 관리
- 추가 정보 저장 가능

### 방법 3: 이메일 기반 (하위 호환성)

환경 변수 `ADMIN_EMAILS`에 관리자 이메일을 설정합니다.

```bash
# .env.local
ADMIN_EMAILS=admin@example.com,manager@example.com
```

**주의:**
- 이 방법은 하위 호환성을 위해 유지됩니다
- 새로운 설정에서는 방법 1 또는 2를 권장합니다

## 보안 구조

### 1. Middleware 레벨 보호

`middleware.ts`에서 `/admin` 경로를 감지하고 관리자 권한을 확인합니다:

```typescript
// middleware.ts
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

if (isAdminRoute(request)) {
  const { sessionClaims, userId } = await auth();
  
  if (!userId) {
    return redirectToSignIn();
  }
  
  if (!isAdminFromClaims(sessionClaims)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}
```

**장점:**
- 모든 `/admin` 경로에 자동 적용
- 서버 사이드에서 처리되어 클라이언트 노출 없음
- 빠른 응답 (페이지 렌더링 전 차단)

### 2. Server Actions 보안

관리자 전용 Server Actions는 `isAdmin()` 함수로 추가 확인합니다:

```typescript
// actions/admin.ts
export async function getDashboardStats() {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    return null;
  }
  // ...
}
```

**장점:**
- 이중 보안 (Defense in Depth)
- API 라우트 직접 접근 차단

### 3. Supabase 접근 보안

관리자 기능은 **Service Role Key**를 사용하여 RLS를 우회합니다:

```typescript
// lib/supabase/service-role.ts
export function getServiceRoleClient() {
  // 서버 사이드에서만 사용
  // 클라이언트에 노출되면 안됨
}
```

**중요:**
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출되면 안됩니다
- `.env.local`에만 저장하고 Git에 커밋하지 마세요

## 테스트 방법

### 1. 관리자 권한 확인

1. 관리자 계정으로 로그인
2. `/admin` 접근 시도
3. 정상적으로 접근 가능해야 함

### 2. 비관리자 차단 확인

1. 일반 사용자 계정으로 로그인
2. `/admin` 접근 시도
3. 자동으로 `/`로 리다이렉트되어야 함

### 3. 미인증 사용자 차단 확인

1. 로그아웃 상태
2. `/admin` 접근 시도
3. `/sign-in`으로 리다이렉트되어야 함

## 문제 해결

### 문제: 관리자 권한이 인식되지 않음

**원인 1: Session Token Claims에 metadata가 포함되지 않음**

**해결:**
1. Clerk Dashboard → **Sessions** → **Customize session token**
2. **Claims Editor**에 `"metadata": "{{user.public_metadata}}"` 추가
3. 사용자 재로그인 필요 (세션 토큰 갱신)

**원인 2: Metadata 업데이트 지연**

**해결:**
- Clerk의 publicMetadata 변경은 즉시 반영되지만, sessionClaims에는 약 60초 지연될 수 있습니다
- 사용자 재로그인 또는 세션 토큰 갱신 대기

### 문제: Middleware에서 권한 체크가 작동하지 않음

**확인 사항:**
1. `middleware.ts`의 `config.matcher`에 `/admin(.*)` 포함 여부
2. Clerk 환경 변수 설정 확인 (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
3. 개발 서버 재시작

## 관련 파일

- `middleware.ts`: 관리자 경로 보호 로직
- `actions/admin.ts`: `isAdmin()` 함수 및 관리자 전용 Server Actions
- `app/admin/layout.tsx`: 관리자 레이아웃 (권한 체크는 middleware에서 처리)
- `lib/supabase/service-role.ts`: Service Role 클라이언트 (RLS 우회)

## 참고 자료

- [Clerk RBAC 문서](https://clerk.com/docs/references/nextjs/basic-rbac)
- [Clerk Session Token Claims](https://clerk.com/docs/references/nextjs/basic-rbac)
- [Clerk Public Metadata](https://clerk.com/docs/users/user-metadata)
