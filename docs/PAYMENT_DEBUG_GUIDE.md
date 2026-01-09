# 결제 완료 문제 디버깅 가이드

## 문제 상황
- 결제 모달에서 결제 완료 버튼 클릭
- 결제 완료 페이지로 이동하지 않음
- `payment_status`가 `PENDING`에서 `PAID`로 변경되지 않음

## 결제 플로우 확인

### 1. 결제 플로우
```
1. 사용자: 결제 모달에서 "다음" 버튼 클릭
   ↓
2. TossPayments: 결제 인증 처리
   ↓
3. TossPayments: successUrl로 리다이렉트
   - URL: `/order/success?paymentKey={paymentKey}&orderId={orderId}&amount={amount}`
   ↓
4. `/order/success` 페이지: `/api/payments/toss/confirm` 호출
   ↓
5. `/api/payments/toss/confirm`: 
   - 토스페이먼츠 승인 API 호출
   - 결제 정보 저장
   - 재고 차감
   - 주문 상태 업데이트 (payment_status: "PAID")
```

## 디버깅 체크리스트

### 1. 브라우저 개발자 도구 확인

#### 네트워크 탭
1. **결제 승인 API 호출 확인**
   - 필터: `toss/confirm`
   - 요청이 있는지 확인
   - 상태 코드 확인 (200, 400, 500 등)
   - 응답 본문 확인

2. **에러 확인**
   - 빨간색으로 표시된 요청 확인
   - 에러 메시지 확인

#### 콘솔 탭
1. **에러 메시지 확인**
   - 빨간색 에러 로그 확인
   - `[OrderSuccessPage]` 또는 `[POST /api/payments/toss/confirm]` 로그 확인

2. **로그 확인**
   - `logger.group()` 로그 그룹 확인
   - 각 단계별 로그 확인

### 2. 서버 로그 확인

터미널에서 다음 로그 확인:
- `[POST /api/payments/toss/confirm]` 로그
- 에러 메시지
- 토스페이먼츠 API 응답

### 3. 데이터베이스 확인

```sql
-- 최근 주문 상태 확인
SELECT 
  id,
  order_number,
  payment_status,
  fulfillment_status,
  total_amount,
  created_at,
  updated_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 5;

-- 결제 정보 확인
SELECT 
  p.id,
  p.order_id,
  p.payment_key,
  p.status as payment_status,
  p.amount,
  p.approved_at,
  o.payment_status as order_payment_status
FROM public.payments p
LEFT JOIN public.orders o ON p.order_id = o.id
ORDER BY p.created_at DESC
LIMIT 5;
```

## 가능한 문제점 및 해결 방법

### 문제 1: 결제 승인 API가 호출되지 않음

**증상:**
- 네트워크 탭에 `/api/payments/toss/confirm` 요청이 없음
- `/order/success` 페이지가 로딩 중 상태로 멈춤

**원인:**
- JavaScript 에러로 인한 API 호출 실패
- URL 파라미터 누락

**해결:**
1. 브라우저 콘솔에서 에러 확인
2. URL 파라미터 확인 (`paymentKey`, `orderId`, `amount`)

### 문제 2: 토스페이먼츠 승인 API 실패

**증상:**
- `/api/payments/toss/confirm` 요청은 있지만 실패
- 상태 코드: 400 또는 500

**원인:**
- 토스페이먼츠 테스트 키 문제
- 결제 금액 불일치
- 주문 ID 불일치

**해결:**
1. 서버 로그에서 토스페이먼츠 API 응답 확인
2. 환경 변수 확인:
   ```bash
   # .env 파일 확인
   TOSS_SECRET_KEY=test_sk_...
   TOSS_CLIENT_KEY=test_ck_...
   ```
3. 결제 금액과 주문 금액 일치 확인

### 문제 3: 주문 상태 업데이트 실패

**증상:**
- 결제 승인 API는 성공했지만 `payment_status`가 변경되지 않음

**원인:**
- 데이터베이스 업데이트 실패
- 낙관적 잠금 조건 불일치

**해결:**
1. 서버 로그에서 업데이트 에러 확인
2. 주문이 이미 `PAID` 상태인지 확인
3. 수동으로 상태 업데이트:
   ```sql
   UPDATE public.orders
   SET 
     payment_status = 'PAID',
     fulfillment_status = 'UNFULFILLED',
     updated_at = now()
   WHERE id = 'YOUR_ORDER_ID';
   ```

### 문제 4: 재고 차감 실패

**증상:**
- 결제는 완료되었지만 재고가 차감되지 않음

**원인:**
- 재고 부족
- 재고 차감 로직 에러

**해결:**
1. 서버 로그에서 재고 차감 에러 확인
2. 상품 재고 확인:
   ```sql
   SELECT id, name, stock 
   FROM public.products 
   WHERE id IN (
     SELECT product_id FROM public.order_items WHERE order_id = 'YOUR_ORDER_ID'
   );
   ```

## 테스트 방법

### 1. 수동 결제 승인 테스트

```sql
-- 1. PENDING 상태인 주문 찾기
SELECT id, order_number, payment_status, total_amount
FROM public.orders
WHERE payment_status = 'PENDING'
ORDER BY created_at DESC
LIMIT 1;

-- 2. 수동으로 PAID로 변경 (테스트용)
UPDATE public.orders
SET 
  payment_status = 'PAID',
  fulfillment_status = 'UNFULFILLED',
  updated_at = now()
WHERE id = 'YOUR_ORDER_ID';

-- 3. 변경 확인
SELECT id, order_number, payment_status, fulfillment_status
FROM public.orders
WHERE id = 'YOUR_ORDER_ID';
```

### 2. API 직접 호출 테스트

```bash
# curl로 결제 승인 API 테스트
curl -X POST http://localhost:3000/api/payments/toss/confirm \
  -H "Content-Type: application/json" \
  -H "Cookie: __clerk_db_jwt=..." \
  -d '{
    "paymentKey": "test_payment_key",
    "orderId": "YOUR_ORDER_ID",
    "amount": 28500
  }'
```

## 로그 확인 포인트

### 클라이언트 사이드 로그
- `[OrderSuccessPage]` - 결제 성공 페이지 로그
- `[PaymentWidget]` - 결제 위젯 로그

### 서버 사이드 로그
- `[POST /api/payments/toss/confirm]` - 결제 승인 API 로그
- 토스페이먼츠 API 응답
- 데이터베이스 업데이트 결과

## 다음 단계

문제를 발견하면:
1. 에러 메시지 복사
2. 서버 로그 복사
3. 네트워크 요청/응답 스크린샷
4. 데이터베이스 상태 확인 결과

이 정보들을 함께 공유해주시면 정확한 원인을 파악할 수 있습니다.

