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

    revalidatePath("/admin/products");
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
