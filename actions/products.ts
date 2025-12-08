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

  // 정렬 (기본 정렬이 slug 숫자 기준이므로, 먼저 전체 데이터를 가져온 후 정렬)
  let shouldSortBySlugNumber = false;
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
      // 기본 정렬: slug 숫자 기준 (PR_01, PR_02, ..., PR_403 순서)
      // slug 문자열 정렬은 "PR_10"이 "PR_2"보다 앞에 올 수 있으므로
      // 데이터를 가져온 후 숫자 부분을 추출해서 정렬
      shouldSortBySlugNumber = true;
      query = query.order("slug", { ascending: true }); // 임시로 slug 정렬 (나중에 재정렬)
  }

  // slug 숫자 기준 정렬인 경우, 페이지네이션 전에 전체 데이터를 가져와야 함
  let data, error, count;
  if (shouldSortBySlugNumber) {
    // 전체 데이터 가져오기 (페이지네이션 없이)
    const { data: allData, error: allError, count: allCount } = await query;
    data = allData;
    error = allError;
    count = allCount;
  } else {
    // 페이지네이션 적용
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
    const result = await query;
    data = result.data;
    error = result.error;
    count = result.count;
  }

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

  // slug 숫자 기준 정렬인 경우, 숫자 부분을 추출하여 정렬
  let sortedData = data || [];
  if (shouldSortBySlugNumber && sortedData.length > 0) {
    sortedData = [...sortedData].sort((a, b) => {
      const slugA = a.slug || "";
      const slugB = b.slug || "";

      // slug에서 숫자 부분 추출 (예: "PR_01" -> 1, "PR_403" -> 403)
      const extractNumber = (slug: string): number => {
        const match = slug.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const numA = extractNumber(slugA);
      const numB = extractNumber(slugB);

      // 숫자가 같으면 slug 전체로 정렬
      if (numA === numB) {
        return slugA.localeCompare(slugB);
      }

      return numA - numB;
    });

    // 정렬 후 페이지네이션 적용
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    sortedData = sortedData.slice(from, to);
  }

  // 데이터 변환
  const products: ProductListItem[] = sortedData.map((product) => {
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
