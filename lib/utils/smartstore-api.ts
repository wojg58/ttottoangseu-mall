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

// 네이버 스마트스토어 API 클라이언트
export class SmartStoreApiClient {
  private clientId: string;
  private clientSecret: string;
  // 토큰 캐싱 (중요!)
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.NAVER_SMARTSTORE_CLIENT_ID || "";
    this.clientSecret = process.env.NAVER_SMARTSTORE_CLIENT_SECRET || "";

    if (!this.clientId || !this.clientSecret) {
      logger.warn(
        "[SmartStoreAPI] 네이버 스마트스토어 API 키가 설정되지 않았습니다.",
      );
    }
  }

  /**
   * OAuth 2.0 액세스 토큰 발급 (캐싱 + bcrypt 서명 포함)
   */
  private async getAccessToken(): Promise<string> {
    // 1. 캐시된 토큰이 유효하면 재사용
    if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
      logger.info("[SmartStoreAPI] 캐시된 토큰 재사용");
      return this.cachedToken;
    }

    logger.group("[SmartStoreAPI] 액세스 토큰 발급 중...");

    try {
      // 2. bcrypt 서명 생성
      const timestamp = Date.now();
      const password = `${this.clientId}_${timestamp}`;

      // bcrypt 서명 생성 (CLIENT_SECRET을 salt로 사용)
      const hashed = bcrypt.hashSync(password, this.clientSecret);
      const signature = Buffer.from(hashed, "utf-8").toString("base64");

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
          error: errorText,
        });
        throw new Error(`토큰 발급 실패: ${response.status}`);
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
      logger.warn("[SmartStoreAPI] 401 발생, 토큰 재발급 후 재시도");
      this.cachedToken = null; // 캐시 무효화
      return this.fetchWithRetry(url, options, true);
    }

    return response;
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
   * 상품 정보 조회 (단일 상품)
   */
  async getProduct(productId: string): Promise<SmartStoreProduct | null> {
    logger.group(`[SmartStoreAPI] 상품 정보 조회: ${productId}`);

    try {
      const response = await this.fetchWithRetry(
        `${BASE_URL}/v1/products/${productId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[SmartStoreAPI] 상품 정보 조회 실패", {
          productId,
          status: response.status,
          error: errorText,
        });
        logger.groupEnd();
        return null;
      }

      const data: SmartStoreApiResponse<SmartStoreProduct> =
        await response.json();

      if (data.code !== "SUCCESS") {
        logger.error("[SmartStoreAPI] 상품 정보 조회 실패", {
          productId,
          code: data.code,
          message: data.message,
        });
        logger.groupEnd();
        return null;
      }

      logger.info("[SmartStoreAPI] 상품 정보 조회 성공", data.data);
      logger.groupEnd();
      return data.data;
    } catch (error) {
      logger.error("[SmartStoreAPI] 상품 정보 조회 예외", error);
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
}

// 싱글톤 인스턴스
let apiClient: SmartStoreApiClient | null = null;

export function getSmartStoreApiClient(): SmartStoreApiClient {
  if (!apiClient) {
    apiClient = new SmartStoreApiClient();
  }
  return apiClient;
}




