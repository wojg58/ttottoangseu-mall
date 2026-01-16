# 관리자 활동 로그 테스트 가이드

## 📋 테스트 개요

주문 상태 변경 시 관리자 활동 로그가 정상적으로 기록되는지 테스트합니다.

## 🧪 테스트 케이스

### 1. 관리자 (Admin) 케이스

**전제 조건:**
- 관리자 계정으로 로그인
- Clerk에서 `role='admin'` 또는 `publicMetadata.isAdmin=true` 설정

**테스트 절차:**
1. 관리자 페이지 접속: `http://localhost:3000/admin/orders`
2. 주문 상세 페이지로 이동
3. 주문 상태 변경 (예: 결제 대기 → 결제 완료)
4. 저장 버튼 클릭

**예상 결과:**
- ✅ 주문 상태가 정상적으로 업데이트됨
- ✅ `/admin/settings/audit-logs` 페이지에서 로그 확인 가능
- ✅ 로그에 다음 정보 포함:
  - 관리자 이메일
  - 액션: `order_status_changed`
  - 엔티티 타입: `order`
  - 엔티티 ID: 주문 ID
  - 변경 전 값 (before)
  - 변경 후 값 (after)
  - IP 주소
  - User Agent

**확인 방법:**
```sql
-- Supabase SQL Editor에서 확인
SELECT 
  admin_email,
  action,
  entity_type,
  entity_id,
  before,
  after,
  ip,
  user_agent,
  created_at
FROM admin_activity_logs
WHERE entity_type = 'order'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. 비관리자 (Non-Admin) 케이스

**전제 조건:**
- 일반 사용자 계정으로 로그인
- 관리자 권한 없음

**테스트 절차:**
1. 일반 사용자로 로그인
2. 관리자 페이지 접속 시도: `http://localhost:3000/admin/orders`
3. (접근 불가 시) 직접 API 호출 시도

**예상 결과:**
- ❌ 관리자 페이지 접근 불가 (리다이렉트)
- ❌ API 호출 시 403 Forbidden 응답
- ❌ 로그 기록 안 됨

**확인 방법:**
```bash
# API 직접 호출 테스트
curl -X PUT http://localhost:3000/api/admin/orders/{orderId}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {일반사용자토큰}" \
  -d '{"payment_status": "PAID"}'

# 예상 응답: {"success": false, "message": "관리자 권한이 필요합니다."}
```

### 3. 비로그인 (Unauthenticated) 케이스

**전제 조건:**
- 로그인하지 않은 상태

**테스트 절차:**
1. 로그아웃 상태
2. 관리자 페이지 접속 시도: `http://localhost:3000/admin/orders`
3. (접근 불가 시) 직접 API 호출 시도

**예상 결과:**
- ❌ 관리자 페이지 접근 불가 (로그인 페이지로 리다이렉트)
- ❌ API 호출 시 401 Unauthorized 또는 403 Forbidden 응답
- ❌ 로그 기록 안 됨

**확인 방법:**
```bash
# API 직접 호출 테스트 (인증 없음)
curl -X PUT http://localhost:3000/api/admin/orders/{orderId}/status \
  -H "Content-Type: application/json" \
  -d '{"payment_status": "PAID"}'

# 예상 응답: 401 또는 403
```

## 🔍 상세 테스트 시나리오

### 시나리오 1: 결제 상태 변경

**테스트 데이터:**
- 주문 ID: 기존 주문 ID
- 변경 전: `payment_status: "PENDING"`
- 변경 후: `payment_status: "PAID"`

**확인 사항:**
1. 주문 상태가 정상적으로 변경됨
2. 로그에 `before: {"payment_status": "PENDING"}` 기록됨
3. 로그에 `after: {"payment_status": "PAID"}` 기록됨
4. 관리자 이메일이 정확히 기록됨

### 시나리오 2: 배송 상태 변경

**테스트 데이터:**
- 주문 ID: 기존 주문 ID
- 변경 전: `fulfillment_status: "UNFULFILLED"`
- 변경 후: `fulfillment_status: "SHIPPED"`
- 운송장 번호: "1234567890"

**확인 사항:**
1. 주문 상태가 정상적으로 변경됨
2. `shipped_at` 시간이 자동으로 기록됨
3. 로그에 `before`와 `after` 값이 정확히 기록됨

### 시나리오 3: 여러 필드 동시 변경

**테스트 데이터:**
- 주문 ID: 기존 주문 ID
- 변경 전: `{payment_status: "PENDING", fulfillment_status: "UNFULFILLED"}`
- 변경 후: `{payment_status: "PAID", fulfillment_status: "PREPARING"}`

**확인 사항:**
1. 모든 필드가 정상적으로 변경됨
2. 로그에 모든 변경사항이 포함됨

### 시나리오 4: 변경사항 없음

**테스트 데이터:**
- 주문 ID: 기존 주문 ID
- 변경 요청: 현재 상태와 동일한 값

**예상 결과:**
- ❌ 업데이트 실패 (400 Bad Request)
- ❌ 로그 기록 안 됨
- 응답: `{"success": false, "message": "변경할 내용이 없습니다."}`

## 🛠️ 수동 테스트 방법

### 1. 브라우저에서 테스트

1. **개발 서버 실행**
   ```bash
   pnpm dev
   ```

2. **관리자로 로그인**
   - `http://localhost:3000/sign-in`
   - 관리자 계정으로 로그인

3. **주문 관리 페이지 접속**
   - `http://localhost:3000/admin/orders`
   - 주문 목록에서 주문 선택

4. **주문 상태 변경**
   - 결제 상태 또는 배송 상태 변경
   - 저장 버튼 클릭

5. **로그 확인**
   - `http://localhost:3000/admin/settings/audit-logs`
   - 최신 로그 확인

### 2. API 직접 호출 테스트

```bash
# 관리자 토큰 필요 (Clerk)
TOKEN="your-admin-token"
ORDER_ID="order-uuid"

curl -X PUT "http://localhost:3000/api/admin/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "payment_status": "PAID",
    "fulfillment_status": "PREPARING"
  }'
```

### 3. 데이터베이스 직접 확인

```sql
-- 최근 로그 10개 확인
SELECT 
  admin_email,
  action,
  entity_type,
  entity_id,
  before,
  after,
  ip,
  created_at
FROM admin_activity_logs
WHERE entity_type = 'order'
ORDER BY created_at DESC
LIMIT 10;

-- 특정 주문의 모든 로그 확인
SELECT *
FROM admin_activity_logs
WHERE entity_type = 'order'
  AND entity_id = '주문-ID'
ORDER BY created_at DESC;
```

## ✅ 체크리스트

### 관리자 케이스
- [ ] 주문 상태 변경 성공
- [ ] 로그가 `admin_activity_logs` 테이블에 기록됨
- [ ] `before` 값이 정확함
- [ ] `after` 값이 정확함
- [ ] 관리자 이메일이 기록됨
- [ ] IP 주소가 기록됨 (있는 경우)
- [ ] User Agent가 기록됨 (있는 경우)
- [ ] `/admin/settings/audit-logs` 페이지에서 로그 확인 가능

### 비관리자 케이스
- [ ] 403 Forbidden 응답
- [ ] 로그 기록 안 됨
- [ ] 에러 메시지: "관리자 권한이 필요합니다."

### 비로그인 케이스
- [ ] 401/403 응답
- [ ] 로그 기록 안 됨

### 에러 처리
- [ ] 주문이 없을 때 404 응답
- [ ] 변경사항이 없을 때 400 응답
- [ ] 업데이트 실패 시 500 응답
- [ ] 로그 기록 실패해도 주문 상태 업데이트는 성공

## 🐛 문제 해결

### 로그가 기록되지 않는 경우

1. **관리자 권한 확인**
   ```sql
   SELECT clerk_user_id, email, role 
   FROM users 
   WHERE email = 'your-email@example.com';
   -- role이 'admin'인지 확인
   ```

2. **RLS 정책 확인**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'admin_activity_logs';
   ```

3. **테이블 존재 확인**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'admin_activity_logs';
   ```

### IP 주소가 null인 경우

- Server Action에서는 Request 객체가 없어 IP 추출이 어려울 수 있음
- API Route를 사용하면 IP 주소가 정상적으로 기록됨

## 📝 참고

- 로그는 실패해도 주문 상태 업데이트는 계속 진행됨 (fail-safe)
- 관리자가 아니면 로그 기록 자체를 시도하지 않음
- 모든 로그는 `/admin/settings/audit-logs` 페이지에서 확인 가능
