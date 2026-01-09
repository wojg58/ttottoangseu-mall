# RLS 정책 테스트 가이드

## 📋 개요

프로덕션 배포 전 RLS (Row Level Security) 정책이 올바르게 작동하는지 검증하는 가이드입니다.

## 🎯 테스트 목표

1. 사용자는 자신의 데이터만 조회/수정 가능한지 확인
2. 다른 사용자의 데이터는 접근 불가능한지 확인
3. 공개 데이터(products, categories)는 모든 사용자가 조회 가능한지 확인
4. 서비스 롤은 모든 데이터 접근 가능한지 확인

## 🔧 테스트 환경 준비

### 1. Supabase Dashboard 접속

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. **SQL Editor** 메뉴 이동

### 2. 테스트 데이터 준비

```sql
-- 테스트용 사용자 생성
INSERT INTO public.users (clerk_user_id, email, name, role)
VALUES 
  ('test_user_1', 'test1@example.com', '테스트 사용자 1', 'customer'),
  ('test_user_2', 'test2@example.com', '테스트 사용자 2', 'customer')
ON CONFLICT (clerk_user_id) DO NOTHING;

-- 테스트용 주문 생성 (사용자 1)
INSERT INTO public.orders (user_id, order_number, total_amount, status)
SELECT id, 'TEST-ORDER-001', 10000, 'pending'
FROM public.users
WHERE clerk_user_id = 'test_user_1'
LIMIT 1;
```

## 📝 테스트 케이스

### 테스트 1: users 테이블 RLS 정책

#### 1-1. 자신의 정보 조회 (성공 예상)

**테스트 방법:**
1. Clerk로 로그인한 사용자의 JWT 토큰 획득
2. Supabase SQL Editor에서 실행:

```sql
-- 자신의 clerk_user_id로 조회
SELECT * FROM public.users 
WHERE clerk_user_id = (auth.jwt()->>'sub')::text;
```

**예상 결과:** ✅ 자신의 사용자 정보 반환

#### 1-2. 다른 사용자 정보 조회 (실패 예상)

**테스트 방법:**
```sql
-- 다른 사용자의 clerk_user_id로 조회 시도
SELECT * FROM public.users 
WHERE clerk_user_id = 'test_user_2';
```

**예상 결과:** ❌ 빈 결과 반환 (RLS 정책에 의해 차단)

---

### 테스트 2: orders 테이블 RLS 정책

#### 2-1. 자신의 주문 조회 (성공 예상)

```sql
SELECT * FROM public.orders 
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE clerk_user_id = (auth.jwt()->>'sub')::text
);
```

**예상 결과:** ✅ 자신의 주문 목록 반환

#### 2-2. 다른 사용자 주문 조회 (실패 예상)

```sql
-- 다른 사용자의 주문 조회 시도
SELECT o.* FROM public.orders o
JOIN public.users u ON u.id = o.user_id
WHERE u.clerk_user_id = 'test_user_2';
```

**예상 결과:** ❌ 빈 결과 반환 (RLS 정책에 의해 차단)

---

### 테스트 3: payments 테이블 RLS 정책

#### 3-1. 자신의 결제 정보 조회 (성공 예상)

```sql
SELECT p.* FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
JOIN public.users u ON u.id = o.user_id
WHERE u.clerk_user_id = (auth.jwt()->>'sub')::text;
```

**예상 결과:** ✅ 자신의 결제 정보 반환

#### 3-2. 다른 사용자 결제 정보 조회 (실패 예상)

```sql
-- 다른 사용자의 결제 정보 조회 시도
SELECT p.* FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
JOIN public.users u ON u.id = o.user_id
WHERE u.clerk_user_id = 'test_user_2';
```

**예상 결과:** ❌ 빈 결과 반환 (RLS 정책에 의해 차단)

---

### 테스트 4: chat_sessions 테이블 RLS 정책

#### 4-1. 자신의 챗봇 세션 조회 (성공 예상)

```sql
SELECT cs.* FROM public.chat_sessions cs
JOIN public.users u ON u.id = cs.user_id
WHERE u.clerk_user_id = (auth.jwt()->>'sub')::text;
```

**예상 결과:** ✅ 자신의 챗봇 세션 반환

#### 4-2. 다른 사용자 세션 조회 (실패 예상)

```sql
-- 다른 사용자의 세션 조회 시도
SELECT cs.* FROM public.chat_sessions cs
JOIN public.users u ON u.id = cs.user_id
WHERE u.clerk_user_id = 'test_user_2';
```

**예상 결과:** ❌ 빈 결과 반환 (RLS 정책에 의해 차단)

---

### 테스트 5: products 테이블 RLS 정책 (공개 데이터)

#### 5-1. 활성 상품 조회 (성공 예상 - 비인증 포함)

```sql
-- 비인증 사용자도 조회 가능해야 함
SELECT * FROM public.products 
WHERE is_active = true AND deleted_at IS NULL
LIMIT 10;
```

**예상 결과:** ✅ 활성 상품 목록 반환 (anon 역할로도 가능)

#### 5-2. 비활성 상품 조회 (실패 예상)

```sql
-- 비활성 상품 조회 시도
SELECT * FROM public.products 
WHERE is_active = false;
```

**예상 결과:** ❌ 빈 결과 반환 (RLS 정책에 의해 차단)

---

### 테스트 6: 서비스 롤 권한 검증

#### 6-1. 서비스 롤로 모든 데이터 접근 (성공 예상)

**주의:** 서비스 롤은 RLS를 우회하므로, 애플리케이션 코드에서 `getServiceRoleClient()`를 사용할 때만 테스트 가능합니다.

**테스트 방법:**
- 애플리케이션 코드에서 서비스 롤 클라이언트로 데이터 조회
- 모든 테이블에 대해 SELECT, INSERT, UPDATE, DELETE 가능해야 함

**예상 결과:** ✅ 모든 데이터 접근 가능

---

## 🧪 자동화된 테스트 스크립트

`supabase/migrations/20250120000001_test_rls_policies.sql` 파일을 실행하여 테스트 데이터를 준비할 수 있습니다.

```sql
-- Supabase SQL Editor에서 실행
\i supabase/migrations/20250120000001_test_rls_policies.sql
```

## ✅ 테스트 체크리스트

### 필수 테스트 항목

- [ ] **users 테이블**
  - [ ] 자신의 정보 조회 가능
  - [ ] 다른 사용자 정보 조회 불가능
  - [ ] 자신의 정보 수정 가능
  - [ ] 다른 사용자 정보 수정 불가능

- [ ] **orders 테이블**
  - [ ] 자신의 주문 조회 가능
  - [ ] 다른 사용자 주문 조회 불가능
  - [ ] 자신의 주문 생성 가능
  - [ ] 자신의 주문 수정 가능

- [ ] **payments 테이블**
  - [ ] 자신의 결제 정보 조회 가능
  - [ ] 다른 사용자 결제 정보 조회 불가능

- [ ] **chat_sessions 테이블**
  - [ ] 자신의 세션 조회 가능
  - [ ] 다른 사용자 세션 조회 불가능
  - [ ] 자신의 세션 생성 가능
  - [ ] 자신의 세션 수정 가능

- [ ] **chat_messages 테이블**
  - [ ] 자신의 메시지 조회 가능
  - [ ] 다른 사용자 메시지 조회 불가능
  - [ ] 자신의 메시지 생성 가능

- [ ] **carts 테이블**
  - [ ] 자신의 장바구니 조회 가능
  - [ ] 다른 사용자 장바구니 조회 불가능
  - [ ] 자신의 장바구니 생성/수정 가능

- [ ] **products 테이블 (공개 데이터)**
  - [ ] 비인증 사용자도 활성 상품 조회 가능
  - [ ] 인증 사용자도 활성 상품 조회 가능
  - [ ] 비활성 상품 조회 불가능

- [ ] **categories 테이블 (공개 데이터)**
  - [ ] 비인증 사용자도 활성 카테고리 조회 가능
  - [ ] 인증 사용자도 활성 카테고리 조회 가능
  - [ ] 비활성 카테고리 조회 불가능

- [ ] **서비스 롤 권한**
  - [ ] 모든 테이블 조회 가능
  - [ ] 모든 테이블 수정 가능
  - [ ] RLS 정책 우회 확인

## 🐛 문제 해결

### 문제: RLS 정책이 작동하지 않음

**원인:**
- RLS가 활성화되지 않음
- 정책이 제대로 생성되지 않음
- JWT 토큰이 올바르지 않음

**해결 방법:**
```sql
-- RLS 활성화 확인
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'orders', 'payments');

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 문제: 서비스 롤도 데이터 접근 불가능

**원인:**
- 서비스 롤 정책이 없음
- 서비스 롤 클라이언트를 사용하지 않음

**해결 방법:**
- `getServiceRoleClient()` 사용 확인
- 서비스 롤 정책이 있는지 확인

## 📚 참고 자료

- [Supabase RLS 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS 문서](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Clerk + Supabase 통합 가이드](https://clerk.com/docs/integrations/databases/supabase)

## ⚠️ 주의사항

1. **프로덕션 배포 전 반드시 테스트**
   - RLS 정책 오류는 프로덕션에서 심각한 문제를 일으킬 수 있음
   - 모든 테스트 케이스를 통과한 후에만 배포

2. **테스트 데이터 정리**
   - 테스트 완료 후 테스트 데이터 삭제
   - 프로덕션 환경에 테스트 데이터가 남지 않도록 주의

3. **JWT 토큰 확인**
   - Clerk 인증을 통한 실제 JWT 토큰으로 테스트
   - `auth.jwt()->>'sub'`가 올바른 clerk_user_id를 반환하는지 확인

---

**테스트 완료 후 프로덕션 배포 가능합니다!** ✅

