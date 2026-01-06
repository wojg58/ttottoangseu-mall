# PGRST301 에러 해결 가이드

## 문제 원인

`PGRST301` 에러는 Supabase PostgREST가 부분 인덱스(partial index)를 사용할 때 인증 토큰이 없거나 유효하지 않을 때 발생합니다.

### 발생 조건

1. **부분 인덱스 사용**: `WHERE deleted_at IS NULL` 조건이 있는 인덱스
2. **인증 토큰 없음**: Clerk 토큰이 없거나 유효하지 않음
3. **PostgREST 제한**: PostgREST는 부분 인덱스를 사용하려면 유효한 인증 토큰이 필요

### 현재 데이터베이스 상태

- `users` 테이블: `idx_users_clerk_user_id` (부분 인덱스)
- `products` 테이블: `products_pkey` (일반 인덱스, 문제 없음)

## 해결 방법

### 방법 1: 일반 인덱스 추가 (권장)

부분 인덱스 대신 일반 인덱스를 추가하여 PostgREST가 항상 사용할 수 있도록 합니다.

```sql
-- users 테이블: clerk_user_id 일반 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id_no_filter
ON public.users(clerk_user_id);

-- products 테이블: id와 deleted_at 복합 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_id_deleted_at
ON public.products(id, deleted_at);
```

**주의**: 이 마이그레이션은 Supabase Dashboard에서 직접 실행해야 합니다.

### 방법 2: 코드 레벨 해결 (현재 구현됨)

모든 쿼리에서 `PGRST301` 에러 발생 시 자동으로 service role 클라이언트로 재시도:

```typescript
// PGRST301 에러 발생 시 service role 클라이언트로 재시도
if (error && error.code === "PGRST301") {
  const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
  const serviceSupabase = getServiceRoleClient();
  // 재시도...
}
```

### 방법 3: 처음부터 service role 클라이언트 사용 (현재 구현됨)

토큰이 없으면 처음부터 service role 클라이언트 사용:

```typescript
const token = await authResult.getToken();
let supabase;

if (!token) {
  supabase = getServiceRoleClient();
} else {
  supabase = await createClient();
}
```

## 현재 구현 상태

✅ `getCurrentUserId()`: PGRST301 에러 처리 완료
✅ `addToCart()`: PGRST301 에러 처리 완료

## 추가 확인 사항

### 상품 ID 형식

실제 상품 ID는 `ttotto_pr_440` 형식입니다. URL에서 전달되는 값이 올바른지 확인:

- URL slug: `----------4-1765340861030-y44fi56` (이것은 slug일 수 있음)
- 실제 product ID: `ttotto_pr_440` 형식

### 권장 조치

1. **즉시**: 현재 코드가 정상 작동하는지 확인 (이미 재시도 로직 구현됨)
2. **장기**: Supabase Dashboard에서 일반 인덱스 추가 마이그레이션 실행

## 참고 자료

- [Supabase PostgREST 인덱스 가이드](https://supabase.com/docs/guides/database/postgres/indexes)
- [PGRST301 에러 문서](https://postgrest.org/en/stable/api.html#errors)
