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
      
      // 기존 이미지 목록 가져오기
      const { data: existingImages } = await supabase
        .from("product_images")
        .select("id")
        .eq("product_id", input.id);

      // 전달된 이미지 중 기존 이미지 ID 추출
      const existingImageIds = input.images
        .map((img) => img.id)
        .filter((id): id is string => !!id);

      // 삭제할 이미지 ID (기존에 있지만 전달되지 않은 이미지)
      const imagesToDelete =
        existingImages?.filter((img) => !existingImageIds.includes(img.id)) || [];

      // 삭제할 이미지가 있으면 삭제
      if (imagesToDelete.length > 0) {
        const deleteIds = imagesToDelete.map((img) => img.id);
        const { error: deleteImageError } = await supabase
          .from("product_images")
          .delete()
          .in("id", deleteIds);

        if (deleteImageError) {
          console.error("이미지 삭제 에러:", deleteImageError);
        } else {
          console.log(`기존 이미지 ${deleteIds.length}개 삭제 완료`);
        }
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
            console.error(`이미지 ${img.id} 업데이트 에러:`, updateError);
          }
        }
        console.log(`기존 이미지 ${imagesToUpdate.length}개 업데이트 완료`);
      }

      // 새 이미지 추가
      if (imagesToInsert.length > 0) {
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
