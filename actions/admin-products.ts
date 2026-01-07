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

/**
 * Supabase Storage URL에서 파일 경로를 추출합니다.
 * @param imageUrl - Supabase Storage URL (예: https://xxx.supabase.co/storage/v1/object/public/product-images/products/xxx.webp)
 * @returns 파일 경로 (예: products/xxx.webp) 또는 null
 */
function extractFilePathFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // /storage/v1/object/public/product-images/ 또는 /storage/v1/object/sign/product-images/ 경로에서 파일 경로 추출
    const productImagesMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/product-images\/(.+)$/);
    if (productImagesMatch && productImagesMatch[1]) {
      return productImagesMatch[1];
    }
    // 하위 호환성: uploads 버킷도 지원
    const uploadsMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/uploads\/(.+)$/);
    if (uploadsMatch && uploadsMatch[1]) {
      return uploadsMatch[1];
    }
    return null;
  } catch (error) {
    console.error("[extractFilePathFromUrl] URL 파싱 에러:", error);
    return null;
  }
}

/**
 * Supabase Storage URL에서 버킷 이름을 추출합니다.
 * @param imageUrl - Supabase Storage URL
 * @returns 버킷 이름 (예: "product-images" 또는 "uploads") 또는 null
 */
function extractBucketFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // product-images 버킷 확인
    if (url.pathname.includes("/product-images/")) {
      return "product-images";
    }
    // uploads 버킷 확인 (하위 호환성)
    if (url.pathname.includes("/uploads/")) {
      return "uploads";
    }
    return null;
  } catch (error) {
    console.error("[extractBucketFromUrl] URL 파싱 에러:", error);
    return null;
  }
}

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
  console.group("[createProduct] 상품 생성");
  console.log("입력:", input);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
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
      console.log("slug 중복");
      console.groupEnd();
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
      console.error("상품 생성 에러:", productError);
      console.groupEnd();
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
        console.error("이미지 추가 에러:", imageError);
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
        console.error("카테고리 추가 에러:", categoryError);
        // 상품은 생성되었으므로 경고만 출력
      } else {
        console.log(`카테고리 ${categoryIds.length}개 추가 완료`);
      }
    }

    // 옵션 추가 (variants가 제공된 경우)
    if (input.variants && input.variants.length > 0) {
      console.log("[createProduct] 옵션 추가 시작");
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
        console.error("옵션 추가 에러:", variantError);
      } else {
        console.log(`옵션 ${input.variants.length}개 추가 완료`);
      }
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("상품 생성 성공:", product.id);
    console.groupEnd();
    return {
      success: true,
      message: "상품이 생성되었습니다.",
      productId: product.id,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
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
  console.group("[updateProduct] 상품 수정");
  console.log("입력:", input);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
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
        console.log("slug 중복");
        console.groupEnd();
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
      console.error("상품 수정 에러:", error);
      console.groupEnd();
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
        console.error("기존 카테고리 삭제 에러:", deleteError);
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
          console.error("카테고리 업데이트 에러:", categoryError);
        } else {
          console.log(`카테고리 ${input.category_ids.length}개 업데이트 완료`);
        }
      }
    }

    // 이미지 업데이트 (images가 제공된 경우)
    if (input.images !== undefined) {
      console.log("[updateProduct] 이미지 업데이트 시작");
      console.log("[updateProduct] 전달된 이미지 수:", input.images.length);
      console.log("[updateProduct] 전달된 이미지 데이터:", JSON.stringify(input.images, null, 2));
      console.log("[updateProduct] 명시적으로 삭제할 이미지 ID 목록:", input.deletedImageIds || []);
      
      // 기존 이미지 목록 가져오기 (image_url 포함)
      const { data: existingImages } = await supabase
        .from("product_images")
        .select("id, image_url")
        .eq("product_id", input.id);

      console.log("[updateProduct] 기존 이미지 수:", existingImages?.length || 0);
      console.log("[updateProduct] 기존 이미지 ID 목록:", existingImages?.map(img => img.id) || []);

      // 전달된 이미지 중 기존 이미지 ID 추출
      const existingImageIds = input.images
        .map((img) => img.id)
        .filter((id): id is string => !!id);

      console.log("[updateProduct] 전달된 이미지 중 기존 ID 목록:", existingImageIds);

      // 삭제할 이미지 ID 결정
      // 1. 명시적으로 삭제할 이미지 ID가 있으면 우선 사용
      // 2. 없으면 기존에 있지만 전달되지 않은 이미지
      let imagesToDelete: Array<{ id: string; image_url: string }> = [];
      
      if (input.deletedImageIds && input.deletedImageIds.length > 0) {
        // 명시적으로 삭제할 이미지 ID 사용
        console.log("[updateProduct] 명시적 삭제 모드: 삭제할 이미지 ID 목록 사용");
        imagesToDelete = existingImages?.filter((img) => 
          input.deletedImageIds!.includes(img.id)
        ) || [];
      } else {
        // 기존 로직: 기존에 있지만 전달되지 않은 이미지
        console.log("[updateProduct] 자동 삭제 모드: 전달되지 않은 이미지 삭제");
        imagesToDelete = existingImages?.filter((img) => 
          !existingImageIds.includes(img.id)
        ) || [];
      }

      console.log("[updateProduct] 삭제 대상 이미지 수:", imagesToDelete.length);
      console.log("[updateProduct] 삭제 대상 이미지 ID 목록:", imagesToDelete.map(img => img.id));
      console.log("[updateProduct] 삭제 대상 이미지 URL 목록:", imagesToDelete.map(img => img.image_url));

      // 삭제할 이미지가 있으면 삭제
      if (imagesToDelete.length > 0) {
        const deleteIds = imagesToDelete.map((img) => img.id);
        
        console.group(`[updateProduct] ${deleteIds.length}개 이미지 삭제 시작`);
        
        // Storage에서 파일 삭제
        let storageDeleteSuccessCount = 0;
        let storageDeleteFailCount = 0;
        
        for (const imageToDelete of imagesToDelete) {
          if (imageToDelete.image_url) {
            console.log(`[updateProduct] 삭제 대상 이미지 URL: ${imageToDelete.image_url}`);
            
            const filePath = extractFilePathFromUrl(imageToDelete.image_url);
            const bucketName = extractBucketFromUrl(imageToDelete.image_url);
            
            console.log(`[updateProduct] 추출된 정보:`, { filePath, bucketName });
            
            if (filePath && bucketName) {
              try {
                console.log(`[updateProduct] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
                const { data, error: storageError } = await supabase.storage
                  .from(bucketName)
                  .remove([filePath]);

                if (storageError) {
                  console.error(`[updateProduct] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
                  console.error(`[updateProduct] 에러 상세:`, JSON.stringify(storageError, null, 2));
                  storageDeleteFailCount++;
                  // Storage 삭제 실패해도 계속 진행 (이미 삭제된 파일일 수 있음)
                } else {
                  console.log(`[updateProduct] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
                  console.log(`[updateProduct] 삭제 결과:`, data);
                  storageDeleteSuccessCount++;
                }
              } catch (error) {
                console.error(`[updateProduct] Storage 파일 삭제 중 예외 발생:`, error);
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
                console.log(`[updateProduct] 외부 URL이므로 Storage 삭제 건너뜀: ${imageToDelete.image_url}`);
                storageDeleteSuccessCount++; // 외부 URL은 성공으로 간주
              } else {
                console.warn(`[updateProduct] 파일 경로 또는 버킷 추출 실패: ${imageToDelete.image_url}`);
                storageDeleteFailCount++;
              }
            }
          }
        }

        console.log(`[updateProduct] Storage 삭제 결과: 성공 ${storageDeleteSuccessCount}개, 실패 ${storageDeleteFailCount}개`);

        // 데이터베이스에서 이미지 레코드 삭제 (Storage 삭제 실패해도 DB는 삭제)
        try {
          const { error: deleteImageError } = await supabase
            .from("product_images")
            .delete()
            .in("id", deleteIds);

          if (deleteImageError) {
            console.error("[updateProduct] 데이터베이스 이미지 삭제 에러:", deleteImageError);
            // DB 삭제 실패는 치명적이므로 에러를 throw하지 않고 로그만 남김
            // (이미지 삭제 실패가 전체 수정을 막지 않도록)
          } else {
            console.log(`[updateProduct] 데이터베이스에서 이미지 ${deleteIds.length}개 삭제 완료`);
            
            // 삭제 후 확인: 실제로 삭제되었는지 검증
            const { data: remainingImages, error: verifyError } = await supabase
              .from("product_images")
              .select("id")
              .eq("product_id", input.id);
            
            if (verifyError) {
              console.error("[updateProduct] 삭제 후 검증 에러:", verifyError);
            } else {
              console.log(`[updateProduct] 삭제 후 남은 이미지 수: ${remainingImages?.length || 0}개`);
              console.log(`[updateProduct] 삭제 후 남은 이미지 ID 목록:`, remainingImages?.map(img => img.id) || []);
            }
          }
        } catch (error) {
          console.error("[updateProduct] 데이터베이스 이미지 삭제 중 예외 발생:", error);
          // 예외 발생해도 계속 진행 (이미지 삭제 실패가 전체 수정을 막지 않도록)
        }
        
        console.groupEnd();
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
        console.log(`[updateProduct] 업데이트할 이미지 수: ${imagesToUpdate.length}`);
        console.log(`[updateProduct] 업데이트할 이미지 ID 목록:`, imagesToUpdate.map(img => img.id));
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
            console.error(`[updateProduct] 이미지 ${img.id} 업데이트 에러:`, updateError);
          } else {
            console.log(`[updateProduct] 이미지 ${img.id} 업데이트 성공`);
          }
        }
        console.log(`[updateProduct] 기존 이미지 ${imagesToUpdate.length}개 업데이트 완료`);
      }

      // 새 이미지 추가
      if (imagesToInsert.length > 0) {
        console.log(`[updateProduct] 추가할 이미지 수: ${imagesToInsert.length}`);
        const { error: insertImageError } = await supabase
          .from("product_images")
          .insert(imagesToInsert);

        if (insertImageError) {
          console.error("이미지 추가 에러:", insertImageError);
        } else {
          console.log(`새 이미지 ${imagesToInsert.length}개 추가 완료`);
        }
      }

      console.log("[updateProduct] 이미지 업데이트 완료");
    }

    // 옵션 업데이트 (variants가 제공된 경우)
    if (input.variants !== undefined) {
      console.log("[updateProduct] 옵션 업데이트 시작");

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
          console.error("옵션 삭제 에러:", deleteVariantError);
        } else {
          console.log(`기존 옵션 ${deleteIds.length}개 삭제 완료`);
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
            console.error(`옵션 ${variant.id} 업데이트 에러:`, updateError);
          }
        }
        console.log(`기존 옵션 ${variantsToUpdate.length}개 업데이트 완료`);
      }

      // 새 옵션 추가
      if (variantsToInsert.length > 0) {
        const { error: insertVariantError } = await supabase
          .from("product_variants")
          .insert(variantsToInsert);

        if (insertVariantError) {
          console.error("옵션 추가 에러:", insertVariantError);
        } else {
          console.log(`새 옵션 ${variantsToInsert.length}개 추가 완료`);
        }
      }

      console.log("[updateProduct] 옵션 업데이트 완료");
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${input.id}`);
    revalidatePath(`/products/${input.slug || ""}`);
    revalidatePath("/products");

    console.log("상품 수정 성공");
    console.groupEnd();
    return { success: true, message: "상품이 수정되었습니다." };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "상품 수정에 실패했습니다." };
  }
}

// 상품 삭제 (soft delete)
export async function deleteProduct(
  productId: string,
): Promise<{ success: boolean; message: string }> {
  console.group("[deleteProduct] 상품 삭제");
  console.log("상품 ID:", productId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  try {
    const supabase = await createClient();
    
    // Service Role 클라이언트 가져오기 (Storage 파일 삭제용)
    const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
    const serviceRoleSupabase = getServiceRoleClient();

    // 1. 상품의 모든 이미지 조회
    console.log("[deleteProduct] 상품 이미지 조회 중...");
    const { data: productImages, error: imagesError } = await supabase
      .from("product_images")
      .select("id, image_url")
      .eq("product_id", productId);

    if (imagesError) {
      console.error("[deleteProduct] 이미지 조회 에러:", imagesError);
      // 이미지 조회 실패해도 상품 삭제는 진행
    } else {
      console.log(`[deleteProduct] 발견된 이미지 수: ${productImages?.length || 0}개`);
      
      if (productImages && productImages.length > 0) {
        console.log("[deleteProduct] 이미지 목록:", productImages.map(img => ({
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
            console.log(`[deleteProduct] 이미지 삭제 처리 시작:`, {
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
                  console.log(`[deleteProduct] Next.js Image URL에서 원본 URL 추출: ${originalUrl}`);
                }
              } catch (e) {
                console.warn(`[deleteProduct] URL 디코딩 실패:`, e);
              }
            }
            
            const filePath = extractFilePathFromUrl(originalUrl);
            const bucketName = extractBucketFromUrl(originalUrl);
            
            console.log(`[deleteProduct] 추출된 정보:`, {
              originalUrl,
              filePath,
              bucketName
            });
            
            if (filePath && bucketName) {
              console.log(`[deleteProduct] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
              const { data: removeData, error: storageError } = await serviceRoleSupabase.storage
                .from(bucketName)
                .remove([filePath]);

              if (storageError) {
                console.error(`[deleteProduct] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
                console.error(`[deleteProduct] 에러 상세:`, JSON.stringify(storageError, null, 2));
                failedCount++;
                // Storage 삭제 실패해도 DB 삭제는 진행
              } else {
                console.log(`[deleteProduct] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
                console.log(`[deleteProduct] 삭제 결과:`, removeData);
                deletedCount++;
              }
            } else {
              // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
              if (originalUrl.includes("shop-phinf.pstatic.net") || 
                  originalUrl.includes("shop1.phinf.naver.net") ||
                  (!originalUrl.includes("supabase.co/storage"))) {
                console.log(`[deleteProduct] 외부 URL이므로 Storage 삭제 건너뜀: ${originalUrl}`);
                skippedCount++;
              } else {
                console.warn(`[deleteProduct] 파일 경로 또는 버킷 추출 실패:`, {
                  originalUrl,
                  filePath,
                  bucketName
                });
                failedCount++;
              }
            }
          }
        }
        
        console.log(`[deleteProduct] 이미지 삭제 요약:`, {
          총개수: productImages.length,
          삭제성공: deletedCount,
          건너뜀: skippedCount,
          실패: failedCount
        });

        // 3. 데이터베이스에서 이미지 레코드 삭제
        console.log("[deleteProduct] 데이터베이스에서 이미지 레코드 삭제 중...");
        const { error: deleteImagesError } = await supabase
          .from("product_images")
          .delete()
          .eq("product_id", productId);

        if (deleteImagesError) {
          console.error("[deleteProduct] 이미지 레코드 삭제 에러:", deleteImagesError);
          // 이미지 레코드 삭제 실패해도 상품 삭제는 진행
        } else {
          console.log(`[deleteProduct] ${productImages.length}개 이미지 레코드 삭제 완료`);
        }
      }
    }

    // 4. 상품 삭제 (soft delete)
    console.log("[deleteProduct] 상품 삭제 처리 중...");
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      console.error("상품 삭제 에러:", error);
      console.groupEnd();
      return { success: false, message: "상품 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("상품 삭제 성공");
    console.groupEnd();
    return { success: true, message: "상품이 삭제되었습니다." };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
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
  console.group("[addProductImage] 이미지 추가");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.groupEnd();
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
      console.error("이미지 추가 에러:", error);
      console.groupEnd();
      return { success: false, message: "이미지 추가에 실패했습니다." };
    }

    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");

    console.log("이미지 추가 성공");
    console.groupEnd();
    return {
      success: true,
      message: "이미지가 추가되었습니다.",
      imageId: data.id,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "이미지 추가에 실패했습니다." };
  }
}

// 상품 이미지 삭제
export async function deleteProductImage(
  imageId: string,
): Promise<{ success: boolean; message: string }> {
  console.group("[deleteProductImage] 이미지 삭제");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.groupEnd();
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
      console.error("이미지 정보 조회 에러:", fetchError);
      console.groupEnd();
      return { success: false, message: "이미지 정보를 가져오는데 실패했습니다." };
    }

    // Storage에서 파일 삭제
    if (imageData?.image_url) {
      console.log(`[deleteProductImage] 삭제 대상 이미지 URL: ${imageData.image_url}`);
      
      const filePath = extractFilePathFromUrl(imageData.image_url);
      const bucketName = extractBucketFromUrl(imageData.image_url);
      
      console.log(`[deleteProductImage] 추출된 정보:`, { filePath, bucketName });
      
      if (filePath && bucketName) {
        console.log(`[deleteProductImage] Storage 파일 삭제 시도: ${bucketName}/${filePath}`);
        const { data, error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (storageError) {
          console.error(`[deleteProductImage] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`, storageError);
          console.error(`[deleteProductImage] 에러 상세:`, JSON.stringify(storageError, null, 2));
          // Storage 삭제 실패해도 DB 삭제는 진행
        } else {
          console.log(`[deleteProductImage] Storage 파일 삭제 성공: ${bucketName}/${filePath}`);
          console.log(`[deleteProductImage] 삭제 결과:`, data);
        }
      } else {
        // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
        if (imageData.image_url.includes("shop-phinf.pstatic.net") || 
            imageData.image_url.includes("http://") || 
            imageData.image_url.includes("https://")) {
          console.log(`[deleteProductImage] 외부 URL이므로 Storage 삭제 건너뜀: ${imageData.image_url}`);
        } else {
          console.warn(`[deleteProductImage] 파일 경로 또는 버킷 추출 실패: ${imageData.image_url}`);
        }
      }
    }

    // 데이터베이스에서 이미지 레코드 삭제
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      console.error("이미지 삭제 에러:", error);
      console.groupEnd();
      return { success: false, message: "이미지 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("이미지 삭제 성공");
    console.groupEnd();
    return { success: true, message: "이미지가 삭제되었습니다." };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "이미지 삭제에 실패했습니다." };
  }
}
