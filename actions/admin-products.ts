/**
 * @file actions/admin-products.ts
 * @description 관리자 상품 관리 Server Actions
 *
 * 주요 기능:
 * 1. 상품 생성
 * 2. 상품 수정
 * 3. 상품 삭제 (soft delete)
 * 4. 상품 이미지 관리
 */

"use server";

import { isAdmin } from "./admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Product, ProductImage } from "@/types/database";
import {
  extractFilePathFromUrl,
  extractBucketFromUrl,
} from "@/lib/utils/storage-url";
import { logger } from "@/lib/logger";

// 상품 생성 입력 타입
export interface CreateProductInput {
  category_id: string; // 기본 카테고리 (하위 호환성)
  category_ids?: string[]; // 다중 카테고리
  name: string;
  slug: string;
  price: number;
  discount_price?: number | null;
  description?: string | null;
  status: "active" | "hidden" | "sold_out";
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  images?: Array<{
    image_url: string;
    is_primary: boolean;
    sort_order: number;
    alt_text?: string | null;
  }>;
  variants?: Array<{
    variant_name: string;
    variant_value: string;
    stock: number;
    price_adjustment: number;
    sku?: string | null;
  }>;
}

// 상품 생성
export async function createProduct(
  input: CreateProductInput,
): Promise<{ success: boolean; message: string; productId?: string }> {
  logger.group("[createProduct] 상품 생성");
  logger.debug("입력:", input);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("관리자 권한 없음");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();

    // slug 중복 확인
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("slug", input.slug)
      .is("deleted_at", null)
      .single();

    if (existing) {
      logger.warn("slug 중복");
      logger.groupEnd();
      return { success: false, message: "이미 사용 중인 slug입니다." };
    }

    // 상품 생성
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        category_id: input.category_id,
        name: input.name,
        slug: input.slug,
        price: input.price,
        discount_price: input.discount_price ?? null,
        description: input.description ?? null,
        status: input.status,
        stock: input.stock,
        is_featured: input.is_featured,
        is_new: input.is_new,
      })
      .select("id")
      .single();

    if (productError || !product) {
      logger.error("상품 생성 에러:", productError);
      logger.groupEnd();
      return { success: false, message: "상품 생성에 실패했습니다." };
    }

    // 이미지 추가
    if (input.images && input.images.length > 0) {
      const imageData = input.images.map((img) => ({
        product_id: product.id,
        image_url: img.image_url,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
        alt_text: img.alt_text ?? null,
      }));

      const { error: imageError } = await supabase
        .from("product_images")
        .insert(imageData);

      if (imageError) {
        logger.error("이미지 추가 에러:", imageError);
        // 상품은 생성되었으므로 경고만 출력
      }
    }

    // 다중 카테고리 추가 (product_categories 테이블)
    const categoryIds = input.category_ids && input.category_ids.length > 0
      ? input.category_ids
      : [input.category_id]; // category_ids가 없으면 기본 category_id 사용

    if (categoryIds.length > 0) {
      const productCategoryData = categoryIds.map((categoryId, index) => ({
        product_id: product.id,
        category_id: categoryId,
        is_primary: index === 0, // 첫 번째 카테고리가 기본 카테고리
        sort_order: index,
      }));

      const { error: categoryError } = await supabase
        .from("product_categories")
        .insert(productCategoryData);

      if (categoryError) {
        logger.error("카테고리 추가 에러:", categoryError);
        // 상품은 생성되었으므로 경고만 출력
      } else {
        logger.info(`카테고리 ${categoryIds.length}개 추가 완료`);
      }
    }

    // 옵션 추가 (variants가 제공된 경우)
    if (input.variants && input.variants.length > 0) {
      logger.debug("[createProduct] 옵션 추가 시작");
      const variantData = input.variants.map((variant) => ({
        product_id: product.id,
        variant_name: variant.variant_name,
        variant_value: variant.variant_value,
        stock: variant.stock,
        price_adjustment: variant.price_adjustment,
        sku: variant.sku ?? null,
      }));

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(variantData);

      if (variantError) {
        logger.error("옵션 추가 에러:", variantError);
      } else {
        logger.info(`옵션 ${input.variants.length}개 추가 완료`);
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("상품 생성 성공:", product.id);
    logger.groupEnd();
    return {
      success: true,
      message: "상품이 생성되었습니다.",
      productId: product.id,
    };
  } catch (error) {
    logger.error("에러:", error);
    logger.groupEnd();
    return { success: false, message: "상품 생성에 실패했습니다." };
  }
}

// 상품 수정 입력 타입
export interface UpdateProductInput {
  id: string;
  category_id?: string; // 기본 카테고리 (하위 호환성)
  category_ids?: string[]; // 다중 카테고리
  name?: string;
  slug?: string;
  price?: number;
  discount_price?: number | null;
  description?: string | null;
  status?: "active" | "hidden" | "sold_out";
  stock?: number;
  is_featured?: boolean;
  is_new?: boolean;
  images?: Array<{
    id?: string; // 기존 이미지의 경우 id가 있음
    image_url: string;
    is_primary: boolean;
    sort_order: number;
    alt_text?: string | null;
  }>;
  deletedImageIds?: string[]; // 명시적으로 삭제할 이미지 ID 목록
  variants?: Array<{
    id?: string; // 기존 옵션의 경우 id가 있음
    variant_name: string;
    variant_value: string;
    stock: number;
    price_adjustment: number;
    sku?: string | null;
  }>;
}

// 상품 수정
export async function updateProduct(
  input: UpdateProductInput,
): Promise<{ success: boolean; message: string }> {
  logger.group("[updateProduct] 상품 수정");
  logger.debug("입력:", input);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("관리자 권한 없음");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();

    // slug 중복 확인 (자기 자신 제외)
    if (input.slug) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("slug", input.slug)
        .neq("id", input.id)
        .is("deleted_at", null)
        .single();

      if (existing) {
        logger.warn("slug 중복");
        logger.groupEnd();
        return { success: false, message: "이미 사용 중인 slug입니다." };
      }
    }

    // 업데이트할 데이터 준비
    const updateData: Partial<Product> = {};
    if (input.category_id) updateData.category_id = input.category_id;
    if (input.name) updateData.name = input.name;
    if (input.slug) updateData.slug = input.slug;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.discount_price !== undefined)
      updateData.discount_price = input.discount_price;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status) updateData.status = input.status;
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.is_featured !== undefined)
      updateData.is_featured = input.is_featured;
    if (input.is_new !== undefined) updateData.is_new = input.is_new;

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", input.id);

    if (error) {
      logger.error("상품 수정 에러:", error);
      logger.groupEnd();
      return { success: false, message: "상품 수정에 실패했습니다." };
    }

    // 다중 카테고리 업데이트 (category_ids가 제공된 경우)
    if (input.category_ids !== undefined) {
      // 기존 카테고리 관계 삭제
      const { error: deleteError } = await supabase
        .from("product_categories")
        .delete()
        .eq("product_id", input.id);

      if (deleteError) {
        logger.error("기존 카테고리 삭제 에러:", deleteError);
      }

      // 새로운 카테고리 관계 추가
      if (input.category_ids.length > 0) {
        const productCategoryData = input.category_ids.map((categoryId, index) => ({
          product_id: input.id,
          category_id: categoryId,
          is_primary: index === 0, // 첫 번째 카테고리가 기본 카테고리
          sort_order: index,
        }));

        const { error: categoryError } = await supabase
          .from("product_categories")
          .insert(productCategoryData);

        if (categoryError) {
          logger.error("카테고리 업데이트 에러:", categoryError);
        } else {
          logger.info(`카테고리 ${input.category_ids.length}개 업데이트 완료`);
        }
      }
    }

    // 이미지 업데이트 (images가 제공된 경우)
    if (input.images !== undefined) {
      logger.debug("[updateProduct] 이미지 업데이트 시작");
      logger.debug("[updateProduct] 전달된 이미지 수:", input.images.length);
      logger.debug("[updateProduct] 전달된 이미지 데이터:", JSON.stringify(input.images, null, 2));
      logger.debug("[updateProduct] 명시적으로 삭제할 이미지 ID 목록:", input.deletedImageIds || []);
      
      // 기존 이미지 목록 가져오기 (image_url 포함)
      const { data: existingImages } = await supabase
        .from("product_images")
        .select("id, image_url")
        .eq("product_id", input.id);

      logger.debug("[updateProduct] 기존 이미지 수:", existingImages?.length || 0);
      logger.debug("[updateProduct] 기존 이미지 ID 목록:", existingImages?.map(img => img.id) || []);

      // 전달된 이미지 중 기존 이미지 ID 추출
      const existingImageIds = input.images
        .map((img) => img.id)
        .filter((id): id is string => !!id);

      logger.debug("[updateProduct] 전달된 이미지 중 기존 ID 목록:", existingImageIds);

      // 삭제할 이미지 ID 결정
      // 1. 명시적으로 삭제할 이미지 ID가 있으면 우선 사용
      // 2. 없으면 기존에 있지만 전달되지 않은 이미지
      let imagesToDelete: Array<{ id: string; image_url: string }> = [];
      
      if (input.deletedImageIds && input.deletedImageIds.length > 0) {
        // 명시적으로 삭제할 이미지 ID 사용
        logger.debug("[updateProduct] 명시적 삭제 모드: 삭제할 이미지 ID 목록 사용");
        logger.debug("[updateProduct] 전달된 deletedImageIds:", input.deletedImageIds);
        logger.debug("[updateProduct] 기존 이미지 목록:", existingImages?.map(img => ({ id: img.id, url: img.image_url })));
        imagesToDelete = existingImages?.filter((img) => 
          input.deletedImageIds!.includes(img.id)
        ) || [];
        logger.debug("[updateProduct] 필터링된 삭제 대상:", imagesToDelete.map(img => ({ id: img.id, url: img.image_url })));
      } else {
        // 기존 로직: 기존에 있지만 전달되지 않은 이미지
        logger.debug("[updateProduct] 자동 삭제 모드: 전달되지 않은 이미지 삭제");
        imagesToDelete = existingImages?.filter((img) => 
          !existingImageIds.includes(img.id)
        ) || [];
      }

      logger.debug("[updateProduct] 삭제 대상 이미지 수:", imagesToDelete.length);
      logger.debug("[updateProduct] 삭제 대상 이미지 ID 목록:", imagesToDelete.map(img => img.id));
      logger.debug("[updateProduct] 삭제 대상 이미지 URL 목록:", imagesToDelete.map(img => img.image_url));

      // 삭제할 이미지가 있으면 삭제
      if (imagesToDelete.length > 0) {
        const deleteIds = imagesToDelete.map((img) => img.id);
        
        logger.group(`[updateProduct] ${deleteIds.length}개 이미지 삭제 시작`);
        
        // Storage에서 파일 삭제
        let storageDeleteSuccessCount = 0;
        let storageDeleteFailCount = 0;
        
        for (const imageToDelete of imagesToDelete) {
          if (imageToDelete.image_url) {
            logger.debug(`[updateProduct] 삭제 대상 이미지 URL: ${imageToDelete.image_url}`);
            
            const filePath = extractFilePathFromUrl(imageToDelete.image_url);
            const bucketName = extractBucketFromUrl(imageToDelete.image_url);
            
            logger.debug(`[updateProduct] 추출된 정보:`, { filePath, bucketName });
            
            if (filePath && bucketName) {
              try {
                logger.debug(`[updateProduct] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
                const { data, error: storageError } = await supabase.storage
                  .from(bucketName)
                  .remove([filePath]);

                if (storageError) {
                  logger.error(`[updateProduct] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
                  logger.error(`[updateProduct] 에러 상세:`, JSON.stringify(storageError, null, 2));
                  storageDeleteFailCount++;
                  // Storage 삭제 실패해도 계속 진행 (이미 삭제된 파일일 수 있음)
                } else {
                  logger.debug(`[updateProduct] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
                  logger.debug(`[updateProduct] 삭제 결과:`, data);
                  storageDeleteSuccessCount++;
                }
              } catch (error) {
                logger.error(`[updateProduct] Storage 파일 삭제 중 예외 발생:`, error);
                storageDeleteFailCount++;
                // 예외 발생해도 계속 진행
              }
            } else {
              // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
              // Supabase Storage URL이 아닌 경우만 외부 URL로 간주
              const isSupabaseUrl = imageToDelete.image_url.includes("supabase.co/storage");
              const isExternalUrl = !isSupabaseUrl && (
                imageToDelete.image_url.includes("shop-phinf.pstatic.net") ||
                imageToDelete.image_url.startsWith("http://") ||
                imageToDelete.image_url.startsWith("https://")
              );
              
              if (isExternalUrl) {
                logger.debug(`[updateProduct] 외부 URL이므로 Storage 삭제 건너뜀: ${imageToDelete.image_url}`);
                storageDeleteSuccessCount++; // 외부 URL은 성공으로 간주
              } else {
                logger.warn(`[updateProduct] 파일 경로 또는 버킷 추출 실패: ${imageToDelete.image_url}`);
                storageDeleteFailCount++;
              }
            }
          }
        }

        logger.info(`[updateProduct] Storage 삭제 결과: 성공 ${storageDeleteSuccessCount}개, 실패 ${storageDeleteFailCount}개`);

        // 데이터베이스에서 이미지 레코드 삭제 (Storage 삭제 실패해도 DB는 삭제)
        // ⚠️ 중요: RLS 정책을 우회하기 위해 Service Role 클라이언트 사용
        try {
          logger.debug(`[updateProduct] 데이터베이스에서 이미지 삭제 시도: ${deleteIds.length}개`);
          logger.debug(`[updateProduct] 삭제할 이미지 ID 목록:`, deleteIds);
          
          // Service Role 클라이언트 가져오기 (RLS 우회)
          const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
          const serviceRoleSupabase = getServiceRoleClient();
          
          // 삭제 전에 실제로 존재하는 이미지 ID만 필터링
          const { data: existingImageIds, error: checkError } = await serviceRoleSupabase
            .from("product_images")
            .select("id")
            .eq("product_id", input.id)
            .in("id", deleteIds);
          
          if (checkError) {
            logger.error("[updateProduct] 이미지 존재 확인 에러:", checkError);
          } else {
            const validDeleteIds = existingImageIds?.map(img => img.id) || [];
            const invalidIds = deleteIds.filter(id => !validDeleteIds.includes(id));
            
            if (invalidIds.length > 0) {
              logger.warn(`[updateProduct] 존재하지 않는 이미지 ID (무시됨):`, invalidIds);
            }
            
            if (validDeleteIds.length > 0) {
              logger.debug(`[updateProduct] Service Role 클라이언트로 이미지 삭제 실행: ${validDeleteIds.length}개`);
              const { data: deleteResult, error: deleteImageError } = await serviceRoleSupabase
                .from("product_images")
                .delete()
                .in("id", validDeleteIds)
                .select(); // 삭제된 레코드 반환

              if (deleteImageError) {
                logger.error("[updateProduct] 데이터베이스 이미지 삭제 에러:", deleteImageError);
                logger.error("[updateProduct] 에러 상세:", JSON.stringify(deleteImageError, null, 2));
                throw new Error(`이미지 삭제 실패: ${deleteImageError.message}`);
              } else {
                logger.info(`[updateProduct] 데이터베이스에서 이미지 ${validDeleteIds.length}개 삭제 완료`);
                logger.debug(`[updateProduct] 삭제된 레코드:`, deleteResult);
                
                // 삭제 후 확인: 실제로 삭제되었는지 검증
                const { data: remainingImages, error: verifyError } = await serviceRoleSupabase
                  .from("product_images")
                  .select("id, image_url, is_primary")
                  .eq("product_id", input.id);
                
                if (verifyError) {
                  logger.error("[updateProduct] 삭제 후 검증 에러:", verifyError);
                } else {
                  logger.debug(`[updateProduct] 삭제 후 남은 이미지 수: ${remainingImages?.length || 0}개`);
                  logger.debug(`[updateProduct] 삭제 후 남은 이미지 ID 목록:`, remainingImages?.map(img => img.id) || []);
                  logger.debug(`[updateProduct] 삭제 후 남은 이미지 정보:`, remainingImages);
                  
                  // 삭제가 제대로 되지 않았다면 경고
                  if (remainingImages && remainingImages.length > 1) {
                    logger.warn(`[updateProduct] ⚠️ 경고: 삭제 후에도 ${remainingImages.length}개의 이미지가 남아있습니다.`);
                  }
                }
              }
            } else {
              logger.warn("[updateProduct] 삭제할 유효한 이미지가 없습니다.");
            }
          }
        } catch (error) {
          logger.error("[updateProduct] 데이터베이스 이미지 삭제 중 예외 발생:", error);
          // 이미지 삭제 실패 시에도 상품 수정은 계속 진행하되, 경고 메시지 반환
          logger.warn("[updateProduct] 이미지 삭제 실패했지만 상품 수정은 계속 진행합니다.");
        }
        
        logger.groupEnd();
      } else {
        logger.debug("[updateProduct] 삭제할 이미지가 없습니다.");
      }

      // 대표 이미지로 설정하는 경우, 기존 대표 이미지 해제
      const hasPrimaryImage = input.images.some((img) => img.is_primary);
      if (hasPrimaryImage) {
        await supabase
          .from("product_images")
          .update({ is_primary: false })
          .eq("product_id", input.id)
          .eq("is_primary", true);
      }

      // 새로 추가할 이미지와 업데이트할 이미지 분리
      const imagesToInsert: Array<{
        product_id: string;
        image_url: string;
        is_primary: boolean;
        sort_order: number;
        alt_text: string | null;
      }> = [];
      const imagesToUpdate: Array<{
        id: string;
        image_url?: string;
        is_primary?: boolean;
        sort_order?: number;
        alt_text?: string | null;
      }> = [];

      input.images.forEach((img) => {
        if (img.id) {
          // 기존 이미지 업데이트
          imagesToUpdate.push({
            id: img.id,
            is_primary: img.is_primary,
            sort_order: img.sort_order,
            alt_text: img.alt_text ?? null,
          });
        } else {
          // 새 이미지 추가
          imagesToInsert.push({
            product_id: input.id,
            image_url: img.image_url,
            is_primary: img.is_primary,
            sort_order: img.sort_order,
            alt_text: img.alt_text ?? null,
          });
        }
      });

      // 기존 이미지 업데이트
      if (imagesToUpdate.length > 0) {
        logger.debug(`[updateProduct] 업데이트할 이미지 수: ${imagesToUpdate.length}`);
        logger.debug(`[updateProduct] 업데이트할 이미지 ID 목록:`, imagesToUpdate.map(img => img.id));
        for (const img of imagesToUpdate) {
          const { error: updateError } = await supabase
            .from("product_images")
            .update({
              is_primary: img.is_primary,
              sort_order: img.sort_order,
              alt_text: img.alt_text,
            })
            .eq("id", img.id);

          if (updateError) {
            logger.error(`[updateProduct] 이미지 ${img.id} 업데이트 에러:`, updateError);
          } else {
            logger.debug(`[updateProduct] 이미지 ${img.id} 업데이트 성공`);
          }
        }
        logger.info(`[updateProduct] 기존 이미지 ${imagesToUpdate.length}개 업데이트 완료`);
      }

      // 새 이미지 추가
      if (imagesToInsert.length > 0) {
        logger.debug(`[updateProduct] 추가할 이미지 수: ${imagesToInsert.length}`);
        const { error: insertImageError } = await supabase
          .from("product_images")
          .insert(imagesToInsert);

        if (insertImageError) {
          logger.error("이미지 추가 에러:", insertImageError);
        } else {
          logger.info(`새 이미지 ${imagesToInsert.length}개 추가 완료`);
        }
      }

      logger.info("[updateProduct] 이미지 업데이트 완료");
    }

    // 옵션 업데이트 (variants가 제공된 경우)
    if (input.variants !== undefined) {
      logger.debug("[updateProduct] 옵션 업데이트 시작");

      // 기존 옵션 목록 가져오기
      const { data: existingVariants } = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", input.id)
        .is("deleted_at", null);

      // 전달된 옵션 중 기존 옵션 ID 추출
      const existingVariantIds = input.variants
        .map((v) => v.id)
        .filter((id): id is string => !!id);

      // 삭제할 옵션 ID (기존에 있지만 전달되지 않은 옵션)
      const variantsToDelete =
        existingVariants?.filter((v) => !existingVariantIds.includes(v.id)) ||
        [];

      // 삭제할 옵션이 있으면 삭제 (soft delete)
      if (variantsToDelete.length > 0) {
        const deleteIds = variantsToDelete.map((v) => v.id);
        const { error: deleteVariantError } = await supabase
          .from("product_variants")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", deleteIds);

        if (deleteVariantError) {
          logger.error("옵션 삭제 에러:", deleteVariantError);
        } else {
          logger.info(`기존 옵션 ${deleteIds.length}개 삭제 완료`);
        }
      }

      // 새로 추가할 옵션과 업데이트할 옵션 분리
      const variantsToInsert: Array<{
        product_id: string;
        variant_name: string;
        variant_value: string;
        stock: number;
        price_adjustment: number;
        sku: string | null;
      }> = [];
      const variantsToUpdate: Array<{
        id: string;
        variant_name?: string;
        variant_value?: string;
        stock?: number;
        price_adjustment?: number;
        sku?: string | null;
      }> = [];

      input.variants.forEach((variant) => {
        if (variant.id) {
          // 기존 옵션 업데이트
          variantsToUpdate.push({
            id: variant.id,
            variant_name: variant.variant_name,
            variant_value: variant.variant_value,
            stock: variant.stock,
            price_adjustment: variant.price_adjustment,
            sku: variant.sku ?? null,
          });
        } else {
          // 새 옵션 추가
          variantsToInsert.push({
            product_id: input.id,
            variant_name: variant.variant_name,
            variant_value: variant.variant_value,
            stock: variant.stock,
            price_adjustment: variant.price_adjustment,
            sku: variant.sku ?? null,
          });
        }
      });

      // 기존 옵션 업데이트
      if (variantsToUpdate.length > 0) {
        for (const variant of variantsToUpdate) {
          const { error: updateError } = await supabase
            .from("product_variants")
            .update({
              variant_name: variant.variant_name,
              variant_value: variant.variant_value,
              stock: variant.stock,
              price_adjustment: variant.price_adjustment,
              sku: variant.sku,
              updated_at: new Date().toISOString(),
            })
            .eq("id", variant.id);

          if (updateError) {
            logger.error(`옵션 ${variant.id} 업데이트 에러:`, updateError);
          }
        }
        logger.info(`기존 옵션 ${variantsToUpdate.length}개 업데이트 완료`);
      }

      // 새 옵션 추가
      if (variantsToInsert.length > 0) {
        const { error: insertVariantError } = await supabase
          .from("product_variants")
          .insert(variantsToInsert);

        if (insertVariantError) {
          logger.error("옵션 추가 에러:", insertVariantError);
        } else {
          logger.info(`새 옵션 ${variantsToInsert.length}개 추가 완료`);
        }
      }

      logger.info("[updateProduct] 옵션 업데이트 완료");
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.id}`);
    revalidatePath(`/products/${input.slug || ""}`);
    revalidatePath("/products");

    logger.info("상품 수정 성공");
    logger.groupEnd();
    return { success: true, message: "상품이 수정되었습니다." };
  } catch (error) {
    logger.error("에러:", error);
    logger.groupEnd();
    return { success: false, message: "상품 수정에 실패했습니다." };
  }
}

// 상품 삭제 (soft delete)
export async function deleteProduct(
  productId: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[deleteProduct] 상품 삭제");
  logger.debug("상품 ID:", productId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("관리자 권한 없음");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();
    
    // Service Role 클라이언트 가져오기 (Storage 파일 삭제용)
    const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
    const serviceRoleSupabase = getServiceRoleClient();

    // 1. 상품의 모든 이미지 조회
    logger.debug("[deleteProduct] 상품 이미지 조회 중...");
    const { data: productImages, error: imagesError } = await supabase
      .from("product_images")
      .select("id, image_url")
      .eq("product_id", productId);

    if (imagesError) {
      logger.error("[deleteProduct] 이미지 조회 에러:", imagesError);
      // 이미지 조회 실패해도 상품 삭제는 진행
    } else {
      logger.debug(`[deleteProduct] 발견된 이미지 수: ${productImages?.length || 0}개`);
      
      if (productImages && productImages.length > 0) {
        logger.debug("[deleteProduct] 이미지 목록:", productImages.map(img => ({
          id: img.id,
          url: img.image_url
        })));
      }

      // 2. 각 이미지의 Storage 파일 삭제
      if (productImages && productImages.length > 0) {
        let deletedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        
        for (const image of productImages) {
          if (image.image_url) {
            logger.debug(`[deleteProduct] 이미지 삭제 처리 시작:`, {
              imageId: image.id,
              imageUrl: image.image_url
            });
            
            // Next.js Image 최적화 URL인 경우 원본 URL 추출
            let originalUrl = image.image_url;
            if (image.image_url.includes("/_next/image?url=")) {
              try {
                const urlParams = new URLSearchParams(image.image_url.split("?")[1]);
                const encodedUrl = urlParams.get("url");
                if (encodedUrl) {
                  originalUrl = decodeURIComponent(encodedUrl);
                  logger.debug(`[deleteProduct] Next.js Image URL에서 원본 URL 추출: ${originalUrl}`);
                }
              } catch (e) {
                logger.warn(`[deleteProduct] URL 디코딩 실패:`, e);
              }
            }
            
            const filePath = extractFilePathFromUrl(originalUrl);
            const bucketName = extractBucketFromUrl(originalUrl);
            
            logger.debug(`[deleteProduct] 추출된 정보:`, {
              originalUrl,
              filePath,
              bucketName
            });
            
            if (filePath && bucketName) {
              logger.debug(`[deleteProduct] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
              const { data: removeData, error: storageError } = await serviceRoleSupabase.storage
                .from(bucketName)
                .remove([filePath]);

              if (storageError) {
                logger.error(`[deleteProduct] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
                logger.error(`[deleteProduct] 에러 상세:`, JSON.stringify(storageError, null, 2));
                failedCount++;
                // Storage 삭제 실패해도 DB 삭제는 진행
              } else {
                logger.debug(`[deleteProduct] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
                logger.debug(`[deleteProduct] 삭제 결과:`, removeData);
                deletedCount++;
              }
            } else {
              // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
              if (originalUrl.includes("shop-phinf.pstatic.net") || 
                  originalUrl.includes("shop1.phinf.naver.net") ||
                  (!originalUrl.includes("supabase.co/storage"))) {
                logger.debug(`[deleteProduct] 외부 URL이므로 Storage 삭제 건너뜀: ${originalUrl}`);
                skippedCount++;
              } else {
                logger.warn(`[deleteProduct] 파일 경로 또는 버킷 추출 실패:`, {
                  originalUrl,
                  filePath,
                  bucketName
                });
                failedCount++;
              }
            }
          }
        }
        
        logger.info(`[deleteProduct] 이미지 삭제 요약:`, {
          총개수: productImages.length,
          삭제성공: deletedCount,
          건너뜀: skippedCount,
          실패: failedCount
        });

        // 3. 데이터베이스에서 이미지 레코드 삭제
        logger.debug("[deleteProduct] 데이터베이스에서 이미지 레코드 삭제 중...");
        const { error: deleteImagesError } = await supabase
          .from("product_images")
          .delete()
          .eq("product_id", productId);

        if (deleteImagesError) {
          logger.error("[deleteProduct] 이미지 레코드 삭제 에러:", deleteImagesError);
          // 이미지 레코드 삭제 실패해도 상품 삭제는 진행
        } else {
          logger.info(`[deleteProduct] ${productImages.length}개 이미지 레코드 삭제 완료`);
        }
      }
    }

    // 4. 상품 삭제 (soft delete)
    logger.debug("[deleteProduct] 상품 삭제 처리 중...");
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      logger.error("상품 삭제 에러:", error);
      logger.groupEnd();
      return { success: false, message: "상품 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("상품 삭제 성공");
    logger.groupEnd();
    return { success: true, message: "상품이 삭제되었습니다." };
  } catch (error) {
    logger.error("에러:", error);
    logger.groupEnd();
    return { success: false, message: "상품 삭제에 실패했습니다." };
  }
}

// 상품 이미지 추가
export async function addProductImage(
  productId: string,
  imageData: {
    image_url: string;
    is_primary: boolean;
    sort_order: number;
    alt_text?: string | null;
  },
): Promise<{ success: boolean; message: string; imageId?: string }> {
  logger.group("[addProductImage] 이미지 추가");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();

    // 대표 이미지로 설정하는 경우, 기존 대표 이미지 해제
    if (imageData.is_primary) {
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId)
        .eq("is_primary", true);
    }

    const { data, error } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        ...imageData,
      })
      .select("id")
      .single();

    if (error || !data) {
      logger.error("이미지 추가 에러:", error);
      logger.groupEnd();
      return { success: false, message: "이미지 추가에 실패했습니다." };
    }

    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");

    logger.info("이미지 추가 성공");
    logger.groupEnd();
    return {
      success: true,
      message: "이미지가 추가되었습니다.",
      imageId: data.id,
    };
  } catch (error) {
    logger.error("에러:", error);
    logger.groupEnd();
    return { success: false, message: "이미지 추가에 실패했습니다." };
  }
}

// 상품 이미지 삭제
export async function deleteProductImage(
  imageId: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[deleteProductImage] 이미지 삭제");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();

    // 삭제하기 전에 이미지 정보 가져오기 (Storage 파일 삭제용)
    const { data: imageData, error: fetchError } = await supabase
      .from("product_images")
      .select("image_url")
      .eq("id", imageId)
      .single();

    if (fetchError) {
      logger.error("이미지 정보 조회 에러:", fetchError);
      logger.groupEnd();
      return { success: false, message: "이미지 정보를 가져오는데 실패했습니다." };
    }

    // Storage에서 파일 삭제
    if (imageData?.image_url) {
      logger.debug(`[deleteProductImage] 삭제 대상 이미지 URL: ${imageData.image_url}`);
      
      const filePath = extractFilePathFromUrl(imageData.image_url);
      const bucketName = extractBucketFromUrl(imageData.image_url);
      
      logger.debug(`[deleteProductImage] 추출된 정보:`, { filePath, bucketName });
      
      if (filePath && bucketName) {
        logger.debug(`[deleteProductImage] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
        const { data, error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) {
          logger.error(`[deleteProductImage] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
          logger.error(`[deleteProductImage] 에러 상세:`, JSON.stringify(storageError, null, 2));
          // Storage 삭제 실패해도 DB 삭제는 진행
        } else {
          logger.debug(`[deleteProductImage] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
          logger.debug(`[deleteProductImage] 삭제 결과:`, data);
        }
      } else {
        // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
        if (imageData.image_url.includes("shop-phinf.pstatic.net") || 
            imageData.image_url.includes("http://") || 
            imageData.image_url.includes("https://")) {
          logger.debug(`[deleteProductImage] 외부 URL이므로 Storage 삭제 건너뜀: ${imageData.image_url}`);
        } else {
          logger.warn(`[deleteProductImage] 파일 경로 또는 버킷 추출 실패: ${imageData.image_url}`);
        }
      }
    }

    // 데이터베이스에서 이미지 레코드 삭제
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      logger.error("이미지 삭제 에러:", error);
      logger.groupEnd();
      return { success: false, message: "이미지 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("이미지 삭제 성공");
    logger.groupEnd();
    return { success: true, message: "이미지가 삭제되었습니다." };
  } catch (error) {
    logger.error("에러:", error);
    logger.groupEnd();
    return { success: false, message: "이미지 삭제에 실패했습니다." };
  }
}
