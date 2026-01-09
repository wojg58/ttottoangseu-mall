/**
 * @file actions/admin.ts
 * @description 관리자 관련 Server Actions
 *
 * 주요 기능:
 * 1. 관리자 권한 확인
 * 2. 대시보드 통계 조회
 * 3. 모든 주문 조회/관리
 */

"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  ProductListItem,
  ProductWithDetails,
} from "@/types/database";

// 관리자 이메일 목록 (환경 변수로 관리 권장)
const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",") || [
  "admin@ttottoangs.com",
];

// 관리자 권한 확인
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;

  const email = user.emailAddresses[0]?.emailAddress;
  return ADMIN_EMAILS.includes(email || "");
}

// 대시보드 통계
export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  recentOrders: Order[];
}

// 대시보드 통계 조회
export async function getDashboardStats(): Promise<DashboardStats | null> {
  console.group("[getDashboardStats] 대시보드 통계 조회");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return null;
  }

  const supabase = await createClient();

  // 전체 주문 수
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  // 대기 중인 주문 수
  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["PENDING", "PAID"]);

  // 총 매출
  const { data: revenueData } = await supabase
    .from("orders")
    .select("total_amount")
    .in("status", ["PAID"]);

  const totalRevenue =
    revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 상품 수
  const { count: totalProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  // 최근 주문 5개
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("통계 조회 완료");
  console.groupEnd();

  return {
    totalOrders: totalOrders ?? 0,
    pendingOrders: pendingOrders ?? 0,
    totalRevenue,
    totalProducts: totalProducts ?? 0,
    recentOrders: (recentOrders as Order[]) || [],
  };
}

// 모든 주문 조회
export async function getAllOrders(
  status?: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ orders: Order[]; total: number; totalPages: number }> {
  console.group("[getAllOrders] 전체 주문 조회");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  const supabase = await createClient();

  let query = supabase.from("orders").select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  console.log("결과:", data?.length, "개 주문");
  console.groupEnd();

  return { orders: (data as Order[]) || [], total, totalPages };
}

// 주문 상태 업데이트
export async function updateOrderStatus(
  orderId: string,
  status: Order["status"],
  trackingNumber?: string,
): Promise<{ success: boolean; message: string }> {
  console.group("[updateOrderStatus] 주문 상태 업데이트");
  console.log("주문:", orderId, "상태:", status);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  const supabase = await createClient();

  const updateData: {
    status: Order["status"];
    tracking_number?: string;
    updated_at: string;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (trackingNumber) {
    updateData.tracking_number = trackingNumber;
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "주문 상태 업데이트에 실패했습니다." };
  }

  console.log("성공");
  console.groupEnd();
  return { success: true, message: "주문 상태가 업데이트되었습니다." };
}

// 상품 목록 조회 (관리자용)
export async function getAdminProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery?: string,
): Promise<{ products: ProductListItem[]; total: number; totalPages: number }> {
  console.group("[getAdminProducts] 관리자 상품 조회");
  console.log("페이지:", page, "페이지 크기:", pageSize, "검색어:", searchQuery || "(없음)");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { products: [], total: 0, totalPages: 0 };
  }

  const supabase = await createClient();

  // 쿼리 빌더 생성
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

  // 검색어가 있으면 상품명으로 필터링
  if (searchQuery && searchQuery.trim()) {
    console.log("[getAdminProducts] 검색 필터 적용:", searchQuery.trim());
    query = query.ilike("name", `%${searchQuery.trim()}%`);
  }

  // 전체 데이터 가져오기 (정렬을 위해)
  const { data: allData, error, count } = await query;

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { products: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // 정렬 로직: ttotto_pr_001을 맨 앞으로, ttotto_pr_316을 맨 뒤로
  const sortedData = (allData || []).sort((a, b) => {
    const idA = a.id as string;
    const idB = b.id as string;

    // ttotto_pr_001을 항상 맨 앞으로
    if (idA === "ttotto_pr_001") return -1;
    if (idB === "ttotto_pr_001") return 1;

    // ttotto_pr_316을 항상 맨 뒤로
    if (idA === "ttotto_pr_316") return 1;
    if (idB === "ttotto_pr_316") return -1;

    // 나머지는 id 기준으로 정렬 (숫자 부분 추출하여 비교)
    const extractNumber = (id: string): number => {
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const numA = extractNumber(idA);
    const numB = extractNumber(idB);

    return numA - numB;
  });

  console.log(
    `정렬 완료: 총 ${sortedData.length}개${sortedData.length > 0 ? `, 첫 번째: ${sortedData[0]?.id}, 마지막: ${sortedData[sortedData.length - 1]?.id}` : ""}`,
  );

  // 페이지네이션 적용
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const paginatedData = sortedData.slice(from, to + 1);

  // 데이터 변환
  const products = (paginatedData || []).map((product) => {
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

  console.log("결과:", products.length, "개 상품");
  console.groupEnd();

  return { products, total, totalPages };
}

// 상품 ID로 조회 (관리자용)
export async function getProductById(
  productId: string,
): Promise<ProductWithDetails | null> {
  console.group("[getProductById] 상품 조회");
  console.log("상품 ID:", productId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(*),
      images:product_images(*),
      variants:product_variants(*),
      product_categories:product_categories(category_id, is_primary, sort_order)
    `,
    )
    .eq("id", productId)
    .single();

  if (error || !data) {
    console.error("에러:", error);
    console.groupEnd();
    return null;
  }

  console.log("결과:", data?.name);
  console.groupEnd();

  return data as unknown as ProductWithDetails;
}
