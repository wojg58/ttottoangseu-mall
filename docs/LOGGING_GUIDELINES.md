# 로깅 가이드라인

> **목적**: 프로젝트 전반에서 일관된 로깅 정책 수립  
> **작성일**: 2025년 1월  
> **적용 범위**: 서버 사이드 (Server Actions, API Routes) 및 클라이언트 사이드 (React Components)

---

## 📋 로그 레벨 정책

| 레벨    | 사용 시점                    | 프로덕션 출력 | 예시                           |
| ------- | ---------------------------- | ------------- | ------------------------------ |
| `debug` | 상세 디버깅 정보             | ❌ 개발 환경만 | 단계별 진행 상황, 중간 값 확인  |
| `info`  | 중요한 비즈니스 로직         | ✅            | 주문 생성, 결제 완료, 사용자 동기화 |
| `warn`  | 경고 상황                    | ✅            | 재시도, 폴백 처리, 예외 상황    |
| `error` | 에러 발생                    | ✅            | 예외 처리, 실패 케이스, API 오류 |

---

## 🎯 로깅 원칙

### 1. **에러와 경고는 항상 로깅**

```typescript
// ✅ DO: 에러는 항상 로깅
try {
  await processOrder(orderId);
} catch (error) {
  logger.error("[processOrder] 주문 처리 실패", error);
  throw error;
}

// ✅ DO: 경고 상황도 로깅
if (!token) {
  logger.warn("[getCurrentUserId] 토큰 없음, service role 사용");
  return getServiceRoleClient();
}
```

### 2. **정상 흐름은 핵심만 로깅**

```typescript
// ✅ DO: 중요한 비즈니스 이벤트만 info
logger.info("[createOrder] 주문 생성 완료", { orderId });

// ❌ DON'T: 단계별 상세 로그는 debug
logger.info("[getCurrentUserId] 1단계: 함수 호출됨"); // ❌
logger.info("[getCurrentUserId] 2단계: Clerk 인증 확인"); // ❌
logger.info("[getCurrentUserId] 3단계: 토큰 확인"); // ❌

// ✅ DO: 디버깅 정보는 debug
logger.debug("[getCurrentUserId] 사용자 조회 중", { clerkUserId });
```

### 3. **디버깅 로그는 `debug` 레벨 사용**

```typescript
// ✅ DO: 디버깅 정보는 debug
logger.debug("[getProducts] 필터 적용", { categorySlug, page, pageSize });
logger.debug("[addToCart] 상품 추가 중", { productId, quantity });

// ❌ DON'T: 디버깅 정보를 info로 사용
logger.info("[getProducts] 필터 적용", { categorySlug }); // ❌
```

### 4. **logger.group/groupEnd 최소화**

```typescript
// ❌ DON'T: 모든 함수에 group 사용
logger.group("[functionName] 시작");
// ... 로직
logger.groupEnd();

// ✅ DO: 복잡한 함수에서만 사용 (선택적)
logger.group("[complexOperation] 복잡한 작업 시작");
// ... 복잡한 로직
logger.groupEnd();

// ✅ DO: 대부분의 경우 개별 로그로 충분
logger.debug("[simpleOperation] 작업 시작");
// ... 로직
logger.debug("[simpleOperation] 작업 완료");
```

### 5. **모든 console.log → logger로 통일**

```typescript
// ❌ DON'T: console.log 직접 사용
console.log("[getProducts] 상품 목록 조회");
console.error("[getProducts] 에러 발생", error);

// ✅ DO: logger 사용
logger.info("[getProducts] 상품 목록 조회");
logger.error("[getProducts] 에러 발생", error);
```

---

## 📝 로깅 패턴 예시

### 서버 사이드 (Server Actions)

```typescript
"use server";

import logger from "@/lib/logger";

// ✅ 좋은 예: 핵심만 로깅
export async function createOrder(orderData: OrderData) {
  try {
    const order = await insertOrder(orderData);
    logger.info("[createOrder] 주문 생성 완료", { orderId: order.id });
    return { success: true, orderId: order.id };
  } catch (error) {
    logger.error("[createOrder] 주문 생성 실패", error);
    return { success: false, message: "주문 생성에 실패했습니다." };
  }
}

// ✅ 좋은 예: 디버깅 정보는 debug
export async function getProducts(filters: ProductFilters) {
  logger.debug("[getProducts] 필터 적용", { filters });
  
  const products = await queryProducts(filters);
  
  if (products.length === 0) {
    logger.debug("[getProducts] 결과 없음");
  }
  
  return products;
}

// ❌ 나쁜 예: 과도한 로깅
export async function getCurrentUserId() {
  logger.group("[getCurrentUserId] 시작");
  logger.info("[getCurrentUserId] 1단계: 함수 호출");
  logger.info("타임스탬프:", new Date().toISOString());
  logger.info("[getCurrentUserId] 2단계: 인증 확인");
  // ... 20개 이상의 로그
  logger.groupEnd();
}
```

### 클라이언트 사이드 (React Components)

```typescript
"use client";

import logger from "@/lib/logger-client";

// ✅ 좋은 예: 민감 정보 제외
export function CheckoutForm() {
  const handleSubmit = async (formData: FormData) => {
    logger.debug("[CheckoutForm] 결제 정보 확인", {
      hasOrdererInfo: !!(formData.ordererName && formData.ordererPhone),
      hasShippingInfo: !!(formData.shippingAddress),
      totalAmount: formData.totalAmount,
    });
    
    // 주문 생성
    const result = await createOrder(formData);
    
    if (result.success) {
      logger.info("[CheckoutForm] 주문 생성 완료");
    } else {
      logger.error("[CheckoutForm] 주문 생성 실패", result.error);
    }
  };
}

// ❌ 나쁜 예: 민감 정보 노출
export function CheckoutForm() {
  const handleSubmit = async (formData: FormData) => {
    logger.info("주문자 정보:", {
      name: formData.ordererName,    // ❌ 민감 정보
      email: formData.ordererEmail,  // ❌ 민감 정보
      phone: formData.ordererPhone, // ❌ 민감 정보
    });
  };
}
```

---

## 🚫 제거해야 할 로그

### 1. 단계별 진행 로그

```typescript
// ❌ 제거
logger.info("[getCurrentUserId] 1단계: 함수 호출됨");
logger.info("[getCurrentUserId] 2단계: Clerk 인증 확인");
logger.info("[getCurrentUserId] 3단계: 토큰 확인");
logger.info("[getCurrentUserId] 4단계: Supabase 조회");

// ✅ 대체 (필요 시)
logger.debug("[getCurrentUserId] 사용자 조회 중");
```

### 2. 타임스탬프 로그

```typescript
// ❌ 제거
logger.info("타임스탬프:", new Date().toISOString());
logger.info("시간:", new Date().toISOString());

// ✅ 대체 (필요 시)
logger.debug("[functionName] 작업 시작");
```

### 3. 정상 흐름의 상세 로그

```typescript
// ❌ 제거
logger.info("[getCart] 장바구니 조회 시작");
logger.info("[getCart] 사용자 ID 확인 완료");
logger.info("[getCart] 장바구니 ID 조회 완료");
logger.info("[getCart] 장바구니 아이템 조회 완료");
logger.info("[getCart] 장바구니 조회 완료");

// ✅ 대체
logger.debug("[getCart] 장바구니 조회");
```

### 4. 중복된 정보 로그

```typescript
// ❌ 제거
logger.info("userId:", userId);
logger.info("사용자 ID:", userId);
logger.info("Clerk userId:", userId);

// ✅ 대체
logger.debug("[functionName] 사용자 확인", { hasUserId: !!userId });
```

---

## ✅ 유지해야 할 로그

### 1. 에러 발생 시

```typescript
// ✅ 유지
try {
  await processOrder(orderId);
} catch (error) {
  logger.error("[processOrder] 주문 처리 실패", error);
  throw error;
}
```

### 2. 경고 상황

```typescript
// ✅ 유지
if (!token) {
  logger.warn("[getCurrentUserId] 토큰 없음, service role 사용");
  return getServiceRoleClient();
}
```

### 3. 중요한 비즈니스 이벤트

```typescript
// ✅ 유지
logger.info("[createOrder] 주문 생성 완료", { orderId });
logger.info("[confirmPayment] 결제 승인 완료", { orderId, amount });
logger.info("[syncUser] 사용자 동기화 완료");
```

### 4. 외부 API 호출 실패

```typescript
// ✅ 유지
const response = await fetch("/api/external-service");
if (!response.ok) {
  logger.error("[callExternalAPI] 외부 API 호출 실패", {
    status: response.status,
    statusText: response.statusText,
  });
}
```

---

## 🔒 보안 주의사항 (클라이언트 사이드)

### 절대 로깅하지 말아야 할 정보

- ❌ 사용자 ID, 이메일, 이름
- ❌ 전화번호, 주소, 우편번호
- ❌ 토큰, 비밀번호, API 키
- ❌ 주문자 정보, 배송 정보
- ❌ 결제 정보 (카드번호, 계좌번호 등)

### 안전한 로깅 방법

```typescript
// ❌ 나쁜 예
logger.info("사용자 정보:", {
  id: user.id,
  email: user.email,
  name: user.name,
});

// ✅ 좋은 예
logger.debug("사용자 확인 완료", {
  hasUser: !!user,
  hasEmail: !!user.email,
  hasName: !!user.name,
});
```

---

## 📊 로그 레벨 분포 목표

| 레벨    | 목표 비율 | 설명                     |
| ------- | --------- | ------------------------ |
| `debug` | 30-40%    | 디버깅 전용 (개발 환경만) |
| `info`  | 40-50%    | 핵심 비즈니스 로직       |
| `warn`  | 5-10%     | 경고 상황                |
| `error` | 5-10%     | 에러 발생                |

---

## 🎯 체크리스트

리팩토링 시 다음을 확인하세요:

- [ ] 모든 `console.log` → `logger`로 변경
- [ ] 단계별 로그 제거 또는 `debug`로 변경
- [ ] 타임스탬프 로그 제거
- [ ] `logger.group/groupEnd` 최소화
- [ ] 에러는 `logger.error` 사용
- [ ] 경고는 `logger.warn` 사용
- [ ] 디버깅 정보는 `logger.debug` 사용
- [ ] 핵심 비즈니스 로직만 `logger.info` 사용
- [ ] 클라이언트 사이드에서 민감 정보 로깅하지 않음

---

## 📚 참고 자료

- [lib/logger.ts](../lib/logger.ts) - 서버 사이드 logger
- [lib/logger-client.ts](../lib/logger-client.ts) - 클라이언트 사이드 logger
- [LOGGING_REFACTORING_PLAN.md](./LOGGING_REFACTORING_PLAN.md) - 리팩토링 계획

---

**작성일**: 2025년 1월  
**버전**: 1.0
