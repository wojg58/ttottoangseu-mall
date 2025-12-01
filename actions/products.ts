/**
 * @file actions/products.ts
 * @description 상품 관련 Server Actions
 *
 * 주요 기능:
 * 1. 상품 목록 조회 (필터링, 정렬, 페이지네이션)
 * 2. 상품 상세 조회
 * 3. 카테고리별 상품 조회
 *
 * @dependencies
 * - Supabase: 데이터베이스 쿼리
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ProductListItem,
  ProductWithDetails,
  Category,
  PaginatedResponse,
} from "@/types/database";

// 상품 목록 필터 타입
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

// 상품 목록 조회
export async function getProducts(
  filters: ProductFilters = {},
  page: number = 1,
  pageSize: number = 12,
): Promise<PaginatedResponse<ProductListItem>> {
  console.group("[getProducts] 상품 목록 조회");
  console.log("필터:", filters);
  console.log("페이지:", page, "페이지 크기:", pageSize);

  const supabase = await createClient();

  // 기본 쿼리 빌드
  let query = supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null);

  // 카테고리 필터
  if (filters.categorySlug) {
    console.log("카테고리 필터 적용:", filters.categorySlug);
    // 먼저 카테고리 ID 조회
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .single();

    if (category) {
      query = query.eq("category_id", category.id);
    }
  }

  // 베스트 상품 필터
  if (filters.featured) {
    query = query.eq("is_featured", true);
  }

  // 신상품 필터
  if (filters.isNew) {
    query = query.eq("is_new", true);
  }

  // 할인 상품 필터
  if (filters.onSale) {
    query = query.not("discount_price", "is", null);
  }

  // 검색어 필터
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  // 가격 필터
  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }

  // 정렬
  switch (filters.sortBy) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
  }

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // 데이터 변환
  const products: ProductListItem[] = (data || []).map((product) => {
    const p = product as {
      id: string;
      category_id: string;
      name: string;
      slug: string;
      price: number;
      discount_price: number | null;
      description: string | null;
      status: "active" | "hidden" | "sold_out";
      stock: number;
      is_featured: boolean;
      is_new: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      category: { id: string; name: string; slug: string };
      images: Array<{
        id: string;
        image_url: string;
        is_primary: boolean;
        alt_text: string | null;
      }>;
    };

    const primaryImage =
      p.images?.find((img) => img.is_primary) || p.images?.[0] || null;

    return {
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      discount_price: p.discount_price,
      description: p.description,
      status: p.status,
      stock: p.stock,
      is_featured: p.is_featured,
      is_new: p.is_new,
      deleted_at: p.deleted_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
      category: p.category,
      primary_image: primaryImage
        ? {
            id: primaryImage.id,
            product_id: p.id,
            image_url: primaryImage.image_url,
            is_primary: primaryImage.is_primary,
            sort_order: 0,
            alt_text: primaryImage.alt_text,
            created_at: p.created_at,
          }
        : null,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  console.log("결과:", { count: products.length, total, totalPages });
  console.groupEnd();

  return {
    data: products,
    total,
    page,
    pageSize,
    totalPages,
  };
}

// 상품 상세 조회
export async function getProductBySlug(
  slug: string,
): Promise<ProductWithDetails | null> {
  console.group("[getProductBySlug] 상품 상세 조회");
  console.log("slug:", slug);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(*),
      images:product_images(*),
      variants:product_variants(*)
    `,
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return null;
  }

  console.log("결과:", data?.name);
  console.groupEnd();

  return data as unknown as ProductWithDetails;
}

// 카테고리 목록 조회
export async function getCategories(): Promise<Category[]> {
  console.group("[getCategories] 카테고리 목록 조회");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return [];
  }

  console.log("결과:", data?.length, "개 카테고리");
  console.groupEnd();

  return data as Category[];
}

// 카테고리 상세 조회
export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  console.group("[getCategoryBySlug] 카테고리 상세 조회");
  console.log("slug:", slug);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return null;
  }

  console.log("결과:", data?.name);
  console.groupEnd();

  return data as Category;
}
