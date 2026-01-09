# 결제 테스트 체크리스트

## ⚠️ 중요: 보안프로그램 오류는 무시하세요

`net::ERR_CONNECTION_REFUSED` 오류는 한국 전자금융거래 보안프로그램(IPinside) 관련 오류입니다.
- **테스트 환경에서는 무시해도 됩니다**
- 실제 결제 완료와는 무관합니다
- 이 오류 때문에 결제가 막히지 않습니다

## ✅ 실제로 확인해야 할 것들

### 1. 결제 완료 후 URL 확인

결제 모달에서 "결제" 버튼을 클릭한 후:

1. **브라우저 주소창 확인**
   - URL이 `/order/success?paymentKey=...&orderId=...&amount=...`로 변경되었는지 확인
   - 페이지가 변경되지 않았다면 결제 인증이 완료되지 않은 것

2. **결제 성공 페이지 확인**
   - "결제 승인 처리 중..." 메시지가 보이는지 확인
   - "결제가 완료되었습니다" 메시지가 나타나는지 확인

### 2. 네트워크 탭 확인

개발자 도구 → 네트워크 탭:

1. **필터 설정**
   - 필터 입력란에 `toss/confirm` 또는 `confirm` 입력

2. **결제 승인 API 호출 확인**
   - `/api/payments/toss/confirm` 요청이 있는지 확인
   - 요청이 없다면 → 결제 성공 페이지로 이동하지 않은 것
   - 요청이 있다면 → 상태 코드와 응답 확인

3. **요청 상태 확인**
   - **200 OK**: 정상 (응답 본문 확인 필요)
   - **400 Bad Request**: 요청 데이터 문제
   - **500 Internal Server Error**: 서버 오류

4. **응답 본문 확인**
   - `{ "success": true, ... }`: 결제 승인 성공
   - `{ "success": false, "message": "..." }`: 결제 승인 실패 (메시지 확인)

### 3. 서버 로그 확인

터미널에서 다음 로그 확인:

```
[POST /api/payments/toss/confirm] 결제 승인 시작
✅ 사용자 인증 완료: ...
✅ 주문 정보 조회 완료: ...
✅ 토스페이먼츠 승인 API 호출 성공
✅ 재고 차감 완료
✅ 주문 상태 업데이트 완료 (PAID)
```

**에러가 있다면:**
- 에러 메시지 전체 복사
- 어떤 단계에서 실패했는지 확인

### 4. 데이터베이스 확인

Supabase Dashboard → SQL Editor:

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
  o.payment_status as order_payment_status,
  o.fulfillment_status
FROM public.payments p
LEFT JOIN public.orders o ON p.order_id = o.id
ORDER BY p.created_at DESC
LIMIT 5;
```

## 🔍 문제 진단

### 시나리오 1: 결제 승인 API가 호출되지 않음

**증상:**
- 네트워크 탭에 `/api/payments/toss/confirm` 요청이 없음
- URL이 `/order/success`로 변경되지 않음

**원인:**
- 토스페이먼츠 결제 인증이 완료되지 않음
- successUrl로 리다이렉트되지 않음

**해결:**
1. 결제 모달에서 실제로 결제를 완료했는지 확인
2. 토스페이먼츠 테스트 카드 정보 확인
3. 브라우저 콘솔에서 토스페이먼츠 관련 에러 확인

### 시나리오 2: 결제 승인 API가 실패함

**증상:**
- 네트워크 탭에 `/api/payments/toss/confirm` 요청이 있음
- 상태 코드: 400 또는 500
- 응답: `{ "success": false, "message": "..." }`

**원인:**
- 토스페이먼츠 API 키 문제
- 결제 금액 불일치
- 주문 정보 문제

**해결:**
1. 서버 로그에서 에러 메시지 확인
2. 환경 변수 확인 (`.env` 파일)
3. 주문 금액과 결제 금액 일치 확인

### 시나리오 3: 결제 승인은 성공했지만 주문 상태가 업데이트되지 않음

**증상:**
- 네트워크 탭: `/api/payments/toss/confirm` 요청 성공 (200 OK)
- 응답: `{ "success": true, ... }`
- 데이터베이스: `payment_status`가 여전히 `PENDING`

**원인:**
- 데이터베이스 업데이트 실패
- 낙관적 잠금 조건 불일치

**해결:**
1. 서버 로그에서 업데이트 에러 확인
2. 주문이 이미 `PAID` 상태인지 확인
3. 수동으로 상태 업데이트 (테스트용)

## 📝 테스트 시 확인할 정보

결제 테스트 후 다음 정보를 공유해주세요:

1. **네트워크 탭 스크린샷**
   - `/api/payments/toss/confirm` 요청
   - 상태 코드
   - 응답 본문

2. **서버 로그**
   - 터미널 출력 전체
   - 특히 에러 메시지

3. **데이터베이스 상태**
   - 주문 상태 쿼리 결과
   - 결제 정보 쿼리 결과

4. **브라우저 URL**
   - 결제 완료 후 최종 URL

이 정보들을 함께 공유해주시면 정확한 원인을 파악할 수 있습니다.

