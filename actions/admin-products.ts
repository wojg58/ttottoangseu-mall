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
import type { Product } from "@/types/database";
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductActionResult,
} from "@/types/products";
import { logger } from "@/lib/logger";
import { updateProductImages } from "@/lib/utils/product-image-manager";
import { updateProductVariants } from "@/lib/utils/product-variant-manager";
import { updateProductCategories } from "@/lib/utils/product-category-manager";

// 상품 생성
export async function createProduct(
  input: CreateProductInput,
): Promise<ProductActionResult> {
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

// 상품 수정
export async function updateProduct(
  input: UpdateProductInput,
): Promise<ProductActionResult> {
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
      await updateProductCategories(supabase, input.id, input.category_ids);
    }

    // 이미지 업데이트 (images가 제공된 경우)
    if (input.images !== undefined) {
      await updateProductImages(
        supabase,
        input.id,
        input.images,
        input.deletedImageIds,
      );
    }

    // 옵션 업데이트 (variants가 제공된 경우)
    if (input.variants !== undefined) {
      await updateProductVariants(supabase, input.id, input.variants);
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
