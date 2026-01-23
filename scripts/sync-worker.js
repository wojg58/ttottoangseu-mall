/**
 * scripts/sync-worker.js
 * AWS EC2에서 24시간 실행될 스크립트입니다.
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// 환경변수 로드
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NAVER_CLIENT_ID =
  process.env.NAVER_COMMERCE_CLIENT_ID ||
  process.env.NAVER_SMARTSTORE_CLIENT_ID;
const NAVER_CLIENT_SECRET =
  process.env.NAVER_COMMERCE_CLIENT_SECRET ||
  process.env.NAVER_SMARTSTORE_CLIENT_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ 환경변수 누락!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
let accessToken = null;
let tokenExpiresAt = 0;

// 네이버 토큰 발급
async function getNaverToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  console.log("🔑 토큰 갱신 중...");

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    throw new Error("네이버 API 인증 정보가 없습니다.");
  }

  // 네이버 커머스 API 토큰 엔드포인트
  // https://apicenter.commerce.naver.com/docs/commerce-api/current/exchange-sellers-auth
  const tokenUrl = "https://api.commerce.naver.com/external/v1/oauth2/token";

  // 네이버 커머스 API 요구 파라미터 준비
  const timestamp = Date.now();
  const type = "SELF";
  const accountId = process.env.NAVER_SMARTSTORE_ACCOUNT_ID || "";

  // client_secret_sign 생성 (네이버 API 문서 방식)
  // 1. password = clientId_timestamp 형식으로 생성
  // 2. bcrypt.hashSync(password, clientSecret) - clientSecret을 salt로 사용
  // 3. 결과를 base64로 인코딩
  const password = `${NAVER_CLIENT_ID}_${timestamp}`;
  let clientSecretSign;
  try {
    const hashed = bcrypt.hashSync(password, NAVER_CLIENT_SECRET);
    clientSecretSign = Buffer.from(hashed, "utf-8").toString("base64");
  } catch (error) {
    throw new Error(`client_secret_sign 생성 실패: ${error.message}`);
  }

  // 요청 바디 준비
  const requestBodyParams = {
    grant_type: "client_credentials",
    client_id: NAVER_CLIENT_ID,
    client_secret: NAVER_CLIENT_SECRET,
    timestamp: timestamp.toString(),
    client_secret_sign: clientSecretSign,
    type: type,
  };

  if (accountId) {
    requestBodyParams.account_id = accountId;
  }

  const requestBody = new URLSearchParams(requestBodyParams);

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody,
    });

    if (res.ok) {
      const data = await res.json();
      accessToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      console.log("✅ 토큰 발급 성공");
      return accessToken;
    } else {
      const errorText = await res.text();
      throw new Error(
        `토큰 발급 실패: ${res.status} - ${errorText.substring(0, 200)}`,
      );
    }
  } catch (error) {
    console.error("❌ 토큰 발급 실패:", error.message);
    throw error;
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log("🚀 AWS Worker Started...");
  while (true) {
    try {
      // 1. 작업 조회
      const { data: jobs } = await supabase
        .from("naver_sync_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);

      if (jobs && jobs.length > 0) {
        console.log(`📦 ${jobs.length}건 처리 시작`);

        for (const job of jobs) {
          // 2. 처리 중 표시
          await supabase
            .from("naver_sync_queue")
            .update({ status: "processing" })
            .eq("id", job.id);

          try {
            const token = await getNaverToken();

            // 옵션 단위 처리 여부 확인
            const isVariantSync = !!job.variant_id;
            console.log(
              `[INFO] 재고 변경 시작 - channelProductNo: ${job.smartstore_id}, target_stock: ${job.target_stock}, 옵션 단위: ${isVariantSync ? '예' : '아니오'}`,
            );
            console.log(
              `[DEBUG] Job 상세 정보:`,
              JSON.stringify(
                {
                  id: job.id,
                  product_id: job.product_id,
                  variant_id: job.variant_id,
                  smartstore_id: job.smartstore_id,
                  smartstore_option_id: job.smartstore_option_id,
                  target_stock: job.target_stock,
                  status: job.status,
                  created_at: job.created_at,
                },
                null,
                2,
              ),
            );

            // 옵션 단위 처리인 경우 variant 정보 조회
            let variantInfo = null;
            if (isVariantSync) {
              const { data: variant } = await supabase
                .from("product_variants")
                .select("smartstore_option_id, smartstore_channel_product_no")
                .eq("id", job.variant_id)
                .single();

              if (variant && variant.smartstore_option_id) {
                variantInfo = {
                  optionId: variant.smartstore_option_id,
                  channelProductNo: variant.smartstore_channel_product_no,
                };
                console.log(
                  `[INFO] 옵션 정보 조회 완료: 옵션 ID ${variantInfo.optionId}, 채널상품 ${variantInfo.channelProductNo}`,
                );
              } else {
                // 매핑되지 않은 옵션: 상품 단위로 처리
                console.warn(
                  `[WARN] 옵션 매핑 정보 없음 (variant_id: ${job.variant_id}, smartstore_option_id: ${variant?.smartstore_option_id || 'null'}), 상품 단위로 처리`,
                );
                // variantInfo를 null로 유지하여 상품 단위 처리로 전환
                variantInfo = null;
              }
            }

            // 3-1. 채널 상품 정보 조회
            // 네이버 커머스 API: 채널 상품 수정 (재고 변경)
            // https://apicenter.commerce.naver.com/docs/commerce-api/current/update-channel-product-product
            // PUT /external/v2/products/channel-products/{channelProductNo}
            let channelProductData = null;

            // 채널 상품 조회 (429 재시도 포함)
            let channelRes = null;
            let retryCount = 0;
            const maxRetries = 5;

            while (retryCount < maxRetries) {
              try {
                console.log(`[INFO] 채널 상품 조회 시도: ${job.smartstore_id} (시도 ${retryCount + 1}/${maxRetries})`);
                channelRes = await fetch(
                  `https://api.commerce.naver.com/external/v2/products/channel-products/${job.smartstore_id}`,
                  {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: "application/json;charset=UTF-8",
                    },
                  },
                );

                console.log(
                  `[INFO] 채널 상품 조회 응답 상태: ${channelRes.status}`,
                );

                // 429 Rate Limit 발생 시 1~2초 대기 후 재시도
                if (channelRes.status === 429) {
                  const waitTime = 1000 + Math.random() * 1000; // 1000ms ~ 2000ms
                  console.log(
                    `[WARN] 429 Rate Limit 발생, ${Math.round(waitTime)}ms 대기 후 재시도 (${retryCount + 1}/${maxRetries})`,
                  );
                  await delay(waitTime);
                  retryCount++;
                  continue;
                }

                // 429가 아니면 응답 처리 후 루프 종료
                if (channelRes.ok) {
                  const channelData = await channelRes.json();
                  console.log(
                    `[INFO] 채널 상품 조회 응답 데이터:`,
                    JSON.stringify(channelData, null, 2),
                  );

                  // channelProduct 데이터 찾기
                  if (channelData.data) {
                    channelProductData = channelData.data;
                  } else if (channelData.smartstoreChannelProduct) {
                    channelProductData = channelData;
                  } else {
                    channelProductData = channelData;
                  }

                  console.log(`[INFO] 채널 상품 데이터 획득 성공`);
                  break; // 성공 시 루프 종료
                } else {
                  const errorText = await channelRes.text();
                  console.log(
                    `[INFO] 채널 상품 조회 실패 (${
                      channelRes.status
                    }): ${errorText.substring(0, 200)}`,
                  );
                  throw new Error(
                    `채널 상품 조회 실패: ${
                      channelRes.status
                    } - ${errorText.substring(0, 200)}`,
                  );
                }
              } catch (fetchError) {
                console.error(`[ERROR] 채널 상품 조회 예외: ${fetchError.message}`);
                if (retryCount < maxRetries - 1) {
                  const waitTime = 1000 + Math.random() * 1000;
                  await delay(waitTime);
                  retryCount++;
                  continue;
                }
                throw fetchError;
              }
            }

            // channelRes가 null이거나 실패한 경우 처리
            if (!channelRes || !channelRes.ok) {
              throw new Error("채널 상품 조회 실패");
            }

            // 3-2. 채널 상품 재고 변경 API 호출
            // 네이버 커머스 API: 채널 상품 수정 (재고 변경)
            // https://apicenter.commerce.naver.com/docs/commerce-api/current/update-channel-product-product
            // PUT /external/v2/products/channel-products/{channelProductNo}
            console.log(
              `[INFO] 채널 상품 재고 변경 시도: ${job.smartstore_id} -> ${job.target_stock}개`,
            );

            // 채널 상품 수정 API 요청 본문 구조
            // { originProduct: {...}, customerBenefit: {...}, smartstoreChannelProduct: {...}, windowChannelProduct: {...} }
            // 채널 상품 조회 응답에서 전체 구조를 가져와서 재고만 업데이트
            let requestBody;
            const originProductData =
              channelProductData.originProduct ||
              channelProductData.data?.originProduct;

            if (originProductData) {
              // originProduct 복사
              const updatedOriginProduct = {
                ...originProductData,
              };

              // 옵션이 있는 상품의 경우 optionInfo.optionCombinations[].stockQuantity도 업데이트
              const hasOptions =
                originProductData.detailAttribute?.optionInfo
                  ?.optionCombinations &&
                originProductData.detailAttribute.optionInfo.optionCombinations
                  .length > 0;

              if (hasOptions) {
                console.log(
                  `[INFO] 옵션이 있는 상품 감지: ${originProductData.detailAttribute.optionInfo.optionCombinations.length}개 옵션`,
                );
                const optionCombinations =
                  originProductData.detailAttribute.optionInfo
                    .optionCombinations;

                // 옵션 단위 동기화인 경우: 해당 옵션만 정확히 업데이트
                if (isVariantSync && variantInfo) {
                  const targetOption = optionCombinations.find(
                    (opt) => opt.id === variantInfo.optionId,
                  );

                  console.log(
                    `[DEBUG] 옵션 검색: variantInfo.optionId=${variantInfo.optionId}, 전체 옵션 ID 목록:`,
                    optionCombinations.map((opt) => ({
                      id: opt.id,
                      name: opt.optionName1 || opt.optionName2 || "N/A",
                      currentStock: opt.stockQuantity,
                    })),
                  );

                  if (targetOption) {
                    console.log(
                      `[INFO] 옵션 단위 재고 업데이트: 옵션 ID ${variantInfo.optionId} (${targetOption.optionName1 || targetOption.optionName2 || "N/A"}) -> 기존 ${targetOption.stockQuantity}개 → ${job.target_stock}개`,
                    );
                    // 해당 옵션만 재고 업데이트, 나머지는 그대로 유지
                    const updatedOptionCombinations = optionCombinations.map(
                      (opt) => {
                        if (opt.id === variantInfo.optionId) {
                          console.log(
                            `[DEBUG] 옵션 재고 변경: ${opt.optionName1 || opt.optionName2 || opt.id} (ID: ${opt.id}) ${opt.stockQuantity} → ${job.target_stock}`,
                          );
                          return { ...opt, stockQuantity: job.target_stock };
                        }
                        return opt; // 다른 옵션은 그대로 유지
                      },
                    );

                    // 전체 재고 합계 계산
                    const totalStock = updatedOptionCombinations.reduce(
                      (sum, opt) => sum + (opt.stockQuantity || 0),
                      0,
                    );
                    console.log(
                      `[DEBUG] 전체 재고 합계 계산: ${totalStock}개 (기존: ${originProductData.stockQuantity}개)`,
                    );
                    updatedOriginProduct.stockQuantity = totalStock;

                    // detailAttribute 재구성 시 seoInfo 제외 (재고 변경 시 불필요)
                    const { seoInfo, ...detailAttributeWithoutSeo } = originProductData.detailAttribute || {};
                    updatedOriginProduct.detailAttribute = {
                      ...detailAttributeWithoutSeo,
                      optionInfo: {
                        ...originProductData.detailAttribute.optionInfo,
                        optionCombinations: updatedOptionCombinations,
                      },
                    };

                    console.log(
                      `[DEBUG] 최종 옵션별 재고 상태:`,
                      updatedOptionCombinations.map((opt) => ({
                        id: opt.id,
                        name: opt.optionName1 || opt.optionName2 || "N/A",
                        stock: opt.stockQuantity,
                      })),
                    );
                    updatedOptionCombinations.forEach((opt) => {
                      console.log(
                        `[INFO]   옵션 ${opt.optionName1 || opt.optionName2 || opt.id} (ID: ${opt.id}): ${opt.stockQuantity}개`,
                      );
                    });
                  } else {
                    console.warn(
                      `[WARN] 옵션 ID ${variantInfo.optionId}를 찾을 수 없음, 상품 단위로 처리`,
                    );
                    console.log(
                      `[DEBUG] 사용 가능한 옵션 ID 목록:`,
                      optionCombinations.map((opt) => opt.id),
                    );
                    // 옵션을 찾을 수 없으면 상품 단위로 처리
                    updatedOriginProduct.stockQuantity = job.target_stock;
                    
                    // detailAttribute 재구성 시 seoInfo 제외 (재고 변경 시 불필요)
                    if (originProductData.detailAttribute?.seoInfo) {
                      const { seoInfo, ...detailAttributeWithoutSeo } = originProductData.detailAttribute;
                      updatedOriginProduct.detailAttribute = detailAttributeWithoutSeo;
                    }
                  }
                } else {
                  // 상품 단위 동기화: 기존 로직 (비율 분배)
                  console.log(
                    `[INFO] 상품 단위 재고 동기화: 총 ${job.target_stock}개를 옵션별로 비율 분배`,
                  );
                  const totalCurrentStock = optionCombinations.reduce(
                    (sum, opt) => sum + (opt.stockQuantity || 0),
                    0,
                  );

                  // 옵션별 재고를 비율에 따라 분배
                  const updatedOptionCombinations = optionCombinations.map(
                    (opt) => {
                      if (totalCurrentStock > 0) {
                        // 비율에 따라 분배
                        const ratio = opt.stockQuantity / totalCurrentStock;
                        const newStock = Math.floor(job.target_stock * ratio);
                        return { ...opt, stockQuantity: newStock };
                      } else {
                        // 현재 재고가 0이면 첫 번째 옵션에 전체 재고 할당
                        return {
                          ...opt,
                          stockQuantity:
                            opt === optionCombinations[0] ? job.target_stock : 0,
                        };
                      }
                    },
                  );

                  // 나머지 재고를 첫 번째 옵션에 추가 (반올림 오차 보정)
                  const allocatedStock = updatedOptionCombinations.reduce(
                    (sum, opt) => sum + opt.stockQuantity,
                    0,
                  );
                  if (
                    allocatedStock < job.target_stock &&
                    optionCombinations.length > 0
                  ) {
                    updatedOptionCombinations[0].stockQuantity +=
                      job.target_stock - allocatedStock;
                  }

                  updatedOriginProduct.stockQuantity = job.target_stock;

                  // detailAttribute 재구성 시 seoInfo 제외 (재고 변경 시 불필요)
                  const { seoInfo: seoInfo2, ...detailAttributeWithoutSeo2 } = originProductData.detailAttribute || {};
                  updatedOriginProduct.detailAttribute = {
                    ...detailAttributeWithoutSeo2,
                    optionInfo: {
                      ...originProductData.detailAttribute.optionInfo,
                      optionCombinations: updatedOptionCombinations,
                    },
                  };

                  console.log(
                    `[INFO] 옵션별 재고 업데이트: 총 ${job.target_stock}개`,
                  );
                  updatedOptionCombinations.forEach((opt, idx) => {
                    console.log(
                      `[INFO]   옵션 ${idx + 1} (${opt.optionName1 || opt.id}): ${
                        opt.stockQuantity
                      }개`,
                    );
                  });
                }
              } else {
                // 옵션이 없는 상품: 상품 재고만 업데이트
                console.log(
                  `[INFO] 옵션이 없는 상품: originProduct.stockQuantity만 업데이트 (${job.target_stock}개)`,
                );
                updatedOriginProduct.stockQuantity = job.target_stock;
                
                // 옵션이 없는 상품도 seoInfo 제거 (재고 변경 시 불필요)
                if (updatedOriginProduct.detailAttribute?.seoInfo) {
                  console.log(`[INFO] seoInfo 제거 (재고 변경 시 불필요)`);
                  const { seoInfo, ...restDetailAttribute } = updatedOriginProduct.detailAttribute;
                  updatedOriginProduct.detailAttribute = restDetailAttribute;
                }
              }

              // 최종 안전장치: seoInfo가 남아있으면 제거 (네이버 API 제한 단어 문제 방지)
              if (updatedOriginProduct.detailAttribute?.seoInfo) {
                console.log(`[INFO] seoInfo 최종 제거 (안전장치)`);
                const { seoInfo, ...restDetailAttribute } = updatedOriginProduct.detailAttribute;
                updatedOriginProduct.detailAttribute = restDetailAttribute;
              }

              requestBody = {
                originProduct: updatedOriginProduct,
              };

              // customerBenefit이 있으면 포함
              const customerBenefit =
                channelProductData.customerBenefit ||
                channelProductData.data?.customerBenefit;
              if (customerBenefit) {
                requestBody.customerBenefit = customerBenefit;
              }

              // smartstoreChannelProduct가 있으면 포함
              const smartstoreChannelProduct =
                channelProductData.smartstoreChannelProduct ||
                channelProductData.data?.smartstoreChannelProduct;
              if (smartstoreChannelProduct) {
                requestBody.smartstoreChannelProduct = smartstoreChannelProduct;
              }

              // windowChannelProduct가 있고 channelNo가 있으면 포함 (필수 필드)
              const windowChannelProduct =
                channelProductData.windowChannelProduct ||
                channelProductData.data?.windowChannelProduct;
              if (windowChannelProduct && windowChannelProduct.channelNo) {
                requestBody.windowChannelProduct = windowChannelProduct;
              }
            } else {
              // originProduct가 없는 경우 최소한의 구조로 생성
              requestBody = {
                originProduct: {
                  stockQuantity: job.target_stock,
                },
              };
            }

            console.log(
              `[INFO] 요청 본문 (stockQuantity: ${job.target_stock}):`,
              JSON.stringify(
                {
                  originProduct: {
                    ...requestBody.originProduct,
                    stockQuantity: requestBody.originProduct.stockQuantity,
                    hasOptions: !!(
                      requestBody.originProduct.detailAttribute?.optionInfo
                        ?.optionCombinations
                    ),
                    optionCount:
                      requestBody.originProduct.detailAttribute?.optionInfo
                        ?.optionCombinations?.length || 0,
                  },
                  hasCustomerBenefit: !!requestBody.customerBenefit,
                  hasSmartstoreChannelProduct:
                    !!requestBody.smartstoreChannelProduct,
                  hasWindowChannelProduct: !!requestBody.windowChannelProduct,
                },
                null,
                2,
              ),
            );
            if (
              requestBody.originProduct.detailAttribute?.optionInfo
                ?.optionCombinations
            ) {
              console.log(
                `[DEBUG] 요청 본문의 옵션별 재고:`,
                requestBody.originProduct.detailAttribute.optionInfo.optionCombinations.map(
                  (opt) => ({
                    id: opt.id,
                    name: opt.optionName1 || opt.optionName2 || "N/A",
                    stock: opt.stockQuantity,
                  }),
                ),
              );
            }

            // 재고 변경 API 호출 (429 재시도 포함)
            let res = null;
            let updateRetryCount = 0;
            const maxUpdateRetries = 5;

            while (updateRetryCount < maxUpdateRetries) {
              try {
                console.log(
                  `[INFO] 재고 변경 API 호출 시도: ${job.smartstore_id} (시도 ${updateRetryCount + 1}/${maxUpdateRetries})`,
                );
                res = await fetch(
                  `https://api.commerce.naver.com/external/v2/products/channel-products/${job.smartstore_id}`,
                  {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                      Accept: "application/json;charset=UTF-8",
                    },
                    body: JSON.stringify(requestBody),
                  },
                );

                console.log(`[INFO] 재고 변경 API 응답 상태: ${res.status}`);

                // 429 Rate Limit 발생 시 1~2초 대기 후 재시도
                if (res.status === 429) {
                  const waitTime = 1000 + Math.random() * 1000; // 1000ms ~ 2000ms
                  console.log(
                    `[WARN] 429 Rate Limit 발생, ${Math.round(waitTime)}ms 대기 후 재시도 (${updateRetryCount + 1}/${maxUpdateRetries})`,
                  );
                  await delay(waitTime);
                  updateRetryCount++;
                  continue;
                }

                // 429가 아니면 루프 종료
                break;
              } catch (fetchError) {
                console.error(`[ERROR] 재고 변경 API 호출 예외: ${fetchError.message}`);
                if (updateRetryCount < maxUpdateRetries - 1) {
                  const waitTime = 1000 + Math.random() * 1000;
                  await delay(waitTime);
                  updateRetryCount++;
                  continue;
                }
                throw fetchError;
              }
            }

            const responseText = await res.text();
            console.log(
              `[INFO] 재고 변경 API 응답 본문:`,
              responseText.substring(0, 500),
            );

            if (!res.ok) {
              throw new Error(
                `재고 변경 실패: ${res.status} - ${responseText}`,
              );
            }

            // 응답 파싱 시도
            let responseData = null;
            try {
              responseData = JSON.parse(responseText);
              console.log(
                `[INFO] 재고 변경 API 응답 데이터:`,
                JSON.stringify(responseData, null, 2),
              );
            } catch (e) {
              console.log(`[INFO] 응답 파싱 실패 (텍스트 응답일 수 있음)`);
            }

            // 4. 성공 처리
            await supabase
              .from("naver_sync_queue")
              .update({ status: "done", processed_at: new Date() })
              .eq("id", job.id);

            // 응답에서 실제 변경된 재고 확인
            const actualStock =
              responseData?.data?.originProduct?.stockQuantity ||
              responseData?.originProduct?.stockQuantity ||
              job.target_stock;

            console.log(
              `✅ [OK] 상품 ${job.smartstore_id} -> 요청: ${job.target_stock}개, 응답: ${actualStock}개`,
            );

            // 옵션 단위 동기화인 경우 응답의 옵션별 재고도 확인
            if (isVariantSync && variantInfo && responseData) {
              const responseOptions =
                responseData?.data?.originProduct?.detailAttribute?.optionInfo
                  ?.optionCombinations ||
                responseData?.originProduct?.detailAttribute?.optionInfo
                  ?.optionCombinations;
              if (responseOptions) {
                const updatedOption = responseOptions.find(
                  (opt) => opt.id === variantInfo.optionId,
                );
                if (updatedOption) {
                  console.log(
                    `[DEBUG] 응답의 옵션 재고 확인: 옵션 ID ${variantInfo.optionId} -> ${updatedOption.stockQuantity}개 (요청: ${job.target_stock}개)`,
                  );
                } else {
                  console.warn(
                    `[WARN] 응답에서 옵션 ID ${variantInfo.optionId}를 찾을 수 없음`,
                  );
                }
                console.log(
                  `[DEBUG] 응답의 전체 옵션별 재고:`,
                  responseOptions.map((opt) => ({
                    id: opt.id,
                    name: opt.optionName1 || opt.optionName2 || "N/A",
                    stock: opt.stockQuantity,
                  })),
                );
              }
            }
          } catch (err) {
            console.error(`❌ [FAIL] Job ${job.id}:`, err.message);
            await supabase
              .from("naver_sync_queue")
              .update({ status: "failed", message: err.message })
              .eq("id", job.id);
          }
          // ★ Rate Limit: 1초 대기
          await delay(1000);
        }
      } else {
        // 작업 없으면 5초 대기
        await delay(5000);
      }
    } catch (e) {
      console.error("Worker Error:", e);
      await delay(5000);
    }
  }
}

run();
