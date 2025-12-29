# 🎯 스마트스토어 옵션 단위 재고 동기화 개선 업무 지시서

> **작성자**: 시니어 개발자 (10년차)
> **대상**: 신입 개발자 1년차 (비전공자)
> **목적**: 스마트스토어 상품을 "옵션(Variant) 단위"로 정확히 재고 동기화

---

## 0. 왜 이 일을 하는가 (배경 먼저 이해하기)

### 현재 문제 상황

지금은 상품을 엑셀로 연동해서 **"상품 단위"** 데이터만 들어오고, 옵션 정보(색상/사이즈)가 누락되어 있어요.

하지만 실제 판매/재고 관리는 **옵션이 재고의 최소 단위**입니다:

```
또또앙 티셔츠 (상품)
├── 빨강/M: 10개
├── 빨강/L: 5개
├── 파랑/M: 0개 (품절)  ← 이게 문제!
└── 파랑/L: 8개

현재: 전체 23개로만 동기화 ❌
문제: 파랑/M이 품절인데 주문이 들어옴!
```

### 이번 목표

**"상품"이 아니라 "옵션(Variant)" 단위로 재고를 정확히 맞추는 것!**

---

## 🗺️ 전체 작업 흐름도

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 네이버 스마트스토어 → DB 동기화 (이 가이드 문서의 Step 1~7)     │
└─────────────────────────────────────────────────────────────────────────┘
     │
     │  Step 1. API 테스트 스크립트 → 실제 응답 구조 확인
     │  Step 2. 인증 방식 수정 (bcrypt 서명 + form 전송)
     │  Step 3. 엔드포인트 수정 (/external 추가)
     │  Step 4. 채널 상품 조회 + 타입 확정
     │  Step 5. DB 마이그레이션 (복합키 컬럼 추가)
     │  Step 6. 매핑 빌드 (네이버 옵션 ↔ 우리 variant 연결)
     │  Step 7. syncVariantStocks() 구현
     │
     ▼
   ✅ product_variants.stock에 정확한 옵션별 재고 데이터 저장됨
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 2: 장바구니/주문 로직 수정 (Phase 1 완료 후 진행)                  │
└─────────────────────────────────────────────────────────────────────────┘
     │
     │  - actions/cart.ts: variant 재고 체크 추가
     │  - actions/orders.ts: variant 재고 검증/차감/복구
     │
     ▼
   ✅ 옵션 단위 재고 관리 완성!
```

**왜 이 순서인가요?**

Phase 1 없이 Phase 2만 하면? → DB에 옵션 재고 데이터가 없거나 부정확해서 의미 없음!

---

## 📋 현재 코드의 문제점 (AS-IS)

### 문제 1: 상품 단위로만 재고 동기화 중

**현재 코드** (`lib/utils/smartstore-api.ts:20-27`)
```typescript
export interface SmartStoreProduct {
  productId: string;
  stockQuantity: number;  // ❌ 상품 전체 재고만 있음
  // 옵션별 재고 정보가 없음!
}
```

### 문제 2: 네이버 API 인증 방식이 다름

**현재 코드** (`lib/utils/smartstore-api.ts:72-77`)
```typescript
body: new URLSearchParams({
  client_secret: this.clientSecret,  // ❌ 시크릿을 그냥 보냄
}),
```

**실제로는**: bcrypt로 서명을 만들어서 보내야 함

### 문제 3: 토큰 발급 전송 포맷 오류

```typescript
// ❌ 현재 (JSON으로 보내면 실패함!)
body: JSON.stringify({...})

// ✅ 올바른 방식 (form-urlencoded)
body: new URLSearchParams({...})
```

> **신입이 가장 많이 틀리는 포인트!**
> 토큰 발급은 `application/x-www-form-urlencoded` 방식으로 보내야 함

### 문제 4: SKU 매핑 로직 부재

**현재 코드** (`actions/sync-stock.ts:49-51`)
```typescript
.eq("smartstore_product_id", smartstoreProductId)  // 상품 ID만 매핑
// 옵션(variant)과의 연결 로직이 없음!
```

---

## 🛠️ 개선 작업 목록 (이 순서대로 하세요!)

> **중요**: "실제 API 응답을 보기 전"에 DB/타입을 확정하면, 나중에 다 갈아엎습니다.
> 그래서 **API 테스트를 가장 먼저** 합니다!

---

### Step 1: API 테스트 스크립트 만들기 (가장 먼저!) ⭐⭐⭐

**목표**: 토큰 발급 + 상품 조회가 되는지 "코드 최소 단위"로 확인

**파일**: `scripts/test-smartstore-api.ts` (신규)

```typescript
/**
 * 스마트스토어 API 연동 테스트 스크립트
 *
 * 실행: npx ts-node scripts/test-smartstore-api.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';

const CLIENT_ID = process.env.NAVER_SMARTSTORE_CLIENT_ID!;
const CLIENT_SECRET = process.env.NAVER_SMARTSTORE_CLIENT_SECRET!;

const BASE_URL = 'https://api.commerce.naver.com/external';

/**
 * 1. 토큰 발급 테스트
 */
async function getAccessToken(): Promise<string> {
  const timestamp = Date.now();
  const password = `${CLIENT_ID}_${timestamp}`;

  // bcrypt 서명 생성
  const hashed = bcrypt.hashSync(password, CLIENT_SECRET);
  const signature = Buffer.from(hashed, 'utf-8').toString('base64');

  // ⚠️ 중요: form-urlencoded로 전송! (JSON 아님)
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      timestamp: timestamp.toString(),
      client_secret_sign: signature,
      grant_type: 'client_credentials',
      type: 'SELF',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 토큰 발급 실패:', response.status, errorText);
    throw new Error(`토큰 발급 실패: ${response.status}`);
  }

  const data = await response.json();
  console.log('✅ 토큰 발급 성공!');
  console.log('   - expires_in:', data.expires_in, '초');

  return data.access_token;
}

/**
 * 2. 채널 상품 조회 테스트
 */
async function getChannelProduct(token: string, channelProductNo: string) {
  const response = await fetch(
    `${BASE_URL}/v2/products/channel-products/${channelProductNo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 상품 조회 실패:', response.status, errorText);
    throw new Error(`상품 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  console.log('✅ 상품 조회 성공!');

  return data;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 스마트스토어 API 테스트 시작\n');

  // 1. 토큰 발급
  console.log('--- 1. 토큰 발급 테스트 ---');
  const token = await getAccessToken();

  // 2. 채널 상품 조회 (실제 상품 ID로 교체하세요!)
  console.log('\n--- 2. 채널 상품 조회 테스트 ---');
  const TEST_CHANNEL_PRODUCT_NO = 'YOUR_CHANNEL_PRODUCT_NO'; // ← 실제 값으로 교체!

  const product = await getChannelProduct(token, TEST_CHANNEL_PRODUCT_NO);

  // 3. 결과를 파일로 저장 (옵션 구조 확인용)
  const outputDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'channel-product.json');
  fs.writeFileSync(outputPath, JSON.stringify(product, null, 2));

  console.log(`\n📁 응답 저장됨: ${outputPath}`);
  console.log('\n⚠️ 이 파일을 열어서 optionInfo 구조를 확인하세요!');
  console.log('   - optionStandards? optionCombinations? optionSimple?');
  console.log('   - sellerManagerCode가 어디에 있는지?');
}

main().catch(console.error);
```

**해야 할 것:**
1. 토큰 발급 성공 여부 출력
2. `channelProductNo` 1개를 넣고 채널상품 조회 결과(JSON)를 파일로 저장
3. `./tmp/channel-product.json` 경로로 저장

**왜 이걸 먼저 하나요?**
> 응답 JSON 구조를 직접 눈으로 봐야 타입을 정확히 만들 수 있어요!

---

### Step 2: 인증 방식 수정 + 토큰 캐싱 (난이도: ⭐⭐⭐)

**파일**: `lib/utils/smartstore-api.ts`

#### 2-1. bcrypt 패키지 설치

```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

#### 2-2. 토큰 발급 함수 수정

```typescript
import bcrypt from 'bcrypt';

const BASE_URL = 'https://api.commerce.naver.com/external';

export class SmartStoreApiClient {
  private clientId: string;
  private clientSecret: string;

  // 토큰 캐싱 (중요!)
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt: number = 0;

  /**
   * OAuth 2.0 액세스 토큰 발급 (캐싱 + 재시도 포함)
   */
  private async getAccessToken(): Promise<string> {
    // 1. 캐시된 토큰이 유효하면 재사용
    if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
      return this.cachedToken;
    }

    // 2. 새 토큰 발급
    const timestamp = Date.now();
    const password = `${this.clientId}_${timestamp}`;

    // bcrypt 서명 생성
    const hashed = bcrypt.hashSync(password, this.clientSecret);
    const signature = Buffer.from(hashed, 'utf-8').toString('base64');

    // ⚠️ 중요: form-urlencoded로 전송!
    const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        timestamp: timestamp.toString(),
        client_secret_sign: signature,
        grant_type: 'client_credentials',
        type: 'SELF',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[SmartStoreAPI] 토큰 발급 실패', {
        status: response.status,
        error: errorText
      });
      throw new Error(`토큰 발급 실패: ${response.status}`);
    }

    const data = await response.json();

    // 3. 캐시 저장 (만료 10분 전까지 유효)
    this.cachedToken = data.access_token;
    this.cachedTokenExpiresAt = Date.now() + (data.expires_in - 600) * 1000;

    logger.info('[SmartStoreAPI] 토큰 발급 성공');
    return this.cachedToken;
  }

  /**
   * API 호출 래퍼 (401 시 토큰 재발급 + 1회 재시도)
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retried = false
  ): Promise<Response> {
    const token = await this.getAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    // 401 Unauthorized → 토큰 재발급 후 1회만 재시도
    if (response.status === 401 && !retried) {
      logger.warn('[SmartStoreAPI] 401 발생, 토큰 재발급 후 재시도');
      this.cachedToken = null; // 캐시 무효화
      return this.fetchWithRetry(url, options, true);
    }

    return response;
  }
}
```

**핵심 포인트:**
- 토큰은 유효시간이 있음 (보통 몇 시간)
- 매번 토큰 발급하면 비용/속도/레이트리밋 위험
- **메모리 캐싱**으로 충분 (단일 인스턴스 기준)
- 401 발생 시 토큰 재발급 후 **1회만 재시도**

---

### Step 3: 엔드포인트 전부 공식 URL로 통일 (난이도: ⭐⭐)

**파일**: `lib/utils/smartstore-api.ts`

```typescript
// ❌ 기존 (잘못된 URL)
`https://api.commerce.naver.com/products/${productId}`
`https://api.commerce.naver.com/oauth2/v1/token`

// ✅ 수정 (공식 URL)
const BASE_URL = 'https://api.commerce.naver.com/external';

// 토큰 발급
`${BASE_URL}/v1/oauth2/token`

// 채널 상품 조회
`${BASE_URL}/v2/products/channel-products/${channelProductNo}`

// 옵션 재고 수정
`${BASE_URL}/v1/products/origin-products/${originProductNo}/option-stock`
```

> **주의**: 기존 코드에 `/external` 없이 쓴 URL이 있으면 전부 수정!

---

### Step 4: 채널 상품 조회 함수 + 옵션 구조 확정 (난이도: ⭐⭐)

**파일**: `lib/utils/smartstore-api.ts`

#### 4-1. 타입 정의 (Step 1에서 저장한 JSON 보고 확정!)

```typescript
// ⚠️ 이 타입은 Step 1에서 저장한 실제 응답을 보고 수정하세요!
export interface SmartStoreOptionStock {
  id: number;                      // 옵션 ID
  optionName1: string;             // 옵션값1 (예: "빨강")
  optionName2?: string;            // 옵션값2 (예: "M")
  stockQuantity: number;           // 해당 옵션 재고
  sellerManagerCode?: string;      // 판매자 관리코드 (=SKU)
  usable?: boolean;                // 사용 가능 여부
}

export interface SmartStoreProductWithOptions {
  originProductNo: number;         // 원상품 번호 (재고 수정 시 필요!)
  channelProductNo: number;        // 채널상품 번호
  name: string;
  optionInfo?: {
    useStockManagement: boolean;
    // 아래 중 하나만 존재 (실제 응답 보고 확인!)
    optionStandards?: SmartStoreOptionStock[];     // 표준형 옵션
    optionCombinations?: SmartStoreOptionStock[];  // 조합형 옵션
    optionSimple?: SmartStoreOptionStock[];        // 단독형 옵션
  };
}
```

#### 4-2. 채널 상품 조회 함수

```typescript
/**
 * 채널 상품 조회 (옵션 정보 포함)
 */
async getChannelProduct(
  channelProductNo: string
): Promise<SmartStoreProductWithOptions | null> {
  try {
    const response = await this.fetchWithRetry(
      `${BASE_URL}/v2/products/channel-products/${channelProductNo}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[SmartStoreAPI] 채널 상품 조회 실패', {
        channelProductNo,
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('[SmartStoreAPI] 채널 상품 조회 예외', error);
    return null;
  }
}

/**
 * 옵션별 재고 목록 추출
 */
extractOptionStocks(
  product: SmartStoreProductWithOptions
): SmartStoreOptionStock[] {
  const { optionInfo } = product;

  if (!optionInfo || !optionInfo.useStockManagement) {
    logger.warn('[SmartStoreAPI] 재고관리 미사용 상품', {
      channelProductNo: product.channelProductNo
    });
    return [];
  }

  // 표준형 > 조합형 > 단독형 순으로 확인
  const options =
    optionInfo.optionStandards ||
    optionInfo.optionCombinations ||
    optionInfo.optionSimple ||
    [];

  return options.filter(opt => opt.usable !== false);
}
```

---

### Step 5: DB 마이그레이션 - 복합키 전략 (난이도: ⭐⭐)

**왜 복합키가 필요한가?**

> 옵션 ID가 **전역으로 유니크가 아닐 수 있어요.**
> (보통 "상품(originProductNo) 하위에서만 유니크"인 경우가 많음)

**현재 스키마 상태:**

| 테이블 | 컬럼 | 현재 상태 |
|--------|------|----------|
| `products` | `smartstore_product_id` | ✅ 있음 |
| `product_variants` | `sku` | ✅ 있음 |
| `product_variants` | `smartstore_origin_product_no` | ❌ **없음** |
| `product_variants` | `smartstore_option_id` | ❌ **없음** |

**마이그레이션 파일 생성:**

파일명: `supabase/migrations/YYYYMMDDHHMMSS_add_smartstore_variant_mapping.sql`

```sql
-- =============================================
-- 네이버 스마트스토어 옵션 단위 재고 연동을 위한 필드 추가
-- =============================================

-- 1. 컬럼 추가
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS smartstore_origin_product_no BIGINT,
ADD COLUMN IF NOT EXISTS smartstore_option_id BIGINT,
ADD COLUMN IF NOT EXISTS smartstore_channel_product_no BIGINT;  -- 멀티채널 확장 대비

-- 2. 복합 인덱스 추가 (origin + option 조합으로 조회)
CREATE INDEX IF NOT EXISTS idx_pv_smartstore_origin_option
ON product_variants(smartstore_origin_product_no, smartstore_option_id)
WHERE smartstore_origin_product_no IS NOT NULL
  AND smartstore_option_id IS NOT NULL
  AND deleted_at IS NULL;

-- 3. SKU 인덱스 추가 (sellerManagerCode 매핑용)
CREATE INDEX IF NOT EXISTS idx_product_variants_sku
ON product_variants(sku)
WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- 4. 주석 추가
COMMENT ON COLUMN product_variants.smartstore_origin_product_no
IS '네이버 스마트스토어 원상품 번호 (옵션 ID와 조합하여 유니크)';

COMMENT ON COLUMN product_variants.smartstore_option_id
IS '네이버 스마트스토어 옵션 ID (원상품 번호와 조합하여 유니크)';

COMMENT ON COLUMN product_variants.smartstore_channel_product_no
IS '네이버 스마트스토어 채널상품 번호 (멀티채널 확장 대비)';

-- 5. (선택) 데이터 정리 후 UNIQUE 제약 추가 검토
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_pv_smartstore_unique
-- ON product_variants(smartstore_origin_product_no, smartstore_option_id)
-- WHERE smartstore_origin_product_no IS NOT NULL
--   AND smartstore_option_id IS NOT NULL
--   AND deleted_at IS NULL;
```

**마이그레이션 실행:**

```bash
# 1. 마이그레이션 파일 생성 후
pnpm supabase migration up

# 2. 타입 재생성
pnpm gen:types
```

---

### Step 6: 매핑 빌드 작업 (초기 1회 / 주기적) (난이도: ⭐⭐⭐)

**파일**: `actions/build-smartstore-mapping.ts` (신규)

**목표**: 스마트스토어 옵션 목록을 읽어서 우리 DB `product_variants`에 매핑 정보를 채워 넣는다.

```typescript
"use server";

import { getSmartStoreApiClient } from "@/lib/utils/smartstore-api";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

interface MappingResult {
  success: boolean;
  mappedCount: number;
  failedCount: number;
  unmappedOptions: Array<{
    productName: string;
    originProductNo: number;
    optionId: number;
    optionName: string;
    sellerManagerCode?: string;
    reason: string;
  }>;
}

/**
 * 스마트스토어 옵션 → product_variants 매핑 빌드
 */
export async function buildSmartstoreMapping(): Promise<MappingResult> {
  const supabase = getServiceRoleClient();
  const apiClient = getSmartStoreApiClient();

  const result: MappingResult = {
    success: true,
    mappedCount: 0,
    failedCount: 0,
    unmappedOptions: [],
  };

  // 1. 스마트스토어 연동된 상품 조회
  const { data: products } = await supabase
    .from("products")
    .select("id, name, smartstore_product_id")
    .not("smartstore_product_id", "is", null)
    .is("deleted_at", null);

  if (!products || products.length === 0) {
    result.success = false;
    return result;
  }

  // 2. 각 상품의 옵션 매핑
  for (const product of products) {
    const channelProduct = await apiClient.getChannelProduct(
      product.smartstore_product_id!
    );

    if (!channelProduct) {
      logger.warn(`[Mapping] 상품 조회 실패: ${product.name}`);
      continue;
    }

    const options = apiClient.extractOptionStocks(channelProduct);

    for (const option of options) {
      // 매핑 우선순위:
      // 1. sellerManagerCode(SKU)로 매칭
      // 2. 옵션명 조합으로 매칭 (최후의 수단)

      let variant = null;

      // 1차: SKU로 매칭
      if (option.sellerManagerCode) {
        const { data } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", product.id)
          .eq("sku", option.sellerManagerCode)
          .is("deleted_at", null)
          .single();
        variant = data;
      }

      // 2차: 옵션명으로 매칭 (SKU 없을 때)
      if (!variant && option.optionName1) {
        const optionValue = option.optionName2
          ? `${option.optionName1}/${option.optionName2}`
          : option.optionName1;

        const { data } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", product.id)
          .ilike("variant_value", `%${option.optionName1}%`)
          .is("deleted_at", null)
          .single();
        variant = data;
      }

      if (variant) {
        // 매핑 정보 저장
        await supabase
          .from("product_variants")
          .update({
            smartstore_origin_product_no: channelProduct.originProductNo,
            smartstore_option_id: option.id,
            smartstore_channel_product_no: channelProduct.channelProductNo,
          })
          .eq("id", variant.id);

        result.mappedCount++;
        logger.info(`[Mapping] 성공: ${product.name} - ${option.optionName1}`);
      } else {
        // 매핑 실패 → 누락 목록에 추가 (중요!)
        result.failedCount++;
        result.unmappedOptions.push({
          productName: product.name,
          originProductNo: channelProduct.originProductNo,
          optionId: option.id,
          optionName: option.optionName2
            ? `${option.optionName1}/${option.optionName2}`
            : option.optionName1,
          sellerManagerCode: option.sellerManagerCode,
          reason: option.sellerManagerCode
            ? 'SKU 불일치'
            : 'SKU 없음 + 옵션명 매칭 실패',
        });
        logger.warn(`[Mapping] 실패: ${product.name} - ${option.optionName1}`);
      }
    }

    // API 레이트 리밋 방지
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 3. 누락 목록 저장 (운영 확인용)
  if (result.unmappedOptions.length > 0) {
    logger.error('[Mapping] 매핑 실패 목록:', result.unmappedOptions);
    // TODO: 누락 목록을 DB 테이블이나 Slack으로 전송
  }

  return result;
}
```

> **중요**: 매칭 실패는 반드시 **"누락 목록"으로 저장/출력**!
> 로그만 찍고 끝내면 운영에서 못 찾습니다.

---

### Step 7: 재고 동기화 메인 로직 (난이도: ⭐⭐⭐)

**파일**: `actions/sync-stock.ts`

```typescript
"use server";

import { getSmartStoreApiClient } from "@/lib/utils/smartstore-api";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

export interface SyncVariantStockResult {
  success: boolean;
  message: string;
  syncedCount: number;
  failedCount: number;
  errors: Array<{
    variantId: string;
    optionId: number;
    error: string;
  }>;
}

/**
 * 옵션 단위 재고 동기화 (스마트스토어 → 자사몰)
 */
export async function syncVariantStocks(
  smartstoreProductId: string
): Promise<SyncVariantStockResult> {
  const supabase = getServiceRoleClient();
  const apiClient = getSmartStoreApiClient();

  const result: SyncVariantStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // 1. 스마트스토어에서 옵션 정보 조회
    const channelProduct = await apiClient.getChannelProduct(smartstoreProductId);

    if (!channelProduct) {
      result.success = false;
      result.message = "스마트스토어 상품 조회 실패";
      return result;
    }

    const options = apiClient.extractOptionStocks(channelProduct);
    const originProductNo = channelProduct.originProductNo;

    // 2. 각 옵션별로 우리 DB의 variant 찾아서 재고 업데이트
    for (const option of options) {
      // 복합키로 매칭 (origin_product_no + option_id)
      const { data: variant, error: findError } = await supabase
        .from("product_variants")
        .select("id, stock, sku")
        .eq("smartstore_origin_product_no", originProductNo)
        .eq("smartstore_option_id", option.id)
        .is("deleted_at", null)
        .single();

      if (findError || !variant) {
        result.failedCount++;
        result.errors.push({
          variantId: "unknown",
          optionId: option.id,
          error: `매핑된 variant 없음 (옵션: ${option.optionName1})`,
        });
        continue;
      }

      // 재고 업데이트
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ stock: option.stockQuantity })
        .eq("id", variant.id);

      if (updateError) {
        result.failedCount++;
        result.errors.push({
          variantId: variant.id,
          optionId: option.id,
          error: updateError.message,
        });
      } else {
        result.syncedCount++;
        logger.info(
          `[syncVariantStocks] ${variant.sku || option.optionName1}: ${variant.stock} → ${option.stockQuantity}`
        );
      }
    }

    result.message = `동기화 완료: 성공 ${result.syncedCount}개, 실패 ${result.failedCount}개`;
    return result;

  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : "알 수 없는 오류";
    return result;
  }
}

/**
 * 전체 상품 옵션 재고 동기화
 */
export async function syncAllVariantStocks(): Promise<SyncVariantStockResult> {
  const supabase = getServiceRoleClient();

  const totalResult: SyncVariantStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  // 스마트스토어 연동된 상품 조회
  const { data: products } = await supabase
    .from("products")
    .select("smartstore_product_id")
    .not("smartstore_product_id", "is", null)
    .is("deleted_at", null);

  if (!products || products.length === 0) {
    totalResult.message = "동기화 대상 상품 없음";
    return totalResult;
  }

  for (const product of products) {
    const result = await syncVariantStocks(product.smartstore_product_id!);

    totalResult.syncedCount += result.syncedCount;
    totalResult.failedCount += result.failedCount;
    totalResult.errors.push(...result.errors);

    // API 레이트 리밋 방지
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  totalResult.message = `전체 동기화 완료: 성공 ${totalResult.syncedCount}개, 실패 ${totalResult.failedCount}개`;

  return totalResult;
}
```

---

## 📊 작업 우선순위 (최종)

| 순서 | 작업 | 난이도 | 핵심 |
|------|------|--------|------|
| 1 | API 테스트 스크립트 | ⭐⭐⭐ | **실제 응답 먼저 확인!** |
| 2 | 인증 방식 수정 + 토큰 캐싱 | ⭐⭐⭐ | bcrypt 서명 + form 전송 |
| 3 | 엔드포인트 통일 | ⭐⭐ | `/external` 추가 |
| 4 | 채널 상품 조회 + 타입 확정 | ⭐⭐ | 실제 응답 보고 타입 수정 |
| 5 | DB 마이그레이션 | ⭐⭐ | 복합키 전략 |
| 6 | 매핑 빌드 | ⭐⭐⭐ | 누락 목록 저장 필수 |
| 7 | 재고 동기화 로직 | ⭐⭐⭐ | 옵션 단위 업데이트 |

---

## 💡 신입이 헷갈릴 수 있는 Q&A

### Q1. "왜 옵션 ID만 저장하면 안 돼요?"

옵션 ID가 **상품 안에서만 유니크**일 가능성이 있어요.
그래서 `originProductNo + optionId` 조합으로 저장해야 안전합니다.

### Q2. "SKU가 없으면 어떻게 해요?"

현실적으로 기존 상품은 **옵션관리코드(SKU)가 비어 있을 가능성이 높아요.**
이 경우는 "운영에서 옵션관리코드를 채우는 작업"이 필요합니다.

### Q3. "토큰 발급을 JSON으로 보내면 왜 안 돼요?"

네이버 API 스펙이 그래요. `application/x-www-form-urlencoded`로 보내야 합니다.
**이거 신입이 가장 많이 틀리는 포인트!**

### Q4. "매핑 실패하면 그냥 넘어가도 되나요?"

**절대 안 됩니다!** 누락 목록을 저장/출력해서 운영에서 확인할 수 있게 해야 해요.
로그만 찍고 끝내면 나중에 찾을 수가 없어요.

---

## ✅ 완료 기준 체크리스트

### 기능 체크
- [ ] 토큰 발급 성공 (bcrypt 서명 + form 전송)
- [ ] 채널 상품 조회 성공
- [ ] 옵션 배열 구조 raw JSON으로 확인 완료
- [ ] `extractOptionStocks()`가 실제 데이터에서 옵션 목록 추출
- [ ] DB 컬럼 추가 완료 (`smartstore_origin_product_no`, `smartstore_option_id`)
- [ ] 매핑 빌드 작업으로 DB에 옵션 매핑 정보 저장됨
- [ ] 재고 동기화 로직이 옵션 단위로 업데이트함
- [ ] 매핑 실패 옵션이 "누락 리스트"로 남음 (운영 확인 가능)

### 운영 안정성 체크
- [ ] 토큰 캐싱 됨
- [ ] 401 발생 시 토큰 재발급 후 1회 재시도
- [ ] API 실패/응답코드/요청 payload가 로그로 남음 (민감정보 제외)
- [ ] 대량 처리 시에도 API 호출이 폭증하지 않음 (배치/딜레이)

---

## 📝 관련 파일 목록

| 파일 경로 | 작업 내용 |
|----------|----------|
| `scripts/test-smartstore-api.ts` | **신규** - API 테스트 스크립트 |
| `lib/utils/smartstore-api.ts` | 인증 수정, 토큰 캐싱, 함수 추가 |
| `actions/build-smartstore-mapping.ts` | **신규** - 매핑 빌드 |
| `actions/sync-stock.ts` | 옵션 단위 동기화 함수 추가 |
| `supabase/migrations/YYYYMMDDHHMMSS_add_smartstore_variant_mapping.sql` | **신규** - 마이그레이션 |
| `database.types.ts` | 자동 생성 (pnpm gen:types) |

---

## 🚨 Phase 2: 후속 작업 (동기화 완료 후 진행)

> **이 섹션은 Phase 1 (네이버 → DB 동기화) 완료 후 진행합니다.**
> 동기화가 되어야 `product_variants.stock`에 정확한 데이터가 있으니까요!

### 발견된 버그: 옵션 재고 검증 누락

현재 장바구니/주문 로직에서 `products.stock`만 체크하고 `product_variants.stock`은 무시합니다.

**문제 상황:**
```
또또앙 티셔츠 (products.stock = 10)
├── 빨강/M: 5개
├── 파랑/M: 0개 (품절)  ← 문제!
└── 파랑/L: 5개

현재: 파랑/M 품절인데 장바구니 담기 가능 (products.stock > 0이라서)
```

### 수정 필요한 파일

| 파일 | 라인 | 현재 문제 | 수정 내용 |
|------|------|----------|----------|
| `actions/cart.ts` | 233-241 | `products.stock`만 체크 | variant 있으면 `product_variants.stock` 체크 |
| `actions/cart.ts` | 329-335 | 수량 변경 시 `products.stock` 체크 | variant 재고 체크 추가 |
| `actions/orders.ts` | 138-147 | 주문 시 `products.stock` 검증 | variant 재고 검증 추가 |
| `actions/orders.ts` | 248-255 | `products.stock` 차감 | variant 있으면 `product_variants.stock` 차감 |
| `actions/orders.ts` | 594-610 | 취소 시 `products.stock` 복구 | variant 있으면 `product_variants.stock` 복구 |

### 수정 예시: `actions/cart.ts`

```typescript
// addToCart() 함수 내 재고 체크 로직 수정

// 🔴 수정: variant 재고 체크 추가
let effectiveStock = product.stock;
let stockLabel = "상품";

if (variantId) {
  const { data: variant } = await supabase
    .from("product_variants")
    .select("stock, variant_value")
    .eq("id", variantId)
    .is("deleted_at", null)
    .single();

  if (variant) {
    effectiveStock = variant.stock;
    stockLabel = variant.variant_value;
  }
}

if (effectiveStock === 0) {
  return { success: false, message: `${stockLabel} 옵션이 품절되었습니다.` };
}

if (effectiveStock < quantity) {
  return {
    success: false,
    message: `재고가 부족합니다. (현재 재고: ${effectiveStock}개)`,
  };
}
```

### 수정 예시: `actions/orders.ts` 재고 차감

```typescript
// 재고 차감 로직 수정

for (const item of cartItems) {
  if (item.variant_id) {
    // 🔴 옵션 재고 차감
    const variant = item.variant as { id: string; stock: number };
    await supabase
      .from("product_variants")
      .update({ stock: variant.stock - item.quantity })
      .eq("id", item.variant_id);
  } else {
    // 기본 상품 재고 차감
    const product = item.product as { id: string; stock: number };
    await supabase
      .from("products")
      .update({ stock: product.stock - item.quantity })
      .eq("id", product.id);
  }
}
```

### Phase 2 완료 기준

- [ ] 장바구니 추가 시 variant 재고 검증
- [ ] 장바구니 수량 변경 시 variant 재고 검증
- [ ] 주문 생성 시 variant 재고 검증
- [ ] 주문 생성 시 variant 재고 차감
- [ ] 주문 취소 시 variant 재고 복구
- [ ] 테스트: 품절 옵션 담기 시도 → 실패 확인

---

## 🔗 참고 자료

| 문서 | URL |
|------|-----|
| 인증 방식 | https://apicenter.commerce.naver.com/docs/auth |
| 채널 상품 조회 | https://apicenter.commerce.naver.com/docs/commerce-api/2.68.0/read-channel-product-1-product |
| 옵션 재고 변경 | https://apicenter.commerce.naver.com/docs/commerce-api/2.68.0/update-options-product |
| 원상품 정보 구조체 | https://apicenter.commerce.naver.com/docs/commerce-api/2.68.0/schemas/원상품-정보-구조체 |

---

> **시니어의 한마디**
> "Step 1 API 테스트부터 해보고, `tmp/channel-product.json` 파일 열어서 실제 응답 구조 확인해.
> 그거 보고 타입이랑 DB 컬럼 확정하면 돼. 막히면 바로 물어봐!"
