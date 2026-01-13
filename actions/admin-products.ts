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
import {
  extractFilePathFromUrl,
  extractBucketFromUrl,
} from "@/lib/utils/storage-url";

// 상품 생성
export async function createProduct(
  input: CreateProductInput,
): Promise<ProductActionResult> {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[createProduct] 관리자 권한 없음");
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
      logger.warn("[createProduct] slug 중복", { slug: input.slug });
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
      logger.error("[createProduct] 상품 생성 실패", productError);
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
        logger.error("[createProduct] 이미지 추가 실패", imageError);
      }
    }

    // 다중 카테고리 추가 (product_categories 테이블)
    const categoryIds =
      input.category_ids && input.category_ids.length > 0
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
        logger.error("[createProduct] 카테고리 추가 실패", categoryError);
      }
    }

    // 옵션 추가 (variants가 제공된 경우)
    if (input.variants && input.variants.length > 0) {
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
        logger.error("[createProduct] 옵션 추가 실패", variantError);
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("[createProduct] 상품 생성 완료", { productId: product.id });
    return {
      success: true,
      message: "상품이 생성되었습니다.",
      productId: product.id,
    };
  } catch (error) {
    logger.error("[createProduct] 예외 발생", error);
    return { success: false, message: "상품 생성에 실패했습니다." };
  }
}

// 상품 수정
export async function updateProduct(
  input: UpdateProductInput,
): Promise<ProductActionResult> {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[updateProduct] 관리자 권한 없음");
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
        logger.warn("[updateProduct] slug 중복", { slug: input.slug });
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
      logger.error("[updateProduct] 상품 수정 실패", error);
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

    logger.info("[updateProduct] 상품 수정 완료", { productId: input.id });
    return { success: true, message: "상품이 수정되었습니다." };
  } catch (error) {
    logger.error("[updateProduct] 예외 발생", error);
    return { success: false, message: "상품 수정에 실패했습니다." };
  }
}

// 상품 삭제 (soft delete)
export async function deleteProduct(
  productId: string,
): Promise<{ success: boolean; message: string }> {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteProduct] 관리자 권한 없음");
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();

    // Service Role 클라이언트 가져오기 (Storage 파일 삭제용)
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const serviceRoleSupabase = getServiceRoleClient();

    // 1. 상품의 모든 이미지 조회
    const { data: productImages, error: imagesError } = await supabase
      .from("product_images")
      .select("id, image_url")
      .eq("product_id", productId);

    if (imagesError) {
      logger.error("[deleteProduct] 이미지 조회 실패", imagesError);
      // 이미지 조회 실패해도 상품 삭제는 진행
    } else if (productImages && productImages.length > 0) {
      // 2. 각 이미지의 Storage 파일 삭제
      for (const image of productImages) {
        if (image.image_url) {
          // Next.js Image 최적화 URL인 경우 원본 URL 추출
          let originalUrl = image.image_url;
          if (image.image_url.includes("/_next/image?url=")) {
            try {
              const urlParams = new URLSearchParams(
                image.image_url.split("?")[1],
              );
              const encodedUrl = urlParams.get("url");
              if (encodedUrl) {
                originalUrl = decodeURIComponent(encodedUrl);
              }
            } catch (e) {
              logger.warn("[deleteProduct] URL 디코딩 실패", e);
            }
          }

          const filePath = extractFilePathFromUrl(originalUrl);
          const bucketName = extractBucketFromUrl(originalUrl);

          if (filePath && bucketName) {
            const { error: storageError } = await serviceRoleSupabase.storage
              .from(bucketName)
              .remove([filePath]);

            if (storageError) {
              logger.error("[deleteProduct] Storage 파일 삭제 실패", {
                bucketName,
                filePath,
                error: storageError,
              });
            }
          } else if (
            !originalUrl.includes("shop-phinf.pstatic.net") &&
            !originalUrl.includes("shop1.phinf.naver.net") &&
            originalUrl.includes("supabase.co/storage")
          ) {
            logger.warn("[deleteProduct] 파일 경로 또는 버킷 추출 실패", {
              originalUrl,
            });
          }
        }
      }

      // 3. 데이터베이스에서 이미지 레코드 삭제
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", productId);

      if (deleteImagesError) {
        logger.error(
          "[deleteProduct] 이미지 레코드 삭제 실패",
          deleteImagesError,
        );
      }
    }

    // 4. 상품 삭제 (soft delete)
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      logger.error("[deleteProduct] 상품 삭제 실패", error);
      return { success: false, message: "상품 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("[deleteProduct] 상품 삭제 완료", { productId });
    return { success: true, message: "상품이 삭제되었습니다." };
  } catch (error) {
    logger.error("[deleteProduct] 예외 발생", error);
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
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[addProductImage] 관리자 권한 없음");
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
      logger.error("[addProductImage] 이미지 추가 실패", error);
      return { success: false, message: "이미지 추가에 실패했습니다." };
    }

    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");

    logger.info("[addProductImage] 이미지 추가 완료", { imageId: data.id });
    return {
      success: true,
      message: "이미지가 추가되었습니다.",
      imageId: data.id,
    };
  } catch (error) {
    logger.error("[addProductImage] 예외 발생", error);
    return { success: false, message: "이미지 추가에 실패했습니다." };
  }
}

// 상품 이미지 삭제
export async function deleteProductImage(
  imageId: string,
): Promise<{ success: boolean; message: string }> {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteProductImage] 관리자 권한 없음");
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
      logger.error("[deleteProductImage] 이미지 정보 조회 실패", fetchError);
      return {
        success: false,
        message: "이미지 정보를 가져오는데 실패했습니다.",
      };
    }

    // Storage에서 파일 삭제
    if (imageData?.image_url) {
      const filePath = extractFilePathFromUrl(imageData.image_url);
      const bucketName = extractBucketFromUrl(imageData.image_url);

      if (filePath && bucketName) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) {
          logger.error("[deleteProductImage] Storage 파일 삭제 실패", {
            bucketName,
            filePath,
            error: storageError,
          });
          // Storage 삭제 실패해도 DB 삭제는 진행
        }
      } else if (
        !imageData.image_url.includes("shop-phinf.pstatic.net") &&
        !imageData.image_url.includes("supabase.co/storage")
      ) {
        logger.warn("[deleteProductImage] 파일 경로 또는 버킷 추출 실패", {
          imageUrl: imageData.image_url,
        });
      }
    }

    // 데이터베이스에서 이미지 레코드 삭제
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      logger.error("[deleteProductImage] 이미지 삭제 실패", error);
      return { success: false, message: "이미지 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    logger.info("[deleteProductImage] 이미지 삭제 완료", { imageId });
    return { success: true, message: "이미지가 삭제되었습니다." };
  } catch (error) {
    logger.error("[deleteProductImage] 예외 발생", error);
    return { success: false, message: "이미지 삭제에 실패했습니다." };
  }
}
