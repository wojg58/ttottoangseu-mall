/**
 * @file lib/utils/smartstore-api.ts
 * @description 네이버 스마트스토어 API 연동 유틸리티
 *
 * 주요 기능:
 * 1. 네이버 스마트스토어 API 인증 (OAuth 2.0)
 * 2. 상품 재고 조회
 * 3. 상품 목록 조회
 *
 * @dependencies
 * - 네이버 스마트스토어 API 키 및 시크릿
 *
 * 참고: 네이버 스마트스토어 API 문서
 * https://developers.naver.com/docs/serviceapi/smartstore/smartstore.md
 */

import { logger } from "@/lib/logger";

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
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

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
   * OAuth 2.0 액세스 토큰 발급
   */
  private async getAccessToken(): Promise<string> {
    // 토큰이 아직 유효한 경우 재사용
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    logger.group("[SmartStoreAPI] 액세스 토큰 발급 중...");

    try {
      const response = await fetch(
        "https://api.commerce.naver.com/oauth2/v1/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.clientId,
            client_secret: this.clientSecret,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[SmartStoreAPI] 토큰 발급 실패", {
          status: response.status,
          error: errorText,
        });
        throw new Error(`토큰 발급 실패: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // 토큰 만료 시간 설정 (기본 1시간, 여유있게 50분으로 설정)
      this.tokenExpiresAt = Date.now() + (data.expires_in - 600) * 1000;

      logger.info("[SmartStoreAPI] 토큰 발급 성공");
      logger.groupEnd();
      return this.accessToken;
    } catch (error) {
      logger.error("[SmartStoreAPI] 토큰 발급 예외", error);
      logger.groupEnd();
      throw error;
    }
  }

  /**
   * 상품 재고 조회 (단일 상품)
   */
  async getProductStock(productId: string): Promise<number | null> {
    logger.group(`[SmartStoreAPI] 상품 재고 조회: ${productId}`);

    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `https://api.commerce.naver.com/products/${productId}/stock`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
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
      const token = await this.getAccessToken();
      const response = await fetch(
        `https://api.commerce.naver.com/products/${productId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
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
      const token = await this.getAccessToken();
      const response = await fetch(
        `https://api.commerce.naver.com/products?page=${page}&size=${pageSize}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
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




