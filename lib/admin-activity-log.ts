/**
 * @file lib/admin-activity-log.ts
 * @description 관리자 활동 로그 기록 유틸리티 (서버 전용)
 *
 * 주요 기능:
 * 1. 관리자 활동 로그 기록 (admin_activity_logs 테이블)
 * 2. 관리자 권한 자동 검증
 * 3. IP 주소 및 User Agent 자동 추출
 * 4. 변경 전/후 값 JSONB 저장
 *
 * @dependencies
 * - @clerk/nextjs/server: currentUser
 * - actions/admin: isAdmin
 * - lib/supabase/server: createClient
 * - lib/logger: 로깅
 */

import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";
import type { NextRequest } from "next/server";

export interface LogAdminActionParams {
  /** 액션 (예: "order_status_changed", "product_price_updated") */
  action: string;
  /** 엔티티 타입 (예: "order", "product", "inventory") */
  entity_type: string;
  /** 엔티티 ID */
  entity_id: string;
  /** 변경 전 값 (JSONB로 저장됨) */
  before?: any;
  /** 변경 후 값 (JSONB로 저장됨) */
  after?: any;
  /** Next.js Request 객체 (IP, User Agent 추출용) */
  req?: NextRequest | Request;
}

/**
 * 관리자 활동 로그 기록
 *
 * @param params 로그 기록 파라미터
 * @returns 성공 여부
 *
 * @example
 * ```typescript
 * // API Route에서 사용
 * import { logAdminAction } from "@/lib/admin-activity-log";
 * import { NextRequest } from "next/server";
 *
 * export async function PUT(request: NextRequest) {
 *   // ... 주문 상태 변경 로직 ...
 *
 *   await logAdminAction({
 *     action: "order_status_changed",
 *     entity_type: "order",
 *     entity_id: orderId,
 *     before: { payment_status: "PENDING" },
 *     after: { payment_status: "PAID" },
 *     req: request,
 *   });
 * }
 * ```
 */
export async function logAdminAction(
  params: LogAdminActionParams
): Promise<boolean> {
  logger.group("[logAdminAction] 관리자 활동 로그 기록 시작");
  logger.info("[logAdminAction] 액션:", params.action);
  logger.info(
    "[logAdminAction] 엔티티:",
    params.entity_type,
    params.entity_id
  );

  try {
    // 1. 관리자 권한 확인
    const adminUser = await isAdmin();
    if (!adminUser) {
      logger.warn(
        "[logAdminAction] ❌ 관리자 권한 없음 - 로그 기록 중단"
      );
      logger.groupEnd();
      return false;
    }

    // 2. 현재 사용자 정보 가져오기
    const user = await currentUser();
    if (!user) {
      logger.warn("[logAdminAction] ❌ 사용자 정보 없음 - 로그 기록 중단");
      logger.groupEnd();
      return false;
    }

    const clerkUserId = user.id;
    const adminEmail =
      user.emailAddresses?.find(
        (addr) => addr.id === user.primaryEmailAddressId
      )?.emailAddress || null;

    logger.info("[logAdminAction] 관리자 정보:", {
      clerkUserId,
      adminEmail,
    });

    // 3. IP 주소 및 User Agent 추출
    let ip: string | null = null;
    let userAgent: string | null = null;

    if (params.req) {
      // IP 주소 추출 (다양한 헤더 확인)
      const forwardedFor = params.req.headers.get("x-forwarded-for");
      const realIp = params.req.headers.get("x-real-ip");
      const cfConnectingIp = params.req.headers.get("cf-connecting-ip"); // Cloudflare

      if (forwardedFor) {
        // x-forwarded-for는 여러 IP가 쉼표로 구분될 수 있음
        ip = forwardedFor.split(",")[0].trim();
      } else if (realIp) {
        ip = realIp;
      } else if (cfConnectingIp) {
        ip = cfConnectingIp;
      } else if (params.req instanceof NextRequest) {
        // NextRequest의 경우 ip 속성 사용
        ip = params.req.ip || null;
      }

      // User Agent 추출
      userAgent = params.req.headers.get("user-agent");

      logger.info("[logAdminAction] 요청 정보:", {
        ip,
        userAgent: userAgent?.substring(0, 50) + "...",
      });
    }

    // 4. Supabase 클라이언트 생성 (RLS 정책 적용)
    const supabase = await createClient();

    // 5. 로그 기록
    const { error } = await supabase.from("admin_activity_logs").insert({
      admin_user_id: clerkUserId, // TEXT 타입 (Clerk user ID)
      admin_email: adminEmail,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      before: params.before || null, // JSONB
      after: params.after || null, // JSONB
      ip: ip,
      user_agent: userAgent,
    });

    if (error) {
      logger.error("[logAdminAction] ❌ 로그 기록 실패", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      logger.groupEnd();
      return false;
    }

    logger.info("[logAdminAction] ✅ 로그 기록 성공");
    logger.groupEnd();
    return true;
  } catch (error) {
    logger.error("[logAdminAction] ❌ 예외 발생:", error);
    logger.groupEnd();
    // 로그 기록 실패해도 메인 로직은 계속 진행
    return false;
  }
}

/**
 * 주문 상태 변경 로그 기록 (편의 함수)
 *
 * @example
 * ```typescript
 * await logOrderStatusChange({
 *   orderId: "order-123",
 *   before: { payment_status: "PENDING", fulfillment_status: "UNFULFILLED" },
 *   after: { payment_status: "PAID", fulfillment_status: "PREPARING" },
 *   req: request,
 * });
 * ```
 */
export async function logOrderStatusChange(params: {
  orderId: string;
  before: Record<string, any>;
  after: Record<string, any>;
  req?: NextRequest | Request;
}): Promise<boolean> {
  return logAdminAction({
    action: "order_status_changed",
    entity_type: "order",
    entity_id: params.orderId,
    before: params.before,
    after: params.after,
    req: params.req,
  });
}

/**
 * 상품 가격 변경 로그 기록 (편의 함수)
 *
 * @example
 * ```typescript
 * await logProductPriceChange({
 *   productId: "prod-123",
 *   before: { price: 10000 },
 *   after: { price: 15000 },
 *   req: request,
 * });
 * ```
 */
export async function logProductPriceChange(params: {
  productId: string;
  before: Record<string, any>;
  after: Record<string, any>;
  req?: NextRequest | Request;
}): Promise<boolean> {
  return logAdminAction({
    action: "product_price_updated",
    entity_type: "product",
    entity_id: params.productId,
    before: params.before,
    after: params.after,
    req: params.req,
  });
}

/**
 * 재고 변경 로그 기록 (편의 함수)
 *
 * @example
 * ```typescript
 * await logInventoryChange({
 *   productId: "prod-123",
 *   variantId: "var-456",
 *   before: { stock: 10 },
 *   after: { stock: 5 },
 *   req: request,
 * });
 * ```
 */
export async function logInventoryChange(params: {
  productId: string;
  variantId?: string | null;
  before: Record<string, any>;
  after: Record<string, any>;
  req?: NextRequest | Request;
}): Promise<boolean> {
  return logAdminAction({
    action: "inventory_updated",
    entity_type: "inventory",
    entity_id: params.variantId || params.productId,
    before: params.before,
    after: params.after,
    req: params.req,
  });
}
