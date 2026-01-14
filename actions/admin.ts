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
import logger from "@/lib/logger";
import type {
  Order,
  OrderItem,
  ProductListItem,
  ProductWithDetails,
} from "@/types/database";

// 관리자 이메일 목록 (환경 변수로 관리 권장)
// 쉼표로 구분된 이메일을 배열로 변환하고, 공백 제거 및 소문자 변환
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS?.split(",") || [
  "admin@ttottoangs.com",
]).map((email) => email.trim().toLowerCase());

// 관리자 권한 확인
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) {
    logger.debug("[isAdmin] 사용자 미인증");
    return false;
  }

  // 모든 이메일 주소 확인 (primary email 우선, 그 다음 모든 이메일)
  const allEmails = user.emailAddresses?.map((addr) => 
    addr.emailAddress?.trim().toLowerCase()
  ).filter((email): email is string => !!email) || [];
  
  // primary email 우선 확인
  const primaryEmail = user.emailAddresses?.find((addr) => addr.id === user.primaryEmailAddressId)?.emailAddress?.trim().toLowerCase();
  
  // 모든 이메일 중 관리자 이메일이 있는지 확인
  const isAdminUser = allEmails.some((email) => ADMIN_EMAILS.includes(email));
  
  logger.debug("[isAdmin] 권한 확인", {
    primaryEmail: primaryEmail || "(없음)",
    allEmails: allEmails,
    adminEmails: ADMIN_EMAILS,
    isAdmin: isAdminUser,
    hasEnvVar: !!process.env.ADMIN_EMAILS,
  });
  
  return isAdminUser;
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

  // 대기 중인 주문 수 (payment_status 기준)
  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("payment_status", ["PENDING", "PAID"]);

  // 총 매출 (payment_status = PAID 기준)
  const { data: revenueData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID");

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
  paymentStatus?: string,
  fulfillmentStatus?: string,
  page: number = 1,
  pageSize: number = 20,
  startDate?: string,
  endDate?: string,
): Promise<{ orders: Order[]; total: number; totalPages: number }> {
  console.group("[getAllOrders] 전체 주문 조회");
  console.log("paymentStatus:", paymentStatus || "(전체)");
  console.log("fulfillmentStatus:", fulfillmentStatus || "(전체)");
  console.log("startDate:", startDate || "(전체)");
  console.log("endDate:", endDate || "(전체)");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  const supabase = await createClient();

  let query = supabase.from("orders").select("*", { count: "exact" });

  // payment_status 필터
  if (paymentStatus) {
    query = query.eq("payment_status", paymentStatus);
  }

  // fulfillment_status 필터
  if (fulfillmentStatus) {
    query = query.eq("fulfillment_status", fulfillmentStatus);
  }

  // 날짜 필터 (결제 완료일 기준 - paid_at 사용)
  // 날짜 필터가 있으면 결제 완료된 주문만 조회
  if (startDate || endDate) {
    query = query.not("paid_at", "is", null);
    query = query.eq("payment_status", "PAID");
  }

  if (startDate) {
    // 시작일 00:00:00부터
    const startDateTime = `${startDate}T00:00:00.000Z`;
    query = query.gte("paid_at", startDateTime);
  }

  if (endDate) {
    // 종료일 23:59:59까지
    const endDateTime = `${endDate}T23:59:59.999Z`;
    query = query.lte("paid_at", endDateTime);
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

// 엑셀 다운로드용 모든 주문 조회 (페이지네이션 없음, 주문 상품 포함)
export async function getAllOrdersForExport(
  paymentStatus?: string,
  fulfillmentStatus?: string,
  startDate?: string,
  endDate?: string,
): Promise<Array<Order & { items: Array<{ product_name: string; variant_info: string | null; quantity: number; price: number }>; user_email: string | null }>> {
  console.group("[getAllOrdersForExport] 엑셀 다운로드용 주문 조회");
  console.log("paymentStatus:", paymentStatus || "(전체)");
  console.log("fulfillmentStatus:", fulfillmentStatus || "(전체)");
  console.log("startDate:", startDate || "(전체)");
  console.log("endDate:", endDate || "(전체)");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return [];
  }

  const supabase = await createClient();

  // 주문 조회 (users 테이블과 조인하여 이메일 포함)
  // 명시적으로 모든 필드를 나열하여 누락 방지
  let query = supabase
    .from("orders")
    .select(`
      id,
      user_id,
      order_number,
      payment_status,
      fulfillment_status,
      status,
      total_amount,
      orderer_name,
      orderer_phone,
      orderer_email,
      shipping_name,
      shipping_phone,
      shipping_address,
      shipping_zip_code,
      shipping_memo,
      shipping_status,
      tracking_number,
      shipped_at,
      delivered_at,
      paid_at,
      created_at,
      updated_at,
      coupon_id,
      user:users!fk_orders_user_id(email)
    `);

  // payment_status 필터
  if (paymentStatus) {
    query = query.eq("payment_status", paymentStatus);
  }

  // fulfillment_status 필터
  if (fulfillmentStatus) {
    query = query.eq("fulfillment_status", fulfillmentStatus);
  }

  // 날짜 필터 (결제 완료일 기준 - paid_at 사용)
  if (startDate || endDate) {
    query = query.not("paid_at", "is", null);
    query = query.eq("payment_status", "PAID");
  }

  if (startDate) {
    const startDateTime = `${startDate}T00:00:00.000Z`;
    query = query.gte("paid_at", startDateTime);
  }

  if (endDate) {
    const endDateTime = `${endDate}T23:59:59.999Z`;
    query = query.lte("paid_at", endDateTime);
  }

  query = query.order("created_at", { ascending: false });

  const { data: orders, error } = await query;

  if (error || !orders) {
    console.error("주문 조회 실패:", error);
    console.groupEnd();
    return [];
  }

  console.log("주문 조회 성공:", orders.length, "개");
  
  // 첫 번째 주문 데이터 구조 확인 (디버깅)
  if (orders.length > 0) {
    const firstOrder = orders[0] as any;
    console.log("첫 번째 주문 데이터 샘플:", {
      id: firstOrder.id,
      order_number: firstOrder.order_number,
      shipping_name: firstOrder.shipping_name,
      shipping_phone: firstOrder.shipping_phone,
      shipping_address: firstOrder.shipping_address,
      shipping_zip_code: firstOrder.shipping_zip_code,
      shipping_memo: firstOrder.shipping_memo,
      user: firstOrder.user,
      has_shipping_address: !!firstOrder.shipping_address,
    });
  }

  // 각 주문의 상품 정보 조회
  const ordersWithItems = await Promise.all(
    (orders as unknown as Array<Order & { user: { email: string } | null }>).map(async (order) => {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, variant_info, quantity, price")
        .eq("order_id", order.id);

      // 배송지 정보 확인 (디버깅)
      if (!order.shipping_address) {
        console.warn(`[getAllOrdersForExport] 배송지 주소 누락: 주문 ${order.order_number} (ID: ${order.id})`);
      }

      return {
        ...order,
        items: items || [],
        user_email: order.user?.email || null,
      };
    }),
  );

  console.log("결과:", ordersWithItems.length, "개 주문");
  console.groupEnd();

  return ordersWithItems;
}

// 주문 데이터를 엑셀로 변환하여 다운로드
export async function exportOrdersToExcel(
  paymentStatus?: string,
  fulfillmentStatus?: string,
  startDate?: string,
  endDate?: string,
): Promise<{ success: boolean; message: string; buffer?: Buffer }> {
  console.group("[exportOrdersToExcel] 주문 데이터 엑셀 다운로드");
  console.log("필터:", { paymentStatus, fulfillmentStatus, startDate, endDate });

  try {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      console.log("관리자 권한 없음");
      console.groupEnd();
      return { success: false, message: "관리자 권한이 필요합니다." };
    }

    const orders = await getAllOrdersForExport(
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
    );

    if (orders.length === 0) {
      console.log("다운로드할 주문이 없습니다");
      console.groupEnd();
      return { success: false, message: "다운로드할 주문이 없습니다." };
    }

    // ExcelJS 동적 import
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("주문 내역");

    // 헤더 설정
    worksheet.columns = [
      { header: "주문번호", key: "order_number", width: 20 },
      { header: "주문일시", key: "created_at", width: 20 },
      { header: "결제완료일시", key: "paid_at", width: 20 },
      { header: "주문자명", key: "shipping_name", width: 15 },
      { header: "주문자연락처", key: "shipping_phone", width: 15 },
      { header: "주문자이메일", key: "user_email", width: 25 },
      { header: "배송지주소", key: "shipping_address", width: 40 },
      { header: "배송지우편번호", key: "shipping_zip_code", width: 12 },
      { header: "배송메모", key: "shipping_memo", width: 30 },
      { header: "주문금액", key: "total_amount", width: 15 },
      { header: "결제상태", key: "payment_status", width: 12 },
      { header: "배송상태", key: "fulfillment_status", width: 12 },
      { header: "운송장번호", key: "tracking_number", width: 20 },
      { header: "배송시작일시", key: "shipped_at", width: 20 },
      { header: "배송완료일시", key: "delivered_at", width: 20 },
      { header: "주문상품", key: "items", width: 50 },
    ];

    // 헤더 스타일
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE0E6" },
    };

    // 날짜 포맷 함수
    const formatDate = (dateString: string | null | undefined): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // 상태 한글 변환
    const formatPaymentStatus = (status: string | undefined): string => {
      const statusMap: Record<string, string> = {
        PENDING: "결제 대기",
        PAID: "결제 완료",
        CANCELED: "주문 취소",
        REFUNDED: "환불 완료",
      };
      return statusMap[status || ""] || status || "";
    };

    const formatFulfillmentStatus = (status: string | undefined): string => {
      const statusMap: Record<string, string> = {
        UNFULFILLED: "미처리",
        PREPARING: "상품 준비중",
        SHIPPED: "배송중",
        DELIVERED: "배송 완료",
        CANCELED: "주문 취소",
      };
      return statusMap[status || ""] || status || "";
    };

    // 데이터 행 추가
    orders.forEach((order, index) => {
      // 주문 상품 정보 문자열로 변환
      const itemsText = order.items
        .map(
          (item) =>
            `${item.product_name}${item.variant_info ? ` (${item.variant_info})` : ""} × ${item.quantity}개`,
        )
        .join(", ");

      // 데이터 검증 및 디버깅
      if (!order.shipping_address) {
        console.warn(`[exportOrdersToExcel] 배송지 주소 누락: 주문 ${order.order_number} (인덱스: ${index})`);
      }

      const rowData = {
        order_number: order.order_number || "",
        created_at: formatDate(order.created_at),
        paid_at: formatDate(order.paid_at),
        shipping_name: order.shipping_name || "",
        shipping_phone: order.shipping_phone || "",
        user_email: order.user_email || "",
        shipping_address: order.shipping_address || "",
        shipping_zip_code: order.shipping_zip_code || "",
        shipping_memo: order.shipping_memo || "",
        total_amount: order.total_amount || 0,
        payment_status: formatPaymentStatus(order.payment_status),
        fulfillment_status: formatFulfillmentStatus(order.fulfillment_status),
        tracking_number: order.tracking_number || "",
        shipped_at: formatDate(order.shipped_at),
        delivered_at: formatDate(order.delivered_at),
        items: itemsText || "",
      };

      // 디버깅: 첫 번째 주문 데이터 확인
      if (index === 0) {
        console.log("[exportOrdersToExcel] 첫 번째 주문 데이터:", {
          order_number: rowData.order_number,
          shipping_name: rowData.shipping_name,
          shipping_address: rowData.shipping_address,
          shipping_zip_code: rowData.shipping_zip_code,
          shipping_memo: rowData.shipping_memo,
        });
      }

      worksheet.addRow(rowData);
    });

    // 금액 컬럼 숫자 포맷
    worksheet.getColumn("total_amount").numFmt = "#,##0";

    // 엑셀 파일 버퍼 생성
    const buffer = await workbook.xlsx.writeBuffer();

    console.log("엑셀 파일 생성 완료:", orders.length, "개 주문");
    console.groupEnd();

    return {
      success: true,
      message: `${orders.length}개의 주문 데이터가 준비되었습니다.`,
      buffer: Buffer.from(buffer),
    };
  } catch (error) {
    console.error("엑셀 다운로드 실패:", error);
    console.groupEnd();
    return {
      success: false,
      message: "엑셀 다운로드 중 오류가 발생했습니다.",
    };
  }
}

// 주문 상태 업데이트 (payment_status, fulfillment_status 분리)
export async function updateOrderStatus(
  orderId: string,
  paymentStatus?: Order["payment_status"],
  fulfillmentStatus?: Order["fulfillment_status"],
  trackingNumber?: string,
): Promise<{ success: boolean; message: string }> {
  console.group("[updateOrderStatus] 주문 상태 업데이트");
  console.log("주문:", orderId);
  console.log("paymentStatus:", paymentStatus || "(변경 없음)");
  console.log("fulfillmentStatus:", fulfillmentStatus || "(변경 없음)");
  console.log("trackingNumber:", trackingNumber || "(없음)");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  const supabase = await createClient();

  const updateData: {
    payment_status?: Order["payment_status"];
    fulfillment_status?: Order["fulfillment_status"];
    tracking_number?: string;
    shipped_at?: string;
    delivered_at?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  // payment_status 업데이트
  if (paymentStatus) {
    updateData.payment_status = paymentStatus;
  }

  // fulfillment_status 업데이트
  if (fulfillmentStatus) {
    updateData.fulfillment_status = fulfillmentStatus;

    // 배송 상태에 따른 자동 처리
    if (fulfillmentStatus === "SHIPPED" && trackingNumber) {
      updateData.tracking_number = trackingNumber;
      updateData.shipped_at = new Date().toISOString();
    } else if (fulfillmentStatus === "DELIVERED") {
      updateData.delivered_at = new Date().toISOString();
    }
  }

  // trackingNumber만 별도로 업데이트하는 경우
  if (trackingNumber && !updateData.tracking_number) {
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

// 관리자용 주문 상세 조회
export async function getAdminOrderById(
  orderId: string,
): Promise<(Order & { items: OrderItem[]; user_email: string | null; payment?: { method: string; amount: number; approved_at: string | null } | null }) | null> {
  console.group("[getAdminOrderById] 관리자 주문 상세 조회");
  console.log("주문 ID:", orderId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return null;
  }

  const supabase = await createClient();

  // 주문 조회 (users 테이블과 조인하여 이메일 포함)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      user_id,
      order_number,
      payment_status,
      fulfillment_status,
      status,
      total_amount,
      shipping_name,
      shipping_phone,
      shipping_address,
      shipping_zip_code,
      shipping_memo,
      shipping_status,
      tracking_number,
      shipped_at,
      delivered_at,
      paid_at,
      created_at,
      updated_at,
      coupon_id,
      orderer_name,
      orderer_phone,
      orderer_email,
      user:users!fk_orders_user_id(email)
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("주문 조회 실패:", orderError);
    console.groupEnd();
    return null;
  }

  // 주문 상품 조회
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsError) {
    console.error("주문 상품 조회 실패:", itemsError);
  }

  // 결제 정보 조회
  const { data: payment } = await supabase
    .from("payments")
    .select("method, amount, approved_at")
    .eq("order_id", orderId)
    .eq("status", "done")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  const orderWithData = {
    ...order,
    items: (items as OrderItem[]) || [],
    user_email: (order as any).user?.email || null,
    payment: payment || null,
  } as Order & { items: OrderItem[]; user_email: string | null; payment?: { method: string; amount: number; approved_at: string | null } | null };

  console.log("주문 조회 성공:", order.order_number);
  console.groupEnd();

  return orderWithData;
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
