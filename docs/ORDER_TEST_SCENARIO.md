# 주문 내역 조회 테스트 시나리오

## 목표
결제 성공 후 DB에 주문이 저장되고, 마이페이지에서 로그인한 사용자 기준으로 주문이 조회되는지 확인

## 사용자 식별자 통일
- **기준**: `users.id` (UUID) 사용
- **변환**: Clerk `userId` (예: `user_xxx`) → `users.id` (UUID)
- **저장**: `orders.user_id`에 `users.id` (UUID) 저장
- **조회**: `orders.user_id == users.id` (UUID)로 필터링

## 테스트 시나리오

### 1. 결제 성공 → 주문 저장 확인

#### 전제 조건
- 로그인 상태
- 장바구니에 상품이 있음

#### 테스트 단계
1. 상품 페이지에서 "바로 구매" 또는 장바구니에서 "결제하기" 클릭
2. 주문/결제 페이지에서 결제 정보 입력
3. 신용카드 결제 진행
4. 결제 성공 페이지 확인

#### 확인 사항 (Vercel 로그)
다음 로그가 순서대로 나타나야 함:

```
[createOrder] clerkUserId=user_xxx
[createOrder] dbUserId(users.id)=<UUID>
[createOrder] 주문 생성 시도: { clerkUserId: "user_xxx", dbUserId: "<UUID>", ... }
[createOrder] inserted order.user_id=<UUID>
[createOrder] ✅ 주문 생성 완료: { insertedOrderUserId: "<UUID>", dbUserId: "<UUID>", match: true }
```

#### 확인 사항 (Supabase)
```sql
-- 최근 주문 확인
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.clerk_user_id,
    u.email,
    o.payment_status,
    o.total_amount,
    o.created_at
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC
LIMIT 5;
```

**확인 포인트**:
- `o.user_id`가 UUID 형식인지 확인
- `u.clerk_user_id`와 현재 로그인한 사용자의 Clerk ID가 일치하는지 확인
- `o.payment_status`가 `PAID`인지 확인

### 2. 마이페이지 주문 내역 조회

#### 테스트 단계
1. 결제 성공 후 "주문 내역 보기" 버튼 클릭 또는 `/mypage/orders` 접속
2. 주문 내역 페이지 확인

#### 확인 사항 (Vercel 로그)
다음 로그가 나타나야 함:

```
[getOrders] clerkUserId=user_xxx
[getOrders] dbUserId(users.id)=<UUID>
[getOrders] query filter = (order.user_id == <UUID>)
[getOrders] results count=1 (또는 그 이상)
[getOrders] 주문 목록 조회 완료: { orderCount: 1, orderNumbers: ["ORD-..."] }
```

#### 확인 사항 (화면)
- "주문 내역이 없습니다" 메시지가 **나오지 않아야** 함
- 결제한 주문이 목록에 표시되어야 함
- 주문번호, 결제 금액, 주문 일시가 정확히 표시되어야 함

### 3. 결제 실패/취소 처리

#### 테스트 단계
1. 주문/결제 페이지에서 결제 진행
2. 결제 창에서 "취소" 클릭
3. 결제 실패 페이지 확인

#### 확인 사항
- 주문은 생성되었지만 `payment_status`가 `PENDING`으로 유지되어야 함
- 마이페이지에서 주문 내역이 표시되어야 함 (결제 대기 상태)

### 4. 여러 주문 조회

#### 테스트 단계
1. 여러 번 결제 진행 (최소 2회 이상)
2. 마이페이지 주문 내역 확인

#### 확인 사항
- 모든 주문이 목록에 표시되어야 함
- 최신 주문이 맨 위에 표시되어야 함
- 각 주문의 정보가 정확해야 함

## 문제 발생 시 확인 사항

### 1. 주문이 DB에 저장되지 않는 경우
- Vercel 로그에서 `[createOrder] 주문 생성 실패` 확인
- 에러 메시지 확인
- `getCurrentUserId()`가 `null`을 반환하는지 확인

### 2. 주문은 저장되었지만 조회되지 않는 경우
- Vercel 로그에서 `[getOrders]` 로그 확인
- `[getOrders] dbUserId`와 `[createOrder] inserted order.user_id`가 일치하는지 확인
- Supabase에서 직접 조회:
  ```sql
  -- 현재 사용자의 Clerk ID로 주문 조회
  SELECT o.*, u.clerk_user_id
  FROM orders o
  INNER JOIN users u ON o.user_id = u.id
  WHERE u.clerk_user_id = 'YOUR_CLERK_USER_ID'
  ORDER BY o.created_at DESC;
  ```

### 3. PGRST301 에러 발생 시
- Vercel 로그에서 `PGRST301` 에러 확인
- `getCurrentUserId()`가 service role 클라이언트로 재시도하는지 확인
- RLS가 비활성화되어 있는지 확인 (개발 환경)

## 로그 확인 방법

### Vercel 로그에서 확인
1. Vercel Dashboard → 프로젝트 → Logs 탭
2. 검색창에 `[createOrder]` 또는 `[getOrders]` 입력
3. 시간순으로 정렬하여 확인

### 로그 형식
```
[createOrder] clerkUserId=user_xxx
[createOrder] dbUserId(users.id)=<UUID>
[createOrder] inserted order.user_id=<UUID>
[getOrders] clerkUserId=user_xxx
[getOrders] dbUserId(users.id)=<UUID>
[getOrders] query filter = (order.user_id == <UUID>)
[getOrders] results count=1
```

## 예상 결과

### 정상 동작 시
- 결제 성공 → 주문 DB 저장 (`orders.user_id` = `users.id` UUID)
- 마이페이지 접속 → 주문 조회 성공 (`orders.user_id` = `users.id` UUID로 필터링)
- 주문 내역 목록에 결제한 주문 표시

### 문제 발생 시
- 로그에서 `clerkUserId`와 `dbUserId` 불일치 확인
- `inserted order.user_id`와 `query filter`의 `user_id` 불일치 확인
- Supabase에서 직접 조회하여 데이터 확인
