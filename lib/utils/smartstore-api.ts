/**
 * @file lib/utils/smartstore-api.ts
 * @description 네이버 스마트스토어 API 연동 유틸리티
 *
 * 주요 기능:
 * 1. 네이버 스마트스토어 API 인증 (OAuth 2.0 with bcrypt 서명)
 * 2. 토큰 캐싱 (메모리 기반, 만료 10분 전까지 유효)
 * 3. API 호출 재시도 (401 시 토큰 재발급 후 1회 재시도)
 * 4. 상품 재고 조회
 * 5. 상품 목록 조회
 *
 * @dependencies
 * - bcrypt: 네이버 API 인증 서명 생성
 * - 네이버 스마트스토어 API 키 및 시크릿
 *
 * 참고: 네이버 스마트스토어 API 문서
 * https://apicenter.commerce.naver.com/docs/auth
 */

import { logger } from "@/lib/logger";
import bcrypt from "bcrypt";

// 네이버 스마트스토어 API 기본 URL
export const BASE_URL = "https://api.commerce.naver.com/external";

const LOGIN_CLIENT_ID_KEYS = [
  "NAVER_LOGIN_CLIENT_ID",
  "NAVER_OAUTH_CLIENT_ID",
  "NAVER_SOCIAL_CLIENT_ID",
  "NAVER_CLIENT_ID",
] as const;

function normalizeEnvValue(value: string) {
  return value
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
}

function describeEnvValue(value: string) {
  const normalized = normalizeEnvValue(value);
  return {
    length: normalized.length,
    prefix: normalized.slice(0, 4),
    suffix: normalized.slice(-4),
  };
}

function getCommonPrefixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[count] === b[count]) count += 1;
  return count;
}

function getCommonSuffixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[a.length - 1 - count] === b[b.length - 1 - count]) {
    count += 1;
  }
  return count;
}

function warnIfLoginKeySuspected(clientId: string) {
  const normalized = normalizeEnvValue(clientId);
  const matchedEnvKeys: string[] = [];

  for (const key of LOGIN_CLIENT_ID_KEYS) {
    const candidate = process.env[key];
    if (!candidate) continue;
    const candidateNormalized = normalizeEnvValue(candidate);
    const sameValue = candidateNormalized === normalized;
    const prefixMatch =
      getCommonPrefixLength(candidateNormalized, normalized) >= 6;
    const suffixMatch =
      getCommonSuffixLength(candidateNormalized, normalized) >= 4;
    if (sameValue || (prefixMatch && suffixMatch)) {
      matchedEnvKeys.push(key);
    }
  }

  if (matchedEnvKeys.length > 0) {
    const info = describeEnvValue(clientId);
    logger.warn(
      "[SmartStoreAPI] client_id가 네이버 로그인(OAuth) 키와 유사해 보입니다.",
      {
        matchedEnvKeys,
        clientIdLength: info.length,
        clientIdPrefix: info.prefix,
        clientIdSuffix: info.suffix,
      },
    );
  }
}

function toBase64Url(value: string) {
  const base64 = Buffer.from(value, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// 네이버 스마트스토어 API 응답 타입
export interface SmartStoreProduct {
  productId: string; // 상품 ID
  name: string; // 상품명
  stockQuantity: number; // 재고 수량
  saleStatus: "SALE" | "SUSPENSION" | "OUTOFSTOCK"; // 판매 상태
  salePrice: number; // 판매가
  discountPrice?: number; // 할인가
}

export interface SmartStoreApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

// 실제 API 응답 구조 기반 타입 정의 (tmp/channel-product.json 참고)
export interface SmartStoreOptionStock {
  id: number; // 옵션 ID
  stockQuantity: number; // 해당 옵션 재고
  price: number; // 가격 조정
  usable: boolean; // 사용 가능 여부
  optionName1: string; // 옵션값1 (예: "페어리요정")
  optionName2?: string; // 옵션값2 (2단계 옵션인 경우, 현재 예시에는 없음)
  sellerManagerCode?: string; // 판매자 관리코드 (=SKU, 현재 예시에는 없음)
}

export interface SmartStoreOptionInfo {
  simpleOptionSortType?: string;
  optionSimple: SmartStoreOptionStock[];
  optionCustom: unknown[];
  optionCombinationSortType?: string;
  optionCombinationGroupNames?: {
    optionGroupName1?: string;
  };
  optionCombinations: SmartStoreOptionStock[];
  standardOptionGroups: unknown[];
  optionStandards: SmartStoreOptionStock[];
  useStockManagement: boolean;
  optionDeliveryAttributes: unknown[];
}

export interface SmartStoreChannelProductResponse {
  originProduct: {
    statusType: string;
    saleType: string;
    leafCategoryId: string;
    name: string;
    detailContent: string;
    images: {
      representativeImage: { url: string };
      optionalImages: Array<{ url: string }>;
    };
    salePrice: number;
    stockQuantity: number;
    deliveryInfo: unknown;
    detailAttribute: {
      naverShoppingSearchInfo: unknown;
      afterServiceInfo: unknown;
      originAreaInfo: unknown;
      optionInfo: SmartStoreOptionInfo;
      [key: string]: unknown;
    };
    customerBenefit: unknown;
  };
  smartstoreChannelProduct: {
    channelProductName: string;
    storeKeepExclusiveProduct: boolean;
    naverShoppingRegistration: boolean;
    channelProductDisplayStatusType: string;
  };
}

export interface SmartStoreChannelProductApiResult {
  data: SmartStoreChannelProductResponse;
  responseText: string;
  status: number;
  statusText: string;
}

// 채널 상품 조회 결과를 위한 정규화된 타입
export interface SmartStoreProductWithOptions {
  originProductNo?: number; // 원상품 번호 (재고 수정 시 필요, 응답에서 직접 확인 불가)
  channelProductNo: number; // 채널상품 번호 (API 엔드포인트에서 사용한 값)
  name: string;
  stockQuantity?: number; // 원상품 재고 수량 (채널상품 조회 응답에서 추출)
  optionInfo?: SmartStoreOptionInfo;
  statusType?: string; // 원상품 상태 (종료/판매중지 확인용)
  channelProductDisplayStatusType?: string; // 채널상품 표시 상태 (종료/판매중지 확인용)
}

// 네이버 스마트스토어 API 클라이언트
export class SmartStoreApiClient {
  private clientId: string;
  private clientSecret: string;
  // 토큰 캐싱 (중요!)
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt: number = 0;

  constructor() {
    this.clientId =
      process.env.NAVER_COMMERCE_CLIENT_ID ||
      process.env.NAVER_SMARTSTORE_CLIENT_ID ||
      "";
    this.clientSecret =
      process.env.NAVER_COMMERCE_CLIENT_SECRET ||
      process.env.NAVER_SMARTSTORE_CLIENT_SECRET ||
      "";

    if (!this.clientId || !this.clientSecret) {
      logger.warn(
        "[SmartStoreAPI] 네이버 스마트스토어 API 키가 설정되지 않았습니다.",
      );
    }

    if (this.clientId) {
      warnIfLoginKeySuspected(this.clientId);
    }
  }

  /**
   * OAuth 2.0 액세스 토큰 발급 (캐싱 + bcrypt 서명 포함)
   */
  private async getAccessToken(): Promise<string> {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "lib/utils/smartstore-api.ts:getAccessToken:entry",
        message: "토큰 발급 시작 (환경 변수 존재 여부)",
        data: {
          clientIdPresent: !!this.clientId,
          clientSecretPresent: !!this.clientSecret,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    // 1. 캐시된 토큰이 유효하면 재사용
    if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
      logger.info("[SmartStoreAPI] 캐시된 토큰 재사용");
      return this.cachedToken;
    }

    logger.group("[SmartStoreAPI] 액세스 토큰 발급 중...");

    try {
      const timestamp = Date.now();
      const password = `${this.clientId}_${timestamp}`;
      const clientIdLength = this.clientId.length;
      const clientSecretLength = this.clientSecret.length;
      const clientIdPrefix = this.clientId.slice(0, 4);
      const clientIdSuffix = this.clientId.slice(-4);
      const clientSecretPrefix = this.clientSecret.slice(0, 4);
      const clientSecretSuffix = this.clientSecret.slice(-4);

      let hashed: string;
      try {
        logger.info(
          "[SmartStoreAPI] 공식 문서 Node.js 예제 확인: bcrypt hash + base64",
        );
        hashed = bcrypt.hashSync(password, this.clientSecret);
      } catch (error) {
        logger.error("[SmartStoreAPI] 서명 생성 실패", {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
          clientSecretPrefix: this.clientSecret.slice(0, 4),
          clientSecretLength: this.clientSecret.length,
        });
        throw error;
      }
      const signature =
        typeof Buffer.from(hashed, "utf-8").toString === "function"
          ? Buffer.from(hashed, "utf-8").toString("base64url")
          : toBase64Url(hashed);
      const hashedPrefix = hashed.slice(0, 4);
      const hashedSuffix = hashed.slice(-4);
      const signaturePrefix = signature.slice(0, 4);
      const signatureSuffix = signature.slice(-4);

      logger.info("[SmartStoreAPI] 서명 생성 완료", {
        timestamp,
        signatureLength: signature.length,
      });

      // ⚠️ 중요: form-urlencoded로 전송! (JSON 아님)
      const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          timestamp: timestamp.toString(),
          client_secret_sign: signature,
          grant_type: "client_credentials",
          type: "SELF",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[SmartStoreAPI] 토큰 발급 실패", {
          status: response.status,
          statusText: response.statusText,
          responseText: errorText,
          url: `${BASE_URL}/v1/oauth2/token`,
        });
        throw new Error(
          `토큰 발급 실패: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();

      // 3. 캐시 저장 (만료 10분 전까지 유효)
      this.cachedToken = data.access_token;
      this.cachedTokenExpiresAt =
        Date.now() + (data.expires_in - 600) * 1000;

      logger.info("[SmartStoreAPI] 토큰 발급 성공", {
        expiresIn: data.expires_in,
        tokenType: data.token_type,
      });
      logger.groupEnd();
      return this.cachedToken;
    } catch (error) {
      logger.error("[SmartStoreAPI] 토큰 발급 예외", error);
      logger.groupEnd();
      throw error;
    }
  }

  /**
   * API 호출 래퍼 (401 시 토큰 재발급 + 1회 재시도)
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retried = false,
  ): Promise<Response> {
    try {
      const token = await this.getAccessToken();
      
      if (!token) {
        logger.error("[SmartStoreAPI] 토큰이 없습니다");
        throw new Error("SmartStore API 토큰 발급 실패");
      }

      logger.debug("[SmartStoreAPI] API 호출", {
        url,
        method: options.method || "GET",
        hasToken: !!token,
        tokenLength: token.length,
      });

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      // 401 Unauthorized → 토큰 재발급 후 1회만 재시도
      if (response.status === 401 && !retried) {
        logger.warn("[SmartStoreAPI] 401 발생, 토큰 재발급 후 재시도", {
          url,
          status: response.status,
        });
        this.cachedToken = null; // 캐시 무효화
        return this.fetchWithRetry(url, options, true);
      }

      return response;
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H5",
          location: "lib/utils/smartstore-api.ts:fetchWithRetry:catch",
          message: "fetchWithRetry 예외 발생",
          data: {
            url,
            retried,
            error: error instanceof Error ? error.message : "알 수 없는 오류",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      logger.error("[SmartStoreAPI] fetchWithRetry 예외", {
        url,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 상품 재고 조회 (단일 상품)
   */
  async getProductStock(productId: string): Promise<number | null> {
    logger.group(`[SmartStoreAPI] 상품 재고 조회: ${productId}`);

    try {
      const response = await this.fetchWithRetry(
        `${BASE_URL}/v1/products/${productId}/stock`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[SmartStoreAPI] 재고 조회 실패", {
          productId,
          status: response.status,
          error: errorText,
        });
        logger.groupEnd();
        return null;
      }

      const data: SmartStoreApiResponse<{ quantity: number }> =
        await response.json();

      if (data.code !== "SUCCESS") {
        logger.error("[SmartStoreAPI] 재고 조회 실패", {
          productId,
          code: data.code,
          message: data.message,
        });
        logger.groupEnd();
        return null;
      }

      logger.info(`[SmartStoreAPI] 재고 조회 성공: ${data.data.quantity}개`);
      logger.groupEnd();
      return data.data.quantity;
    } catch (error) {
      logger.error("[SmartStoreAPI] 재고 조회 예외", error);
      logger.groupEnd();
      return null;
    }
  }

  /**
   * 상품 정보 조회 (단일 상품) - 원상품 번호용
   * 
   * @param productId 원상품 번호 (originProductNo)
   * @returns 상품 정보 또는 null
   */
  async getProduct(productId: string): Promise<SmartStoreProduct | null> {
    const apiUrl = `${BASE_URL}/v1/products/${productId}`;
    logger.group(`[SmartStoreAPI] 상품 정보 조회 (원상품 번호용): ${productId}`);
    logger.info("[SmartStoreAPI] API 호출 시작", {
      endpoint: "GET /v1/products/{productId}",
      url: apiUrl,
      productId,
      note: "이 API는 원상품 번호(originProductNo)를 사용합니다",
    });

    try {
      const response = await this.fetchWithRetry(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // 응답 상태 코드 및 본문 상세 로깅
      const responseStatus = response.status;
      const responseStatusText = response.statusText;
      let responseBody: string | object = "";
      let responseBodySummary = "";

      try {
        responseBody = await response.text();
        responseBodySummary = responseBody.length > 500 
          ? responseBody.substring(0, 500) + "..." 
          : responseBody;
        
        // JSON 파싱 시도
        try {
          responseBody = JSON.parse(responseBody);
        } catch {
          // JSON이 아니면 텍스트로 유지
        }
      } catch (e) {
        responseBodySummary = "응답 본문 읽기 실패";
      }

      logger.info("[SmartStoreAPI] API 응답 수신", {
        status: responseStatus,
        statusText: responseStatusText,
        ok: response.ok,
        responseBodySummary: typeof responseBody === "string" 
          ? responseBodySummary 
          : JSON.stringify(responseBody).substring(0, 500),
      });

      if (!response.ok) {
        const errorDetails = {
          productId,
          endpoint: "GET /v1/products/{productId}",
          url: apiUrl,
          status: responseStatus,
          statusText: responseStatusText,
          responseBody: responseBodySummary,
          error: typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody),
        };
        logger.error("[SmartStoreAPI] 상품 정보 조회 실패 (HTTP 에러)", errorDetails);
        logger.groupEnd();
        return null;
      }

      const data: SmartStoreApiResponse<SmartStoreProduct> =
        typeof responseBody === "object" ? responseBody : JSON.parse(responseBody as string);

      if (data.code !== "SUCCESS") {
        const errorDetails = {
          productId,
          endpoint: "GET /v1/products/{productId}",
          url: apiUrl,
          code: data.code,
          message: data.message,
          responseData: data,
        };
        logger.error("[SmartStoreAPI] 상품 정보 조회 실패 (API 에러)", errorDetails);
        logger.groupEnd();
        return null;
      }

      logger.info("[SmartStoreAPI] 상품 정보 조회 성공", {
        productId,
        endpoint: "GET /v1/products/{productId}",
        stockQuantity: data.data.stockQuantity,
        saleStatus: data.data.saleStatus,
        name: data.data.name,
      });
      logger.groupEnd();
      return data.data;
    } catch (error) {
      const errorDetails = {
        productId,
        endpoint: "GET /v1/products/{productId}",
        url: apiUrl,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        stack: error instanceof Error ? error.stack : undefined,
      };
      logger.error("[SmartStoreAPI] 상품 정보 조회 예외", errorDetails);
      logger.groupEnd();
      return null;
    }
  }

  /**
   * 상품 목록 조회 (페이지네이션)
   */
  async getProducts(
    page: number = 1,
    pageSize: number = 100,
  ): Promise<SmartStoreProduct[]> {
    logger.group(`[SmartStoreAPI] 상품 목록 조회: 페이지 ${page}`);

    try {
      const response = await this.fetchWithRetry(
        `${BASE_URL}/v1/products?page=${page}&size=${pageSize}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[SmartStoreAPI] 상품 목록 조회 실패", {
          page,
          status: response.status,
          error: errorText,
        });
        logger.groupEnd();
        return [];
      }

      const data: SmartStoreApiResponse<{
        totalCount: number;
        products: SmartStoreProduct[];
      }> = await response.json();

      if (data.code !== "SUCCESS") {
        logger.error("[SmartStoreAPI] 상품 목록 조회 실패", {
          page,
          code: data.code,
          message: data.message,
        });
        logger.groupEnd();
        return [];
      }

      logger.info(
        `[SmartStoreAPI] 상품 목록 조회 성공: ${data.data.products.length}개`,
      );
      logger.groupEnd();
      return data.data.products;
    } catch (error) {
      logger.error("[SmartStoreAPI] 상품 목록 조회 예외", error);
      logger.groupEnd();
      return [];
    }
  }

  /**
   * 채널 상품 원본 응답 조회 (옵션 정보 포함)
   *
   * @param channelProductNo 채널상품 번호 (products.smartstore_product_id 값)
   * @returns 채널 상품 원본 응답 또는 null
   */
  async getChannelProductRaw(
    channelProductNo: string,
  ): Promise<SmartStoreChannelProductApiResult | null> {
    const apiUrl = `${BASE_URL}/v2/products/channel-products/${channelProductNo}`;
    logger.group(`[SmartStoreAPI] 채널 상품 원본 조회: ${channelProductNo}`);
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "lib/utils/smartstore-api.ts:getChannelProductRaw:entry",
        message: "채널 상품 원본 조회 시작",
        data: { channelProductNo, apiUrl },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    logger.info("[SmartStoreAPI] API 호출 시작", {
      endpoint: "GET /v2/products/channel-products/{channelProductNo}",
      url: apiUrl,
      channelProductNo,
      note: "이 API는 채널상품 번호(channelProductNo)를 사용합니다",
    });

    try {
      const response = await this.fetchWithRetry(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseText = await response.text();
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "lib/utils/smartstore-api.ts:getChannelProductRaw:response",
          message: "채널 상품 응답 수신",
          data: {
            channelProductNo,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            responseTextLength: responseText.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      const responseSummary =
        responseText.length > 500
          ? `${responseText.substring(0, 500)}...`
          : responseText;

      logger.info("[SmartStoreAPI] API 응답 수신", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        responseBodySummary: responseSummary,
      });

      if (!response.ok) {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H3",
            location: "lib/utils/smartstore-api.ts:getChannelProductRaw:http-error",
            message: "채널 상품 HTTP 에러",
            data: {
              channelProductNo,
              status: response.status,
              statusText: response.statusText,
              responseTextPreview: responseText.substring(0, 200),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log
        logger.error("[SmartStoreAPI] 채널 상품 조회 실패 (HTTP 에러)", {
          channelProductNo,
          endpoint: "GET /v2/products/channel-products/{channelProductNo}",
          url: apiUrl,
          status: response.status,
          statusText: response.statusText,
          responseText,
        });
        logger.groupEnd();
        return null;
      }

      let data: SmartStoreChannelProductResponse;
      try {
        data = JSON.parse(responseText) as SmartStoreChannelProductResponse;
      } catch (error) {
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H4",
            location: "lib/utils/smartstore-api.ts:getChannelProductRaw:parse-error",
            message: "채널 상품 JSON 파싱 실패",
            data: {
              channelProductNo,
              responseTextPreview: responseText.substring(0, 200),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log
        logger.error("[SmartStoreAPI] 채널 상품 응답 JSON 파싱 실패", {
          channelProductNo,
          responseText: responseSummary,
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
        logger.groupEnd();
        return null;
      }

      logger.groupEnd();
      return {
        data,
        responseText,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/4cdb12f7-9503-41e2-9643-35fd98685c1a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "lib/utils/smartstore-api.ts:getChannelProductRaw:catch",
          message: "채널 상품 원본 조회 예외",
          data: {
            channelProductNo,
            error: error instanceof Error ? error.message : "알 수 없는 오류",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      logger.error("[SmartStoreAPI] 채널 상품 원본 조회 예외", {
        channelProductNo,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        stack: error instanceof Error ? error.stack : undefined,
      });
      logger.groupEnd();
      return null;
    }
  }

  /**
   * 채널 상품 조회 (옵션 정보 포함)
   * 
   * @param channelProductNo 채널상품 번호 (products.smartstore_product_id 값)
   * @returns 채널 상품 정보 (옵션 포함) 또는 null
   */
  async getChannelProduct(
    channelProductNo: string,
  ): Promise<SmartStoreProductWithOptions | null> {
    logger.group(`[SmartStoreAPI] 채널 상품 조회: ${channelProductNo}`);
    try {
      const rawResult = await this.getChannelProductRaw(channelProductNo);
      if (!rawResult) {
        logger.groupEnd();
        return null;
      }

      const data = rawResult.data;
      // originProductNo 추출 시도 (응답 구조에 따라 다를 수 있음)
      // 채널 상품 조회 응답에서 직접 가져올 수 없으면 원상품 조회 API 호출 필요
      let originProductNo: number | undefined = undefined;

      // 응답 구조 확인: data.originProductNo 또는 data.originProduct.originProductNo 등
      if ((data as any).originProductNo) {
        originProductNo = (data as any).originProductNo;
      } else if ((data.originProduct as any).originProductNo) {
        originProductNo = (data.originProduct as any).originProductNo;
      }

      // 응답을 정규화된 형태로 변환
      const normalized: SmartStoreProductWithOptions = {
        channelProductNo: parseInt(channelProductNo, 10),
        name: data.originProduct.name,
        stockQuantity: data.originProduct.stockQuantity, // 원상품 재고 수량
        optionInfo: data.originProduct.detailAttribute.optionInfo,
        originProductNo: originProductNo,
        // 상품 상태 정보 추가 (종료/판매중지 확인용)
        statusType: data.originProduct.statusType,
        channelProductDisplayStatusType: data.smartstoreChannelProduct.channelProductDisplayStatusType,
      };

      logger.info("[SmartStoreAPI] 채널 상품 조회 성공", {
        channelProductNo: normalized.channelProductNo,
        originProductNo: normalized.originProductNo,
        name: normalized.name,
        hasOptions: !!normalized.optionInfo,
        useStockManagement:
          normalized.optionInfo?.useStockManagement ?? false,
        optionCount: normalized.optionInfo
          ? (normalized.optionInfo.optionStandards.length +
            normalized.optionInfo.optionCombinations.length +
            normalized.optionInfo.optionSimple.length)
          : 0,
      });
      logger.groupEnd();
      return normalized;
    } catch (error) {
      const errorDetails = {
        channelProductNo,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        stack: error instanceof Error ? error.stack : undefined,
      };
      logger.error("[SmartStoreAPI] 채널 상품 조회 예외", errorDetails);
      logger.groupEnd();
      return null;
    }
  }

  /**
   * 옵션별 재고 목록 추출
   * 
   * @param source 채널 상품 정보 또는 채널 상품 원본 응답
   * @returns 사용 가능한 옵션별 재고 목록
   */
  extractOptionStocks(
    source: SmartStoreProductWithOptions | SmartStoreChannelProductResponse,
  ): SmartStoreOptionStock[] {
    const channelProductNo =
      "channelProductNo" in source
        ? source.channelProductNo
        : undefined;
    const productName =
      "name" in source
        ? source.name
        : source.originProduct?.name;
    const optionInfo =
      "originProduct" in source
        ? source.originProduct?.detailAttribute?.optionInfo
        : source.optionInfo;

    if (!optionInfo || !optionInfo.useStockManagement) {
      logger.warn("[SmartStoreAPI] 재고관리 미사용 상품", {
        channelProductNo,
        name: productName,
      });
      return [];
    }

    // 표준형 > 조합형 > 단독형 순으로 확인
    const options =
      optionInfo.optionStandards.length > 0
        ? optionInfo.optionStandards
        : optionInfo.optionCombinations.length > 0
          ? optionInfo.optionCombinations
          : optionInfo.optionSimple.length > 0
            ? optionInfo.optionSimple
            : [];

    // usable이 false인 옵션 제외
    const usableOptions = options.filter(
      (opt) => opt.usable !== false,
    );

    logger.info("[SmartStoreAPI] 옵션 추출 완료", {
      channelProductNo,
      totalOptions: options.length,
      usableOptions: usableOptions.length,
    });

    return usableOptions;
  }
}

// 싱글톤 인스턴스
let apiClient: SmartStoreApiClient | null = null;

export function getSmartStoreApiClient(): SmartStoreApiClient {
  if (!apiClient) {
    apiClient = new SmartStoreApiClient();
  }
  return apiClient;
}




