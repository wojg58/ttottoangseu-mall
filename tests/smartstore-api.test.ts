/**
 * @file tests/smartstore-api.test.ts
 * @description 스마트스토어 재고 파싱 유틸리티 테스트
 *
 * 주요 기능:
 * 1. 옵션 재고 합산 모드 검증
 * 2. 단일 재고 필드 모드 검증
 * 3. 재고 정보 누락 시 에러 처리 검증
 *
 * @dependencies
 * - vitest: 테스트 러너
 * - lib/utils/smartstore-api.ts: deriveStocks 함수
 */

import { describe, expect, it } from "vitest";
import type {
  SmartStoreOptionInfo,
  SmartStoreProductWithOptions,
} from "@/lib/utils/smartstore-api";
import { deriveStocks } from "@/lib/utils/smartstore-api";

const baseOptionInfo: SmartStoreOptionInfo = {
  optionSimple: [],
  optionCustom: [],
  optionCombinations: [],
  optionStandards: [],
  useStockManagement: false,
  optionDeliveryAttributes: [],
};

function createChannelProduct(
  overrides: Partial<SmartStoreProductWithOptions>,
): SmartStoreProductWithOptions {
  return {
    channelProductNo: 123,
    name: "테스트 상품",
    stockQuantity: 5,
    optionInfo: baseOptionInfo,
    ...overrides,
  };
}

describe("deriveStocks", () => {
  it("옵션 재고 합산 모드에서 옵션 재고를 합산한다", () => {
    const optionInfo: SmartStoreOptionInfo = {
      ...baseOptionInfo,
      useStockManagement: true,
      optionStandards: [
        {
          id: 10,
          stockQuantity: 3,
          price: 0,
          usable: true,
          optionName1: "옵션A",
        },
        {
          id: 11,
          stockQuantity: 2,
          price: 0,
          usable: true,
          optionName1: "옵션B",
        },
      ],
    };

    const channelProduct = createChannelProduct({
      optionInfo,
      stockQuantity: 999,
    });

    const result = deriveStocks(channelProduct);
    expect(result.mode).toBe("options_sum");
    expect(result.productStock).toBe(5);
    expect(result.options?.length).toBe(2);
  });

  it("옵션 재고가 없으면 단일 재고 필드를 사용한다", () => {
    const channelProduct = createChannelProduct({
      optionInfo: {
        ...baseOptionInfo,
        useStockManagement: false,
      },
      stockQuantity: 7,
    });

    const result = deriveStocks(channelProduct);
    expect(result.mode).toBe("single");
    expect(result.productStock).toBe(7);
    expect(result.options).toBeUndefined();
  });

  it("재고 정보가 없으면 에러를 발생시킨다", () => {
    const channelProduct = createChannelProduct({
      stockQuantity: undefined,
    });

    expect(() => deriveStocks(channelProduct)).toThrow(
      "채널 상품 응답에 재고 정보가 없습니다",
    );
  });
});
