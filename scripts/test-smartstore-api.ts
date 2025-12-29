/**
 * 스마트스토어 API 연동 테스트 스크립트
 *
 * 목적: 네이버 스마트스토어 API의 실제 응답 구조를 확인하기 위한 테스트
 *
 * 실행 방법:
 *   pnpm tsx scripts/test-smartstore-api.ts
 *
 * 또는:
 *   npx tsx scripts/test-smartstore-api.ts
 *
 * 결과:
 *   - tmp/channel-product.json 파일에 실제 API 응답이 저장됩니다
 *   - 이 파일을 열어서 optionInfo 구조를 확인하세요
 */

// .env 파일 로드 (가장 먼저 실행)
import "dotenv/config";

import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";

// 환경 변수 확인
const CLIENT_ID = process.env.NAVER_SMARTSTORE_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_SMARTSTORE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ 환경 변수가 설정되지 않았습니다!");
  console.error("   .env 파일에 다음을 추가하세요:");
  console.error("   NAVER_SMARTSTORE_CLIENT_ID=your_client_id");
  console.error("   NAVER_SMARTSTORE_CLIENT_SECRET=your_client_secret");
  process.exit(1);
}

const BASE_URL = "https://api.commerce.naver.com/external";

/**
 * 1. 토큰 발급 테스트
 *
 * 네이버 스마트스토어 API는 bcrypt 서명을 사용한 인증 방식을 사용합니다.
 */
async function getAccessToken(): Promise<string> {
  console.log("🔐 토큰 발급 시도...");

  const timestamp = Date.now();
  const password = `${CLIENT_ID}_${timestamp}`;

  // bcrypt 서명 생성
  // 주의: 네이버 API는 CLIENT_SECRET을 salt로 사용합니다
  const hashed = bcrypt.hashSync(password, CLIENT_SECRET);
  const signature = Buffer.from(hashed, "utf-8").toString("base64");

  console.log("   - timestamp:", timestamp);
  console.log("   - password:", password);
  console.log("   - signature 생성 완료");

  // ⚠️ 중요: form-urlencoded로 전송! (JSON 아님)
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      timestamp: timestamp.toString(),
      client_secret_sign: signature,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ 토큰 발급 실패:", response.status);
    console.error("   응답:", errorText);
    throw new Error(`토큰 발급 실패: ${response.status}`);
  }

  const data = await response.json();
  console.log("✅ 토큰 발급 성공!");
  console.log("   - expires_in:", data.expires_in, "초");
  console.log("   - token_type:", data.token_type);

  return data.access_token;
}

/**
 * 2. 채널 상품 조회 테스트
 *
 * 채널 상품 조회 API를 통해 옵션 정보를 포함한 상품 정보를 가져옵니다.
 */
async function getChannelProduct(token: string, channelProductNo: string) {
  console.log(`\n📦 채널 상품 조회 시도: ${channelProductNo}`);

  const response = await fetch(
    `${BASE_URL}/v2/products/channel-products/${channelProductNo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ 상품 조회 실패:", response.status);
    console.error("   응답:", errorText);
    throw new Error(`상품 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  console.log("✅ 상품 조회 성공!");
  console.log("   - 상품명:", data.name || data.productName || "N/A");
  console.log("   - 원상품 번호:", data.originProductNo || "N/A");
  console.log("   - 채널상품 번호:", data.channelProductNo || "N/A");

  return data;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log("🚀 스마트스토어 API 테스트 시작\n");
  console.log("=".repeat(60));

  try {
    // 1. 토큰 발급
    console.log("\n--- 1단계: 토큰 발급 테스트 ---");
    const token = await getAccessToken();

    // 2. 채널 상품 조회 (실제 상품 ID로 교체하세요!)
    console.log("\n--- 2단계: 채널 상품 조회 테스트 ---");

    // ⚠️ 중요: 실제 채널상품 번호로 교체하세요!
    const TEST_CHANNEL_PRODUCT_NO =
      process.env.TEST_CHANNEL_PRODUCT_NO || "YOUR_CHANNEL_PRODUCT_NO";

    if (TEST_CHANNEL_PRODUCT_NO === "YOUR_CHANNEL_PRODUCT_NO") {
      console.warn(
        "⚠️  TEST_CHANNEL_PRODUCT_NO 환경 변수가 설정되지 않았습니다.",
      );
      console.warn(
        "   .env 파일에 다음을 추가하거나, 스크립트 내의 값을 직접 수정하세요:",
      );
      console.warn("   TEST_CHANNEL_PRODUCT_NO=실제_채널상품번호");
      console.warn(
        "\n   또는 스마트스토어에서 연동된 상품의 채널상품 번호를 확인하세요.",
      );
      console.warn("   (products 테이블의 smartstore_product_id 컬럼 값)");
      return;
    }

    const product = await getChannelProduct(token, TEST_CHANNEL_PRODUCT_NO);

    // 3. 결과를 파일로 저장 (옵션 구조 확인용)
    const outputDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`\n📁 tmp 디렉토리 생성: ${outputDir}`);
    }

    const outputPath = path.join(outputDir, "channel-product.json");
    fs.writeFileSync(outputPath, JSON.stringify(product, null, 2), "utf-8");

    console.log(`\n📁 응답 저장됨: ${outputPath}`);
    console.log("\n⚠️  이 파일을 열어서 다음을 확인하세요:");
    console.log("   1. optionInfo 구조");
    console.log("      - optionStandards? (표준형 옵션)");
    console.log("      - optionCombinations? (조합형 옵션)");
    console.log("      - optionSimple? (단독형 옵션)");
    console.log("   2. sellerManagerCode 위치 (SKU 매핑용)");
    console.log("   3. originProductNo (재고 수정 시 필요)");
    console.log("   4. 각 옵션의 id, optionName1, optionName2, stockQuantity");

    // 옵션 정보 요약 출력
    if (product.optionInfo) {
      console.log("\n📊 옵션 정보 요약:");
      console.log(
        "   - 재고관리 사용:",
        product.optionInfo.useStockManagement ? "예" : "아니오",
      );

      const options =
        product.optionInfo.optionStandards ||
        product.optionInfo.optionCombinations ||
        product.optionInfo.optionSimple ||
        [];

      console.log("   - 옵션 개수:", options.length);
      if (options.length > 0) {
        console.log("   - 첫 번째 옵션 예시:");
        const firstOption = options[0];
        console.log("     * id:", firstOption.id);
        console.log("     * optionName1:", firstOption.optionName1);
        console.log("     * optionName2:", firstOption.optionName2 || "없음");
        console.log("     * stockQuantity:", firstOption.stockQuantity);
        console.log(
          "     * sellerManagerCode:",
          firstOption.sellerManagerCode || "없음",
        );
      }
    } else {
      console.log(
        "\n⚠️  optionInfo가 없습니다. 이 상품은 옵션이 없거나 옵션 정보가 포함되지 않았습니다.",
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ 테스트 완료!");
    console.log("\n다음 단계:");
    console.log("   1. tmp/channel-product.json 파일을 열어서 구조 확인");
    console.log("   2. Step 4에서 타입 정의를 실제 응답 구조에 맞게 수정");
    console.log("   3. Step 5에서 DB 마이그레이션 진행");
  } catch (error) {
    console.error("\n❌ 테스트 실패:", error);
    if (error instanceof Error) {
      console.error("   오류 메시지:", error.message);
    }
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(console.error);
