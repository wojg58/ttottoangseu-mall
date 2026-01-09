/**
 * @file types/products.ts
 * @description 상품 관련 타입 정의
 *
 * 상품 생성, 수정, 조회에 사용되는 모든 타입을 통합 관리합니다.
 */

import type { ProductStatus } from "./database";

// =============================================
// 상품 입력 타입
// =============================================

/**
 * 상품 이미지 입력 타입
 */
export interface ProductImageInput {
  id?: string; // 기존 이미지의 경우 id가 있음
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  alt_text?: string | null;
}

/**
 * 상품 옵션(변형) 입력 타입
 */
export interface ProductVariantInput {
  id?: string; // 기존 옵션의 경우 id가 있음
  variant_name: string;
  variant_value: string;
  stock: number;
  price_adjustment: number;
  sku?: string | null;
}

/**
 * 상품 생성 입력 타입
 */
export interface CreateProductInput {
  category_id: string; // 기본 카테고리 (하위 호환성)
  category_ids?: string[]; // 다중 카테고리
  name: string;
  slug: string;
  price: number;
  discount_price?: number | null;
  description?: string | null;
  status: ProductStatus;
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  images?: ProductImageInput[];
  variants?: ProductVariantInput[];
}

/**
 * 상품 수정 입력 타입
 */
export interface UpdateProductInput {
  id: string;
  category_id?: string; // 기본 카테고리 (하위 호환성)
  category_ids?: string[]; // 다중 카테고리
  name?: string;
  slug?: string;
  price?: number;
  discount_price?: number | null;
  description?: string | null;
  status?: ProductStatus;
  stock?: number;
  is_featured?: boolean;
  is_new?: boolean;
  images?: ProductImageInput[];
  deletedImageIds?: string[]; // 명시적으로 삭제할 이미지 ID 목록
  variants?: ProductVariantInput[];
}

// =============================================
// 상품 필터 타입
// =============================================

/**
 * 상품 목록 필터 타입
 */
export interface ProductFilters {
  categorySlug?: string;
  featured?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "newest" | "price_asc" | "price_desc" | "name";
}

// =============================================
// 상품 응답 타입
// =============================================

/**
 * 상품 생성/수정 응답 타입
 */
export interface ProductActionResult {
  success: boolean;
  message: string;
  productId?: string;
}

