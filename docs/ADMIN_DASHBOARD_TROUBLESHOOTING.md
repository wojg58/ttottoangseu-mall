# 관리자 대시보드 문제 해결 가이드

## 문제: 배포 사이트에서 관리자 대시보드 데이터가 비어있음

### 원인 확인 체크리스트

#### 1. Supabase 환경 변수 확인

**로컬 환경 (.env.local)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**배포 환경 (Vercel)**
1. Vercel 대시보드 → 프로젝트 선택
2. Settings → Environment Variables
3. 다음 변수들이 **Production** 환경에 설정되어 있는지 확인:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ 중요**: 로컬과 배포가 **같은 Supabase 프로젝트**를 가리켜야 합니다.

#### 2. 관리자 이메일 환경 변수 확인

**배포 환경 (Vercel)에 반드시 설정 필요:**
```env
ADMIN_EMAILS=your-email@example.com
```

여러 이메일은 쉼표로 구분:
```env
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

**확인 방법:**
1. Vercel 대시보드 → Settings → Environment Variables
2. `ADMIN_EMAILS` 변수가 **Production** 환경에 있는지 확인
3. 값이 로그인한 사용자의 이메일과 일치하는지 확인

#### 3. Clerk 사용자 ID 확인

배포 환경에서 로그인한 사용자의 Clerk User ID를 확인:
1. 배포 사이트에서 로그인
2. 브라우저 개발자 도구 → Console
3. 관리자 대시보드 접속 시 로그 확인:
   ```
   [isAdmin] 권한 확인 결과
   clerkUserId: user_xxxxx
   primaryEmail: your-email@example.com
   isAdmin: true/false
   ```

#### 4. 서버 로그 확인

배포 환경의 서버 로그에서 다음을 확인:

**성공 케이스:**
```
[getDashboardStats] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용
[getDashboardStats] ✅ 전체 주문 수: 8
[getDashboardStats] ✅ 상품 수: 512
```

**실패 케이스:**
```
[isAdmin] ❌ 관리자 권한 없음 - 이메일이 관리자 목록에 없습니다
또는
[getDashboardStats] ❌ 전체 주문 수 조회 실패
```

### 해결 방법

#### 방법 1: 환경 변수 설정 (가장 일반적)

1. **Vercel 대시보드** 접속
2. **Settings** → **Environment Variables**
3. 다음 변수 추가/수정:
   - `ADMIN_EMAILS`: 관리자 이메일 주소 (쉼표로 구분)
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (없는 경우)
4. **Redeploy** 실행

#### 방법 2: Supabase 프로젝트 확인

로컬과 배포가 다른 Supabase 프로젝트를 사용하는 경우:

1. **로컬 `.env.local`**의 `NEXT_PUBLIC_SUPABASE_URL` 확인
2. **Vercel 환경 변수**의 `NEXT_PUBLIC_SUPABASE_URL` 확인
3. 두 값이 **동일한지** 확인
4. 다르면:
   - 같은 프로젝트로 통일하거나
   - 배포 DB에 데이터 시딩/마이그레이션 적용

#### 방법 3: RLS 정책 확인 (개발 환경)

개발 환경에서는 RLS가 비활성화되어 있어야 합니다:

```sql
-- 모든 테이블의 RLS 비활성화 (개발 환경 전용)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

**⚠️ 주의**: 프로덕션에서는 RLS를 활성화하고 적절한 정책을 설정해야 합니다.

### 현재 구현 방식

관리자 대시보드는 **Service Role 클라이언트**를 사용하여 RLS를 우회합니다:

```typescript
// actions/admin.ts
const supabase = getServiceRoleClient(); // RLS 우회
```

이 방식의 장점:
- RLS 정책과 무관하게 모든 데이터 조회 가능
- 관리자 권한 체크(`isAdmin()`)로 이중 보안
- 서버 사이드에서만 사용되므로 안전

### 디버깅 로그

배포 환경에서 다음 로그를 확인하세요:

1. **관리자 권한 확인:**
   ```
   [isAdmin] 권한 확인 결과
   - clerkUserId: user_xxxxx
   - primaryEmail: your-email@example.com
   - adminEmails: ["admin@example.com"]
   - isAdmin: true/false
   ```

2. **대시보드 통계 조회:**
   ```
   [getDashboardStats] ✅ 관리자 권한 확인됨
   [getDashboardStats] ✅ 전체 주문 수: X
   [getDashboardStats] ✅ 상품 수: Y
   ```

3. **에러 발생 시:**
   ```
   [getDashboardStats] ❌ 전체 주문 수 조회 실패
   - code: PGRST301
   - message: ...
   ```

### 체크리스트

배포 사이트에서 관리자 대시보드가 비어있을 때:

- [ ] Vercel에 `ADMIN_EMAILS` 환경 변수가 설정되어 있는가?
- [ ] 로그인한 사용자의 이메일이 `ADMIN_EMAILS`에 포함되어 있는가?
- [ ] Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 환경 변수가 설정되어 있는가?
- [ ] 로컬과 배포의 `NEXT_PUBLIC_SUPABASE_URL`이 같은 프로젝트를 가리키는가?
- [ ] 서버 로그에서 `[isAdmin] ✅ 관리자 권한 확인됨`이 출력되는가?
- [ ] 서버 로그에서 데이터 조회 에러가 발생하는가?

### 추가 도움

문제가 지속되면:
1. Vercel 서버 로그 전체 확인
2. Supabase 대시보드에서 직접 쿼리 실행하여 데이터 존재 확인
3. Clerk 대시보드에서 사용자 이메일 주소 확인
