/**
 * @file actions/import-products.ts
 * @description 상품 일괄 이관 Server Actions
 *
 * 주요 기능:
 * 1. 파싱된 상품 데이터를 실제 DB에 저장
 * 2. 카테고리 매핑 처리
 * 3. 이미지 URL 저장 (이미지 업로드는 별도 처리)
 * 4. 옵션 정보 저장
 */

"use server";

import { isAdmin } from "./admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import type { ParsedProductData } from "@/lib/utils/import-products";
import type { CreateProductInput } from "./admin-products";
import { uploadImagesFromUrls } from "@/lib/utils/upload-image";

// 상품 일괄 생성 결과
export interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
  errors: Array<{
    product_name: string;
    message: string;
  }>;
}

/**
 * 파싱된 상품 데이터를 실제 DB에 저장
 */
export async function importProducts(
  products: ParsedProductData[],
): Promise<ImportResult> {
  // 타임아웃 방지를 위한 설정
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 4 * 60 * 1000; // 4분 (Next.js 기본 타임아웃보다 짧게)
  
  console.group("[importProducts] 상품 일괄 이관 시작");
  console.log("이관할 상품 수:", products.length);
  console.log("[importProducts] 타임아웃 방지를 위해 이미지 업로드는 건너뜁니다.");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
      imported: 0,
      failed: products.length,
      errors: [],
    };
  }

  // 대량 이관 작업은 Service Role 클라이언트 사용 (JWT 만료 방지)
  const supabase = getServiceRoleClient();
  let imported = 0;
  let failed = 0;
  const errors: ImportResult["errors"] = [];

  // 카테고리 목록 조회 (slug로 매핑) - RLS 문제 방지
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, slug, name")
    .is("deleted_at", null);

  if (categoryError) {
    console.error("[importProducts] 카테고리 조회 에러:", {
      message: categoryError.message,
      details: categoryError.details,
      hint: categoryError.hint,
      code: categoryError.code,
    });
    console.warn(
      "[importProducts] 카테고리 조회 실패, 빈 카테고리 맵으로 계속 진행합니다.",
    );
  }

  const categoryMap = new Map<string, string>();
  categories?.forEach((cat) => {
    categoryMap.set(cat.slug, cat.id);
  });

  console.log("카테고리 매핑:", categoryMap.size, "개");

  // 각 상품 처리
  for (let i = 0; i < products.length; i++) {
    // 타임아웃 체크 (4분 경과 시 경고)
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > MAX_EXECUTION_TIME) {
      console.warn(
        `[importProducts] 타임아웃 경고: ${elapsedTime}ms 경과, ${i}/${products.length}개 처리됨`,
      );
      // 타임아웃이 임박해도 계속 진행 (에러 발생 시에만 중단)
    }

    const productData = products[i];
    try {
      // 진행 상황 로깅 (10개마다 또는 마지막)
      if (i % 10 === 0 || i === products.length - 1) {
        console.log(
          `[importProducts] 진행 상황: ${i + 1}/${products.length} (${Math.round(((i + 1) / products.length) * 100)}%)`,
        );
      }
      
      console.log(
        `[importProducts] 상품 처리 중 (${i + 1}/${products.length}): ${
          productData.name
        }`,
      );

      // 카테고리 ID 찾기 (다중 카테고리 우선)
      let categoryIds: string[] = [];
      let categoryId: string | null = null; // 기본 카테고리 (하위 호환성)

      // 다중 카테고리 처리
      if (productData.category_slugs && productData.category_slugs.length > 0) {
        // 각 slug를 처리 (쉼표로 구분된 경우 분리)
        const allSlugs: string[] = [];
        productData.category_slugs.forEach((slug) => {
          // 쉼표로 구분된 경우 분리
          if (slug.includes(",")) {
            const parts = slug
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s);
            allSlugs.push(...parts);
          } else {
            allSlugs.push(slug);
          }
        });

        // 각 slug를 카테고리 ID로 매핑
        categoryIds = allSlugs
          .map((slug) => categoryMap.get(slug))
          .filter((id): id is string => id !== undefined);

        // 중복 제거
        categoryIds = Array.from(new Set(categoryIds));

        if (categoryIds.length > 0) {
          categoryId = categoryIds[0]; // 첫 번째가 기본 카테고리
        } else {
          console.warn(
            `[importProducts] 카테고리 slug 매핑 실패: ${productData.name}`,
            `요청한 slugs: ${productData.category_slugs.join(", ")}`,
            `사용 가능한 slugs: ${Array.from(categoryMap.keys()).join(", ")}`,
          );
        }
      } else if (productData.category_slug) {
        // 단일 카테고리 (하위 호환성)
        // 쉼표로 구분된 경우 첫 번째만 사용
        const slug = productData.category_slug.includes(",")
          ? productData.category_slug.split(",")[0].trim()
          : productData.category_slug;

        const singleCategoryId = categoryMap.get(slug);
        if (singleCategoryId) {
          categoryId = singleCategoryId;
          categoryIds = [singleCategoryId];
        } else {
          console.warn(
            `[importProducts] 카테고리 slug 매핑 실패: ${productData.name}`,
            `요청한 slug: ${productData.category_slug}`,
            `사용 가능한 slugs: ${Array.from(categoryMap.keys()).join(", ")}`,
          );
        }
      }

      // 카테고리가 없으면 첫 번째 카테고리 사용 (항상 보장)
      if (categoryIds.length === 0) {
        if (categories && categories.length > 0) {
          categoryId = categories[0].id;
          categoryIds = [categories[0].id];
          console.warn(
            `[importProducts] 카테고리 매핑 실패, 기본 카테고리 사용: ${productData.name} -> ${categories[0].name}`,
          );
        } else {
          // 카테고리가 하나도 없으면 에러 (이 경우는 거의 없음)
          const errorMessage = `카테고리를 찾을 수 없습니다. (요청한 카테고리: ${
            productData.category_slugs?.join(", ") ||
            productData.category_slug ||
            "없음"
          })`;
          console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
          errors.push({
            product_name: productData.name,
            message: errorMessage,
          });
          failed++;
          continue;
        }
      }

      // categoryId가 여전히 null이면 첫 번째 카테고리 사용
      if (!categoryId && categoryIds.length > 0) {
        categoryId = categoryIds[0];
        console.warn(
          `[importProducts] categoryId가 null이어서 첫 번째 카테고리 사용: ${productData.name}`,
        );
      }

      // slug 중복 확인 및 해결 (더 견고한 방식)
      let finalSlug = productData.slug || `product-${Date.now()}-${i}`;
      
      // slug가 비어있거나 너무 짧으면 자동 생성
      if (!finalSlug || finalSlug.trim().length < 3) {
        finalSlug = `product-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
        console.warn(`[importProducts] slug가 비어있어 자동 생성: ${finalSlug}`);
      }

      // slug 중복 확인 (최대 20번 시도)
      let slugRetryCount = 0;
      const maxSlugRetries = 20;

      while (slugRetryCount < maxSlugRetries) {
        const { data: existing, error: checkError } = await supabase
          .from("products")
          .select("id")
          .eq("slug", finalSlug)
          .is("deleted_at", null)
          .maybeSingle();

        if (checkError && checkError.code !== "PGRST116") {
          // PGRST116은 "결과 없음" 에러이므로 정상
          console.warn(`[importProducts] slug 중복 확인 중 에러 (무시):`, checkError);
        }

        if (!existing) {
          // 중복 없음, 사용 가능
          break;
        }

        // slug가 중복되면 고유한 값 추가 (인덱스 + 타임스탬프 + 랜덤)
        const uniqueSuffix = `${i}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        finalSlug = `${productData.slug || "product"}-${uniqueSuffix}`;
        slugRetryCount++;
        
        if (slugRetryCount <= 5) {
          console.warn(
            `[importProducts] slug 중복 (시도 ${slugRetryCount}/${maxSlugRetries}), 새 slug 생성: ${finalSlug}`,
          );
        }
      }

      if (slugRetryCount >= maxSlugRetries) {
        // 최대 재시도 후에도 실패하면 완전히 고유한 slug 생성
        finalSlug = `product-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 15)}`;
        console.warn(
          `[importProducts] slug 중복 해결을 위해 완전히 새로운 slug 생성: ${finalSlug}`,
        );
      }

      if (finalSlug !== productData.slug) {
        productData.slug = finalSlug;
        console.log(
          `[importProducts] slug 최종 결정: ${productData.slug} -> ${finalSlug}`,
        );
      }

      // 상품 생성 입력 데이터 준비
      const createInput: CreateProductInput = {
        category_id: categoryId!, // 기본 카테고리 (하위 호환성)
        category_ids: categoryIds, // 다중 카테고리
        name: productData.name,
        slug: productData.slug,
        price: productData.price,
        discount_price: productData.discount_price,
        description: productData.description,
        status: productData.status,
        stock: productData.stock,
        is_featured: productData.is_featured,
        is_new: productData.is_new,
        images: productData.image_urls.map((url, index) => ({
          image_url: url,
          is_primary: index === 0,
          sort_order: index,
          alt_text: productData.name,
        })),
      };

      // 입력 데이터 검증 및 로깅
      console.log(`[importProducts] 상품 생성 시도 (${i + 1}/${products.length}):`, {
        name: createInput.name,
        slug: createInput.slug,
        category_id: createInput.category_id,
        price: createInput.price,
        discount_price: createInput.discount_price,
        stock: createInput.stock,
        status: createInput.status,
      });

      // 데이터 검증
      if (!createInput.category_id) {
        const errorMessage = "category_id가 없습니다.";
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      if (!createInput.slug || createInput.slug.trim() === "") {
        const errorMessage = "slug가 없습니다.";
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      if (createInput.price < 0) {
        const errorMessage = `가격이 음수입니다: ${createInput.price}`;
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      if (createInput.discount_price !== null && createInput.discount_price > createInput.price) {
        const errorMessage = `할인가가 정가보다 큽니다: ${createInput.discount_price} > ${createInput.price}`;
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      if (createInput.stock < 0) {
        const errorMessage = `재고가 음수입니다: ${createInput.stock}`;
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      if (!["active", "hidden", "sold_out"].includes(createInput.status)) {
        const errorMessage = `잘못된 상태 값입니다: ${createInput.status}`;
        console.error(`[importProducts] ${errorMessage}: ${productData.name}`);
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        continue;
      }

      // 상품 생성 (재시도 로직 포함)
      let product: { id: string } | null = null;
      let productError: any = null;
      let insertRetryCount = 0;
      const maxInsertRetries = 3;
      let currentSlug = createInput.slug;

      while (insertRetryCount < maxInsertRetries && !product) {
        // 타임아웃 체크 (각 상품 처리 전)
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_EXECUTION_TIME) {
          console.error(
            `[importProducts] 타임아웃 발생: ${elapsedTime}ms 경과, ${i}/${products.length}개 처리됨`,
          );
          throw new Error(`타임아웃: ${i}/${products.length}개 처리 후 중단`);
        }

        // INSERT 직전에 slug 중복 다시 확인 (race condition 방지)
        if (insertRetryCount > 0) {
          // 재시도 시 slug 변경
          currentSlug = `${createInput.slug}-retry-${insertRetryCount}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          console.warn(
            `[importProducts] 상품 생성 재시도 ${insertRetryCount}/${maxInsertRetries}, slug 변경: ${currentSlug}`,
          );
        }

        const { data: insertResult, error: insertError } = await supabase
          .from("products")
          .insert({
            category_id: createInput.category_id,
            name: createInput.name,
            slug: currentSlug,
            price: createInput.price,
            discount_price: createInput.discount_price,
            description: createInput.description,
            status: createInput.status,
            stock: createInput.stock,
            is_featured: createInput.is_featured,
            is_new: createInput.is_new,
            smartstore_product_id: productData.smartstore_product_id || null,
          })
          .select("id")
          .single();

        if (insertError) {
          productError = insertError;
          
          // slug 중복 에러인 경우 재시도
          if (
            insertError.code === "23505" ||
            insertError.message?.includes("duplicate") ||
            insertError.message?.includes("unique")
          ) {
            insertRetryCount++;
            console.warn(
              `[importProducts] slug 중복 에러 감지, 재시도 ${insertRetryCount}/${maxInsertRetries}`,
            );
            // 짧은 대기 후 재시도 (race condition 방지)
            await new Promise((resolve) => setTimeout(resolve, 50)); // 100ms -> 50ms로 단축
            continue;
          } else {
            // 다른 에러는 즉시 실패 처리
            break;
          }
        } else if (insertResult) {
          product = insertResult;
          // 성공 시 slug 업데이트
          if (currentSlug !== createInput.slug) {
            createInput.slug = currentSlug;
            productData.slug = currentSlug;
          }
          break;
        }
      }

      if (productError || !product) {
        const errorMessage = `상품 생성 실패 (재시도 ${insertRetryCount}회): ${
          productError?.message || "알 수 없는 오류"
        } (코드: ${productError?.code || "N/A"})`;
        console.error(
          `[importProducts] ${errorMessage}: ${productData.name}`,
          {
            error: productError,
            input: {
              category_id: createInput.category_id,
              slug: currentSlug,
              price: createInput.price,
              discount_price: createInput.discount_price,
              stock: createInput.stock,
              status: createInput.status,
            },
          },
        );
        console.warn(
          `[importProducts] 상품 생성 실패, 다음 상품으로 계속 진행합니다.`,
        );
        errors.push({
          product_name: productData.name,
          message: errorMessage,
        });
        failed++;
        // 상품 생성 실패해도 계속 진행
        continue;
      }

      // 이미지 저장 (이미지 업로드는 나중에 처리하거나 원본 URL 사용)
      // 타임아웃 방지를 위해 이미지 업로드를 비동기로 처리하거나 원본 URL 사용
      if (createInput.images && createInput.images.length > 0) {
        // 타임아웃 방지를 위해 이미지 업로드는 건너뛰고 원본 URL 사용
        // 필요시 나중에 별도 작업으로 이미지 업로드 가능
        const imageData = createInput.images.map((img, index) => ({
          product_id: product.id,
          image_url: img.image_url, // 원본 URL 사용 (나중에 업로드 가능)
          is_primary: img.is_primary,
          sort_order: img.sort_order,
          alt_text: img.alt_text || productData.name,
        }));

        const { error: imageError } = await supabase
          .from("product_images")
          .insert(imageData);

        if (imageError) {
          console.error(`이미지 저장 실패: ${productData.name}`, imageError);
          // 이미지는 실패해도 상품은 생성됨
        }
        // 성공 로그는 제거 (너무 많은 로그 방지)
      }

      // 다중 카테고리 저장 (product_categories 테이블)
      if (categoryIds.length > 0) {
        // 기존 카테고리 관계 삭제 (중복 방지)
        const { error: deleteError } = await supabase
          .from("product_categories")
          .delete()
          .eq("product_id", product.id);

        if (deleteError) {
          console.warn(
            `기존 카테고리 삭제 실패 (무시): ${productData.name}`,
            deleteError,
          );
        }

        // 중복 제거 (이중 안전장치)
        const uniqueCategoryIds = Array.from(new Set(categoryIds));

        const productCategoryData = uniqueCategoryIds.map((catId, index) => ({
          product_id: product.id,
          category_id: catId,
          is_primary: index === 0, // 첫 번째 카테고리가 기본 카테고리
          sort_order: index,
        }));

        const { error: categoryError } = await supabase
          .from("product_categories")
          .insert(productCategoryData);

        if (categoryError) {
          console.error(
            `카테고리 저장 실패: ${productData.name}`,
            categoryError,
          );
          // 카테고리는 실패해도 상품은 생성됨
        } else {
          console.log(
            `카테고리 저장 성공: ${productData.name} (${uniqueCategoryIds.length}개)`,
          );
        }
      }

      // 옵션 저장
      if (productData.variants && productData.variants.length > 0) {
        const variantData = productData.variants.map((variant) => ({
          product_id: product.id,
          variant_name: variant.variant_name,
          variant_value: variant.variant_value,
          stock: variant.stock,
          price_adjustment: variant.price_adjustment,
          sku: variant.sku || null,
        }));

        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantData);

        if (variantError) {
          console.error(`옵션 저장 실패: ${productData.name}`, variantError);
          // 옵션은 실패해도 상품은 생성됨
        }
      }

      imported++;
      // 진행 상황 로깅 (10개마다 또는 마지막)
      if (imported % 10 === 0 || imported === products.length) {
        console.log(
          `[importProducts] 상품 생성 진행: ${imported}/${products.length} (${Math.round((imported / products.length) * 100)}%)`,
        );
      }
    } catch (error) {
      const errorMessage = `처리 중 오류: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`;
      console.error(
        `[importProducts] ${errorMessage}: ${productData.name}`,
        error,
      );
      console.warn(
        `[importProducts] 상품 처리 실패, 다음 상품으로 계속 진행합니다.`,
      );
      errors.push({
        product_name: productData.name,
        message: errorMessage,
      });
      failed++;
      // 에러가 발생해도 계속 진행 (break 대신 continue)
      continue;
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");

  // 중단된 경우 확인 (처리된 상품 수가 전체보다 적고 실패가 있는 경우)
  const wasStopped = failed > 0 && imported + failed < products.length;

  console.log(
    `이관 완료: 성공 ${imported}개, 실패 ${failed}개${
      wasStopped ? " (중단됨)" : ""
    }`,
  );
  console.groupEnd();

  return {
    success: failed === 0 && !wasStopped,
    message: wasStopped
      ? `${imported}개 상품이 이관되었으나, ${
          errors.length > 0
            ? errors[errors.length - 1]?.product_name
            : "알 수 없는"
        } 상품 처리 중 오류가 발생하여 작업이 중단되었습니다.`
      : `${imported}개 상품이 성공적으로 이관되었습니다.${
          failed > 0 ? ` (${failed}개 실패)` : ""
        }`,
    imported,
    failed,
    errors,
  };
}
