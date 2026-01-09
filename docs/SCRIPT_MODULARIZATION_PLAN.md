# 🔧 스크립트 모듈화 계획

> **build-smartstore-mapping.js 모듈화 계획서**

## 현재 상태

- **파일**: `scripts/build-smartstore-mapping.js`
- **크기**: 1,404줄
- **주요 함수**: 7개
- **복잡도**: 매우 높음

## 주요 함수 분석

### 1. `getNaverToken()` (42-91줄)
- **책임**: 네이버 API 토큰 발급 및 캐싱
- **의존성**: bcrypt, 환경 변수
- **모듈화 대상**: ✅

### 2. `fetchWithRetry()` (94-128줄)
- **책임**: API 호출 래퍼 (401 재시도, 429 exponential backoff)
- **의존성**: `getNaverToken()`
- **모듈화 대상**: ✅

### 3. `getChannelProduct()` (129-161줄)
- **책임**: 특정 상품 정보 가져오기
- **의존성**: `fetchWithRetry()`
- **모듈화 대상**: ✅

### 4. `extractOptionStocks()` (162-186줄)
- **책임**: 옵션 재고 정보 추출
- **의존성**: 없음 (순수 함수)
- **모듈화 대상**: ✅

### 5. `downloadCompressAndUploadImage()` (190-260줄)
- **책임**: 이미지 다운로드, 압축, 업로드
- **의존성**: sharp, Supabase Storage
- **모듈화 대상**: ✅

### 6. `getAllSmartstoreProducts()` (261-367줄)
- **책임**: 모든 스마트스토어 상품 가져오기
- **의존성**: `fetchWithRetry()`
- **모듈화 대상**: ✅

### 7. `buildMapping()` (368-1404줄)
- **책임**: 메인 로직 (옵션 매핑, 이미지 처리, 재고 동기화)
- **의존성**: 위의 모든 함수들
- **모듈화 대상**: ✅ (기능별로 분리)

## 모듈화 계획

### 디렉토리 구조

```
scripts/
├── smartstore/
│   ├── token-manager.js          # 네이버 토큰 관리
│   ├── api-client.js              # API 호출 래퍼 (fetchWithRetry)
│   ├── product-fetcher.js        # 상품 데이터 가져오기
│   ├── option-mapper.js          # 옵션 매핑 로직
│   ├── image-processor.js        # 이미지 처리
│   └── stock-sync.js              # 재고 동기화
└── build-smartstore-mapping.js   # 메인 (200줄 이하)
```

### 모듈별 책임

#### 1. `smartstore/token-manager.js`
```javascript
// 네이버 API 토큰 관리
export async function getNaverToken()
export function clearTokenCache()
```

#### 2. `smartstore/api-client.js`
```javascript
// API 호출 래퍼
export async function fetchWithRetry(url, options, retried, retryCount)
export async function getChannelProduct(channelProductNo)
```

#### 3. `smartstore/product-fetcher.js`
```javascript
// 상품 데이터 가져오기
export async function getAllSmartstoreProducts()
export async function getProductDetails(channelProductNo)
```

#### 4. `smartstore/option-mapper.js`
```javascript
// 옵션 매핑 로직
export function extractOptionStocks(channelProductData)
export async function mapProductOptions(product, channelProductData)
```

#### 5. `smartstore/image-processor.js`
```javascript
// 이미지 처리
export async function downloadCompressAndUploadImage(imageUrl, productId)
export async function processProductImages(product, images)
```

#### 6. `smartstore/stock-sync.js`
```javascript
// 재고 동기화
export async function syncProductStock(productId, stockData)
export async function syncAllProductStocks(products)
```

### 메인 스크립트 (`build-smartstore-mapping.js`)

```javascript
// 메인 로직만 남김 (200줄 이하)
const { getAllSmartstoreProducts } = require('./smartstore/product-fetcher');
const { mapProductOptions } = require('./smartstore/option-mapper');
const { processProductImages } = require('./smartstore/image-processor');
const { syncProductStock } = require('./smartstore/stock-sync');

async function buildMapping() {
  // 1. 상품 가져오기
  const products = await getAllSmartstoreProducts();
  
  // 2. 각 상품 처리
  for (const product of products) {
    await mapProductOptions(product);
    await processProductImages(product);
    await syncProductStock(product);
  }
}
```

## 예상 효과

- **코드 가독성**: 각 모듈이 단일 책임을 가짐
- **테스트 용이**: 각 모듈을 독립적으로 테스트 가능
- **재사용성**: 다른 스크립트에서도 모듈 활용 가능
- **유지보수성**: 버그 수정 시 해당 모듈만 수정

## 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
2. **기능 보존**: 리팩토링 중 기존 기능이 동작하는지 확인
3. **테스트**: 각 모듈 분리 후 충분한 테스트 수행

## 실행 계획

1. ✅ 구조 분석 완료
2. ⏳ 모듈 디렉토리 생성
3. ⏳ 각 모듈별로 함수 분리
4. ⏳ 메인 스크립트 리팩토링
5. ⏳ 테스트 및 검증

---

**작성일**: 2025-01-XX  
**상태**: 계획 완료, 실행 대기

