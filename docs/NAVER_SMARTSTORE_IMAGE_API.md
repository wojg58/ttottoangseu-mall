# 네이버 스마트스토어 상품 이미지 조회 API 스펙

**작성자:** 10년차 선임 개발자  
**대상:** 1년차 신입 개발자  
**최종 수정일:** 2025-01-27

---

## 목차

1. [목적 설명](#1-목적-설명)
2. [전체 흐름 요약](#2-전체-흐름-요약)
3. [이미지 종류별 상세 설명](#3-이미지-종류별-상세-설명)
4. [응답 예시](#4-응답-예시-json-일부)
5. [사용 API 엔드포인트](#5-사용-api-엔드포인트-전체-url)
6. [권한 및 OAuth 설정 요건](#6-권한-및-oauth-설정-요건)
7. [개발 시 주의사항](#7-개발-시-주의사항)

---

## 1. 목적 설명

네이버 커머스 API를 이용하면 **스마트스토어 상품 데이터를 안전하게 획득**할 수 있습니다. 이 API를 통해 다음 이미지들을 직접 가져와 자사몰 상품 페이지를 구성할 수 있습니다:

- **대표 이미지**: 상품의 메인 이미지
- **부가 이미지**: 추가 상품 사진 (최대 9개)
- **옵션별 이미지**: 색상 등 옵션에 따른 이미지
- **상세설명 내 이미지**: 상품 상세 설명 HTML 내의 이미지들

### 왜 스크래핑 대신 API를 사용해야 하나요?

- ✅ **데이터 일관성**: 공식 API로 항상 최신 데이터 보장
- ✅ **안정성**: 스크래핑은 HTML 구조 변경 시 깨질 수 있음
- ✅ **자동화 가능**: 실시간 재고·가격 연동 등 다양한 자동화 구현 가능
- ✅ **법적 안전성**: 공식 API 사용으로 저작권 문제 방지

---

## 2. 전체 흐름 요약

### 단계별 프로세스

```
1. OAuth2 인증 토큰 발급
   ↓
2. (선택) 상품 목록 조회 → 채널상품번호 획득
   ↓
3. 채널 상품 조회 → 모든 이미지 정보 + 상세 HTML 획득
   ↓
4. 데이터 파싱 및 활용
```

### 상세 설명

#### Step 1: OAuth2 인증 토큰 발급

- Commerce API는 **Client Credentials 방식**의 OAuth2를 사용합니다
- 미리 발급받은 `client_id`와 `client_secret`으로 토큰을 받습니다
- 모든 API 요청에 `Authorization: Bearer {token}` 헤더를 추가해야 합니다

#### Step 2: 상품 목록 조회 (선택)

- **이미 채널상품번호를 알고 있으면 이 단계는 생략 가능**
- `POST https://api.commerce.naver.com/external/v1/products/search` API 호출
- 응답에서 채널상품번호(`CHANNEL_PRODUCT_NO`)를 얻습니다

#### Step 3: 채널 상품 조회

- `GET https://api.commerce.naver.com/external/v2/products/channel-products/{채널상품번호}` 엔드포인트 호출
- 이 응답에 **모든 이미지 정보**와 **상품 상세 HTML**이 포함됩니다

#### Step 4: 데이터 활용

- 응답 JSON에서 다음 필드들을 추출:
  - `originProduct.images`: 대표/추가 이미지
  - `originProduct.standardOptionAttributes[].imageUrls`: 옵션별 이미지
  - `originProduct.detailContent`: 상세 설명 HTML (파싱 필요)

---

## 3. 이미지 종류별 상세 설명

### 3.1 대표 이미지 (Representative Image)

**위치:** `originProduct.images.representativeImage.url`

**특징:**

- 상품의 메인 이미지 (1개)
- 1000×1000px 권장
- 반드시 Commerce API의 **상품 이미지 다건 등록** API로 업로드하여 획득한 URL이어야 함
- 외부 URL이나 직접 접근 가능한 URL은 사용 불가

**예시:**

```json
{
  "images": {
    "representativeImage": {
      "url": "https://shop.phinf.naver.net/main123.jpg"
    }
  }
}
```

### 3.2 추가 이미지 (Optional/Sub Images)

**위치:** `originProduct.images.optionalImages[]`

**특징:**

- 대표 이미지를 제외한 부가 이미지 목록
- 최대 9개까지 가능
- 각 요소의 `url` 속성에 이미지 주소가 있음
- 역시 이미지 등록 API로 받은 URL이어야 함
- 없을 경우 빈 배열 `[]`로 반환

**예시:**

```json
{
  "images": {
    "optionalImages": [
      { "url": "https://shop.phinf.naver.net/subimage1.jpg" },
      { "url": "https://shop.phinf.naver.net/subimage2.jpg" }
    ]
  }
}
```

### 3.3 옵션 이미지 (Option Image)

**위치:** `originProduct.standardOptionAttributes[i].imageUrls[]`

**특징:**

- 스마트스토어의 **표준형 옵션**(예: 색상)마다 이미지가 있는 경우
- 각 옵션 속성에 다중 URL을 지정할 수 있음
- 없는 경우 빈 배열 `[]`
- 예: 색상 옵션의 빨강(Red) 항목에 이미지가 있으면 해당 속성의 `imageUrls`에 URL이 담김

**예시:**

```json
{
  "standardOptionAttributes": [
    {
      "attributeId": 11,
      "attributeValueId": 101,
      "attributeValueName": "Red",
      "imageUrls": ["https://shop.phinf.naver.net/red1.jpg"]
    },
    {
      "attributeId": 11,
      "attributeValueId": 102,
      "attributeValueName": "Blue",
      "imageUrls": []
    }
  ]
}
```

### 3.4 상세 설명 이미지 (Detail Content Images)

**위치:** `originProduct.detailContent` (HTML 문자열)

**특징:**

- 상품 상세 설명이 **HTML 문자열**로 제공됨
- HTML 내부 `<img>` 태그의 `src` 속성값을 파싱하여 추출
- Node.js 환경에서는 **Cheerio** 같은 라이브러리로 파싱
- HTML 내 URL은 스마트스토어의 CDN(`phinf.naver.net` 등)을 사용
- 상대경로가 아닌 **절대 URL**임에 유의
- `<amp-img>` 등 다른 태그가 있을 수 있으니 필요 시 처리

**예시:**

```html
<div>
  <img src="https://shop.phinf.naver.net/detail1.jpg" />
  <img src="https://shop.phinf.naver.net/detail2.jpg" />
</div>
```

**파싱 예시 (Node.js + Cheerio):**

```javascript
const cheerio = require("cheerio");

const $ = cheerio.load(detailContent);
const imageUrls = [];

$("img").each((i, elem) => {
  const src = $(elem).attr("src");
  if (src) {
    imageUrls.push(src);
  }
});
```

---

## 4. 응답 예시 (JSON 일부)

```json
{
  "originProduct": {
    "images": {
      "representativeImage": {
        "url": "https://shop.phinf.naver.net/main123.jpg"
      },
      "optionalImages": [
        { "url": "https://shop.phinf.naver.net/subimage1.jpg" },
        { "url": "https://shop.phinf.naver.net/subimage2.jpg" }
      ]
    },
    "detailContent": "<div><img src=\"https://shop.phinf.naver.net/detail1.jpg\"/></div>",
    "standardOptionAttributes": [
      {
        "attributeId": 11,
        "attributeValueId": 101,
        "attributeValueName": "Red",
        "imageUrls": ["https://shop.phinf.naver.net/red1.jpg"]
      },
      {
        "attributeId": 11,
        "attributeValueId": 102,
        "attributeValueName": "Blue",
        "imageUrls": []
      }
    ]
    /* 기타 필드 생략 */
  }
}
```

### 필드 요약

| 이미지 종류      | JSON 경로                                              | 개수 제한   |
| ---------------- | ------------------------------------------------------ | ----------- |
| 대표 이미지      | `originProduct.images.representativeImage.url`         | 1개         |
| 추가 이미지      | `originProduct.images.optionalImages[]`                | 최대 9개    |
| 옵션 이미지      | `originProduct.standardOptionAttributes[].imageUrls[]` | 옵션별 다수 |
| 상세 설명 이미지 | `originProduct.detailContent` (HTML 파싱)              | 제한 없음   |

---

## 5. 사용 API 엔드포인트 (전체 URL)

### 5.1 OAuth2 토큰 발급

```
POST https://api.commerce.naver.com/oauth2/v1/token
```

**요청 헤더:**

```
Content-Type: application/x-www-form-urlencoded
```

**요청 본문:**

```
grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}&timestamp={timestamp}&signature={signature}
```

### 5.2 상품 목록 조회 (선택)

```
POST https://api.commerce.naver.com/external/v1/products/search
```

**요청 헤더:**

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**용도:** 채널상품번호(`CHANNEL_PRODUCT_NO`) 획득  
**참고:** 이미 채널상품번호를 알고 있으면 생략 가능

### 5.3 채널 상품 조회 (핵심)

```
GET https://api.commerce.naver.com/external/v2/products/channel-products/{채널상품번호}
```

**요청 헤더:**

```
Authorization: Bearer {access_token}
```

**용도:** 모든 이미지 정보와 상품 상세 HTML 획득  
**응답:** `originProduct` 객체에 모든 이미지 데이터 포함

### 5.4 원상품 조회 (선택)

```
GET https://api.commerce.naver.com/external/v2/products/origin-products/{원상품번호}
```

**요청 헤더:**

```
Authorization: Bearer {access_token}
```

**용도:** 채널 상품의 원상품번호를 통해 상세 조회  
**참고:** 채널 상품 조회로 충분한 경우 생략 가능

---

## 6. 권한 및 OAuth 설정 요건

### 6.1 OAuth2 방식

- **타입:** Client Credentials 방식
- **인증 정보:** `client_id`, `client_secret`
- **토큰 발급:** API센터에서 발급받은 자격증명과 타임스탬프로 전자서명 생성 후 토큰 발급

### 6.2 토큰 사용

- 모든 API 요청에 `Authorization: Bearer {access_token}` 헤더 필수
- Commerce API는 별도의 세분화된 scope를 사용하지 않음
- 발급 받은 토큰은 동의된 판매자 계정 내에서의 모든 상품 데이터 조회 권한을 가짐
- **단, 자신의 스마트스토어에 등록된 상품에 한정**

### 6.3 토큰 만료 처리

- 인증 실패(토큰 만료 등) 시 **401 에러** 반환
- Commerce API는 응답에 `GW.AUTHN` 코드로 토큰 만료를 알림
- 이 경우 토큰을 재발급하여 요청을 재시도해야 함

---

## 7. 개발 시 주의사항

### 7.1 이미지 URL 출처

⚠️ **중요:** 이미지 URL은 반드시 **"상품 이미지 다건 등록" API로 업로드 후 받은 URL**이어야 합니다.

- ❌ 외부 URL 사용 불가
- ❌ 직접 접근 가능한 URL 사용 불가
- ✅ 네이버에서 발급한 CDN URL만 사용 가능
- ✅ 상품 등록 시와 마찬가지로, 이미지를 신규 등록하거나 재등록할 때는 업로드 API를 거쳐야 함

### 7.2 HTML 파싱

- 상세 설명(`detailContent`)은 **HTML 문자열**입니다
- 단순 문자열 추출로는 이미지 URL을 얻기 어렵기 때문에 **HTML 파싱**이 필요합니다
- Node.js 환경에서는 **Cheerio**, **jsdom** 등으로 `<img>` 요소의 `src`만 골라내세요
- 파싱 과정에서 `<amp-img>` 등 다른 태그가 있을 수 있으니, 필요 시 `amp-img`의 `src`도 처리합니다

### 7.3 누락 방지

- 채널상품 조회 시 대표/추가 이미지 필드는 필수로 응답되지만
- 옵션 이미지가 없거나 추가 이미지가 없으면 **빈 배열 `[]`**로 옵니다
- **null 체크**나 빈 배열 처리에 유의하세요
- 예: `optionalImages`가 아예 없지 않고 `[]`인 경우도 있습니다

### 7.4 백엔드 처리

- Next.js에서는 **API 라우트**나 **Server Actions** 등 **서버 사이드**에서 이 API를 호출하는 것이 좋습니다
- 클라이언트 측에서 직접 호출 시:
  - ❌ CORS 제약이 있을 수 있음
  - ❌ 토큰 보안 이슈 발생 가능

### 7.5 오류 처리

- 인증 실패(토큰 만료 등) 시 **401 에러** 반환
- Commerce API는 응답에 `GW.AUTHN` 코드로 토큰 만료를 알림
- 이 경우 토큰을 재발급하여 요청을 재시도해야 함

**오류 처리 예시:**

```javascript
try {
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // 토큰 재발급
    const newToken = await refreshToken();
    // 재시도
    return await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });
  }
} catch (error) {
  console.error("API 호출 실패:", error);
}
```

### 7.6 이미지 형식

- 업로드 가능한 이미지: JPEG, PNG 등
- URL 끝이 `.jpg/.png` 등이지만, 실제 Content-Type은 API 호출로 확인 가능
- 상세 설명 이미지의 경우 네이버 CDN에서 호스팅되므로 원본 형식으로 받을 수 있습니다

### 7.7 최대 개수 및 크기

- **대표 이미지:** 1개
- **추가 이미지:** 최대 9개
- **옵션 이미지:** 옵션별 다수
- **상세 설명 이미지:** 제한 없음

가급적 모든 필드를 모두 한 번에 파싱·적재해 실수가 없도록 하세요.

### 7.8 주요 포인트 요약

| 항목             | 위치                                                 | 주의사항                    |
| ---------------- | ---------------------------------------------------- | --------------------------- |
| 대표/추가 이미지 | `originProduct.images`                               | 필수 필드, 빈 배열 가능     |
| 옵션 이미지      | `originProduct.standardOptionAttributes[].imageUrls` | 옵션별로 다름, 빈 배열 가능 |
| 상세설명 이미지  | `originProduct.detailContent` (HTML 파싱)            | HTML 파싱 필수              |

**헷갈리지 말 것:**

- ❌ 대표/추가 이미지는 `originProduct.images` 필드
- ❌ 옵션 이미지는 `standardOptionAttributes[].imageUrls` 필드
- ❌ 상세설명 이미지는 HTML 파싱 필요
- ✅ 이미지 URL은 반드시 네이버 제공 URL이어야 하므로, **업로드 API를 통한 URL 확보** 단계를 누락하지 않도록 주의

---

## 참고 자료

- [네이버 커머스 API 공식 문서](https://apicenter.commerce.naver.com/)
- [OAuth2 인증 가이드](https://apicenter.commerce.naver.com/docs/auth)
- [원상품 정보 구조체](https://apicenter.commerce.naver.com/docs/commerce-api/current/schemas/%EC%9B%90%EC%83%81%ED%92%88-%EC%A0%95%EB%B3%B4-%EA%B5%AC%EC%A1%B0%EC%B2%B4)

---

## 변경 이력

| 날짜       | 버전 | 변경 내용 | 작성자             |
| ---------- | ---- | --------- | ------------------ |
| 2025-01-27 | 1.0  | 초안 작성 | 10년차 선임 개발자 |
