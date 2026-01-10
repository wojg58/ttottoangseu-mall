# 🔧 프로젝트 리팩토링 가이드

> **10년차 시니어 개발자 관점에서 본 코드 정리 및 복잡도 낮추기 방안**

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [우선순위별 개선 방안](#우선순위별-개선-방안)
3. [구체적인 리팩토링 계획](#구체적인-리팩토링-계획)
4. [실행 체크리스트](#실행-체크리스트)

---

## 현재 상태 분석

### 🔴 Critical Issues (즉시 개선 필요)

#### 1. **중복 코드 (DRY 위반)**

**문제점:**
- `extractFilePathFromUrl`, `extractBucketFromUrl` 함수가 **3곳에 중복** 정의됨
  - `actions/admin-products.ts` (24-65줄)
  - `scripts/check-image-urls.ts` (21-60줄)
  - `scripts/cleanup-unused-images.ts` (21-34줄)

**영향:**
- 버그 수정 시 3곳 모두 수정해야 함
- 유지보수 비용 증가
- 일관성 문제 발생 가능

**해결 방안:**
```typescript
// lib/utils/storage-url.ts (새 파일 생성)
export function extractFilePathFromUrl(imageUrl: string): string | null { ... }
export function extractBucketFromUrl(imageUrl: string): string | null { ... }
```

#### 2. **거대한 스크립트 파일**

**문제점:**
- `scripts/build-smartstore-mapping.js` - **1404줄**의 단일 파일
- 하나의 함수(`buildMapping`)가 너무 많은 책임을 가짐
- 테스트 불가능한 구조

**영향:**
- 코드 이해 어려움
- 디버깅 어려움
- 재사용 불가능

**해결 방안:**
- 모듈화: 기능별로 분리
  - `scripts/smartstore/token-manager.js`
  - `scripts/smartstore/product-fetcher.js`
  - `scripts/smartstore/option-mapper.js`
  - `scripts/smartstore/image-processor.js`
  - `scripts/smartstore/stock-sync.js`

#### 3. **과도한 로깅**

**문제점:**
- `console.log`, `console.group`이 프로덕션 코드에 과도하게 사용됨
- 디버깅 목적의 로그가 그대로 남아있음

**영향:**
- 성능 저하 (프로덕션)
- 로그 노이즈 증가
- 민감 정보 노출 위험

**해결 방안:**
- `lib/logger.ts`를 활용하여 환경별 로깅 제어
- 개발 환경에서만 상세 로그 출력
- 프로덕션에서는 에러만 로깅

---

### 🟡 High Priority Issues (단기 개선)

#### 4. **중복된 Bulk 작업 컴포넌트**

**문제점:**
- `bulk-delete-products-button.tsx`
- `bulk-restore-products-button.tsx`
- `bulk-hide-products-button.tsx`
- `bulk-show-products-button.tsx`

4개 컴포넌트가 거의 동일한 패턴을 가짐 (약 70줄씩, 총 280줄)

**해결 방안:**
```typescript
// components/bulk-action-button.tsx (통합 컴포넌트)
interface BulkActionButtonProps {
  action: 'delete' | 'restore' | 'hide' | 'show';
  selectedProductIds: string[];
  onSuccess?: () => void;
}
```

**절감 효과:** 280줄 → 약 100줄 (64% 감소)

#### 5. **복잡한 함수 분리 필요**

**문제점:**
- `actions/admin-products.ts`의 `updateProduct` 함수가 **500줄 이상**
- 이미지 삭제 로직이 중첩되어 있음
- 단일 책임 원칙 위반

**해결 방안:**
```typescript
// actions/admin-products.ts
async function updateProduct(...) {
  await updateProductBasicInfo(...);
  await updateProductImages(...);
  await updateProductVariants(...);
  await updateProductCategories(...);
}

// lib/utils/product-image-manager.ts (새 파일)
export async function deleteProductImages(...) { ... }
export async function updateProductImages(...) { ... }
```

#### 6. **TODO 주석 정리**

**발견된 TODO:**
- `scripts/build-smartstore-mapping.js:539` - 스마트스토어 상품 추가 로직
- `components/product-card.tsx:50` - 찜하기 기능
- `components/inquiry-form.tsx:75` - 에러 메시지 표시
- `components/review-form.tsx:68` - 에러 메시지 표시

**해결 방안:**
- 각 TODO를 이슈로 등록하거나
- 즉시 구현하거나
- 제거 (더 이상 필요 없으면)

---

### 🟢 Medium Priority Issues (중기 개선)

#### 7. **타입 정의 중복**

**문제점:**
- 여러 파일에서 유사한 타입 정의가 중복됨
- `ProductFilters`, `CreateProductInput` 등

**해결 방안:**
- `types/products.ts`에 통합
- 공통 타입은 `types/common.ts`에 정의

#### 8. **에러 처리 일관성**

**문제점:**
- 에러 처리 방식이 파일마다 다름
- 일부는 `try-catch`, 일부는 에러 무시

**해결 방안:**
- 공통 에러 처리 유틸리티 생성
- 에러 타입 정의 및 표준화

#### 9. **환경 변수 검증**

**문제점:**
- 환경 변수 누락 시 런타임 에러 발생
- 초기화 시점에 검증하지 않음

**해결 방안:**
- `lib/env.ts`에서 환경 변수 검증 및 타입 정의
- 앱 시작 시 검증

---

## 우선순위별 개선 방안

### Phase 1: 즉시 개선 (1-2일)

1. ✅ **중복 유틸리티 함수 통합**
   - `lib/utils/storage-url.ts` 생성
   - 3곳의 중복 코드 제거
   - **예상 효과:** 코드 100줄 감소, 유지보수성 향상

2. ✅ **로깅 정리**
   - `lib/logger.ts` 활용
   - 불필요한 `console.log` 제거
   - **예상 효과:** 프로덕션 성능 향상

### Phase 2: 단기 개선 (3-5일)

3. ✅ **Bulk 작업 컴포넌트 통합**
   - `bulk-action-button.tsx` 생성
   - 4개 컴포넌트 → 1개로 통합
   - **예상 효과:** 코드 180줄 감소

4. ✅ **복잡한 함수 분리**
   - `updateProduct` 함수 분리
   - 이미지 관리 로직 모듈화
   - **예상 효과:** 가독성 향상, 테스트 용이

### Phase 3: 중기 개선 (1-2주)

5. ✅ **거대 스크립트 모듈화**
   - `build-smartstore-mapping.js` 분리
   - 기능별 모듈로 재구성
   - **예상 효과:** 유지보수성 대폭 향상

6. ✅ **타입 정의 통합**
   - 공통 타입 파일 정리
   - 중복 타입 제거

7. ✅ **TODO 정리**
   - 이슈 등록 또는 구현
   - 불필요한 TODO 제거

---

## 구체적인 리팩토링 계획

### 1. 중복 유틸리티 함수 통합

**Before:**
```typescript
// actions/admin-products.ts
function extractFilePathFromUrl(imageUrl: string): string | null { ... }
function extractBucketFromUrl(imageUrl: string): string | null { ... }

// scripts/check-image-urls.ts
function extractFilePathFromUrl(imageUrl: string): string | null { ... }
function extractBucketFromUrl(imageUrl: string): string | null { ... }

// scripts/cleanup-unused-images.ts
function extractFilePathFromUrl(imageUrl: string): string | null { ... }
```

**After:**
```typescript
// lib/utils/storage-url.ts
export function extractFilePathFromUrl(imageUrl: string): string | null {
  // 통합된 구현
}

export function extractBucketFromUrl(imageUrl: string): string | null {
  // 통합된 구현
}

// 사용처
import { extractFilePathFromUrl, extractBucketFromUrl } from '@/lib/utils/storage-url';
```

### 2. Bulk 작업 컴포넌트 통합

**Before:**
```typescript
// 4개의 거의 동일한 컴포넌트
// bulk-delete-products-button.tsx (71줄)
// bulk-restore-products-button.tsx (71줄)
// bulk-hide-products-button.tsx (87줄)
// bulk-show-products-button.tsx (87줄)
```

**After:**
```typescript
// components/bulk-action-button.tsx (약 100줄)
interface BulkActionButtonProps {
  action: 'delete' | 'restore' | 'hide' | 'show';
  selectedProductIds: string[];
  onSuccess?: () => void;
}

const ACTION_CONFIG = {
  delete: { 
    action: deleteAllProducts, 
    icon: Trash2, 
    confirmMessage: '...',
    variant: 'destructive' 
  },
  // ...
};

export default function BulkActionButton({ action, ... }: BulkActionButtonProps) {
  // 공통 로직
}
```

### 3. 거대 스크립트 모듈화

**Before:**
```javascript
// scripts/build-smartstore-mapping.js (1404줄)
async function buildMapping() {
  // 모든 로직이 하나의 함수에...
}
```

**After:**
```javascript
// scripts/smartstore/token-manager.js
export async function getNaverToken() { ... }

// scripts/smartstore/product-fetcher.js
export async function getAllSmartstoreProducts() { ... }

// scripts/smartstore/option-mapper.js
export async function mapProductOptions(product) { ... }

// scripts/smartstore/image-processor.js
export async function processProductImages(product) { ... }

// scripts/smartstore/stock-sync.js
export async function syncProductStock(product) { ... }

// scripts/build-smartstore-mapping.js (메인, 약 200줄)
import { getAllSmartstoreProducts } from './smartstore/product-fetcher';
import { mapProductOptions } from './smartstore/option-mapper';
// ...

async function buildMapping() {
  const products = await getAllSmartstoreProducts();
  for (const product of products) {
    await mapProductOptions(product);
    await processProductImages(product);
    await syncProductStock(product);
  }
}
```

### 4. 복잡한 함수 분리

**Before:**
```typescript
// actions/admin-products.ts
export async function updateProduct(input: UpdateProductInput) {
  // 500줄 이상의 복잡한 로직
  // - 기본 정보 업데이트
  // - 이미지 삭제/추가/업데이트
  // - 옵션 업데이트
  // - 카테고리 업데이트
  // 모두 하나의 함수에...
}
```

**After:**
```typescript
// actions/admin-products.ts
export async function updateProduct(input: UpdateProductInput) {
  await updateProductBasicInfo(input);
  if (input.images !== undefined) {
    await updateProductImages(input.id, input.images, input.deletedImageIds);
  }
  if (input.variants !== undefined) {
    await updateProductVariants(input.id, input.variants);
  }
  if (input.category_ids !== undefined) {
    await updateProductCategories(input.id, input.category_ids);
  }
}

// lib/utils/product-image-manager.ts
export async function updateProductImages(
  productId: string,
  images: ImageInput[],
  deletedImageIds?: string[]
) {
  // 이미지 관리 로직만
}

// lib/utils/product-variant-manager.ts
export async function updateProductVariants(
  productId: string,
  variants: VariantInput[]
) {
  // 옵션 관리 로직만
}
```

---

## 실행 체크리스트

### Phase 1: 즉시 개선

- [ ] `lib/utils/storage-url.ts` 생성
- [ ] `extractFilePathFromUrl`, `extractBucketFromUrl` 통합
- [ ] 3곳의 중복 코드 제거 및 import로 변경
- [ ] 테스트 (이미지 삭제 기능 확인)
- [ ] `lib/logger.ts` 활용하여 불필요한 `console.log` 제거
- [ ] 프로덕션 환경에서 로깅 레벨 확인

### Phase 2: 단기 개선

- [ ] `components/bulk-action-button.tsx` 생성
- [ ] 4개 bulk 컴포넌트를 새 컴포넌트로 교체
- [ ] 기존 4개 컴포넌트 삭제
- [ ] `lib/utils/product-image-manager.ts` 생성
- [ ] `updateProduct` 함수에서 이미지 로직 분리
- [ ] `lib/utils/product-variant-manager.ts` 생성
- [ ] `updateProduct` 함수에서 옵션 로직 분리

### Phase 3: 중기 개선

- [ ] `scripts/smartstore/` 디렉토리 생성
- [ ] `build-smartstore-mapping.js` 모듈화
- [ ] 각 모듈별 단위 테스트 작성
- [ ] `types/products.ts` 통합
- [ ] 중복 타입 정의 제거
- [ ] TODO 주석 정리 (이슈 등록 또는 구현)

---

## 예상 효과

### 코드량 감소
- **중복 유틸리티 통합:** ~100줄 감소
- **Bulk 컴포넌트 통합:** ~180줄 감소
- **로깅 정리:** ~200줄 감소
- **총 예상 감소:** ~480줄 (약 5-7% 감소)

### 유지보수성 향상
- ✅ 중복 코드 제거로 버그 수정 시 한 곳만 수정
- ✅ 모듈화로 테스트 용이
- ✅ 함수 분리로 가독성 향상
- ✅ 타입 통합으로 타입 안정성 향상

### 성능 향상
- ✅ 불필요한 로깅 제거로 프로덕션 성능 향상
- ✅ 모듈화로 필요한 부분만 로드 가능

---

## 주의사항

1. **점진적 리팩토링**
   - 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
   - 각 단계마다 테스트 필수

2. **기능 보존**
   - 리팩토링 중 기존 기능이 동작하는지 확인
   - 회귀 테스트 수행

3. **커밋 전략**
   - 각 개선 사항을 별도 커밋으로 분리
   - 명확한 커밋 메시지 작성

4. **문서화**
   - 변경 사항 문서화
   - 새로운 구조 설명

---

## 참고 자료

- [Clean Code - Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring - Martin Fowler](https://refactoring.com/)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Single Responsibility Principle](https://en.wikipedia.org/wiki/Single-responsibility_principle)

---

**작성일:** 2025-01-XX  
**작성자:** AI Assistant (10년차 시니어 개발자 관점)  
**검토 필요:** 프로젝트 리더







