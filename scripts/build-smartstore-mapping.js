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
const sharp = require("sharp");
const cheerio = require("cheerio");

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

// API 호출 래퍼 (401 시 토큰 재발급 + 1회 재시도, 429 시 exponential backoff)
async function fetchWithRetry(url, options, retried = false, retryCount = 0) {
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
    return fetchWithRetry(url, options, true, retryCount);
  }

  // 429 Rate Limit → 1~2초 대기 후 재시도 (최대 5회)
  if (response.status === 429 && retryCount < 5) {
    // 1~2초 사이 랜덤 대기 (Rate Limit 분산)
    const waitTime = 1000 + Math.random() * 1000; // 1000ms ~ 2000ms
    console.log(
      `[WARN] 429 Rate Limit 발생, ${Math.round(waitTime)}ms 대기 후 재시도 (${
        retryCount + 1
      }/5)`,
    );
    await delay(waitTime);
    return fetchWithRetry(url, options, retried, retryCount + 1);
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

// 이미지 다운로드 + 800×800 압축 + Supabase Storage 업로드
async function downloadCompressAndUploadImage(
  imageUrl,
  productId,
  imageType = "additional", // "primary", "additional", "option", "detail"
) {
  try {
    console.log(`[INFO] 이미지 처리 시작: ${imageUrl.substring(0, 50)}...`);

    // 1. 이미지 다운로드
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `이미지 다운로드 실패: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 2. 이미지 압축 (800×800)
    console.log(`[INFO] 이미지 압축 중 (800×800)...`);
    const compressedBuffer = await sharp(imageBuffer)
      .resize(800, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // 3. Supabase Storage에 업로드
    const fileName = `product-${productId}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.webp`;
    const filePath = `products/${fileName}`;

    console.log(`[INFO] Supabase Storage 업로드 중: ${filePath}`);
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, compressedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`업로드 실패: ${uploadError.message}`);
    }

    // 4. 공개 URL 가져오기
    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(filePath);

    console.log(`[INFO] ✅ 이미지 업로드 완료: ${publicUrl}`);
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error(`[ERROR] 이미지 처리 실패: ${error.message}`);
    return { success: false, error: error.message, url: imageUrl }; // 실패 시 원본 URL 반환
  }
}

// 상세 설명 HTML에서 이미지 URL 추출
function extractDetailImagesFromHTML(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") {
    return [];
  }

  try {
    const $ = cheerio.load(htmlContent);
    const imageUrls = [];

    // <img> 태그에서 src 추출
    $("img").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src && src.trim()) {
        imageUrls.push(src.trim());
      }
    });

    // <amp-img> 태그도 처리
    $("amp-img").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src && src.trim()) {
        imageUrls.push(src.trim());
      }
    });

    return imageUrls;
  } catch (error) {
    console.error(`[ERROR] HTML 파싱 실패: ${error.message}`);
    return [];
  }
}

// 스마트스토어 API에서 모든 상품 목록 가져오기 (v1/products/search API 사용)
async function getAllSmartstoreProducts() {
  const allProducts = [];
  let page = 1;
  const pageSize = 500; // 최대 500까지 가능
  let hasMore = true;

  console.log("[INFO] 📦 스마트스토어 API에서 상품 목록 가져오는 중...");

  while (hasMore) {
    try {
      // 상품 목록 검색 API (POST)
      // https://api.commerce.naver.com/external/v1/products/search
      const url = `${BASE_URL}/v1/products/search`;

      const requestBody = {
        page: page,
        size: pageSize,
        // 전체 목록 조회 시 빈 객체도 가능하지만, 페이지네이션을 위해 page/size 지정
      };

      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ERROR] 상품 목록 조회 실패 (페이지 ${page}): ${
            response.status
          } - ${errorText.substring(0, 300)}`,
        );
        break;
      }

      const data = await response.json();

      // 응답 구조 확인 (첫 페이지에서만 출력)
      if (page === 1 && allProducts.length === 0) {
        console.log("[DEBUG] 응답 키:", Object.keys(data));
        if (data.contents && data.contents.length > 0) {
          console.log(
            "[DEBUG] 첫 번째 상품 구조:",
            JSON.stringify(data.contents[0], null, 2).substring(0, 500),
          );
        }
      }

      // 응답 구조: { contents: [...], ... }
      // contents 배열의 각 항목은 { originProductNo, channelProducts: [...] } 형태
      // channelProducts 배열의 각 항목이 실제 채널 상품 정보
      const originProducts = data.contents || [];

      // 각 원상품의 channelProducts를 평탄화하여 저장 (품절 상품 제외)
      for (const originProduct of originProducts) {
        if (
          originProduct.channelProducts &&
          Array.isArray(originProduct.channelProducts)
        ) {
          // 품절 상품 필터링: 판매중이고 재고가 있는 상품만
          const activeChannelProducts = originProduct.channelProducts.filter(
            (cp) => {
              const isOnSale = cp.statusType === "SALE"; // 판매중
              const hasStock = (cp.stockQuantity || 0) > 0; // 재고 있음
              const isDisplayed = cp.channelProductDisplayStatusType === "ON"; // 표시 상태 ON
              return isOnSale && hasStock && isDisplayed;
            },
          );
          allProducts.push(...activeChannelProducts);
        }
      }

      const totalChannelProducts = originProducts.reduce(
        (sum, op) => sum + (op.channelProducts?.length || 0),
        0,
      );
      const activeChannelProducts = allProducts.length;
      console.log(
        `[INFO] 페이지 ${page}: ${originProducts.length}개 원상품, ${totalChannelProducts}개 채널상품 (품절 제외: ${activeChannelProducts}개, 누적: ${allProducts.length}개)`,
      );

      // 다음 페이지 확인
      if (originProducts.length < pageSize) {
        // 더 이상 데이터가 없음
        hasMore = false;
      } else {
        page++;
        // API 레이트 리밋 방지 (delay 증가)
        await delay(300);
      }
    } catch (error) {
      console.error(
        `[ERROR] 상품 목록 조회 예외 (페이지 ${page}):`,
        error.message,
      );
      break;
    }
  }

  console.log(`[INFO] ✅ 총 ${allProducts.length}개 상품 조회 완료\n`);
  return allProducts;
}

// 메인 실행 함수
async function buildMapping() {
  // 테스트용: 특정 상품명만 처리
  const TEST_PRODUCT_NAME = "산리오 헬로키티 마이멜로디 쿠로미 포차코 시나모롤 아코디언 가죽 카드지갑 반지갑";
  const TEST_MODE = true; // true: 테스트 모드 (특정 상품만), false: 전체 처리

  console.log("🚀 스마트스토어 옵션 매핑 빌드 시작");
  if (TEST_MODE) {
    console.log(`[TEST MODE] 테스트 상품: "${TEST_PRODUCT_NAME}"\n`);
  } else {
    console.log("(모든 상품 처리)\n");
  }
  console.log("=".repeat(60));

  const result = {
    success: true,
    mappedCount: 0,
    failedCount: 0,
    unmappedOptions: [],
    processedProducts: 0,
    totalProducts: 0,
    matchedProducts: 0, // 우리 DB와 매칭된 상품 수
    newMappings: 0, // 새로 smartstore_product_id가 연결된 상품 수
  };

  try {
    // 1. 우리 DB의 판매중인 모든 상품 가져오기 (페이지네이션)
    console.log("\n[INFO] 📋 우리 DB의 판매중인 상품 조회 중...");

    const allOurProducts = [];
    const pageSize = 100;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: products, error: findError } = await supabase
        .from("products")
        .select("id, name, smartstore_product_id, status")
        .eq("status", "active") // 판매중인 상품만
        .is("deleted_at", null)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order("id", { ascending: true });

      if (findError) {
        console.error("[ERROR] 상품 조회 실패:", findError);
        result.success = false;
        return result;
      }

      if (!products || products.length === 0) {
        hasMore = false;
        break;
      }

      // 테스트 모드: 특정 상품명만 필터링
      let filteredProducts = products;
      if (TEST_MODE) {
        filteredProducts = products.filter((p) =>
          p.name.includes(TEST_PRODUCT_NAME) ||
          TEST_PRODUCT_NAME.includes(p.name),
        );
        console.log(
          `[TEST MODE] 페이지 ${page + 1}: ${products.length}개 중 ${filteredProducts.length}개 매칭`,
        );
      }

      allOurProducts.push(...filteredProducts);
      console.log(
        `[INFO] 페이지 ${page + 1}: ${filteredProducts.length}개 상품 조회 (누적: ${
          allOurProducts.length
        }개)`,
      );

      if (products.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (allOurProducts.length === 0) {
      if (TEST_MODE) {
        console.log(
          "[INFO] 우리 DB에 해당 상품이 없습니다. 스마트스토어에서 찾아 추가합니다...",
        );
        // 테스트 모드에서는 계속 진행 (스마트스토어에서 상품 추가)
      } else {
        console.log("[INFO] 우리 DB에 판매중인 상품이 없습니다.");
        result.success = false;
        return result;
      }
    }

    console.log(
      `[INFO] ✅ 우리 DB 판매중인 상품: ${allOurProducts.length}개\n`,
    );

    result.totalProducts = allOurProducts.length;

    // 2. 스마트스토어 API에서 모든 상품 목록 가져오기 (매칭용)
    console.log("\n[INFO] 📦 스마트스토어 API에서 상품 목록 가져오는 중...");
    const smartstoreProducts = await getAllSmartstoreProducts();
    console.log(
      `[INFO] ✅ 스마트스토어 상품: ${smartstoreProducts.length}개\n`,
    );

    // 3. 각 상품의 옵션 매핑 처리
    for (let i = 0; i < allOurProducts.length; i++) {
      const product = allOurProducts[i];
      result.processedProducts++;

      console.log(
        `\n[${i + 1}/${allOurProducts.length}] 상품 처리: ${
          product.name
        } (ID: ${product.id})`,
      );

      // smartstore_product_id가 없으면 스마트스토어에서 매칭 시도
      if (!product.smartstore_product_id) {
        console.log(`[INFO]   스마트스토어 미연동 상품 - 매칭 시도 중...`);

        // 스마트스토어 상품 목록에서 이름으로 매칭
        // v1/products/search 응답: channelProducts 배열의 각 항목이 { name, channelProductNo, ... }
        const matchedSmartstoreProduct = smartstoreProducts.find((sp) => {
          const smartstoreName = sp.name || "";
          if (!smartstoreName) return false;
          return (
            smartstoreName === product.name ||
            smartstoreName.includes(product.name) ||
            product.name.includes(smartstoreName)
          );
        });

        if (matchedSmartstoreProduct) {
          // 매칭된 상품의 채널상품 번호 찾기
          // v1/products/search 응답: channelProducts 배열의 각 항목에 channelProductNo가 있음
          const channelProductNo =
            matchedSmartstoreProduct.channelProductNo ||
            matchedSmartstoreProduct.channelProductDisplayNo;

          if (channelProductNo) {
            console.log(
              `[INFO]   🔗 매칭 발견: "${product.name}" → 스마트스토어 상품 (${channelProductNo})`,
            );

            // 우리 DB에 smartstore_product_id 연결
            const { error: updateError } = await supabase
              .from("products")
              .update({ smartstore_product_id: channelProductNo.toString() })
              .eq("id", product.id);

            if (updateError) {
              console.error(
                `[ERROR]   smartstore_product_id 업데이트 실패: ${updateError.message}`,
              );
              // 업데이트 실패해도 계속 진행 (채널상품 조회 시도)
            } else {
              product.smartstore_product_id = channelProductNo.toString();
              result.newMappings++;
              console.log(`[INFO]   ✅ smartstore_product_id 연결 완료`);
            }
          } else {
            console.warn(`[WARN]   매칭된 상품의 채널상품 번호를 찾을 수 없음`);
          }
        } else {
          console.warn(
            `[WARN]   스마트스토어에서 매칭되는 상품 없음 - 새로 추가 필요`,
          );
          // TODO: 스마트스토어에 상품 추가 로직 (나중에 구현)
          // 현재는 로그만 남기고 스킵
          continue;
        }
      }

      // 여전히 smartstore_product_id가 없으면 스킵
      if (!product.smartstore_product_id) {
        console.log(`[INFO]   스마트스토어 연동 불가 (스킵)`);
        continue;
      }

      result.matchedProducts++;

      try {
        // 채널 상품 조회 (옵션 정보 포함)
        const channelProductData = await getChannelProduct(
          product.smartstore_product_id,
        );

        if (!channelProductData) {
          console.warn(`[WARN] 채널 상품 조회 실패: ${product.name}`);
          result.failedCount++;
          continue;
        }

        const options = extractOptionStocks(channelProductData);
        const originProduct = channelProductData.originProduct;

        // channelProductNo는 API 엔드포인트에서 사용한 값
        const channelProductNo = parseInt(product.smartstore_product_id, 10);

        // originProductNo는 채널 상품 조회 응답에 직접 없을 수 있음
        // 재고 수정 시 필요하지만, 매핑 작업에서는 옵션 ID + 채널상품 번호로 충분
        // 나중에 재고 동기화 시 다른 API로 확인하거나, 매핑된 데이터로 역추적 가능
        const originProductNo = null; // 매핑 작업에서는 사용하지 않음 (재고 수정 시 필요)

        // 0. 상품 설명(description) 업데이트
        if (originProduct?.detailContent) {
          console.log(`[INFO] 상품 설명 업데이트 중...`);
          const { error: descUpdateError } = await supabase
            .from("products")
            .update({ description: originProduct.detailContent })
            .eq("id", product.id);

          if (descUpdateError) {
            console.warn(
              `[WARN] 상품 설명 업데이트 실패: ${descUpdateError.message}`,
            );
          } else {
            console.log(`[INFO]   ✅ 상품 설명 업데이트 완료`);
          }
        }

        // 1. 상품 이미지 추가/업데이트
        console.log(`[INFO] 이미지 추가/업데이트 시작...`);
        const images = [];

        // 1-1. 대표 이미지 (압축 없이 원본 URL 사용)
        if (originProduct?.images?.representativeImage?.url) {
          const representativeUrl =
            originProduct.images.representativeImage.url;
          images.push({
            image_url: representativeUrl,
            is_primary: true,
            sort_order: 0,
            alt_text: product.name,
          });
          console.log(`[INFO]   대표 이미지: ${representativeUrl}`);
        }

        // 1-2. 추가 이미지 (800×800 압축 후 업로드)
        if (originProduct?.images?.optionalImages) {
          console.log(
            `[INFO]   추가 이미지 ${originProduct.images.optionalImages.length}개 처리 중...`,
          );
          for (
            let index = 0;
            index < originProduct.images.optionalImages.length;
            index++
          ) {
            const img = originProduct.images.optionalImages[index];
            if (img.url) {
              const result = await downloadCompressAndUploadImage(
                img.url,
                product.id,
                "additional",
              );
              if (result.success) {
                images.push({
                  image_url: result.url,
                  is_primary: false,
                  sort_order: index + 1,
                  alt_text: `${product.name} - 이미지 ${index + 1}`,
                });
              } else {
                console.warn(
                  `[WARN]   추가 이미지 처리 실패 (원본 URL 사용): ${result.error}`,
                );
                // 실패 시 원본 URL 사용
                images.push({
                  image_url: img.url,
                  is_primary: false,
                  sort_order: index + 1,
                  alt_text: `${product.name} - 이미지 ${index + 1}`,
                });
              }
            }
            // API 레이트 리밋 방지
            await delay(200);
          }
        }

        // 1-3. 옵션 이미지 (800×800 압축 후 업로드)
        if (originProduct?.standardOptionAttributes) {
          console.log(
            `[INFO]   옵션 이미지 처리 중... (${originProduct.standardOptionAttributes.length}개 옵션)`,
          );
          for (const optionAttr of originProduct.standardOptionAttributes) {
            if (optionAttr.imageUrls && optionAttr.imageUrls.length > 0) {
              for (let i = 0; i < optionAttr.imageUrls.length; i++) {
                const imageUrl = optionAttr.imageUrls[i];
                const result = await downloadCompressAndUploadImage(
                  imageUrl,
                  product.id,
                  "option",
                );
                if (result.success) {
                  images.push({
                    image_url: result.url,
                    is_primary: false,
                    sort_order: images.length,
                    alt_text: `${product.name} - 옵션 ${optionAttr.attributeValueName || "이미지"} ${i + 1}`,
                  });
                } else {
                  console.warn(
                    `[WARN]   옵션 이미지 처리 실패: ${result.error}`,
                  );
                }
                await delay(200);
              }
            }
          }
        }

        // 1-4. 상세 설명 이미지 (HTML 파싱 → 800×800 압축 후 업로드)
        if (originProduct?.detailContent) {
          console.log(`[INFO]   상세 설명 이미지 추출 중...`);
          const detailImageUrls = extractDetailImagesFromHTML(
            originProduct.detailContent,
          );
          console.log(
            `[INFO]   상세 설명에서 ${detailImageUrls.length}개 이미지 발견`,
          );

          for (let i = 0; i < detailImageUrls.length; i++) {
            const imageUrl = detailImageUrls[i];
            const result = await downloadCompressAndUploadImage(
              imageUrl,
              product.id,
              "detail",
            );
            if (result.success) {
              images.push({
                image_url: result.url,
                is_primary: false,
                sort_order: images.length,
                alt_text: `${product.name} - 상세 이미지 ${i + 1}`,
              });
            } else {
              console.warn(
                `[WARN]   상세 이미지 처리 실패: ${result.error}`,
              );
            }
            await delay(200);
          }
        }

        // 1-5. DB에 저장
        if (images.length > 0) {
          // 기존 이미지 확인
          const { data: existingImages } = await supabase
            .from("product_images")
            .select("id, image_url")
            .eq("product_id", product.id);

          // 기존 이미지 URL 목록
          const existingUrls = new Set(
            (existingImages || []).map((img) => img.image_url),
          );

          // 새로 추가할 이미지만 필터링
          const newImages = images.filter(
            (img) => !existingUrls.has(img.image_url),
          );

          if (newImages.length > 0) {
            const imageData = newImages.map((img) => ({
              product_id: product.id,
              ...img,
            }));

            const { error: imageError } = await supabase
              .from("product_images")
              .insert(imageData);

            if (imageError) {
              console.warn(`[WARN] 이미지 추가 실패: ${imageError.message}`);
            } else {
              console.log(
                `[INFO]   ✅ 이미지 ${newImages.length}개 추가 완료 (기존 ${
                  existingImages?.length || 0
                }개 유지, 총 ${images.length}개)`,
              );
            }
          } else {
            console.log(
              `[INFO]   이미지 이미 존재함 (${existingImages?.length || 0}개)`,
            );
          }
        } else {
          console.log(`[INFO]   이미지 없음 (스킵)`);
        }

        // 2. 옵션이 없는 상품 처리
        if (options.length === 0) {
          console.log(`[INFO] 옵션이 없는 상품 - 기본 variant 확인 중...`);

          // 옵션이 없는 상품은 기본 variant가 있는지 확인
          const { data: existingVariants } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", product.id)
            .is("deleted_at", null);

          if (!existingVariants || existingVariants.length === 0) {
            // variant가 없으면 기본 variant 생성
            console.log(`[INFO]   기본 variant 생성 중...`);
            const { error: variantError } = await supabase
              .from("product_variants")
              .insert({
                product_id: product.id,
                variant_name: "기본",
                variant_value: "기본",
                stock: originProduct?.stockQuantity || 0,
                price_adjustment: 0,
                sku: null,
              });

            if (variantError) {
              console.warn(
                `[WARN] 기본 variant 생성 실패: ${variantError.message}`,
              );
            } else {
              console.log(`[INFO]   ✅ 기본 variant 생성 완료`);
            }
          } else {
            console.log(
              `[INFO]   기존 variant 존재 (${existingVariants.length}개)`,
            );
          }

          // 옵션이 없는 상품은 매핑 작업 완료
          continue;
        }

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

        // API 레이트 리밋 방지 (delay 증가)
        await delay(300);
      } catch (error) {
        console.error(`[ERROR] 상품 처리 중 오류: ${error.message}`);
        result.failedCount++;
      }
    }

    // 4. 스마트스토어에만 있고 우리 DB에 없는 상품 추가
    console.log("\n" + "=".repeat(60));
    console.log("[INFO] 📥 스마트스토어에만 있는 상품 추가 중...");

    // 우리 DB의 모든 상품명 목록 (매칭 확인용)
    const ourProductNames = new Set(
      allOurProducts.map((p) => p.name.toLowerCase().trim()),
    );

    // 기본 카테고리 ID 가져오기 (첫 번째 카테고리 사용)
    const { data: categories } = await supabase
      .from("categories")
      .select("id")
      .is("deleted_at", null)
      .limit(1);

    const defaultCategoryId =
      categories && categories.length > 0 ? categories[0].id : null;

    if (!defaultCategoryId) {
      console.warn("[WARN] 기본 카테고리가 없어 상품 추가를 건너뜁니다.");
    } else {
      let addedCount = 0;
      let skippedCount = 0;

      for (const smartstoreProduct of smartstoreProducts) {
        const smartstoreName = (smartstoreProduct.name || "")
          .toLowerCase()
          .trim();

        // 테스트 모드: 특정 상품명만 처리
        if (TEST_MODE) {
          const testNameLower = TEST_PRODUCT_NAME.toLowerCase().trim();
          if (
            !smartstoreName.includes(testNameLower) &&
            !testNameLower.includes(smartstoreName)
          ) {
            skippedCount++;
            continue;
          }
        }

        // 이미 우리 DB에 있는 상품인지 확인
        const existsInOurDB = ourProductNames.has(smartstoreName);

        if (existsInOurDB) {
          skippedCount++;
          continue;
        }

        // 우리 DB에 없는 상품 → 추가
        try {
          const channelProductNo =
            smartstoreProduct.channelProductNo ||
            smartstoreProduct.channelProductDisplayNo;

          if (!channelProductNo) {
            console.warn(
              `[WARN] 채널상품 번호 없음: ${smartstoreProduct.name}`,
            );
            skippedCount++;
            continue;
          }

          // 채널 상품 상세 정보 가져오기 (이미지, 옵션 정보 포함)
          console.log(
            `[INFO]   상세 정보 조회 중: ${smartstoreProduct.name} (${channelProductNo})`,
          );
          const channelProductData = await getChannelProduct(
            channelProductNo.toString(),
          );

          if (!channelProductData) {
            console.warn(
              `[WARN] 채널 상품 조회 실패: ${smartstoreProduct.name}`,
            );
            skippedCount++;
            continue;
          }

          const originProduct = channelProductData.originProduct;

          // slug 생성 (상품명 기반)
          const slug = smartstoreProduct.name
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .substring(0, 100);

          // slug 중복 확인 및 처리
          let finalSlug = slug;
          let slugSuffix = 1;
          while (true) {
            const { data: existing } = await supabase
              .from("products")
              .select("id")
              .eq("slug", finalSlug)
              .is("deleted_at", null)
              .single();

            if (!existing) break;
            finalSlug = `${slug}-${slugSuffix}`;
            slugSuffix++;
          }

          // 상품 추가
          const { data: newProduct, error: insertError } = await supabase
            .from("products")
            .insert({
              category_id: defaultCategoryId,
              name: smartstoreProduct.name,
              slug: finalSlug,
              price: originProduct.salePrice || 0,
              discount_price: null, // 할인가는 나중에 필요시 추가
              description: originProduct.detailContent || null,
              status: "active",
              stock: originProduct.stockQuantity || 0,
              is_featured: false,
              is_new: false,
              smartstore_product_id: channelProductNo.toString(),
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(
              `[ERROR] 상품 추가 실패: ${smartstoreProduct.name} - ${insertError.message}`,
            );
            skippedCount++;
            continue;
          }

          console.log(
            `[INFO]   ✅ 상품 추가: ${smartstoreProduct.name} (ID: ${newProduct.id})`,
          );

          // 1. 이미지 추가 (product_images)
          const images = [];

          // 1-1. 대표 이미지 (압축 없이 원본 URL 사용)
          if (originProduct.images?.representativeImage?.url) {
            const representativeUrl =
              originProduct.images.representativeImage.url;
            images.push({
              image_url: representativeUrl,
              is_primary: true,
              sort_order: 0,
              alt_text: smartstoreProduct.name,
            });
            console.log(`[INFO]   대표 이미지: ${representativeUrl}`);
          }

          // 1-2. 추가 이미지 (800×800 압축 후 업로드)
          if (originProduct.images?.optionalImages) {
            console.log(
              `[INFO]   추가 이미지 ${originProduct.images.optionalImages.length}개 처리 중...`,
            );
            for (
              let index = 0;
              index < originProduct.images.optionalImages.length;
              index++
            ) {
              const img = originProduct.images.optionalImages[index];
              if (img.url) {
                const result = await downloadCompressAndUploadImage(
                  img.url,
                  newProduct.id,
                  "additional",
                );
                if (result.success) {
                  images.push({
                    image_url: result.url,
                    is_primary: false,
                    sort_order: index + 1,
                    alt_text: `${smartstoreProduct.name} - 이미지 ${index + 1}`,
                  });
                } else {
                  console.warn(
                    `[WARN]   추가 이미지 처리 실패 (원본 URL 사용): ${result.error}`,
                  );
                  images.push({
                    image_url: img.url,
                    is_primary: false,
                    sort_order: index + 1,
                    alt_text: `${smartstoreProduct.name} - 이미지 ${index + 1}`,
                  });
                }
              }
              await delay(200);
            }
          }

          // 1-3. 옵션 이미지 (800×800 압축 후 업로드)
          if (originProduct?.standardOptionAttributes) {
            console.log(
              `[INFO]   옵션 이미지 처리 중... (${originProduct.standardOptionAttributes.length}개 옵션)`,
            );
            for (const optionAttr of originProduct.standardOptionAttributes) {
              if (optionAttr.imageUrls && optionAttr.imageUrls.length > 0) {
                for (let i = 0; i < optionAttr.imageUrls.length; i++) {
                  const imageUrl = optionAttr.imageUrls[i];
                  const result = await downloadCompressAndUploadImage(
                    imageUrl,
                    newProduct.id,
                    "option",
                  );
                  if (result.success) {
                    images.push({
                      image_url: result.url,
                      is_primary: false,
                      sort_order: images.length,
                      alt_text: `${smartstoreProduct.name} - 옵션 ${optionAttr.attributeValueName || "이미지"} ${i + 1}`,
                    });
                  } else {
                    console.warn(
                      `[WARN]   옵션 이미지 처리 실패: ${result.error}`,
                    );
                  }
                  await delay(200);
                }
              }
            }
          }

          // 1-4. 상세 설명 이미지 (HTML 파싱 → 800×800 압축 후 업로드)
          if (originProduct?.detailContent) {
            console.log(`[INFO]   상세 설명 이미지 추출 중...`);
            const detailImageUrls = extractDetailImagesFromHTML(
              originProduct.detailContent,
            );
            console.log(
              `[INFO]   상세 설명에서 ${detailImageUrls.length}개 이미지 발견`,
            );

            for (let i = 0; i < detailImageUrls.length; i++) {
              const imageUrl = detailImageUrls[i];
              const result = await downloadCompressAndUploadImage(
                imageUrl,
                newProduct.id,
                "detail",
              );
              if (result.success) {
                images.push({
                  image_url: result.url,
                  is_primary: false,
                  sort_order: images.length,
                  alt_text: `${smartstoreProduct.name} - 상세 이미지 ${i + 1}`,
                });
              } else {
                console.warn(
                  `[WARN]   상세 이미지 처리 실패: ${result.error}`,
                );
              }
              await delay(200);
            }
          }

          if (images.length > 0) {
            const imageData = images.map((img) => ({
              product_id: newProduct.id,
              ...img,
            }));

            const { error: imageError } = await supabase
              .from("product_images")
              .insert(imageData);

            if (imageError) {
              console.warn(`[WARN] 이미지 추가 실패: ${imageError.message}`);
            } else {
              const detailImageCount =
                originProduct?.detailContent
                  ? extractDetailImagesFromHTML(originProduct.detailContent)
                      .length
                  : 0;
              console.log(
                `[INFO]   ✅ 이미지 ${images.length}개 추가 완료 (대표: 1개, 추가: ${originProduct.images?.optionalImages?.length || 0}개, 옵션: ${originProduct?.standardOptionAttributes?.filter((o) => o.imageUrls?.length > 0).length || 0}개, 상세: ${detailImageCount}개)`,
              );
            }
          }

          // 2. 옵션 추가 (product_variants)
          const options = extractOptionStocks(channelProductData);
          if (options.length > 0) {
            const variantData = options.map((option, index) => {
              const optionName = option.optionName2
                ? `${option.optionName1}/${option.optionName2}`
                : option.optionName1;

              return {
                product_id: newProduct.id,
                variant_name: "옵션", // 기본 옵션명
                variant_value: optionName,
                stock: option.stockQuantity || 0,
                price_adjustment: option.price || 0,
                sku: option.sellerManagerCode || null,
              };
            });

            const { error: variantError } = await supabase
              .from("product_variants")
              .insert(variantData);

            if (variantError) {
              console.warn(`[WARN] 옵션 추가 실패: ${variantError.message}`);
            } else {
              console.log(`[INFO]   ✅ 옵션 ${options.length}개 추가 완료`);

              // 옵션 매핑 정보도 함께 저장
              const channelProductNoInt = parseInt(channelProductNo, 10);
              for (let i = 0; i < options.length; i++) {
                const option = options[i];
                const variant = variantData[i];

                // 방금 추가한 variant 찾기
                const { data: insertedVariant } = await supabase
                  .from("product_variants")
                  .select("id")
                  .eq("product_id", newProduct.id)
                  .eq("variant_value", variant.variant_value)
                  .is("deleted_at", null)
                  .single();

                if (insertedVariant) {
                  await supabase
                    .from("product_variants")
                    .update({
                      smartstore_option_id: option.id,
                      smartstore_channel_product_no: channelProductNoInt,
                    })
                    .eq("id", insertedVariant.id);
                }
              }
            }
          }

          // 3. 카테고리 연결 (product_categories)
          const { error: categoryError } = await supabase
            .from("product_categories")
            .insert({
              product_id: newProduct.id,
              category_id: defaultCategoryId,
              is_primary: true,
              sort_order: 0,
            });

          if (categoryError) {
            console.warn(`[WARN] 카테고리 연결 실패: ${categoryError.message}`);
          } else {
            console.log(`[INFO]   ✅ 카테고리 연결 완료`);
          }

          addedCount++;
          // 우리 DB 목록에 추가 (중복 체크용)
          allOurProducts.push({
            id: newProduct.id,
            name: smartstoreProduct.name,
            smartstore_product_id: channelProductNo.toString(),
            status: "active",
          });
          ourProductNames.add(smartstoreName);

          // API 레이트 리밋 방지 (delay 증가)
          await delay(500);
        } catch (error) {
          console.error(
            `[ERROR] 상품 추가 중 오류: ${smartstoreProduct.name} - ${error.message}`,
          );
          skippedCount++;
        }
      }

      console.log(
        `[INFO] ✅ 상품 추가 완료: ${addedCount}개 추가, ${skippedCount}개 스킵`,
      );
      result.newMappings += addedCount;
    }

    // 5. 결과 요약
    console.log("\n" + "=".repeat(60));
    console.log("📊 매핑 빌드 결과 요약");
    console.log("=".repeat(60));
    console.log(`📦 스마트스토어 상품: ${result.totalProducts}개`);
    console.log(`🔗 우리 DB와 매칭: ${result.matchedProducts}개`);
    console.log(`🆕 새로 연결된 상품: ${result.newMappings}개`);
    console.log(`✅ 옵션 매핑 성공: ${result.mappedCount}개`);
    console.log(`❌ 옵션 매핑 실패: ${result.failedCount}개`);
    console.log(
      `📊 처리된 상품: ${result.processedProducts}/${result.totalProducts}개`,
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
