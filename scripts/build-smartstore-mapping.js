/**
 * scripts/build-smartstore-mapping.js
 * AWS EC2에서 실행할 스마트스토어 옵션 매핑 빌드 스크립트
 *
 * 목적: 스마트스토어 옵션 목록을 읽어서 우리 DB product_variants에 매핑 정보를 채워 넣는다.
 *
 * 실행 방법:
 *   node scripts/build-smartstore-mapping.js
 *
 * 또는 PM2로 실행:
 *   pm2 start scripts/build-smartstore-mapping.js --name "smartstore-mapping" --no-autorestart
 *   (1회 실행 후 종료되는 스크립트이므로 --no-autorestart 사용)
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");

// 환경변수 로드
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NAVER_CLIENT_ID = process.env.NAVER_SMARTSTORE_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_SMARTSTORE_CLIENT_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ 환경변수 누락!");
  process.exit(1);
}

if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
  console.error("❌ 네이버 API 인증 정보가 없습니다!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BASE_URL = "https://api.commerce.naver.com/external";

let accessToken = null;
let tokenExpiresAt = 0;

// 네이버 토큰 발급
async function getNaverToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    console.log("[INFO] 캐시된 토큰 재사용");
    return accessToken;
  }

  console.log("[INFO] 🔑 토큰 발급 중...");

  const timestamp = Date.now();
  const password = `${NAVER_CLIENT_ID}_${timestamp}`;

  // bcrypt 서명 생성
  const hashed = bcrypt.hashSync(password, NAVER_CLIENT_SECRET);
  const signature = Buffer.from(hashed, "utf-8").toString("base64");

  const tokenUrl = `${BASE_URL}/v1/oauth2/token`;

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: NAVER_CLIENT_ID,
        timestamp: timestamp.toString(),
        client_secret_sign: signature,
        grant_type: "client_credentials",
        type: "SELF",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `토큰 발급 실패: ${res.status} - ${errorText.substring(0, 200)}`,
      );
    }

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 600) * 1000; // 만료 10분 전까지 유효

    console.log("[INFO] ✅ 토큰 발급 성공");
    return accessToken;
  } catch (error) {
    console.error("[ERROR] ❌ 토큰 발급 실패:", error.message);
    throw error;
  }
}

// API 호출 래퍼 (401 시 토큰 재발급 + 1회 재시도)
async function fetchWithRetry(url, options, retried = false) {
  const token = await getNaverToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // 401 Unauthorized → 토큰 재발급 후 1회만 재시도
  if (response.status === 401 && !retried) {
    console.log("[WARN] 401 발생, 토큰 재발급 후 재시도");
    accessToken = null; // 캐시 무효화
    return fetchWithRetry(url, options, true);
  }

  return response;
}

// 채널 상품 조회
async function getChannelProduct(channelProductNo) {
  console.log(`[INFO] 📦 채널 상품 조회: ${channelProductNo}`);

  const response = await fetchWithRetry(
    `${BASE_URL}/v2/products/channel-products/${channelProductNo}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[ERROR] 채널 상품 조회 실패: ${response.status} - ${errorText.substring(
        0,
        200,
      )}`,
    );
    return null;
  }

  const data = await response.json();
  console.log(
    `[INFO] ✅ 채널 상품 조회 성공: ${data.originProduct?.name || "N/A"}`,
  );

  return data;
}

// 옵션별 재고 목록 추출
function extractOptionStocks(channelProductData) {
  const optionInfo =
    channelProductData.originProduct?.detailAttribute?.optionInfo;

  if (!optionInfo || !optionInfo.useStockManagement) {
    console.warn("[WARN] 재고관리 미사용 상품");
    return [];
  }

  // 표준형 > 조합형 > 단독형 순으로 확인
  const options = (
    optionInfo.optionStandards && optionInfo.optionStandards.length > 0
      ? optionInfo.optionStandards
      : optionInfo.optionCombinations &&
        optionInfo.optionCombinations.length > 0
      ? optionInfo.optionCombinations
      : optionInfo.optionSimple && optionInfo.optionSimple.length > 0
      ? optionInfo.optionSimple
      : []
  ).filter((opt) => opt.usable !== false);

  console.log(`[INFO] 옵션 추출: ${options.length}개`);
  return options;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 메인 실행 함수
async function buildMapping() {
  console.log("🚀 스마트스토어 옵션 매핑 빌드 시작\n");
  console.log("=".repeat(60));

  const result = {
    success: true,
    mappedCount: 0,
    failedCount: 0,
    unmappedOptions: [],
    processedProducts: 0,
    totalProducts: 0,
  };

  try {
    // 1. 스마트스토어 연동된 상품 조회
    console.log("\n[INFO] 📋 스마트스토어 연동 상품 조회 중...");
    const { data: products, error: findError } = await supabase
      .from("products")
      .select("id, name, smartstore_product_id")
      .not("smartstore_product_id", "is", null)
      .is("deleted_at", null);

    if (findError) {
      console.error("[ERROR] 상품 조회 실패:", findError);
      result.success = false;
      return result;
    }

    if (!products || products.length === 0) {
      console.log("[INFO] 매핑 대상 상품이 없습니다.");
      result.success = false;
      return result;
    }

    result.totalProducts = products.length;
    console.log(`[INFO] ✅ 매핑 대상 상품: ${products.length}개\n`);

    // 2. 각 상품의 옵션 매핑
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      result.processedProducts++;

      console.log(
        `\n[${i + 1}/${products.length}] 상품 처리: ${product.name} (${
          product.smartstore_product_id
        })`,
      );

      try {
        // 채널 상품 조회
        const channelProductData = await getChannelProduct(
          product.smartstore_product_id,
        );

        if (!channelProductData) {
          console.warn(`[WARN] 상품 조회 실패: ${product.name}`);
          result.failedCount++;
          continue;
        }

        const options = extractOptionStocks(channelProductData);

        if (options.length === 0) {
          console.log(`[INFO] 옵션이 없는 상품 (스킵)`);
          continue;
        }

        // channelProductNo는 API 엔드포인트에서 사용한 값
        const channelProductNo = parseInt(product.smartstore_product_id, 10);

        // originProductNo는 채널 상품 조회 응답에 직접 없을 수 있음
        // 재고 수정 시 필요하지만, 매핑 작업에서는 옵션 ID + 채널상품 번호로 충분
        // 나중에 재고 동기화 시 다른 API로 확인하거나, 매핑된 데이터로 역추적 가능
        const originProductNo = null; // 매핑 작업에서는 사용하지 않음 (재고 수정 시 필요)

        console.log(`[INFO] 옵션 ${options.length}개 매핑 시작...`);

        // 각 옵션별로 매핑
        for (const option of options) {
          // 매핑 우선순위:
          // 1. sellerManagerCode(SKU)로 매칭
          // 2. 옵션명 조합으로 매칭 (최후의 수단)

          let variant = null;

          // 1차: SKU로 매칭
          if (option.sellerManagerCode) {
            const { data } = await supabase
              .from("product_variants")
              .select("id, variant_value, sku")
              .eq("product_id", product.id)
              .eq("sku", option.sellerManagerCode)
              .is("deleted_at", null)
              .single();
            variant = data;

            if (variant) {
              console.log(
                `[INFO]   SKU 매칭 성공: ${option.sellerManagerCode} → ${variant.variant_value}`,
              );
            }
          }

          // 2차: 옵션명으로 매칭 (SKU 없을 때)
          if (!variant && option.optionName1) {
            const { data } = await supabase
              .from("product_variants")
              .select("id, variant_value, sku")
              .eq("product_id", product.id)
              .ilike("variant_value", `%${option.optionName1}%`)
              .is("deleted_at", null)
              .limit(1);

            if (data && data.length > 0) {
              variant = data[0];
              console.log(
                `[INFO]   옵션명 매칭 성공: ${option.optionName1} → ${variant.variant_value}`,
              );
            }
          }

          if (variant) {
            // 매핑 정보 저장
            // 주의: originProductNo는 재고 수정 시 필요하지만, 매핑 작업에서는
            // 옵션 ID + 채널상품 번호 조합으로도 충분히 매핑 가능
            const updateData = {
              smartstore_option_id: option.id,
              smartstore_channel_product_no: channelProductNo,
              // originProductNo는 나중에 재고 동기화 시 채워넣을 수 있음
            };

            const { error: updateError } = await supabase
              .from("product_variants")
              .update(updateData)
              .eq("id", variant.id);

            if (updateError) {
              console.error(
                `[ERROR] 매핑 정보 저장 실패: ${updateError.message}`,
              );
              result.failedCount++;
              result.unmappedOptions.push({
                productName: product.name,
                originProductNo: originProductNo || "N/A",
                optionId: option.id,
                optionName: option.optionName2
                  ? `${option.optionName1}/${option.optionName2}`
                  : option.optionName1,
                sellerManagerCode: option.sellerManagerCode,
                reason: `DB 업데이트 실패: ${updateError.message}`,
              });
            } else {
              result.mappedCount++;
              console.log(
                `[INFO]   ✅ 매핑 완료: ${option.optionName1} (옵션 ID: ${option.id})`,
              );
            }
          } else {
            // 매핑 실패 → 누락 목록에 추가
            result.failedCount++;
            const unmappedOption = {
              productName: product.name,
              originProductNo: originProductNo || "N/A",
              optionId: option.id,
              optionName: option.optionName2
                ? `${option.optionName1}/${option.optionName2}`
                : option.optionName1,
              sellerManagerCode: option.sellerManagerCode,
              reason: option.sellerManagerCode
                ? "SKU 불일치"
                : "SKU 없음 + 옵션명 매칭 실패",
            };
            result.unmappedOptions.push(unmappedOption);
            console.warn(
              `[WARN]   ❌ 매핑 실패: ${unmappedOption.optionName} (${unmappedOption.reason})`,
            );
          }
        }

        // API 레이트 리밋 방지
        await delay(100);
      } catch (error) {
        console.error(`[ERROR] 상품 처리 중 오류: ${error.message}`);
        result.failedCount++;
      }
    }

    // 3. 결과 요약
    console.log("\n" + "=".repeat(60));
    console.log("📊 매핑 빌드 결과 요약");
    console.log("=".repeat(60));
    console.log(`✅ 성공: ${result.mappedCount}개`);
    console.log(`❌ 실패: ${result.failedCount}개`);
    console.log(
      `📦 처리된 상품: ${result.processedProducts}/${result.totalProducts}개`,
    );

    if (result.unmappedOptions.length > 0) {
      console.log(
        `\n⚠️  매핑 실패 옵션 목록 (${result.unmappedOptions.length}개):`,
      );
      result.unmappedOptions.forEach((opt, idx) => {
        console.log(
          `  ${idx + 1}. ${opt.productName} - ${opt.optionName} (${
            opt.reason
          })`,
        );
      });

      // 누락 목록을 파일로 저장 (선택사항)
      const fs = require("fs");
      const path = require("path");
      const outputDir = path.join(process.cwd(), "tmp");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(
        outputDir,
        `unmapped-options-${Date.now()}.json`,
      );
      fs.writeFileSync(
        outputPath,
        JSON.stringify(result.unmappedOptions, null, 2),
        "utf-8",
      );
      console.log(`\n📁 누락 목록 저장: ${outputPath}`);
    }

    console.log("\n✅ 매핑 빌드 작업 완료!");
    return result;
  } catch (error) {
    console.error("[ERROR] 매핑 빌드 중 예외:", error);
    result.success = false;
    return result;
  }
}

// 스크립트 실행
buildMapping()
  .then((result) => {
    if (result.success) {
      console.log("\n🎉 모든 작업이 완료되었습니다!");
      process.exit(0);
    } else {
      console.log("\n⚠️  일부 작업이 실패했습니다.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("[ERROR] 치명적 오류:", error);
    process.exit(1);
  });
