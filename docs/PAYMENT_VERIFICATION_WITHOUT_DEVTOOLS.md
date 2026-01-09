# 개발자 도구 없이 결제 완료 확인 방법

## 문제 상황
- 카드사 보안 프로그램이 개발자 도구를 감지하여 페이지를 다시 로드함
- 결제 모달 내에서 개발자 도구 사용 불가

## ✅ 확인 방법 (개발자 도구 없이)

### 방법 1: 서버 로그 확인 (가장 중요)

터미널에서 개발 서버 로그를 실시간으로 확인:

```bash
# 개발 서버 실행 중인 터미널에서 확인
# 결제 완료 시 다음 로그가 나타나야 함:

[POST /api/payments/toss/confirm] 결제 승인 시작
✅ 사용자 인증 완료: user_xxx
✅ 주문 정보 조회 완료: { orderNumber: 'ORD-...', totalAmount: 28500 }
✅ 토스페이먼츠 승인 API 호출 성공
✅ 재고 차감 완료
✅ 주문 상태 업데이트 완료 (PAID)
🎉 결제 승인 프로세스 완료!
```

**에러가 있다면:**
- 에러 메시지 전체를 복사
- 어떤 단계에서 실패했는지 확인

### 방법 2: 브라우저 주소창 확인

결제 완료 후 브라우저 주소창 URL 확인:

**성공 시:**
```
http://localhost:3000/order/success?paymentKey=...&orderId=...&amount=...
```

**실패 시:**
```
http://localhost:3000/order/fail?message=...
```

**결제 인증 미완료:**
- URL이 변경되지 않음
- 결제 모달이 계속 열려있음

### 방법 3: 결제 완료 페이지 확인

결제 완료 후 리다이렉트된 페이지에서:

**성공 페이지 (`/order/success`):**
- "결제 승인 처리 중..." 메시지
- "결제가 완료되었습니다" 메시지
- 주문번호 표시

**실패 페이지 (`/order/fail`):**
- 에러 메시지 표시
- "다시 시도" 버튼

### 방법 4: 데이터베이스 직접 확인

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- 1. 최근 주문 상태 확인
SELECT 
  id,
  order_number,
  payment_status,
  fulfillment_status,
  total_amount,
  created_at,
  updated_at
FROM public.orders
WHERE id = 'YOUR_ORDER_ID'  -- 실제 주문 ID로 변경
ORDER BY created_at DESC;

-- 2. 결제 정보 확인
SELECT 
  p.id,
  p.order_id,
  p.payment_key,
  p.status as payment_status,
  p.amount,
  p.approved_at,
  o.payment_status as order_payment_status,
  o.fulfillment_status
FROM public.payments p
LEFT JOIN public.orders o ON p.order_id = o.id
WHERE p.order_id = 'YOUR_ORDER_ID'  -- 실제 주문 ID로 변경
ORDER BY p.created_at DESC;
```

**확인 포인트:**
- `payment_status`가 `PAID`인지
- `fulfillment_status`가 `UNFULFILLED`인지
- `approved_at`이 설정되었는지
- `updated_at`이 최근에 업데이트되었는지

### 방법 5: 마이페이지에서 확인

결제 완료 후 마이페이지에서 주문 상태 확인:

1. `/mypage/orders` 페이지 접속
2. 최근 주문 확인
3. 주문 상태가 "결제 완료"로 표시되는지 확인

---

## 🔍 문제 진단 체크리스트

### 시나리오 1: 결제 완료 후 URL이 변경되지 않음

**증상:**
- 결제 모달이 계속 열려있음
- URL이 `/checkout/payment`에서 변경되지 않음

**원인:**
- 토스페이먼츠 결제 인증이 완료되지 않음
- 카드 정보 입력 오류
- 테스트 카드 정보 문제

**해결:**
1. 토스페이먼츠 테스트 카드 정보 확인
2. 카드 정보를 정확히 입력했는지 확인
3. 결제 모달에서 에러 메시지 확인

### 시나리오 2: 결제 완료 후 `/order/fail`로 이동

**증상:**
- URL이 `/order/fail?message=...`로 변경됨
- 에러 메시지 표시

**원인:**
- 결제 승인 API 실패
- 토스페이먼츠 API 키 문제
- 결제 금액 불일치

**해결:**
1. 서버 로그에서 에러 메시지 확인
2. 환경 변수 확인 (`.env` 파일)
3. 주문 금액과 결제 금액 일치 확인

### 시나리오 3: 결제 완료 후 `/order/success`로 이동했지만 주문 상태가 업데이트되지 않음

**증상:**
- URL이 `/order/success`로 변경됨
- "결제 승인 처리 중..." 메시지가 계속 표시됨
- 데이터베이스에서 `payment_status`가 여전히 `PENDING`

**원인:**
- 결제 승인 API 호출 실패
- 서버 에러

**해결:**
1. 서버 로그에서 에러 확인
2. 데이터베이스 직접 확인
3. 수동으로 상태 업데이트 (테스트용)

---

## 📝 테스트 시 확인할 정보

결제 테스트 후 다음 정보를 공유해주세요:

1. **브라우저 주소창 URL** (결제 완료 후)
2. **서버 로그** (터미널 출력 전체, 특히 에러 메시지)
3. **데이터베이스 쿼리 결과** (위 SQL 실행 결과)
4. **결제 완료 페이지 메시지** (성공/실패 메시지)

이 정보들을 함께 공유해주시면 정확한 원인을 파악할 수 있습니다.

