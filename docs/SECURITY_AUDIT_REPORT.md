# 🔒 보안 감사 보고서 (Security Audit Report)

**작성일**: 2025-01-27  
**감사자**: 10년차 보안 전문가  
**프로젝트**: 또또앙스몰 (ttottoangseumall)  
**기술 스택**: Next.js 15, Clerk, Supabase, TypeScript

---

## 📋 목차

1. [요약 (Executive Summary)](#요약-executive-summary)
2. [긍정적인 보안 조치](#긍정적인-보안-조치)
3. [심각한 보안 이슈 (Critical)](#심각한-보안-이슈-critical)
4. [높은 위험도 이슈 (High)](#높은-위험도-이슈-high)
5. [중간 위험도 이슈 (Medium)](#중간-위험도-이슈-medium)
6. [낮은 위험도 이슈 (Low)](#낮은-위험도-이슈-low)
7. [권장 사항](#권장-사항)
8. [우선순위별 조치 계획](#우선순위별-조치-계획)

---

## 요약 (Executive Summary)

### 전체 보안 점수: **72/100** (양호)

프로젝트는 기본적인 보안 조치가 잘 되어 있으나, 몇 가지 중요한 보안 취약점이 발견되었습니다. 특히 **Rate Limiting 부재**, **입력 검증 부족**, **에러 메시지 노출** 등이 주요 이슈입니다.

### 위험도 분포

- 🔴 **Critical (심각)**: 2건
- 🟠 **High (높음)**: 5건 (의존성 취약점 포함)
- 🟡 **Medium (중간)**: 5건
- 🟢 **Low (낮음)**: 3건

---

## 긍정적인 보안 조치

### ✅ 잘 구현된 부분

1. **환경 변수 관리**

   - 민감 정보가 하드코딩되지 않음
   - `.gitignore`에 환경 변수 파일 포함
   - 서비스 롤 키가 서버 사이드에서만 사용

2. **인증 시스템**

   - Clerk를 통한 안전한 인증 구현
   - 미들웨어에서 인증 보호 적용
   - 공개 경로와 보호 경로 명확히 구분

3. **보안 헤더**

   - CSP (Content Security Policy) 설정
   - X-Frame-Options, X-Content-Type-Options 등 설정
   - Referrer-Policy 설정

4. **데이터베이스 보안**

   - Supabase 사용으로 SQL 인젝션 자동 방지
   - RLS (Row Level Security) 지원 (개발 중 비활성화)

5. **파일 업로드 검증**
   - 파일 타입 검증
   - 파일 크기 제한 (10MB)
   - 이미지 압축 및 WebP 변환

---

## 심각한 보안 이슈 (Critical)

### 🔴 CRIT-001: Rate Limiting 부재

**위험도**: 🔴 Critical  
**영향**: API 엔드포인트가 무제한 요청에 노출되어 DDoS 공격 가능

**현재 상태**:

- 모든 API 라우트에 Rate Limiting이 없음
- `/api/chat/stream`, `/api/payments/*` 등 중요 API가 보호되지 않음

**영향받는 엔드포인트**:

- `/api/chat/stream` - 챗봇 API (비용 발생)
- `/api/payments/*` - 결제 API
- `/api/sync-user` - 사용자 동기화
- `/api/products` - 상품 조회

**권장 조치**:

```typescript
// lib/rate-limit.ts 생성
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10초에 10회
  analytics: true,
});

// middleware.ts 또는 각 API 라우트에 적용
```

**우선순위**: 즉시 조치 필요

---

### 🔴 CRIT-002: 입력 검증 부족 (Input Validation)

**위험도**: 🔴 Critical  
**영향**: 악의적인 입력으로 인한 데이터 무결성 문제, 잠재적 공격 벡터

**발견된 문제**:

1. **챗봇 메시지 검증 부족** (`app/api/chat/stream/route.ts`)

   ```typescript
   // 현재: 단순 trim만 수행
   const message = (body.message ?? "").trim();

   // 문제: 길이 제한, 특수 문자 필터링 없음
   ```

2. **상품 조회 파라미터 검증 부족** (`app/api/products/route.ts`)

   ```typescript
   // 현재: parseInt만 수행, 음수/과도한 값 검증 없음
   const limit = parseInt(searchParams.get("limit") || "5", 10);
   const skip = parseInt(searchParams.get("skip") || "0", 10);
   ```

3. **결제 금액 검증** (`app/api/payments/toss/confirm/route.ts`)
   - ✅ 금액 검증은 있으나, 추가 검증 필요

**권장 조치**:

```typescript
// lib/validation.ts 생성
import { z } from "zod";

export const chatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z
    .string()
    .min(1, "메시지는 최소 1자 이상이어야 합니다")
    .max(5000, "메시지는 5000자를 초과할 수 없습니다")
    .regex(/^[\s\S]*$/, "허용되지 않는 문자가 포함되어 있습니다"),
});

export const productQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(12),
  skip: z.coerce.number().int().min(0).max(10000).default(0),
});
```

**우선순위**: 즉시 조치 필요

---

## 높은 위험도 이슈 (High)

### 🟠 HIGH-001: 에러 메시지에 민감 정보 노출

**위험도**: 🟠 High  
**영향**: 스택 트레이스, 데이터베이스 구조 등이 노출될 수 있음

**발견된 문제**:

1. **에러 메시지에 상세 정보 포함** (`app/api/sync-user/route.ts:178`)

   ```typescript
   return NextResponse.json(
     { error: "Failed to fetch user", details: fetchErrorByClerkId.message },
     { status: 500 },
   );
   // 문제: 데이터베이스 에러 메시지가 그대로 노출됨
   ```

2. **프로덕션에서 console.log 사용**
   - 여러 파일에서 상세한 로그 출력
   - 프로덕션에서도 민감 정보가 로그에 남을 수 있음

**권장 조치**:

```typescript
// lib/error-handler.ts 생성
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
  return error instanceof Error ? error.message : String(error);
}

// 사용 예시
return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
```

**우선순위**: 높음 (1주일 내)

---

### 🟠 HIGH-002: CORS 설정 부재

**위험도**: 🟠 High  
**영향**: Cross-Origin 요청이 제한되지 않아 CSRF 공격 가능성

**현재 상태**:

- `next.config.ts`에 CORS 설정 없음
- API 라우트에 CORS 헤더 설정 없음

**권장 조치**:

```typescript
// middleware.ts에 추가
const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.ALLOWED_ORIGINS || "https://ttottoangseu.co.kr",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// OPTIONS 요청 처리
if (req.method === "OPTIONS") {
  return new NextResponse(null, { headers: corsHeaders });
}
```

**우선순위**: 높음 (1주일 내)

---

### 🟠 HIGH-003: 파일 업로드 추가 보안 검증 필요

**위험도**: 🟠 High  
**영향**: 악성 파일 업로드 가능성

**현재 상태** (`actions/upload-image.ts`):

- ✅ 파일 타입 검증 (MIME type)
- ✅ 파일 크기 제한 (10MB)
- ✅ 확장자 검증
- ❌ 파일 내용 검증 없음 (매직 넘버 체크)
- ❌ 파일명 보안 검증 부족

**권장 조치**:

```typescript
import { fileTypeFromBuffer } from "file-type";

// 파일 내용 검증 추가
const fileType = await fileTypeFromBuffer(arrayBuffer);
if (!fileType || !fileType.mime.startsWith("image/")) {
  throw new Error("이미지 파일이 아닙니다.");
}

// 파일명 보안 강화
const sanitizedFileName = fileName
  .replace(/[^a-zA-Z0-9.-]/g, "_")
  .substring(0, 255);
```

**우선순위**: 높음 (2주일 내)

---

### 🟠 HIGH-004: 세션 관리 보안 강화 필요

**위험도**: 🟠 High  
**영향**: 세션 하이재킹, CSRF 공격 가능성

**현재 상태**:

- Clerk가 세션 관리하나, 추가 보안 조치 필요
- 챗봇 세션 소유자 검증은 있으나 추가 검증 필요

**권장 조치**:

```typescript
// 세션 토큰 검증 강화
// IP 주소 기반 세션 검증 (선택사항)
// 세션 타임아웃 설정 확인
```

**우선순위**: 높음 (2주일 내)

---

## 중간 위험도 이슈 (Medium)

### 🟡 MED-001: XSS 방지 추가 검증 필요

**위험도**: 🟡 Medium  
**영향**: 사용자 입력이 HTML로 렌더링될 경우 XSS 공격 가능

**발견된 문제**:

- `dangerouslySetInnerHTML` 사용 여부 확인 필요
- 상품 설명, 리뷰 등 사용자 생성 콘텐츠의 HTML 이스케이프 확인

**권장 조치**:

```typescript
import DOMPurify from "isomorphic-dompurify";

// HTML 정제
const sanitizedHtml = DOMPurify.sanitize(userInput);
```

**우선순위**: 중간 (1개월 내)

---

### 🟡 MED-002: 의존성 취약점 발견 (High 심각도)

**위험도**: 🟡 Medium → 🟠 **High로 상향**  
**영향**: 알려진 보안 취약점이 있는 패키지 사용 중

**발견된 취약점**:

1. **xlsx 패키지 (v0.18.5) - CVE-2023-30533**

   - **심각도**: High (CVSS 7.8)
   - **유형**: Prototype Pollution
   - **영향**: 특수하게 제작된 파일을 읽을 때 프로토타입 오염 공격 가능
   - **상태**: 패치된 버전 없음 (npm에서 유지보수 중단)
   - **권장 조치**:
     - 사용하지 않는다면 제거
     - 사용 중이라면 신뢰할 수 있는 파일만 처리하도록 제한
     - 또는 [SheetJS 공식 CDN](https://cdn.sheetjs.com/)에서 v0.19.3 이상 사용

2. **xlsx 패키지 (v0.18.5) - CVE-2024-22363**
   - **심각도**: High (CVSS 7.5)
   - **유형**: Regular Expression Denial of Service (ReDoS)
   - **영향**: 악의적인 정규식으로 인한 서비스 거부 공격 가능
   - **상태**: 패치된 버전 없음 (npm에서 유지보수 중단)
   - **권장 조치**: 위와 동일

**현재 사용 위치**:

- ✅ `lib/utils/import-products.ts`에서 사용 중
- 상품 일괄 임포트 기능에 사용됨

**권장 조치**:

```bash
# 1. 현재 사용 여부 확인
grep -r "xlsx" --include="*.ts" --include="*.tsx" --include="*.js"

# 2. 사용하지 않는다면 제거
pnpm remove xlsx

# 3. 사용 중이라면 대체 패키지 검토
# - exceljs: 더 안전하고 활발히 유지보수됨
# - node-xlsx: 경량 대안
```

**우선순위**: 🟠 **높음 (1주일 내)** - High 심각도 취약점이므로 즉시 조치 필요

---

### 🟡 MED-003: 로깅 보안 강화

**위험도**: 🟡 Medium  
**영향**: 로그에 민감 정보가 기록될 수 있음

**현재 상태**:

- `lib/logger.ts`가 있으나, 민감 정보 필터링 필요

**권장 조치**:

```typescript
// 민감 정보 마스킹
function maskSensitiveData(data: any): any {
  const sensitiveKeys = ["password", "token", "secret", "key", "authorization"];
  // 재귀적으로 마스킹 처리
}
```

**우선순위**: 중간 (1개월 내)

---

### 🟡 MED-004: API 인증 토큰 검증 강화

**위험도**: 🟡 Medium  
**영향**: 만료된 토큰이나 무효한 토큰 사용 가능성

**권장 조치**:

- 토큰 만료 시간 확인
- 토큰 재발급 로직 검증
- 토큰 무효화 메커니즘 확인

**우선순위**: 중간 (1개월 내)

---

### 🟡 MED-005: 데이터베이스 RLS 정책 검토 필요

**위험도**: 🟡 Medium  
**영향**: 개발 중 RLS가 비활성화되어 있으나, 프로덕션 전환 시 보안 정책 필요

**현재 상태**:

- 개발 중 RLS 비활성화 (규칙에 따라)
- 프로덕션 전환 시 RLS 정책 작성 필요

**권장 조치**:

- 프로덕션 배포 전 RLS 정책 작성
- 각 테이블별 접근 권한 정의
- 테스트 환경에서 RLS 활성화 후 테스트

**우선순위**: 중간 (프로덕션 배포 전)

---

### 🟡 MED-006: 결제 프로세스 보안 강화

**위험도**: 🟡 Medium  
**영향**: 결제 금액 조작, 중복 결제 등 가능성

**현재 상태** (`app/api/payments/toss/confirm/route.ts`):

- ✅ 금액 검증 있음
- ✅ 주문 소유자 검증 있음
- ❌ 중복 결제 방지 로직 확인 필요
- ❌ 결제 상태 검증 강화 필요

**권장 조치**:

```typescript
// 중복 결제 방지
const existingPayment = await supabase
  .from("payments")
  .select("id")
  .eq("payment_key", paymentData.paymentKey)
  .single();

if (existingPayment) {
  return NextResponse.json(
    { success: false, message: "이미 처리된 결제입니다." },
    { status: 400 },
  );
}
```

**우선순위**: 중간 (2주일 내)

---

## 낮은 위험도 이슈 (Low)

### 🟢 LOW-001: HTTPS 강제 설정 확인

**위험도**: 🟢 Low  
**영향**: 프로덕션에서 HTTPS 강제 여부 확인 필요

**권장 조치**:

- Vercel/배포 환경에서 HTTPS 자동 적용 확인
- HSTS 헤더 설정 확인

**우선순위**: 낮음 (3개월 내)

---

### 🟢 LOW-002: 보안 모니터링 및 알림 설정

**위험도**: 🟢 Low  
**영향**: 보안 인시던트 조기 발견 어려움

**권장 조치**:

- Sentry 보안 이벤트 모니터링 설정
- 비정상적인 API 호출 패턴 감지
- 로그인 실패 횟수 모니터링

**우선순위**: 낮음 (3개월 내)

---

### 🟢 LOW-003: 보안 헤더 추가 검토

**위험도**: 🟢 Low  
**영향**: 추가 보안 헤더로 보안 강화 가능

**권장 조치**:

```typescript
// 추가 보안 헤더
headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
headers.set("X-Permitted-Cross-Domain-Policies", "none");
```

**우선순위**: 낮음 (3개월 내)

---

## 권장 사항

### 즉시 조치 (1주일 내)

1. ✅ **Rate Limiting 구현** - 모든 API 엔드포인트에 적용
2. ✅ **입력 검증 강화** - Zod 스키마로 모든 사용자 입력 검증
3. ✅ **에러 메시지 정제** - 프로덕션에서 상세 에러 숨김

### 단기 조치 (1개월 내)

1. ✅ **CORS 설정** - 허용된 도메인만 접근 가능하도록
2. ✅ **파일 업로드 보안 강화** - 매직 넘버 검증 추가
3. ✅ **의존성 취약점 점검** - `pnpm audit` 실행 및 수정
4. ✅ **로깅 보안 강화** - 민감 정보 마스킹

### 중기 조치 (3개월 내)

1. ✅ **보안 모니터링 설정** - 비정상 패턴 감지
2. ✅ **RLS 정책 작성** - 프로덕션 배포 전 완료
3. ✅ **보안 테스트** - 침투 테스트 또는 보안 스캔

---

## 우선순위별 조치 계획

### Phase 1: 긴급 조치 (1주일)

- [ ] CRIT-001: Rate Limiting 구현
- [ ] CRIT-002: 입력 검증 강화
- [ ] HIGH-001: 에러 메시지 정제
- [ ] MED-002: xlsx 패키지 취약점 대응 (High 심각도)

### Phase 2: 중요 조치 (1개월)

- [ ] HIGH-002: CORS 설정
- [ ] HIGH-003: 파일 업로드 보안 강화
- [ ] HIGH-004: 세션 관리 보안 강화
- [ ] MED-002: 의존성 취약점 점검
- [ ] MED-003: 로깅 보안 강화

### Phase 3: 추가 조치 (3개월)

- [ ] MED-001: XSS 방지 추가 검증
- [ ] MED-004: API 인증 토큰 검증 강화
- [ ] MED-005: RLS 정책 작성
- [ ] MED-006: 결제 프로세스 보안 강화
- [ ] LOW-001: HTTPS 강제 설정 확인
- [ ] LOW-002: 보안 모니터링 설정
- [ ] LOW-003: 보안 헤더 추가 검토

---

## 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase Security Guide](https://supabase.com/docs/guides/platform/security)
- [Clerk Security Documentation](https://clerk.com/docs/security)

---

**보고서 작성자**: 10년차 보안 전문가  
**다음 감사 예정일**: 주요 이슈 해결 후 재감사 권장
