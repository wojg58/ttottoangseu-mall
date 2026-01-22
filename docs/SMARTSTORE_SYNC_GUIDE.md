# 네이버 스마트스토어 재고 동기화 가이드

## 개요

네이버 스마트스토어와 Supabase 간의 재고를 일방향으로 동기화하는 기능입니다.

**동작 구조:**

```
네이버 스마트스토어 → Supabase → 로컬호스트:3000
```

## 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 다음 환경 변수를 추가하세요:

```env
# 네이버 스마트스토어(커머스) API
NAVER_COMMERCE_CLIENT_ID=your_commerce_client_id
NAVER_COMMERCE_CLIENT_SECRET=your_commerce_client_secret

# (기존 호환) 아래 키도 동작하지만, 혼동 방지를 위해 위 키 사용 권장
NAVER_SMARTSTORE_CLIENT_ID=your_commerce_client_id
NAVER_SMARTSTORE_CLIENT_SECRET=your_commerce_client_secret
```

**중요:**
- 위 값은 **네이버 스마트스토어(커머스) API 전용 키**입니다.
- **네이버 로그인(OAuth) 키가 아닙니다.**

### 2. 네이버 스마트스토어 API 키 발급

1. [네이버 개발자 센터](https://developers.naver.com/) 접속
2. **애플리케이션 등록** 클릭
3. 애플리케이션 정보 입력:
   - **애플리케이션 이름**: 원하는 이름
   - **사용 API**: **스마트스토어(커머스) API** 선택
   - **서비스 환경**: **웹** 선택
   - **로그인 오픈 API 서비스 환경**: **웹** 선택
4. **등록** 클릭
5. 발급된 **Client ID**와 **Client Secret**을 `.env` 파일에 입력

#### 키 위치/확인 경로 (중요)
- **(1) Naver Developers > 내 애플리케이션 > 해당 앱 > API 설정**
  - **스마트스토어(커머스) API**가 **활성화** 되어 있는지 확인
- **(2) Naver Developers > 개요**
  - **Client ID / Client Secret** 위치
  - **Client Secret은 "보기/재발급" 버튼**으로 확인
- **(3) 스마트스토어 판매자센터**
  - 해당 앱(Client ID)이 **연동/승인 상태**인지 확인
  - **메뉴명은 판매자센터 UI에 따라 다를 수 있음**

#### 절대 주의
- **네이버 로그인(OAuth) 키 화면에서 가져오면 안 됩니다.**
  - 예: "네이버 로그인" 또는 "Login API" 화면에서 보이는 키는 **스마트스토어 토큰 발급에 사용할 수 없습니다.**

### 3. 데이터베이스 마이그레이션 적용

Supabase Dashboard에서 다음 마이그레이션을 실행하세요:

```sql
-- products 테이블에 smartstore_product_id 필드 추가
ALTER TABLE products
ADD COLUMN IF NOT EXISTS smartstore_product_id TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_smartstore_product_id
ON products(smartstore_product_id)
WHERE smartstore_product_id IS NOT NULL AND deleted_at IS NULL;
```

또는 Supabase MCP를 통해 자동으로 적용되었을 수 있습니다.

### 4. 상품에 스마트스토어 ID 연결

관리자 페이지에서 상품을 등록/수정할 때 **스마트스토어 상품 ID**를 입력하세요.

또는 SQL로 직접 업데이트:

```sql
-- 예시: 상품 ID가 'ttotto_01'인 상품에 스마트스토어 ID 연결
UPDATE products
SET smartstore_product_id = '1234567890'
WHERE id = 'ttotto_01';
```

## 사용 방법

### 방법 1: API 엔드포인트 호출 (권장)

#### 전체 상품 재고 동기화

```bash
# 브라우저 또는 터미널에서
curl http://localhost:3000/api/sync-stock
```

#### 단일 상품 재고 동기화

```bash
curl "http://localhost:3000/api/sync-stock?productId=1234567890"
```

### 방법 2: Server Action 직접 호출

```typescript
import { syncAllStocks, syncProductStock } from "@/actions/sync-stock";

// 전체 상품 동기화
const result = await syncAllStocks();

// 단일 상품 동기화
const result = await syncProductStock("1234567890");
```

### 방법 3: 주기적 자동 실행 (Cron Job)

로컬호스트에서 주기적으로 실행하려면:

#### Windows (작업 스케줄러)

1. 작업 스케줄러 열기
2. **기본 작업 만들기** 클릭
3. 트리거: **매일** 또는 **5분마다**
4. 동작: **프로그램 시작**
5. 프로그램: `curl`
6. 인수: `http://localhost:3000/api/sync-stock`

#### macOS/Linux (Cron)

```bash
# crontab 편집
crontab -e

# 5분마다 실행
*/5 * * * * curl http://localhost:3000/api/sync-stock
```

#### Node.js 스크립트 (권장)

`scripts/sync-stock.js` 파일 생성:

```javascript
const https = require("https");

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/sync-stock",
  method: "GET",
};

const req = https.request(options, (res) => {
  console.log(`상태 코드: ${res.statusCode}`);
  res.on("data", (d) => {
    process.stdout.write(d);
  });
});

req.on("error", (error) => {
  console.error(error);
});

req.end();
```

그리고 cron으로 실행:

```bash
*/5 * * * * node /path/to/scripts/sync-stock.js
```

## 동작 원리

1. **네이버 스마트스토어 API 호출**

   - OAuth 2.0으로 액세스 토큰 발급
   - 상품 재고 정보 조회

2. **Supabase 업데이트**

   - `products` 테이블의 `stock` 필드 업데이트
   - 재고가 0이면 `status`를 `sold_out`으로 변경
   - 재고가 생기면 `status`를 `active`로 복구

3. **로컬호스트에서 조회**
   - Next.js 앱이 Supabase에서 최신 재고 정보를 읽어서 표시

## 주의사항

### API 레이트 리밋

네이버 스마트스토어 API는 호출 제한이 있을 수 있습니다. 너무 자주 호출하지 마세요.

**권장 주기:**

- 개발 환경: 5분마다
- 프로덕션 환경: 1시간마다

### 에러 처리

동기화 실패 시:

- 로그를 확인하세요 (`console.log` 또는 Supabase 로그)
- 네이버 스마트스토어 API 키가 올바른지 확인
- 상품 ID가 올바르게 연결되었는지 확인

### 상품 ID 매핑

각 상품은 `smartstore_product_id` 필드에 네이버 스마트스토어 상품 ID가 저장되어 있어야 합니다.

## 문제 해결

### "토큰 발급 실패" 오류

- 네이버 스마트스토어(커머스) API 키가 올바른지 확인
- **네이버 로그인(OAuth) 키와 섞이지 않았는지 확인**
- `.env` 파일에 환경 변수가 제대로 설정되었는지 확인
- 네이버 개발자 센터에서 **스마트스토어(커머스) API** 권한이 활성화되었는지 확인
- 스마트스토어 판매자센터에서 해당 앱(Client ID)이 **연동/승인** 상태인지 확인

### "상품을 찾을 수 없습니다" 오류

- `smartstore_product_id` 필드가 제대로 설정되었는지 확인
- Supabase에서 해당 상품이 삭제되지 않았는지 확인 (`deleted_at IS NULL`)

### "재고 조회 실패" 오류

- 네이버 스마트스토어에서 해당 상품 ID가 존재하는지 확인
- API 권한이 올바르게 설정되었는지 확인

## API 응답 형식

### 성공 응답

```json
{
  "success": true,
  "message": "재고 동기화 완료: 성공 10개, 실패 0개",
  "syncedCount": 10,
  "failedCount": 0,
  "errors": []
}
```

### 실패 응답

```json
{
  "success": false,
  "message": "재고 동기화 중 오류 발생: ...",
  "syncedCount": 5,
  "failedCount": 5,
  "errors": [
    {
      "productId": "1234567890",
      "error": "상품을 찾을 수 없습니다"
    }
  ]
}
```

## 추가 기능

### 관리자 페이지에서 수동 동기화

관리자 페이지에 재고 동기화 버튼을 추가할 수 있습니다:

```typescript
import { syncAllStocks } from "@/actions/sync-stock";

async function handleSyncStock() {
  const result = await syncAllStocks();
  alert(result.message);
}
```

이 기능은 추후 구현 예정입니다.
