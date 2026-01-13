# 로깅 리팩토링 계획

> **목표**: 과도한 로깅을 정리하고, 프로덕션 환경에 적합한 로깅 정책 수립  
> **작성일**: 2025년 1월  
> **우선순위**: 🔴 **높음**

---

## 📊 현재 상황 분석

### 서버 사이드 로깅 현황

| 파일                        | logger 호출 | console 호출 | logger.group | 주요 문제             |
| --------------------------- | ----------- | ------------ | ------------ | --------------------- |
| `actions/cart.ts`           | **258회**   | 0회          | 52회         | 과도한 단계별 로깅    |
| `actions/orders.ts`         | 85회        | 5회          | 33회         | group 과다 사용       |
| `actions/admin-products.ts`  | 87회        | 48회         | 28회         | console.log 혼재      |
| `actions/sync-stock.ts`     | 49회        | 0회          | 22회         | group 과다 사용       |
| `actions/member-actions.ts` | 23회        | 0회          | 10회         | 적절한 수준           |
| 기타 파일                   | 0회         | **361회**    | 0회          | console.log 통일 필요 |

**서버 사이드 총계**:

- `logger` 호출: **502회**
- `console.log` 호출: **361회**
- `logger.group` 호출: **145회**

### 클라이언트 사이드 로깅 현황 ⚠️⚠️⚠️

| 파일                              | console 호출 | logger 호출 | 민감 정보 노출 | 주요 문제                    |
| --------------------------------- | ------------ | ----------- | -------------- | ---------------------------- |
| `components/auth-session-sync.tsx` | **64회**     | 0회         | ✅ **심각**    | 사용자 ID, 이메일, 토큰 노출 |
| `hooks/use-sync-user.ts`          | **15회**     | 0회         | ✅ **심각**    | 사용자 ID, 이메일, 토큰 노출 |
| `components/checkout-form.tsx`     | 28회         | 33회        | ✅ **심각**    | 주문자 정보, 주소 노출       |
| `components/payment-widget.tsx`    | 0회          | 31회        | ✅ **심각**    | 고객 이메일, 주문 정보 노출  |
| `app/sign-in/.../sign-in-content.tsx` | **128회** | 0회         | ✅ **심각**    | 이메일, 비밀번호 관련 로그   |
| 기타 컴포넌트                     | **317회**    | 107회       | ⚠️ **보통**    | console.log 직접 사용        |

**클라이언트 사이드 총계**:

- `console.log` 호출: **646회** (프로덕션에 노출됨!)
- `logger` 호출: **107회** (클라이언트용 logger 없음)
- **민감 정보 노출**: 사용자 ID, 이메일, 이름, 주소, 전화번호, 토큰 정보 등

### 🚨 **보안 위험: 클라이언트 사이드 민감 정보 노출**

**노출되는 민감 정보**:

1. **사용자 개인정보**:
   ```typescript
   // ❌ components/auth-session-sync.tsx
   console.log("👤 Clerk 사용자 정보:", {
     id: user.id,                    // 사용자 ID 노출
     email: user.emailAddresses[0]?.emailAddress,  // 이메일 노출
     name: user.fullName,            // 이름 노출
   });
   ```

2. **인증 토큰 정보**:
   ```typescript
   // ❌ hooks/use-sync-user.ts
   console.log("토큰 존재:", !!token);
   console.log("토큰 길이:", token.length);  // 토큰 길이 노출
   ```

3. **주문자 정보**:
   ```typescript
   // ❌ components/checkout-form.tsx
   logger.info("주문자 정보:", {
     name: formData.ordererName,      // 이름 노출
     phone: formData.ordererPhone,   // 전화번호 노출
     email: formData.ordererEmail,   // 이메일 노출
   });
   logger.info("배송 정보:", {
     address: formData.shippingAddress,  // 주소 노출
     zipCode: formData.shippingZipCode,  // 우편번호 노출
   });
   ```

4. **결제 정보**:
   ```typescript
   // ❌ components/payment-widget.tsx
   logger.info("[PaymentWidget] customerKey (이메일):", customerEmail);  // 이메일 노출
   logger.info("[PaymentWidget] actualValues:", {
     orderId,
     amount,
     customerName,
     customerEmail,  // 이메일 노출
   });
   ```

### 주요 문제점

#### 1. **과도한 단계별 로깅** ⚠️⚠️⚠️

```typescript
// ❌ 현재: actions/cart.ts
async function getCurrentUserId() {
  logger.group("[getCurrentUserId] 사용자 ID 조회 시작");
  logger.info("[getCurrentUserId] 1단계: 함수 호출됨");
  logger.info("타임스탬프:", new Date().toISOString());
  logger.info("[getCurrentUserId] 2단계: Clerk 인증 확인");
  logger.info("Clerk userId:", clerkUserId);
  logger.info("[getCurrentUserId] 3단계: Clerk 토큰 확인");
  logger.info("[getCurrentUserId] 4단계: Supabase users 테이블 조회");
  // ... 20개 이상의 로그
  logger.groupEnd();
}
```

**문제**:

- 단계별 로그가 너무 상세함
- 정상 흐름에서도 과도한 로그 출력
- 디버깅 목적의 로그가 프로덕션까지 포함

#### 2. **logger.group/groupEnd 과다 사용** ⚠️⚠️

```typescript
// ❌ 현재: 거의 모든 함수에 group 사용
logger.group("[functionName] 시작");
// ... 로직
logger.groupEnd();
```

**문제**:

- 함수마다 group/groupEnd 사용
- 로그 가독성 저하
- 불필요한 중첩 구조

#### 3. **console.log와 logger 혼재** ⚠️⚠️

```typescript
// ❌ 현재: 일관성 부족
console.log("[getProducts] 상품 목록 조회");
logger.info("[getCart] 장바구니 조회");
```

**문제**:

- 프로덕션 로깅 정책 불일치
- 디버깅 시 로그 추적 어려움

---

## 🎯 리팩토링 목표

### 1. **로그 레벨 정책 수립**

| 레벨    | 사용 시점            | 프로덕션 출력  | 예시                   |
| ------- | -------------------- | -------------- | ---------------------- |
| `debug` | 상세 디버깅 정보     | ❌ 개발 환경만 | 단계별 진행 상황       |
| `info`  | 중요한 비즈니스 로직 | ✅             | 주문 생성, 결제 완료   |
| `warn`  | 경고 상황            | ✅             | 재시도, 폴백 처리      |
| `error` | 에러 발생            | ✅             | 예외 처리, 실패 케이스 |

### 2. **로깅 원칙**

#### 서버 사이드

1. **에러와 경고는 항상 로깅**
2. **정상 흐름은 핵심만 로깅** (주문 생성, 결제 완료 등)
3. **디버깅 로그는 `debug` 레벨 사용**
4. **logger.group/groupEnd 최소화** (복잡한 함수에서만 사용)
5. **모든 console.log → logger로 통일**

#### 클라이언트 사이드 🔴 **최우선**

1. **민감 정보는 절대 로깅하지 않음** (사용자 ID, 이메일, 이름, 주소, 전화번호, 토큰)
2. **클라이언트용 logger 생성** (개발 환경에서만 출력)
3. **모든 console.log → logger로 통일**
4. **프로덕션에서는 로그 출력 안 함**
5. **에러만 Sentry로 전송** (민감 정보 제외)

---

## 📋 단계별 리팩토링 계획

### Phase 0: 클라이언트 사이드 logger 생성 및 민감 정보 제거 🔴 **최우선** (1주)

**우선순위**: 🔴 **최우선** (보안 위험)

#### 0.1 클라이언트용 logger 생성

**현재 문제**:
- `lib/logger.ts`는 서버 사이드용 (`process.env.NODE_ENV` 사용)
- 클라이언트에서 `logger` 사용 시 빌드 에러 발생 가능
- 클라이언트에서 `console.log` 직접 사용으로 민감 정보 노출

**해결 방안**:
```typescript
// lib/logger-client.ts (신규 생성)
"use client";

const isDev = typeof window !== "undefined" && 
  (process.env.NODE_ENV === "development" || 
   window.location.hostname === "localhost");

// 민감 정보 키워드 (서버와 동일)
const SENSITIVE_KEYS = [
  "password", "secret", "token", "key", "authorization",
  "email", "userId", "user_id", "clerk_id", "phone",
  "address", "zipCode", "zip_code", "name", "customerName",
  "ordererName", "shippingName", "depositorName",
] as const;

// 민감 정보 마스킹 함수
function maskSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length <= 8) return "***";
    const visibleLength = Math.min(2, Math.floor(value.length / 4));
    return value.substring(0, visibleLength) + "***" + 
           value.substring(value.length - visibleLength);
  }
  return "***";
}

function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(maskSensitiveData);
  
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sk => 
      lowerKey.includes(sk.toLowerCase())
    );
    
    if (isSensitive) {
      masked[key] = maskSensitiveValue(value);
    } else if (typeof value === "object" && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (isDev) {
      if (data !== undefined) {
        const masked = maskSensitiveData(data);
        console.log(`[DEBUG] ${message}`, masked);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  },
  
  info: (message: string, data?: unknown) => {
    if (isDev) {
      if (data !== undefined) {
        const masked = maskSensitiveData(data);
        console.log(`[INFO] ${message}`, masked);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  },
  
  warn: (message: string, data?: unknown) => {
    // 경고는 개발 환경에서만 (프로덕션 노출 방지)
    if (isDev) {
      if (data !== undefined) {
        const masked = maskSensitiveData(data);
        console.warn(`[WARN] ${message}`, masked);
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  },
  
  error: (message: string, error?: unknown) => {
    // 에러는 Sentry로만 전송 (민감 정보 제외)
    if (error !== undefined) {
      const masked = maskSensitiveData(error);
      // Sentry.captureException() 호출 (민감 정보 제외)
      if (isDev) {
        console.error(`[ERROR] ${message}`, masked);
      }
    } else {
      if (isDev) {
        console.error(`[ERROR] ${message}`);
      }
    }
  },
  
  group: (name: string) => {
    if (isDev) console.group(name);
  },
  
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
};

export default logger;
```

**작업**:

- [ ] `lib/logger-client.ts` 생성
- [ ] 민감 정보 마스킹 함수 구현
- [ ] 개발 환경에서만 출력되도록 설정

#### 0.2 민감 정보 노출 제거

**우선순위 파일**:

1. **`components/auth-session-sync.tsx`** (64회 console, 사용자 정보 노출)
2. **`hooks/use-sync-user.ts`** (15회 console, 토큰 정보 노출)
3. **`components/checkout-form.tsx`** (주문자/배송 정보 노출)
4. **`components/payment-widget.tsx`** (결제 정보 노출)
5. **`app/sign-in/.../sign-in-content.tsx`** (128회 console, 이메일 노출)

**리팩토링 예시**:

```typescript
// ❌ 현재: components/auth-session-sync.tsx
if (user) {
  userInfo = {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || "없음",
    name: user.fullName || user.username || "없음",
  };
  console.log("👤 Clerk 사용자 정보:", userInfo);  // ❌ 민감 정보 노출
}

// ✅ 개선 후
import logger from "@/lib/logger-client";

if (user) {
  // 민감 정보는 로깅하지 않음
  logger.debug("[AuthSessionSync] 사용자 인증 확인됨");
  
  // 디버깅 필요 시 마스킹된 정보만
  if (isDev) {
    logger.debug("[AuthSessionSync] 사용자 상태:", {
      hasUser: !!user,
      hasEmail: !!user.emailAddresses[0],
      hasName: !!user.fullName,
      externalAccountsCount: user.externalAccounts?.length || 0,
    });
  }
}
```

**작업**:

- [ ] `components/auth-session-sync.tsx` 리팩토링
- [ ] `hooks/use-sync-user.ts` 리팩토링
- [ ] `components/checkout-form.tsx` 리팩토링
- [ ] `components/payment-widget.tsx` 리팩토링
- [ ] `app/sign-in/.../sign-in-content.tsx` 리팩토링
- [ ] 기타 컴포넌트 리팩토링

**예상 결과**: 
- 클라이언트 `console.log` 646회 → **0회**
- 민감 정보 노출 → **0건**

---

### Phase 1: 로그 레벨 정책 수립 및 logger 개선 (1주)

#### 1.1 logger에 debug 레벨 추가 확인

현재 `lib/logger.ts`에 `debug` 레벨이 이미 있으므로 추가 작업 불필요.

#### 1.2 로깅 가이드라인 문서화

```typescript
// ✅ 권장 패턴
// 1. 에러는 항상 로깅
catch (error) {
  logger.error("[functionName] 작업 실패", error);
}

// 2. 중요한 비즈니스 로직만 info
logger.info("[createOrder] 주문 생성 완료", { orderId });

// 3. 디버깅 정보는 debug
logger.debug("[getCurrentUserId] 사용자 조회", { userId });

// 4. 경고는 warn
logger.warn("[getCurrentUserId] 토큰 없음, service role 사용");
```

**작업**:

- [ ] `docs/LOGGING_GUIDELINES.md` 작성
- [ ] 팀 공유 및 리뷰

---

### Phase 2: actions/cart.ts 리팩토링 (1주)

**우선순위**: 🔴 **최우선** (258회 로그, 가장 과도함)

#### 2.1 getCurrentUserId 함수 리팩토링

**현재**: 20개 이상의 로그  
**목표**: 3-5개로 축소

```typescript
// ❌ 현재 (20개 이상의 로그)
async function getCurrentUserId(): Promise<string | null> {
  logger.group("[getCurrentUserId] 사용자 ID 조회 시작");
  logger.info("[getCurrentUserId] 1단계: 함수 호출됨");
  logger.info("타임스탬프:", new Date().toISOString());
  // ... 18개 이상의 로그
  logger.groupEnd();
}

// ✅ 개선 후 (3-5개 로그)
async function getCurrentUserId(): Promise<string | null> {
  const authResult = await auth();
  const { userId: clerkUserId } = authResult;

  if (!clerkUserId) {
    logger.debug("[getCurrentUserId] 사용자 미인증");
    return null;
  }

  const token = await authResult.getToken();
  const supabase = token ? await createClient() : getServiceRoleClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    // PGRST301 에러는 재시도 (조용히 처리)
    if (error.code === "PGRST301") {
      logger.debug("[getCurrentUserId] PGRST301 에러, service role로 재시도");
      // 재시도 로직...
    } else {
      logger.error("[getCurrentUserId] 사용자 조회 실패", error);
      return null;
    }
  }

  if (!user) {
    // 동기화 시도 (조용히 처리)
    logger.debug("[getCurrentUserId] 사용자 없음, 동기화 시도");
    // 동기화 로직...
  }

  return user?.id ?? null;
}
```

**제거할 로그**:

- ❌ 단계별 로그 (1단계, 2단계, 3단계...)
- ❌ 타임스탬프 로그
- ❌ 정상 흐름의 상세 로그
- ❌ logger.group/groupEnd

**유지할 로그**:

- ✅ 에러 발생 시 (`logger.error`)
- ✅ 경고 상황 (`logger.warn`)
- ✅ 디버깅 필요 시 (`logger.debug`)

#### 2.2 getOrCreateCartId 함수 리팩토링

**현재**: 15개 이상의 로그  
**목표**: 2-3개로 축소

```typescript
// ✅ 개선 후
async function getOrCreateCartId(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existingCart, error } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (error && error.code === "PGRST301") {
    logger.debug("[getOrCreateCartId] PGRST301, service role로 재시도");
    // 재시도 로직...
  }

  if (existingCart) {
    return existingCart.id;
  }

  // 장바구니 생성
  const { data: newCart, error: insertError } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (insertError) {
    logger.error("[getOrCreateCartId] 장바구니 생성 실패", insertError);
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  return newCart.id;
}
```

#### 2.3 주요 함수별 리팩토링 목표

| 함수                | 현재 로그 | 목표 로그 | 우선순위  |
| ------------------- | --------- | --------- | --------- |
| `getCurrentUserId`  | 20+       | 3-5       | 🔴 최우선 |
| `getOrCreateCartId` | 15+       | 2-3       | 🔴 최우선 |
| `addToCart`         | 30+       | 5-7       | 🔴 최우선 |
| `updateCartItem`    | 25+       | 4-6       | 🟡 높음   |
| `removeFromCart`    | 20+       | 3-5       | 🟡 높음   |
| 기타 함수           | 10+       | 2-4       | 🟢 중간   |

**작업**:

- [ ] `getCurrentUserId` 리팩토링
- [ ] `getOrCreateCartId` 리팩토링
- [ ] `addToCart` 리팩토링
- [ ] `updateCartItem` 리팩토링
- [ ] `removeFromCart` 리팩토링
- [ ] 기타 함수 리팩토링

**예상 결과**: 258회 → **50-70회** (약 70% 감소)

---

### Phase 3: actions/orders.ts 리팩토링 (3일)

**현재**: 85회 logger, 33회 group  
**목표**: 20-30회로 축소

#### 3.1 주요 개선 사항

- logger.group/groupEnd 제거
- 단계별 로그 → debug 레벨로 변경
- 에러/경고만 info/warn 유지

**작업**:

- [ ] logger.group 제거
- [ ] 단계별 로그를 debug로 변경
- [ ] 핵심 로직만 info 유지

**예상 결과**: 85회 → **20-30회** (약 65% 감소)

---

### Phase 4: actions/admin-products.ts 리팩토링 (3일)

**현재**: 87회 logger, 48회 console.log, 28회 group  
**목표**: 30-40회로 축소

#### 4.1 주요 개선 사항

- console.log → logger로 통일
- logger.group 제거
- 단계별 로그 최소화

**작업**:

- [ ] console.log → logger.info/debug로 변경
- [ ] logger.group 제거
- [ ] 핵심 로직만 로깅

**예상 결과**: 135회 → **30-40회** (약 70% 감소)

---

### Phase 5: 기타 파일 리팩토링 (1주)

#### 5.1 console.log 통일

**대상 파일**:

- `actions/products.ts` (41회)
- `actions/payments.ts` (42회)
- `actions/import-products.ts` (43회)
- `actions/coupons.ts` (26회)
- 기타 파일들

**작업**:

- [ ] 모든 `console.log` → `logger.info` 또는 `logger.debug`
- [ ] 모든 `console.error` → `logger.error`
- [ ] 모든 `console.warn` → `logger.warn`

#### 5.2 logger.group 제거

**대상 파일**:

- `actions/sync-stock.ts` (22회 group)
- `actions/member-actions.ts` (10회 group)

**작업**:

- [ ] logger.group/groupEnd 제거
- [ ] 필요한 경우만 개별 로그로 변경

**예상 결과**: 361회 console.log → **0회**, logger.group 145회 → **10-20회**

---

## 📈 예상 결과

### 리팩토링 전후 비교

| 항목             | 리팩토링 전 | 리팩토링 후   | 감소율          |
| ---------------- | ----------- | ------------- | --------------- |
| **logger 호출**  | 502회       | **150-200회** | 60-70% ↓        |
| **console.log**  | 361회       | **0회**       | 100% ↓          |
| **logger.group** | 145회       | **10-20회**   | 85-90% ↓        |
| **총 로그 호출** | 1,008회     | **160-220회** | **78-84% 감소** |

### 로그 레벨 분포 (예상)

| 레벨    | 리팩토링 전 | 리팩토링 후  | 비고               |
| ------- | ----------- | ------------ | ------------------ |
| `debug` | 0회         | **50-80회**  | 디버깅 전용        |
| `info`  | 502회       | **80-120회** | 핵심 비즈니스 로직 |
| `warn`  | ~50회       | **20-30회**  | 경고 상황          |
| `error` | ~50회       | **30-40회**  | 에러 발생          |

---

## ✅ 체크리스트

### Phase 0: 클라이언트 사이드 보안 (최우선)

- [ ] `lib/logger-client.ts` 생성
- [ ] 민감 정보 마스킹 함수 구현
- [ ] `components/auth-session-sync.tsx` 리팩토링
- [ ] `hooks/use-sync-user.ts` 리팩토링
- [ ] `components/checkout-form.tsx` 리팩토링
- [ ] `components/payment-widget.tsx` 리팩토링
- [ ] `app/sign-in/.../sign-in-content.tsx` 리팩토링
- [ ] 모든 클라이언트 컴포넌트에서 `console.log` 제거
- [ ] 프로덕션 빌드에서 로그 출력 안 되는지 확인

### Phase 1: 정책 수립

- [ ] 로깅 가이드라인 문서 작성
- [ ] 팀 리뷰 및 승인

### Phase 2: cart.ts 리팩토링

- [ ] `getCurrentUserId` 리팩토링
- [ ] `getOrCreateCartId` 리팩토링
- [ ] `addToCart` 리팩토링
- [ ] `updateCartItem` 리팩토링
- [ ] `removeFromCart` 리팩토링
- [ ] 기타 함수 리팩토링
- [ ] 테스트 및 검증

### Phase 3: orders.ts 리팩토링

- [ ] logger.group 제거
- [ ] 단계별 로그 최소화
- [ ] 테스트 및 검증

### Phase 4: admin-products.ts 리팩토링

- [ ] console.log 통일
- [ ] logger.group 제거
- [ ] 테스트 및 검증

### Phase 5: 기타 파일 리팩토링

- [ ] 모든 console.log 통일
- [ ] logger.group 제거
- [ ] 최종 검증

---

## 🎯 성공 기준

### 클라이언트 사이드 (최우선)

1. ✅ **클라이언트 console.log 100% 제거**
2. ✅ **민감 정보 노출 0건**
3. ✅ **프로덕션에서 로그 출력 안 됨**
4. ✅ **클라이언트용 logger 사용**

### 서버 사이드

1. ✅ **로그 호출 수 80% 이상 감소**
2. ✅ **모든 console.log 제거**
3. ✅ **logger.group 90% 이상 감소**
4. ✅ **에러/경고는 모두 로깅**
5. ✅ **핵심 비즈니스 로직만 info 레벨**
6. ✅ **디버깅 로그는 debug 레벨**

---

## 📚 참고 자료

- [lib/logger.ts](../lib/logger.ts) - 현재 logger 구현
- [actions/cart.ts](../actions/cart.ts) - 가장 과도한 로깅 예시
- [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md) - 프로젝트 구조 평가

---

## 💡 리팩토링 팁

### 1. 점진적 리팩토링

한 번에 모든 파일을 수정하지 말고, 파일별로 단계적으로 진행:

1. 파일 선택
2. 리팩토링
3. 테스트
4. 커밋
5. 다음 파일

### 2. 로그 제거 기준

**제거해도 되는 로그**:

- ✅ 단계별 진행 상황 (1단계, 2단계...)
- ✅ 타임스탬프
- ✅ 정상 흐름의 상세 정보
- ✅ 중복된 정보

**유지해야 하는 로그**:

- ✅ 에러 발생 시
- ✅ 경고 상황
- ✅ 중요한 비즈니스 이벤트 (주문 생성, 결제 완료 등)
- ✅ 외부 API 호출 실패

### 3. 디버깅 필요 시

리팩토링 후에도 디버깅이 필요하면:

- `logger.debug()` 사용 (개발 환경에서만 출력)
- 필요 시 임시로 추가 후 제거

---

---

## 🚨 보안 체크리스트

리팩토링 후 다음을 확인하세요:

- [ ] 프로덕션 빌드에서 브라우저 콘솔에 로그가 출력되지 않음
- [ ] 사용자 ID, 이메일, 이름이 콘솔에 노출되지 않음
- [ ] 주문자 정보, 배송 정보가 콘솔에 노출되지 않음
- [ ] 토큰 정보가 콘솔에 노출되지 않음
- [ ] 결제 정보가 콘솔에 노출되지 않음
- [ ] 개발 환경에서만 디버깅 로그 출력됨

---

**작성일**: 2025년 1월  
**예상 소요 시간**: 4-5주 (클라이언트 보안 우선)  
**담당자**: 개발팀  
**우선순위**: 🔴 **클라이언트 사이드 보안 최우선**
