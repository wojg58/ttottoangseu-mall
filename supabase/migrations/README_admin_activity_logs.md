# admin_activity_logs 테이블 마이그레이션 가이드

## 📋 마이그레이션 파일 위치

```
supabase/migrations/20260116000000_create_admin_activity_logs.sql
```

## 🚀 적용 방법

### 방법 1: Supabase 대시보드에서 직접 실행 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **마이그레이션 파일 내용 복사**
   - `supabase/migrations/20260116000000_create_admin_activity_logs.sql` 파일 열기
   - 전체 내용 복사 (Ctrl+A, Ctrl+C)

4. **SQL Editor에 붙여넣기 및 실행**
   - SQL Editor에 붙여넣기 (Ctrl+V)
   - "Run" 버튼 클릭 또는 Ctrl+Enter

5. **결과 확인**
   - "Success. No rows returned" 메시지 확인
   - Table Editor에서 `admin_activity_logs` 테이블 확인

### 방법 2: Supabase CLI 사용

```bash
# 프로젝트 디렉토리에서 실행
cd d:\MVP\ttottoangseumall

# Supabase CLI로 마이그레이션 적용
supabase db push

# 또는 특정 마이그레이션만 실행
supabase migration up
```

## 📊 테이블 구조

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | UUID | PRIMARY KEY | 기본 키 (자동 생성) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 생성 시간 |
| admin_user_id | TEXT | NOT NULL | Clerk user ID |
| admin_email | TEXT | NULL | 관리자 이메일 |
| action | TEXT | NOT NULL | 액션 (예: "order_status_changed") |
| entity_type | TEXT | NOT NULL | 엔티티 타입 (예: "order") |
| entity_id | TEXT | NOT NULL | 엔티티 ID |
| before | JSONB | NULL | 변경 전 값 |
| after | JSONB | NULL | 변경 후 값 |
| ip | TEXT | NULL | IP 주소 |
| user_agent | TEXT | NULL | User Agent |

## 🔒 보안 설정

### RLS (Row Level Security)
- ✅ **활성화됨**
- 관리자만 SELECT/INSERT 가능
- UPDATE/DELETE 불가 (로그는 읽기 전용)

### 정책
1. **SELECT 정책**: `admin_only_select_admin_activity_logs`
   - `users` 테이블에서 `clerk_user_id`와 `role='admin'` 확인
   - 관리자만 조회 가능

2. **INSERT 정책**: `admin_only_insert_admin_activity_logs`
   - `users` 테이블에서 `clerk_user_id`와 `role='admin'` 확인
   - 관리자만 삽입 가능

## 📈 인덱스

성능 최적화를 위한 인덱스:
- `idx_admin_activity_logs_created_at`: 생성 시간 (DESC)
- `idx_admin_activity_logs_action`: 액션
- `idx_admin_activity_logs_entity_type`: 엔티티 타입
- `idx_admin_activity_logs_admin_user_id`: 관리자 ID
- `idx_admin_activity_logs_entity_type_id`: 엔티티 타입 + ID (복합 인덱스)

## ✅ 적용 후 확인

마이그레이션 실행 후 다음을 확인하세요:

1. **테이블 생성 확인**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'admin_activity_logs';
   ```

2. **RLS 활성화 확인**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'admin_activity_logs';
   -- rowsecurity = true 여야 함
   ```

3. **정책 확인**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'admin_activity_logs';
   ```

4. **인덱스 확인**
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'admin_activity_logs';
   ```

## 🔧 사용 예시

### 로그 기록 예시

```typescript
// lib/audit-log.ts 또는 actions/admin.ts에서 사용
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const supabase = getServiceRoleClient();

await supabase.from("admin_activity_logs").insert({
  admin_user_id: clerkUserId, // TEXT 타입
  admin_email: userEmail,
  action: "order_status_changed",
  entity_type: "order",
  entity_id: orderId,
  before: { payment_status: "PENDING" }, // JSONB
  after: { payment_status: "PAID" }, // JSONB
  ip: ipAddress,
  user_agent: userAgent,
});
```

## ⚠️ 주의사항

1. **로그는 수정/삭제 불가**: RLS 정책에서 UPDATE/DELETE를 허용하지 않음
2. **관리자 권한 확인**: `users` 테이블의 `role='admin'`인 사용자만 접근 가능
3. **Clerk 연동**: `auth.jwt()->>'sub'`를 통해 Clerk user ID 확인
4. **JSONB 타입**: `before`/`after` 필드는 JSONB 타입이므로 객체를 직접 저장 가능

## 🐛 문제 해결

### 에러: "permission denied for table admin_activity_logs"
- **원인**: RLS 정책이 제대로 적용되지 않았거나, 사용자가 관리자가 아님
- **해결**: 
  1. `users` 테이블에서 해당 사용자의 `role`이 `'admin'`인지 확인
  2. RLS 정책이 제대로 생성되었는지 확인

### 에러: "relation does not exist"
- **원인**: 테이블이 생성되지 않음
- **해결**: 마이그레이션 파일을 다시 실행

### 에러: "duplicate key value violates unique constraint"
- **원인**: 인덱스가 이미 존재함
- **해결**: 마이그레이션 파일의 `CREATE INDEX IF NOT EXISTS` 구문 사용 (이미 적용됨)
