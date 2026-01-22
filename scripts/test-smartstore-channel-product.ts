/**
 * @file scripts/test-smartstore-channel-product.ts
 * @description 스마트스토어 채널상품 조회 테스트 스크립트
 *
 * 실행:
 * - CHANNEL_PRODUCT_NO=12510492005 pnpm tsx scripts/test-smartstore-channel-product.ts
 *
 * 결과:
 * - tmp/channel-product-<CHANNEL_PRODUCT_NO>.json 저장
 */

import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { getSmartStoreApiClient } from "../lib/utils/smartstore-api";

function ensureEnv(name: string, value?: string) {
  if (!value) {
    throw new Error(`환경 변수 누락: ${name}`);
  }
  return value;
}

function getOriginProductNoFromResponse(response: unknown): number | undefined {
  if (!response || typeof response !== "object") return undefined;
  const candidate = response as Record<string, unknown>;
  if (typeof candidate.originProductNo === "number") return candidate.originProductNo;
  const originProduct = candidate.originProduct as Record<string, unknown> | undefined;
  if (!originProduct) return undefined;
  const originProductNo = originProduct.originProductNo;
  return typeof originProductNo === "number" ? originProductNo : undefined;
}

async function main() {
  const argChannelProductNo = process.argv[2];
  const channelProductNo =
    argChannelProductNo ||
    ensureEnv("CHANNEL_PRODUCT_NO", process.env.CHANNEL_PRODUCT_NO);

  console.log("🚀 채널상품 조회 테스트 시작");
  console.log("[INFO] channelProductNo:", channelProductNo);

  const apiClient = getSmartStoreApiClient();
  const rawResult = await apiClient.getChannelProductRaw(channelProductNo);

  if (!rawResult) {
    throw new Error("채널상품 조회 실패 (SmartStore API 응답 확인 필요)");
  }

  const responseData = rawResult.data;
  const originProductNo = getOriginProductNoFromResponse(responseData);
  const optionInfo =
    responseData.originProduct?.detailAttribute?.optionInfo ?? null;
  const options = apiClient.extractOptionStocks(responseData);
  const hasOptions = options.length > 0;
  const useStockManagement = optionInfo?.useStockManagement ?? false;
  const usedSource =
    useStockManagement && hasOptions ? "sum_options" : "single_field";

  const outputDir = path.join(process.cwd(), "tmp");
  const outputPath = path.join(
    outputDir,
    `channel-product-${channelProductNo}.json`,
  );

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(responseData, null, 2), "utf-8");

  console.log("[INFO] originProductNo:", originProductNo ?? "unknown");
  console.log("[INFO] optionInfo.useStockManagement:", useStockManagement);
  console.log("[INFO] options.exists:", hasOptions);
  console.log("[INFO] options.count:", options.length);
  console.log("[INFO] stock_source:", usedSource);
  console.log("✅ 저장 완료:", outputPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ 실패:", message);
  process.exit(1);
});
