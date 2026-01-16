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
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";
import type {
  Order,
  OrderItem,
  ProductListItem,
  ProductWithDetails,
} from "@/types/database";

// 관리자 이메일 목록 (환경 변수로 관리 권장, 하위 호환성 유지)
// 쉼표로 구분된 이메일을 배열로 변환하고, 공백 제거 및 소문자 변환
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS?.split(",") || [
  "wojg58@gmail.com", // 관리자 계정
  "ttottoangseu@naver.com", // 관리자 계정
]).map((email) => email.trim().toLowerCase());

/**
 * 관리자 권한 확인
 * 
 * 우선순위:
 * 1. Clerk role === 'admin' 체크
 * 2. publicMetadata.isAdmin === true 체크
 * 3. 이메일 기반 체크 (하위 호환성)
 * 
 * @returns 관리자 여부
 */
export async function isAdmin(): Promise<boolean> {
  logger.group("[isAdmin] 관리자 권한 확인 시작");
  
  const user = await currentUser();
  if (!user) {
    logger.warn("[isAdmin] ❌ 사용자 미인증");
    logger.groupEnd();
    return false;
  }

  const clerkUserId = user.id;
  
  // 1. Clerk role 체크 (가장 우선)
  // Clerk Dashboard에서 사용자에게 'admin' role을 부여한 경우
  const userRole = user.publicMetadata?.role as string | undefined;
  if (userRole === "admin") {
    logger.info("[isAdmin] ✅ 관리자 권한 확인됨 (role=admin)", {
      clerkUserId,
      role: userRole,
    });
    logger.groupEnd();
    return true;
  }

  // 2. publicMetadata.isAdmin 체크
  const isAdminFromMetadata = user.publicMetadata?.isAdmin === true;
  if (isAdminFromMetadata) {
    logger.info("[isAdmin] ✅ 관리자 권한 확인됨 (publicMetadata.isAdmin=true)", {
      clerkUserId,
      isAdmin: isAdminFromMetadata,
    });
    logger.groupEnd();
    return true;
  }

  // 3. 이메일 기반 체크 (하위 호환성)
  const allEmails = user.emailAddresses?.map((addr) => 
    addr.emailAddress?.trim().toLowerCase()
  ).filter((email): email is string => !!email) || [];
  
  const primaryEmail = user.emailAddresses?.find((addr) => addr.id === user.primaryEmailAddressId)?.emailAddress?.trim().toLowerCase();
  
  const isAdminUser = allEmails.some((email) => ADMIN_EMAILS.includes(email));
  
  logger.info("[isAdmin] 권한 확인 결과", {
    clerkUserId,
    primaryEmail: primaryEmail || "(없음)",
    allEmails: allEmails,
    adminEmails: ADMIN_EMAILS,
    role: userRole || "(없음)",
    isAdminFromMetadata: isAdminFromMetadata || false,
    isAdminFromEmail: isAdminUser,
    finalResult: isAdminUser,
    hasEnvVar: !!process.env.ADMIN_EMAILS,
    envVarValue: process.env.ADMIN_EMAILS ? "설정됨" : "설정 안됨",
  });
  
  if (!isAdminUser) {
    logger.warn("[isAdmin] ❌ 관리자 권한 없음 - role, publicMetadata.isAdmin, 이메일 모두 확인 실패");
  } else {
    logger.info("[isAdmin] ✅ 관리자 권한 확인됨 (이메일 기반)");
  }
  
  logger.groupEnd();
  return isAdminUser;
}

// 대시보드 통계
export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  recentOrders: Order[];
  // 확장된 KPI
  canceledRefundedOrders: number; // 취소/환불 건수
  lowStockProducts: number; // 재고부족 상품 수
  newMembersToday: number; // 오늘 신규 회원
  newMembers7Days: number; // 7일 신규 회원
  newMembers30Days: number; // 30일 신규 회원
  // 알림/할일
  unprocessedOrders: number; // 미처리 주문 (결제완료 + 배송대기)
  unansweredInquiries: number; // 미답변 문의 (추후)
}

// 대시보드 통계 조회
export async function getDashboardStats(): Promise<DashboardStats | null> {
  logger.group("[getDashboardStats] 대시보드 통계 조회 시작");
  logger.info("[getDashboardStats] 환경 변수 확인", {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getDashboardStats] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return null;
  }

  logger.info("[getDashboardStats] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

  // 전체 주문 수
  logger.info("[getDashboardStats] 전체 주문 수 조회 중...");
  const { count: totalOrders, error: ordersCountError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });
  
  if (ordersCountError) {
    logger.error("[getDashboardStats] ❌ 전체 주문 수 조회 실패", {
      code: ordersCountError.code,
      message: ordersCountError.message,
      details: ordersCountError.details,
      hint: ordersCountError.hint,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 전체 주문 수:", totalOrders ?? 0);
  }

  // 대기 중인 주문 수 (payment_status 기준)
  logger.info("[getDashboardStats] 대기 중인 주문 수 조회 중...");
  const { count: pendingOrders, error: pendingError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("payment_status", ["PENDING", "PAID"]);
  
  if (pendingError) {
    logger.error("[getDashboardStats] ❌ 대기 중인 주문 수 조회 실패", {
      code: pendingError.code,
      message: pendingError.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 대기 중인 주문 수:", pendingOrders ?? 0);
  }

  // 총 매출 (payment_status = PAID 기준)
  logger.info("[getDashboardStats] 총 매출 조회 중...");
  const { data: revenueData, error: revenueError } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID");
  
  if (revenueError) {
    logger.error("[getDashboardStats] ❌ 총 매출 조회 실패", {
      code: revenueError.code,
      message: revenueError.message,
    });
  } else {
    const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
    logger.info(`[getDashboardStats] ✅ 총 매출: ${totalRevenue}원`);
  }

  const totalRevenue =
    revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 상품 수
  logger.info("[getDashboardStats] 상품 수 조회 중...");
  const { count: totalProducts, error: productsError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  
  if (productsError) {
    logger.error("[getDashboardStats] ❌ 상품 수 조회 실패", {
      code: productsError.code,
      message: productsError.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 상품 수:", totalProducts ?? 0);
  }

  // 최근 주문 5개
  logger.info("[getDashboardStats] 최근 주문 5개 조회 중...");
  const { data: recentOrders, error: recentOrdersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentOrdersError) {
    logger.error("[getDashboardStats] ❌ 최근 주문 조회 실패", {
      code: recentOrdersError.code,
      message: recentOrdersError.message,
      details: recentOrdersError.details,
      hint: recentOrdersError.hint,
    });
  } else {
    logger.info(`[getDashboardStats] ✅ 최근 주문: ${recentOrders?.length ?? 0}개`);
  }

  // 취소/환불 건수
  logger.info("[getDashboardStats] 취소/환불 건수 조회 중...");
  const { count: canceledRefundedOrders, error: canceledError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("payment_status", ["CANCELED", "REFUNDED"]);

  if (canceledError) {
    logger.error("[getDashboardStats] ❌ 취소/환불 건수 조회 실패", {
      code: canceledError.code,
      message: canceledError.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 취소/환불 건수:", canceledRefundedOrders ?? 0);
  }

  // 재고부족 상품 수 (재고 10개 이하)
  logger.info("[getDashboardStats] 재고부족 상품 수 조회 중...");
  const { count: lowStockProducts, error: lowStockError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .lte("stock", 10);

  if (lowStockError) {
    logger.error("[getDashboardStats] ❌ 재고부족 상품 수 조회 실패", {
      code: lowStockError.code,
      message: lowStockError.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 재고부족 상품 수:", lowStockProducts ?? 0);
  }

  // 신규 회원 수 (오늘/7일/30일)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  logger.info("[getDashboardStats] 신규 회원 수 조회 중...");
  
  const { count: newMembersToday, error: newMembersTodayError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  const { count: newMembers7Days, error: newMembers7DaysError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: newMembers30Days, error: newMembers30DaysError } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (newMembersTodayError || newMembers7DaysError || newMembers30DaysError) {
    logger.error("[getDashboardStats] ❌ 신규 회원 수 조회 실패", {
      todayError: newMembersTodayError?.message,
      sevenDaysError: newMembers7DaysError?.message,
      thirtyDaysError: newMembers30DaysError?.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 신규 회원 수:", {
      today: newMembersToday ?? 0,
      sevenDays: newMembers7Days ?? 0,
      thirtyDays: newMembers30Days ?? 0,
    });
  }

  // 미처리 주문 수 (결제완료 + 배송대기)
  logger.info("[getDashboardStats] 미처리 주문 수 조회 중...");
  const { count: unprocessedOrders, error: unprocessedError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "PAID")
    .in("fulfillment_status", ["UNFULFILLED", "PREPARING"]);

  if (unprocessedError) {
    logger.error("[getDashboardStats] ❌ 미처리 주문 수 조회 실패", {
      code: unprocessedError.code,
      message: unprocessedError.message,
    });
  } else {
    logger.info("[getDashboardStats] ✅ 미처리 주문 수:", unprocessedOrders ?? 0);
  }

  // 미답변 문의 수
  const unansweredInquiries = await getUnansweredInquiriesCount();

  const result = {
    totalOrders: totalOrders ?? 0,
    pendingOrders: pendingOrders ?? 0,
    totalRevenue,
    totalProducts: totalProducts ?? 0,
    recentOrders: (recentOrders as Order[]) || [],
    canceledRefundedOrders: canceledRefundedOrders ?? 0,
    lowStockProducts: lowStockProducts ?? 0,
    newMembersToday: newMembersToday ?? 0,
    newMembers7Days: newMembers7Days ?? 0,
    newMembers30Days: newMembers30Days ?? 0,
    unprocessedOrders: unprocessedOrders ?? 0,
    unansweredInquiries,
  };
  
  logger.info("[getDashboardStats] ✅ 통계 조회 완료", {
    totalOrders: result.totalOrders,
    pendingOrders: result.pendingOrders,
    totalRevenue: result.totalRevenue,
    totalProducts: result.totalProducts,
    recentOrdersCount: result.recentOrders.length,
    canceledRefundedOrders: result.canceledRefundedOrders,
    lowStockProducts: result.lowStockProducts,
    newMembersToday: result.newMembersToday,
    unprocessedOrders: result.unprocessedOrders,
  });
  logger.groupEnd();

  return result;
}

// 모든 주문 조회
export async function getAllOrders(
  paymentStatus?: string,
  fulfillmentStatus?: string,
  page: number = 1,
  pageSize: number = 20,
  startDate?: string,
  endDate?: string,
  searchQuery?: string,
): Promise<{ orders: Order[]; total: number; totalPages: number }> {
  logger.group("[getAllOrders] 전체 주문 조회 시작");
  logger.info("[getAllOrders] 필터 조건", {
    paymentStatus: paymentStatus || "(전체)",
    fulfillmentStatus: fulfillmentStatus || "(전체)",
    startDate: startDate || "(전체)",
    endDate: endDate || "(전체)",
    searchQuery: searchQuery || "(없음)",
    page,
    pageSize,
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAllOrders] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  logger.info("[getAllOrders] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

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

  // 검색어 필터 (주문번호, 고객명, 전화번호)
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = searchQuery.trim();
    query = query.or(
      `order_number.ilike.%${searchTerm}%,shipping_name.ilike.%${searchTerm}%,shipping_phone.ilike.%${searchTerm}%,orderer_name.ilike.%${searchTerm}%,orderer_phone.ilike.%${searchTerm}%`
    );
    logger.info("[getAllOrders] 검색 필터 적용:", searchTerm);
  }

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("[getAllOrders] ❌ 주문 조회 실패", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    logger.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  logger.info("[getAllOrders] ✅ 주문 조회 성공", {
    ordersCount: data?.length ?? 0,
    total,
    totalPages,
  });
  logger.groupEnd();

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
    logger.warn("[getAllOrdersForExport] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return [];
  }

  logger.info("[getAllOrdersForExport] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

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
// Server Action용 - Request 객체가 없을 때 사용
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
    logger.warn("[updateOrderStatus] ❌ 관리자 권한 없음 - 업데이트 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  logger.info("[updateOrderStatus] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

  // 변경 전 주문 정보 조회 (before)
  const { data: oldOrder, error: oldOrderError } = await supabase
    .from("orders")
    .select("order_number, payment_status, fulfillment_status, tracking_number, shipped_at, delivered_at")
    .eq("id", orderId)
    .single();

  if (oldOrderError || !oldOrder) {
    logger.error("[updateOrderStatus] ❌ 주문 조회 실패", {
      code: oldOrderError?.code,
      message: oldOrderError?.message,
    });
    console.groupEnd();
    return { success: false, message: "주문을 찾을 수 없습니다." };
  }

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

  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // payment_status 업데이트
  if (paymentStatus && oldOrder?.payment_status !== paymentStatus) {
    updateData.payment_status = paymentStatus;
    changes.push({
      field: "payment_status",
      oldValue: oldOrder?.payment_status,
      newValue: paymentStatus,
    });
  }

  // fulfillment_status 업데이트
  if (fulfillmentStatus && oldOrder?.fulfillment_status !== fulfillmentStatus) {
    updateData.fulfillment_status = fulfillmentStatus;

    // 배송 상태에 따른 자동 처리
    if (fulfillmentStatus === "SHIPPED" && trackingNumber) {
      updateData.tracking_number = trackingNumber;
      updateData.shipped_at = new Date().toISOString();
    } else if (fulfillmentStatus === "DELIVERED") {
      updateData.delivered_at = new Date().toISOString();
    }

    changes.push({
      field: "fulfillment_status",
      oldValue: oldOrder?.fulfillment_status,
      newValue: fulfillmentStatus,
    });
  }

  // trackingNumber만 별도로 업데이트하는 경우
  if (trackingNumber && oldOrder?.tracking_number !== trackingNumber) {
    updateData.tracking_number = trackingNumber;
    changes.push({
      field: "tracking_number",
      oldValue: oldOrder?.tracking_number || null,
      newValue: trackingNumber,
    });
  }

  // 변경사항이 없으면 에러 반환
  if (Object.keys(updateData).length === 1) {
    // updated_at만 있는 경우
    logger.warn("[updateOrderStatus] ⚠️ 변경사항 없음");
    console.groupEnd();
    return { success: false, message: "변경할 내용이 없습니다." };
  }

  // 주문 상태 업데이트
  const { data: newOrder, error: updateError } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select("order_number, payment_status, fulfillment_status, tracking_number, shipped_at, delivered_at")
    .single();

  if (updateError || !newOrder) {
    logger.error("[updateOrderStatus] ❌ 주문 상태 업데이트 실패", {
      code: updateError?.code,
      message: updateError?.message,
    });
    console.error("에러:", updateError);
    console.groupEnd();
    return { success: false, message: "주문 상태 업데이트에 실패했습니다." };
  }

  // 관리자 활동 로그 기록 (Server Action에서는 Request 객체 생성)
  try {
    const { headers } = await import("next/headers");
    const headersList = await headers();
    const request = new Request("http://localhost", {
      headers: Object.fromEntries(headersList.entries()),
    });

    const beforeData: Record<string, any> = {};
    const afterData: Record<string, any> = {};

    if (paymentStatus && paymentStatus !== oldOrder.payment_status) {
      beforeData.payment_status = oldOrder.payment_status;
      afterData.payment_status = newOrder.payment_status;
    }

    if (fulfillmentStatus && fulfillmentStatus !== oldOrder.fulfillment_status) {
      beforeData.fulfillment_status = oldOrder.fulfillment_status;
      afterData.fulfillment_status = newOrder.fulfillment_status;
    }

    if (trackingNumber && trackingNumber !== oldOrder.tracking_number) {
      beforeData.tracking_number = oldOrder.tracking_number || null;
      afterData.tracking_number = newOrder.tracking_number || null;
    }

    // 로그 기록 (변경사항이 있는 경우만)
    if (Object.keys(beforeData).length > 0) {
      const { logAdminAction } = await import("@/lib/admin-activity-log");
      const logResult = await logAdminAction({
        action: "order_status_changed",
        entity_type: "order",
        entity_id: orderId,
        before: beforeData,
        after: afterData,
        req: request,
      });

      if (!logResult) {
        logger.warn("[updateOrderStatus] ⚠️ 로그 기록 실패 (주문 상태는 업데이트됨)");
      } else {
        logger.info("[updateOrderStatus] ✅ 로그 기록 성공");
      }
    }
  } catch (logError) {
    logger.error("[updateOrderStatus] ❌ 로그 기록 예외 발생", logError);
    // 로그 기록 실패해도 주문 상태 업데이트는 성공했으므로 계속 진행
  }

  console.log("성공");
  console.groupEnd();
  return { success: true, message: "주문 상태가 업데이트되었습니다." };
}

// 배송 대기 주문 조회 (결제완료 + 배송대기)
export async function getPendingFulfillmentOrders(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ orders: Order[]; total: number; totalPages: number }> {
  logger.group("[getPendingFulfillmentOrders] 배송 대기 주문 조회 시작");
  logger.info(`[getPendingFulfillmentOrders] 페이지: ${page}, 페이지 크기: ${pageSize}`);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getPendingFulfillmentOrders] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  logger.info("[getPendingFulfillmentOrders] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  // 결제완료 + 배송대기 주문 조회
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("payment_status", "PAID")
    .in("fulfillment_status", ["UNFULFILLED", "PREPARING"]);

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("[getPendingFulfillmentOrders] ❌ 주문 조회 실패", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    logger.groupEnd();
    return { orders: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  logger.info("[getPendingFulfillmentOrders] ✅ 주문 조회 성공", {
    ordersCount: data?.length ?? 0,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { orders: (data as Order[]) || [], total, totalPages };
}

// 일괄 송장번호 등록
export async function bulkUpdateTrackingNumbers(
  updates: Array<{ orderId: string; trackingNumber: string }>,
): Promise<{ success: boolean; message: string; updated: number }> {
  logger.group("[bulkUpdateTrackingNumbers] 일괄 송장번호 등록 시작");
  logger.info("[bulkUpdateTrackingNumbers] 업데이트할 주문 수:", updates.length);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[bulkUpdateTrackingNumbers] ❌ 관리자 권한 없음 - 업데이트 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다.", updated: 0 };
  }

  logger.info("[bulkUpdateTrackingNumbers] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  let updatedCount = 0;
  const errors: string[] = [];

  // 각 주문에 대해 송장번호 업데이트
  for (const update of updates) {
    const { error } = await supabase
      .from("orders")
      .update({
        tracking_number: update.trackingNumber,
        fulfillment_status: "SHIPPED",
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.orderId);

    if (error) {
      logger.error(`[bulkUpdateTrackingNumbers] 주문 ${update.orderId} 업데이트 실패`, {
        code: error.code,
        message: error.message,
      });
      errors.push(`주문 ${update.orderId}: ${error.message}`);
    } else {
      updatedCount++;
    }
  }

  if (errors.length > 0) {
    logger.warn("[bulkUpdateTrackingNumbers] 일부 주문 업데이트 실패", {
      updated: updatedCount,
      failed: errors.length,
      errors: errors.slice(0, 5), // 처음 5개만 로그
    });
  }

  logger.info("[bulkUpdateTrackingNumbers] ✅ 일괄 업데이트 완료", {
    updated: updatedCount,
    total: updates.length,
  });
  logger.groupEnd();

  if (updatedCount === 0) {
    return {
      success: false,
      message: "송장번호 등록에 실패했습니다.",
      updated: 0,
    };
  }

  return {
    success: true,
    message: `${updatedCount}개의 주문에 송장번호가 등록되었습니다.`,
    updated: updatedCount,
  };
}

// 재고 목록 조회 (상품 + 옵션)
export interface InventoryItem {
  product_id: string;
  product_name: string;
  product_stock: number;
  variant_id: string | null;
  variant_name: string | null;
  variant_value: string | null;
  variant_stock: number | null;
  sku: string | null;
  category_name: string | null;
  is_low_stock: boolean;
}

export async function getInventoryList(
  page: number = 1,
  pageSize: number = 20,
  lowStockOnly: boolean = false,
  searchQuery?: string,
): Promise<{
  items: InventoryItem[];
  total: number;
  totalPages: number;
}> {
  logger.group("[getInventoryList] 재고 목록 조회 시작");
  logger.info("[getInventoryList] 필터 조건", {
    page,
    pageSize,
    lowStockOnly,
    searchQuery: searchQuery || "(없음)",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getInventoryList] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { items: [], total: 0, totalPages: 0 };
  }

  logger.info("[getInventoryList] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  // 성능 최적화: N+1 쿼리 문제 해결
  // 1. 모든 상품을 한 번에 조회 (필터링 적용)
  let productsQuery = supabase
    .from("products")
    .select(
      `
      id,
      name,
      stock,
      category_id,
      category:categories!fk_products_category_id(name)
    `,
    )
    .is("deleted_at", null);

  if (searchQuery && searchQuery.trim()) {
    productsQuery = productsQuery.ilike("name", `%${searchQuery.trim()}%`);
  }

  if (lowStockOnly) {
    productsQuery = productsQuery.lte("stock", 10);
  }

  const { data: products, error: productsError } = await productsQuery;

  if (productsError) {
    logger.error("[getInventoryList] ❌ 상품 조회 실패", {
      code: productsError.code,
      message: productsError.message,
    });
    logger.groupEnd();
    return { items: [], total: 0, totalPages: 0 };
  }

  if (!products || products.length === 0) {
    logger.info("[getInventoryList] 조회된 상품 없음");
    logger.groupEnd();
    return { items: [], total: 0, totalPages: 0 };
  }

  // 2. 모든 옵션을 한 번에 조회 (해당 상품들의 옵션만)
  const productIds = products.map((p) => p.id);
  let variantsQuery = supabase
    .from("product_variants")
    .select("id, variant_name, variant_value, stock, sku, product_id")
    .in("product_id", productIds)
    .is("deleted_at", null);

  if (lowStockOnly) {
    variantsQuery = variantsQuery.lte("stock", 10);
  }

  const { data: variants, error: variantsError } = await variantsQuery;

  if (variantsError) {
    logger.error("[getInventoryList] ❌ 옵션 조회 실패", {
      code: variantsError.code,
      message: variantsError.message,
    });
    logger.groupEnd();
    return { items: [], total: 0, totalPages: 0 };
  }

  // 3. 메모리에서 조인하여 인벤토리 아이템 구성
  const inventoryItems: InventoryItem[] = [];
  const variantsByProductId = new Map<string, typeof variants>();

  // 옵션을 상품 ID별로 그룹화
  if (variants) {
    for (const variant of variants) {
      if (!variantsByProductId.has(variant.product_id)) {
        variantsByProductId.set(variant.product_id, []);
      }
      variantsByProductId.get(variant.product_id)!.push(variant);
    }
  }

  // 각 상품에 대해 인벤토리 아이템 생성
  for (const product of products) {
    const productVariants = variantsByProductId.get(product.id) || [];

    if (productVariants.length > 0) {
      // 옵션이 있는 경우: 옵션별로 표시
      for (const variant of productVariants) {
        inventoryItems.push({
          product_id: product.id,
          product_name: product.name,
          product_stock: product.stock,
          variant_id: variant.id,
          variant_name: variant.variant_name,
          variant_value: variant.variant_value,
          variant_stock: variant.stock,
          sku: variant.sku,
          category_name: product.category?.name || null,
          is_low_stock: variant.stock <= 10,
        });
      }
    } else {
      // 옵션이 없는 경우: 상품 재고만 표시
      inventoryItems.push({
        product_id: product.id,
        product_name: product.name,
        product_stock: product.stock,
        variant_id: null,
        variant_name: null,
        variant_value: null,
        variant_stock: null,
        sku: null,
        category_name: product.category?.name || null,
        is_low_stock: product.stock <= 10,
      });
    }
  }

  // 재고부족 필터 적용 (옵션 재고 기준)
  const filteredItems = lowStockOnly
    ? inventoryItems.filter((item) => {
        const stock = item.variant_stock ?? item.product_stock;
        return stock <= 10;
      })
    : inventoryItems;

  // 정렬: 상품명 기준
  filteredItems.sort((a, b) => {
    if (a.product_name < b.product_name) return -1;
    if (a.product_name > b.product_name) return 1;
    // 같은 상품인 경우 옵션명으로 정렬
    if (a.variant_name && b.variant_name) {
      return a.variant_name.localeCompare(b.variant_name);
    }
    return 0;
  });

  const total = filteredItems.length;
  const totalPages = Math.ceil(total / pageSize);

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginatedItems = filteredItems.slice(from, to);

  logger.info("[getInventoryList] ✅ 재고 목록 조회 성공", {
    itemsCount: paginatedItems.length,
    total,
    totalPages,
    queriesUsed: 2, // 옵션 있는 상품 + 옵션 없는 상품
  });
  logger.groupEnd();

  return { items: paginatedItems, total, totalPages };
}

// 재고 업데이트 (상품 또는 옵션)
export async function updateInventory(
  productId: string,
  stock: number,
  variantId?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[updateInventory] 재고 업데이트 시작");
  logger.info("[updateInventory] 상품 ID:", productId, "재고:", stock, "옵션 ID:", variantId || "(없음)");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[updateInventory] ❌ 관리자 권한 없음 - 업데이트 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  if (stock < 0) {
    logger.warn("[updateInventory] ❌ 재고는 0 이상이어야 합니다");
    logger.groupEnd();
    return { success: false, message: "재고는 0 이상이어야 합니다." };
  }

  logger.info("[updateInventory] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  let oldStock: number | null = null;
  let productName: string = "";
  let variantName: string | null = null;

  if (variantId) {
    // 옵션 재고 업데이트
    const { data: variant } = await supabase
      .from("product_variants")
      .select("stock, variant_name, product:products(name)")
      .eq("id", variantId)
      .single();

    if (variant) {
      oldStock = variant.stock;
      variantName = variant.variant_name;
      productName = (variant.product as any)?.name || "";
    }

    const { error } = await supabase
      .from("product_variants")
      .update({
        stock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variantId);

    if (error) {
      logger.error("[updateInventory] ❌ 옵션 재고 업데이트 실패", {
        code: error.code,
        message: error.message,
      });
      logger.groupEnd();
      return { success: false, message: "재고 업데이트에 실패했습니다." };
    }
  } else {
    // 상품 재고 업데이트
    const { data: product } = await supabase
      .from("products")
      .select("stock, name")
      .eq("id", productId)
      .single();

    if (product) {
      oldStock = product.stock;
      productName = product.name;
    }

    const { error } = await supabase
      .from("products")
      .update({
        stock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (error) {
      logger.error("[updateInventory] ❌ 상품 재고 업데이트 실패", {
        code: error.code,
        message: error.message,
      });
      logger.groupEnd();
      return { success: false, message: "재고 업데이트에 실패했습니다." };
    }
  }

  // Audit log 기록
  if (oldStock !== null && oldStock !== stock) {
    const { logInventoryChange } = await import("@/lib/audit-log");
    await logInventoryChange(
      productId,
      productName,
      variantId || null,
      variantName,
      oldStock,
      stock,
      ipAddress,
      userAgent
    );
  }

  logger.info("[updateInventory] ✅ 재고 업데이트 성공");
  logger.groupEnd();
  return { success: true, message: "재고가 업데이트되었습니다." };
}

// 회원 목록 조회
export interface CustomerListItem {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
}

export async function getCustomers(
  page: number = 1,
  pageSize: number = 20,
  searchQuery?: string,
  sortBy: string = "created_at",
): Promise<{
  customers: CustomerListItem[];
  total: number;
  totalPages: number;
}> {
  logger.group("[getCustomers] 회원 목록 조회 시작");
  logger.info("[getCustomers] 필터 조건", {
    page,
    pageSize,
    searchQuery: searchQuery || "(없음)",
    sortBy,
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getCustomers] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { customers: [], total: 0, totalPages: 0 };
  }

  logger.info("[getCustomers] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  // 회원 조회
  let userQuery = supabase
    .from("users")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (searchQuery && searchQuery.trim()) {
    userQuery = userQuery.or(
      `name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`
    );
  }

  // 정렬
  if (sortBy === "name") {
    userQuery = userQuery.order("name", { ascending: true });
  } else if (sortBy === "email") {
    userQuery = userQuery.order("email", { ascending: true });
  } else {
    userQuery = userQuery.order("created_at", { ascending: false });
  }

  const { data: users, error: usersError, count } = await userQuery;

  if (usersError) {
    logger.error("[getCustomers] ❌ 회원 조회 실패", {
      code: usersError.code,
      message: usersError.message,
    });
    logger.groupEnd();
    return { customers: [], total: 0, totalPages: 0 };
  }

  // 각 회원의 주문 통계 조회
  const customers: CustomerListItem[] = [];

  for (const user of users || []) {
    const u = user as {
      id: string;
      clerk_user_id: string;
      email: string;
      name: string | null;
      phone: string | null;
      role: string;
      created_at: string;
    };

    // 주문 통계 조회
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_amount, created_at, paid_at")
      .eq("user_id", u.id)
      .eq("payment_status", "PAID");

    const orderCount = orders?.length || 0;
    const totalSpent =
      orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
    const lastOrderAt =
      orders && orders.length > 0
        ? orders.sort(
            (a, b) =>
              new Date(b.paid_at || b.created_at).getTime() -
              new Date(a.paid_at || a.created_at).getTime(),
          )[0]?.paid_at || orders[0]?.created_at
        : null;

    customers.push({
      id: u.id,
      clerk_user_id: u.clerk_user_id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      created_at: u.created_at,
      order_count: orderCount,
      total_spent: totalSpent,
      last_order_at: lastOrderAt,
    });
  }

  // 정렬 (주문 통계 기준)
  if (sortBy === "order_count") {
    customers.sort((a, b) => b.order_count - a.order_count);
  } else if (sortBy === "total_spent") {
    customers.sort((a, b) => b.total_spent - a.total_spent);
  } else if (sortBy === "last_order") {
    customers.sort((a, b) => {
      if (!a.last_order_at && !b.last_order_at) return 0;
      if (!a.last_order_at) return 1;
      if (!b.last_order_at) return -1;
      return (
        new Date(b.last_order_at).getTime() -
        new Date(a.last_order_at).getTime()
      );
    });
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginatedCustomers = customers.slice(from, to);

  logger.info("[getCustomers] ✅ 회원 목록 조회 성공", {
    customersCount: paginatedCustomers.length,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { customers: paginatedCustomers, total, totalPages };
}

// 회원 상세 조회 (주문 이력 포함)
export interface CustomerDetail extends CustomerListItem {
  orders: Array<{
    id: string;
    order_number: string;
    total_amount: number;
    payment_status: string;
    fulfillment_status: string;
    created_at: string;
    paid_at: string | null;
  }>;
}

export async function getCustomerById(
  customerId: string,
): Promise<CustomerDetail | null> {
  logger.group("[getCustomerById] 회원 상세 조회 시작");
  logger.info("[getCustomerById] 회원 ID:", customerId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getCustomerById] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return null;
  }

  logger.info("[getCustomerById] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  // 회원 정보 조회
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", customerId)
    .is("deleted_at", null)
    .single();

  if (userError || !user) {
    logger.error("[getCustomerById] ❌ 회원 조회 실패", {
      code: userError?.code,
      message: userError?.message,
    });
    logger.groupEnd();
    return null;
  }

  // 주문 이력 조회
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, payment_status, fulfillment_status, created_at, paid_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  // 주문 통계 계산
  const paidOrders = orders?.filter((o) => o.payment_status === "PAID") || [];
  const orderCount = paidOrders.length;
  const totalSpent = paidOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const lastOrderAt =
    paidOrders.length > 0
      ? paidOrders.sort(
          (a, b) =>
            new Date(b.paid_at || b.created_at).getTime() -
            new Date(a.paid_at || a.created_at).getTime(),
        )[0]?.paid_at || paidOrders[0]?.created_at
      : null;

  const customer: CustomerDetail = {
    id: user.id,
    clerk_user_id: user.clerk_user_id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    created_at: user.created_at,
    order_count: orderCount,
    total_spent: totalSpent,
    last_order_at: lastOrderAt,
    orders: (orders || []).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      total_amount: o.total_amount,
      payment_status: o.payment_status,
      fulfillment_status: o.fulfillment_status,
      created_at: o.created_at,
      paid_at: o.paid_at,
    })),
  };

  logger.info("[getCustomerById] ✅ 회원 상세 조회 성공:", user.email);
  logger.groupEnd();

  return customer;
}

// 리뷰 목록 조회 (관리자용)
export interface AdminReview {
  id: string;
  product_id: string;
  product_name: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  order_id: string | null;
  rating: number;
  content: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

export async function getAdminReviews(
  page: number = 1,
  pageSize: number = 20,
  searchQuery?: string,
): Promise<{ reviews: AdminReview[]; total: number; totalPages: number }> {
  logger.group("[getAdminReviews] 관리자 리뷰 목록 조회 시작");
  logger.info("[getAdminReviews] 필터 조건", {
    page,
    pageSize,
    searchQuery: searchQuery || "(없음)",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAdminReviews] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { reviews: [], total: 0, totalPages: 0 };
  }

  logger.info("[getAdminReviews] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  let query = supabase
    .from("reviews")
    .select(
      `
      id,
      product_id,
      user_id,
      order_id,
      rating,
      content,
      images,
      created_at,
      updated_at,
      product:products(name),
      user:users(name, email)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `content.ilike.%${searchQuery.trim()}%,product:products.name.ilike.%${searchQuery.trim()}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("[getAdminReviews] ❌ 리뷰 조회 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { reviews: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const reviews: AdminReview[] = (data || []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name || "상품 없음",
    user_id: item.user_id,
    user_name: item.user?.name || null,
    user_email: item.user?.email || "",
    order_id: item.order_id,
    rating: item.rating,
    content: item.content,
    images: (item.images as string[]) || [],
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  logger.info("[getAdminReviews] ✅ 리뷰 목록 조회 성공", {
    reviewsCount: reviews.length,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { reviews, total, totalPages };
}

// 문의 목록 조회 (관리자용)
export interface AdminInquiry {
  id: string;
  product_id: string;
  product_name: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  title: string;
  content: string;
  is_secret: boolean;
  status: "pending" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAdminInquiries(
  page: number = 1,
  pageSize: number = 20,
  status?: string,
  searchQuery?: string,
): Promise<{ inquiries: AdminInquiry[]; total: number; totalPages: number }> {
  logger.group("[getAdminInquiries] 관리자 문의 목록 조회 시작");
  logger.info("[getAdminInquiries] 필터 조건", {
    page,
    pageSize,
    status: status || "(전체)",
    searchQuery: searchQuery || "(없음)",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAdminInquiries] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { inquiries: [], total: 0, totalPages: 0 };
  }

  logger.info("[getAdminInquiries] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  let query = supabase
    .from("inquiries")
    .select(
      `
      id,
      product_id,
      user_id,
      title,
      content,
      is_secret,
      status,
      answer,
      answered_at,
      created_at,
      updated_at,
      product:products(name),
      user:users(name, email)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (status) {
    query = query.eq("status", status);
  }

  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%,product:products.name.ilike.%${searchQuery.trim()}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("[getAdminInquiries] ❌ 문의 조회 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { inquiries: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const inquiries: AdminInquiry[] = (data || []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name || "상품 없음",
    user_id: item.user_id,
    user_name: item.user?.name || null,
    user_email: item.user?.email || null,
    title: item.title,
    content: item.content,
    is_secret: item.is_secret,
    status: item.status,
    answer: item.answer,
    answered_at: item.answered_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  logger.info("[getAdminInquiries] ✅ 문의 목록 조회 성공", {
    inquiriesCount: inquiries.length,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { inquiries, total, totalPages };
}

// 문의 답변 등록/수정
export async function answerInquiry(
  inquiryId: string,
  answer: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[answerInquiry] 문의 답변 등록 시작");
  logger.info("[answerInquiry] 문의 ID:", inquiryId, "답변 길이:", answer.length);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[answerInquiry] ❌ 관리자 권한 없음 - 답변 등록 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  if (!answer.trim()) {
    logger.warn("[answerInquiry] ❌ 답변 내용이 없습니다");
    logger.groupEnd();
    return { success: false, message: "답변 내용을 입력해주세요." };
  }

  logger.info("[answerInquiry] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("inquiries")
    .update({
      answer: answer.trim(),
      status: "answered",
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  if (error) {
    logger.error("[answerInquiry] ❌ 문의 답변 등록 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { success: false, message: "답변 등록에 실패했습니다." };
  }

  logger.info("[answerInquiry] ✅ 문의 답변 등록 성공");
  logger.groupEnd();
  return { success: true, message: "답변이 등록되었습니다." };
}

// 문의 삭제 (관리자용, 소프트 삭제)
export async function deleteInquiry(
  inquiryId: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[deleteInquiry] 문의 삭제 시작");
  logger.info("[deleteInquiry] 문의 ID:", inquiryId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteInquiry] ❌ 관리자 권한 없음 - 삭제 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  logger.info("[deleteInquiry] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("inquiries")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  if (error) {
    logger.error("[deleteInquiry] ❌ 문의 삭제 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { success: false, message: "문의 삭제에 실패했습니다." };
  }

  logger.info("[deleteInquiry] ✅ 문의 삭제 성공");
  logger.groupEnd();
  return { success: true, message: "문의가 삭제되었습니다." };
}

// 문의 일괄 삭제 (관리자용)
export async function deleteInquiries(
  inquiryIds: string[],
): Promise<{ success: boolean; message: string; deletedCount: number }> {
  logger.group("[deleteInquiries] 문의 일괄 삭제 시작");
  logger.info("[deleteInquiries] 삭제할 문의 ID 개수:", inquiryIds.length);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteInquiries] ❌ 관리자 권한 없음 - 삭제 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다.", deletedCount: 0 };
  }

  if (!inquiryIds || inquiryIds.length === 0) {
    logger.warn("[deleteInquiries] ❌ 삭제할 문의 ID가 없습니다");
    logger.groupEnd();
    return { success: false, message: "삭제할 문의를 선택해주세요.", deletedCount: 0 };
  }

  logger.info("[deleteInquiries] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  const supabase = getServiceRoleClient();

  let deletedCount = 0;
  const errors: string[] = [];

  for (const inquiryId of inquiryIds) {
    const { error } = await supabase
      .from("inquiries")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId);

    if (error) {
      logger.error("[deleteInquiries] ❌ 문의 삭제 실패", {
        inquiryId,
        code: error.code,
        message: error.message,
      });
      errors.push(`${inquiryId}: ${error.message}`);
    } else {
      deletedCount++;
    }
  }

  if (errors.length > 0) {
    logger.warn("[deleteInquiries] ⚠️ 일부 문의 삭제 실패", {
      deletedCount,
      errorCount: errors.length,
      errors,
    });
    logger.groupEnd();
    return {
      success: deletedCount > 0,
      message: `${deletedCount}개 삭제 완료. ${errors.length}개 실패.`,
      deletedCount,
    };
  }

  logger.info("[deleteInquiries] ✅ 문의 일괄 삭제 성공", {
    deletedCount,
  });
  logger.groupEnd();
  return {
    success: true,
    message: `${deletedCount}개의 문의가 삭제되었습니다.`,
    deletedCount,
  };
}

// 미답변 문의 수 조회 (대시보드용)
export async function getUnansweredInquiriesCount(): Promise<number> {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    return 0;
  }

  const supabase = getServiceRoleClient();

  const { count, error } = await supabase
    .from("inquiries")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .is("deleted_at", null);

  if (error) {
    logger.error("[getUnansweredInquiriesCount] ❌ 미답변 문의 수 조회 실패", {
      code: error.code,
      message: error.message,
    });
    return 0;
  }

  return count ?? 0;
}

// 리뷰 삭제 (관리자용, 소프트 삭제)
export async function deleteReview(
  reviewId: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[deleteReview] 리뷰 삭제 시작");
  logger.info("[deleteReview] 리뷰 ID:", reviewId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteReview] ❌ 관리자 권한 없음 - 삭제 중단");
    logger.groupEnd();
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  logger.info("[deleteReview] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("reviews")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) {
    logger.error("[deleteReview] ❌ 리뷰 삭제 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { success: false, message: "리뷰 삭제에 실패했습니다." };
  }

  logger.info("[deleteReview] ✅ 리뷰 삭제 성공");
  logger.groupEnd();
  return { success: true, message: "리뷰가 삭제되었습니다." };
}

// 쿠폰 목록 조회 (관리자용)
export interface AdminCoupon {
  id: string;
  code: string;
  name: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  discount_type: "fixed" | "percentage";
  discount_amount: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  status: "active" | "used" | "expired";
  used_at: string | null;
  expires_at: string;
  order_id: string | null;
  created_at: string;
}

export async function getAdminCoupons(
  page: number = 1,
  pageSize: number = 20,
  status?: string,
  searchQuery?: string,
): Promise<{ coupons: AdminCoupon[]; total: number; totalPages: number }> {
  logger.group("[getAdminCoupons] 관리자 쿠폰 목록 조회 시작");
  logger.info("[getAdminCoupons] 필터 조건", {
    page,
    pageSize,
    status: status || "(전체)",
    searchQuery: searchQuery || "(없음)",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAdminCoupons] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { coupons: [], total: 0, totalPages: 0 };
  }

  logger.info("[getAdminCoupons] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  let query = supabase
    .from("coupons")
    .select(
      `
      *,
      user:users!fk_coupons_user_id(name, email)
    `,
      { count: "exact" },
    );

  if (status) {
    query = query.eq("status", status);
  }

  if (searchQuery && searchQuery.trim()) {
    query = query.or(
      `code.ilike.%${searchQuery.trim()}%,name.ilike.%${searchQuery.trim()}%`
    );
  }

  query = query.order("created_at", { ascending: false });

  // 페이지네이션
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("[getAdminCoupons] ❌ 쿠폰 조회 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return { coupons: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const coupons: AdminCoupon[] = (data || []).map((item: any) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    user_id: item.user_id,
    user_name: item.user?.name || null,
    user_email: item.user?.email || "",
    discount_type: item.discount_type,
    discount_amount: item.discount_amount,
    min_order_amount: item.min_order_amount,
    max_discount_amount: item.max_discount_amount,
    status: item.status,
    used_at: item.used_at,
    expires_at: item.expires_at,
    order_id: item.order_id,
    created_at: item.created_at,
  }));

  logger.info("[getAdminCoupons] ✅ 쿠폰 목록 조회 성공", {
    couponsCount: coupons.length,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { coupons, total, totalPages };
}

// 통계 데이터 조회
export interface AnalyticsData {
  // 기간별 매출
  revenueToday: number;
  revenue7Days: number;
  revenue30Days: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  
  // 주문 통계
  ordersToday: number;
  orders7Days: number;
  orders30Days: number;
  
  // 취소/환불 통계
  canceledToday: number;
  canceled7Days: number;
  canceled30Days: number;
  refundedToday: number;
  refunded7Days: number;
  refunded30Days: number;
  
  // 베스트 상품 (판매량 기준)
  bestProducts: Array<{
    product_id: string;
    product_name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
  
  // 취소율
  cancelRate7Days: number;
  cancelRate30Days: number;
}

export async function getAnalyticsData(
  startDate?: string,
  endDate?: string,
): Promise<AnalyticsData | null> {
  logger.group("[getAnalyticsData] 통계 데이터 조회 시작");
  logger.info("[getAnalyticsData] 기간:", {
    startDate: startDate || "(전체)",
    endDate: endDate || "(전체)",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAnalyticsData] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return null;
  }

  logger.info("[getAnalyticsData] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  const supabase = getServiceRoleClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // 오늘 매출
  const { data: revenueTodayData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID")
    .gte("paid_at", todayStart.toISOString());

  const revenueToday =
    revenueTodayData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 7일 매출
  const { data: revenue7DaysData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID")
    .gte("paid_at", sevenDaysAgo.toISOString());

  const revenue7Days =
    revenue7DaysData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 30일 매출
  const { data: revenue30DaysData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID")
    .gte("paid_at", thirtyDaysAgo.toISOString());

  const revenue30Days =
    revenue30DaysData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 이번 달 매출
  const { data: revenueThisMonthData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID")
    .gte("paid_at", thisMonthStart.toISOString());

  const revenueThisMonth =
    revenueThisMonthData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 지난 달 매출
  const { data: revenueLastMonthData } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("payment_status", "PAID")
    .gte("paid_at", lastMonthStart.toISOString())
    .lte("paid_at", lastMonthEnd.toISOString());

  const revenueLastMonth =
    revenueLastMonthData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

  // 주문 통계
  const { count: ordersToday } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());

  const { count: orders7Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: orders30Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  // 취소/환불 통계
  const { count: canceledToday } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "CANCELED")
    .gte("created_at", todayStart.toISOString());

  const { count: canceled7Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "CANCELED")
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: canceled30Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "CANCELED")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const { count: refundedToday } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "REFUNDED")
    .gte("created_at", todayStart.toISOString());

  const { count: refunded7Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "REFUNDED")
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: refunded30Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("payment_status", "REFUNDED")
    .gte("created_at", thirtyDaysAgo.toISOString());

  // 베스트 상품 (판매량 기준) - 30일간 결제 완료된 주문의 상품들
  const { data: paidOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_status", "PAID")
    .gte("paid_at", thirtyDaysAgo.toISOString());

  const paidOrderIds = paidOrders?.map((o) => o.id) || [];

  let orderItems: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }> = [];

  if (paidOrderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, product_name, quantity, price")
      .in("order_id", paidOrderIds);

    orderItems = (items || []) as typeof orderItems;
  }

  const productStats = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();

  orderItems?.forEach((item) => {
    const existing = productStats.get(item.product_id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
    } else {
      productStats.set(item.product_id, {
        name: item.product_name,
        quantity: item.quantity,
        revenue: item.price * item.quantity,
      });
    }
  });

  const bestProducts = Array.from(productStats.entries())
    .map(([product_id, stats]) => ({
      product_id,
      product_name: stats.name,
      total_quantity: stats.quantity,
      total_revenue: stats.revenue,
    }))
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 10);

  // 취소율 계산
  const { count: totalOrders7Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: totalOrders30Days } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  const cancelRate7Days =
    totalOrders7Days && totalOrders7Days > 0
      ? ((canceled7Days || 0) / totalOrders7Days) * 100
      : 0;

  const cancelRate30Days =
    totalOrders30Days && totalOrders30Days > 0
      ? ((canceled30Days || 0) / totalOrders30Days) * 100
      : 0;

  const result: AnalyticsData = {
    revenueToday,
    revenue7Days,
    revenue30Days,
    revenueThisMonth,
    revenueLastMonth,
    ordersToday: ordersToday || 0,
    orders7Days: orders7Days || 0,
    orders30Days: orders30Days || 0,
    canceledToday: canceledToday || 0,
    canceled7Days: canceled7Days || 0,
    canceled30Days: canceled30Days || 0,
    refundedToday: refundedToday || 0,
    refunded7Days: refunded7Days || 0,
    refunded30Days: refunded30Days || 0,
    bestProducts,
    cancelRate7Days: Math.round(cancelRate7Days * 10) / 10,
    cancelRate30Days: Math.round(cancelRate30Days * 10) / 10,
  };

  logger.info("[getAnalyticsData] ✅ 통계 데이터 조회 성공", {
    revenueToday: result.revenueToday,
    revenue7Days: result.revenue7Days,
    revenue30Days: result.revenue30Days,
    bestProductsCount: result.bestProducts.length,
  });
  logger.groupEnd();

  return result;
}

// 상품 목록 조회 (관리자용)
export async function getAdminProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery?: string,
  categoryId?: string,
  status?: string,
  stockFilter?: string,
  sortBy?: string,
): Promise<{ products: ProductListItem[]; total: number; totalPages: number }> {
  logger.group("[getAdminProducts] 관리자 상품 조회 시작");
  logger.info("[getAdminProducts] 필터 조건", {
    page,
    pageSize,
    searchQuery: searchQuery || "(없음)",
    categoryId: categoryId || "(전체)",
    status: status || "(전체)",
    stockFilter: stockFilter || "(전체)",
    sortBy: sortBy || "created_at",
  });

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAdminProducts] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return { products: [], total: 0, totalPages: 0 };
  }

  logger.info("[getAdminProducts] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

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
    logger.info("[getAdminProducts] 검색 필터 적용:", searchQuery.trim());
    query = query.ilike("name", `%${searchQuery.trim()}%`);
  }

  // 카테고리 필터
  if (categoryId) {
    logger.info("[getAdminProducts] 카테고리 필터 적용:", categoryId);
    query = query.eq("category_id", categoryId);
  }

  // 노출 상태 필터
  if (status) {
    logger.info("[getAdminProducts] 노출 상태 필터 적용:", status);
    query = query.eq("status", status);
  }

  // 재고 필터
  if (stockFilter === "low") {
    logger.info("[getAdminProducts] 재고부족 필터 적용 (10개 이하)");
    query = query.lte("stock", 10);
  } else if (stockFilter === "out") {
    logger.info("[getAdminProducts] 품절 필터 적용");
    query = query.eq("stock", 0);
  }

  // 정렬 적용
  if (sortBy === "name") {
    query = query.order("name", { ascending: true });
  } else if (sortBy === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (sortBy === "price_desc") {
    query = query.order("price", { ascending: false });
  } else if (sortBy === "stock_asc") {
    query = query.order("stock", { ascending: true });
  } else if (sortBy === "stock_desc") {
    query = query.order("stock", { ascending: false });
  } else {
    // 기본: 등록일 최신순
    query = query.order("created_at", { ascending: false });
  }

  // 전체 데이터 가져오기 (정렬을 위해)
  const { data: allData, error, count } = await query;

  if (error) {
    logger.error("[getAdminProducts] ❌ 상품 조회 실패", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    logger.groupEnd();
    return { products: [], total: 0, totalPages: 0 };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // 정렬 로직: sortBy가 "id"인 경우에만 특별 정렬 적용
  let sortedData = allData || [];
  
  if (sortBy === "id") {
    // ttotto_pr_001을 맨 앞으로, ttotto_pr_316을 맨 뒤로
    sortedData = sortedData.sort((a, b) => {
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
  }

  logger.info(
    `[getAdminProducts] 정렬 완료: 총 ${sortedData.length}개`,
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

  logger.info("[getAdminProducts] ✅ 상품 조회 성공:", {
    productsCount: products.length,
    total,
    totalPages,
  });
  logger.groupEnd();

  return { products, total, totalPages };
}

// 관리자용 주문 상세 조회
export async function getAdminOrderById(
  orderId: string,
): Promise<(Order & { items: OrderItem[]; user_email: string | null; payment?: { method: string; amount: number; approved_at: string | null } | null }) | null> {
  logger.group("[getAdminOrderById] 관리자 주문 상세 조회 시작");
  logger.info("[getAdminOrderById] 주문 ID:", orderId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getAdminOrderById] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return null;
  }

  logger.info("[getAdminOrderById] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");
  
  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

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
    logger.error("[getAdminOrderById] ❌ 주문 조회 실패", {
      code: orderError?.code,
      message: orderError?.message,
      details: orderError?.details,
      hint: orderError?.hint,
    });
    logger.groupEnd();
    return null;
  }

  // 주문 상품 조회
  logger.info("[getAdminOrderById] 주문 상품 조회 중...");
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsError) {
    logger.error("[getAdminOrderById] ❌ 주문 상품 조회 실패", {
      code: itemsError.code,
      message: itemsError.message,
    });
  } else {
    logger.info(`[getAdminOrderById] ✅ 주문 상품: ${items?.length ?? 0}개`);
  }

  // 결제 정보 조회
  logger.info("[getAdminOrderById] 결제 정보 조회 중...");
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("method, amount, approved_at")
    .eq("order_id", orderId)
    .eq("status", "done")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  if (paymentError && paymentError.code !== "PGRST116") {
    logger.warn("[getAdminOrderById] 결제 정보 조회 실패 (무시 가능)", {
      code: paymentError.code,
      message: paymentError.message,
    });
  }

  const orderWithData = {
    ...order,
    items: (items as OrderItem[]) || [],
    user_email: (order as any).user?.email || null,
    payment: payment || null,
  } as Order & { items: OrderItem[]; user_email: string | null; payment?: { method: string; amount: number; approved_at: string | null } | null };

  logger.info("[getAdminOrderById] ✅ 주문 조회 성공:", order.order_number);
  logger.groupEnd();

  return orderWithData;
}

// 상품 ID로 조회 (관리자용)
export async function getProductById(
  productId: string,
): Promise<ProductWithDetails | null> {
  logger.group("[getProductById] 상품 조회 시작");
  logger.info("[getProductById] 상품 ID:", productId);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[getProductById] ❌ 관리자 권한 없음 - 조회 중단");
    logger.groupEnd();
    return null;
  }

  logger.info("[getProductById] ✅ 관리자 권한 확인됨 - Service Role 클라이언트 사용");

  // 관리자 대시보드는 RLS를 우회하기 위해 service_role 클라이언트 사용
  const supabase = getServiceRoleClient();

  logger.info("[getProductById] 상품 데이터 조회 중...");
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
    logger.error("[getProductById] ❌ 상품 조회 실패", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    logger.groupEnd();
    return null;
  }

  logger.info("[getProductById] ✅ 상품 조회 성공:", data?.name);
  logger.groupEnd();

  return data as unknown as ProductWithDetails;
}
