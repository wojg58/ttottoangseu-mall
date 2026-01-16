/**
 * @file app/api/admin/orders/[id]/status/route.ts
 * @description 주문 상태 변경 API 라우트
 *
 * 주요 기능:
 * 1. 주문 상태 변경 (payment_status, fulfillment_status, tracking_number)
 * 2. 관리자 활동 로그 자동 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAdminAction } from "@/lib/admin-activity-log";
import logger from "@/lib/logger";
import type { Order } from "@/types/database";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.group("[PUT /api/admin/orders/[id]/status] 주문 상태 변경 시작");

  try {
    // 1. 관리자 권한 확인
    const adminUser = await isAdmin();
    if (!adminUser) {
      logger.warn("[PUT /api/admin/orders/[id]/status] ❌ 관리자 권한 없음");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    logger.info("[PUT /api/admin/orders/[id]/status] 주문 ID:", id);
    logger.info("[PUT /api/admin/orders/[id]/status] 요청 데이터:", body);

    const supabase = getServiceRoleClient();

    // 2. 변경 전 주문 정보 조회 (before)
    const { data: oldOrder, error: oldOrderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, payment_status, fulfillment_status, tracking_number, shipped_at, delivered_at"
      )
      .eq("id", id)
      .single();

    if (oldOrderError || !oldOrder) {
      logger.error("[PUT /api/admin/orders/[id]/status] ❌ 주문 조회 실패", {
        code: oldOrderError?.code,
        message: oldOrderError?.message,
      });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    logger.info("[PUT /api/admin/orders/[id]/status] 변경 전 주문 상태:", {
      payment_status: oldOrder.payment_status,
      fulfillment_status: oldOrder.fulfillment_status,
      tracking_number: oldOrder.tracking_number,
    });

    // 3. 업데이트 데이터 준비
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
    if (body.payment_status && body.payment_status !== oldOrder.payment_status) {
      updateData.payment_status = body.payment_status;
    }

    // fulfillment_status 업데이트
    if (
      body.fulfillment_status &&
      body.fulfillment_status !== oldOrder.fulfillment_status
    ) {
      updateData.fulfillment_status = body.fulfillment_status;

      // 배송 상태에 따른 자동 처리
      if (body.fulfillment_status === "SHIPPED" && body.tracking_number) {
        updateData.tracking_number = body.tracking_number;
        updateData.shipped_at = new Date().toISOString();
      } else if (body.fulfillment_status === "DELIVERED") {
        updateData.delivered_at = new Date().toISOString();
      }
    }

    // trackingNumber만 별도로 업데이트하는 경우
    if (
      body.tracking_number &&
      body.tracking_number !== oldOrder.tracking_number
    ) {
      updateData.tracking_number = body.tracking_number;
    }

    // 변경사항이 없으면 에러 반환
    if (Object.keys(updateData).length === 1) {
      // updated_at만 있는 경우
      logger.warn(
        "[PUT /api/admin/orders/[id]/status] ⚠️ 변경사항 없음"
      );
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "변경할 내용이 없습니다." },
        { status: 400 }
      );
    }

    // 4. 주문 상태 업데이트
    const { data: newOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select(
        "id, order_number, payment_status, fulfillment_status, tracking_number, shipped_at, delivered_at"
      )
      .single();

    if (updateError || !newOrder) {
      logger.error(
        "[PUT /api/admin/orders/[id]/status] ❌ 주문 상태 업데이트 실패",
        {
          code: updateError?.code,
          message: updateError?.message,
        }
      );
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문 상태 업데이트에 실패했습니다." },
        { status: 500 }
      );
    }

    logger.info("[PUT /api/admin/orders/[id]/status] 변경 후 주문 상태:", {
      payment_status: newOrder.payment_status,
      fulfillment_status: newOrder.fulfillment_status,
      tracking_number: newOrder.tracking_number,
    });

    // 5. 관리자 활동 로그 기록
    try {
      const beforeData: Record<string, any> = {};
      const afterData: Record<string, any> = {};

      if (body.payment_status && body.payment_status !== oldOrder.payment_status) {
        beforeData.payment_status = oldOrder.payment_status;
        afterData.payment_status = newOrder.payment_status;
      }

      if (
        body.fulfillment_status &&
        body.fulfillment_status !== oldOrder.fulfillment_status
      ) {
        beforeData.fulfillment_status = oldOrder.fulfillment_status;
        afterData.fulfillment_status = newOrder.fulfillment_status;
      }

      if (
        body.tracking_number &&
        body.tracking_number !== oldOrder.tracking_number
      ) {
        beforeData.tracking_number = oldOrder.tracking_number || null;
        afterData.tracking_number = newOrder.tracking_number || null;
      }

      // 로그 기록 (변경사항이 있는 경우만)
      if (Object.keys(beforeData).length > 0) {
        const logResult = await logAdminAction({
          action: "order_status_changed",
          entity_type: "order",
          entity_id: id,
          before: beforeData,
          after: afterData,
          req: request,
        });

        if (!logResult) {
          logger.warn(
            "[PUT /api/admin/orders/[id]/status] ⚠️ 로그 기록 실패 (주문 상태는 업데이트됨)"
          );
        } else {
          logger.info(
            "[PUT /api/admin/orders/[id]/status] ✅ 로그 기록 성공"
          );
        }
      }
    } catch (logError) {
      logger.error(
        "[PUT /api/admin/orders/[id]/status] ❌ 로그 기록 예외 발생",
        logError
      );
      // 로그 기록 실패해도 주문 상태 업데이트는 성공했으므로 계속 진행
    }

    logger.info("[PUT /api/admin/orders/[id]/status] ✅ 주문 상태 변경 성공");
    logger.groupEnd();

    return NextResponse.json({
      success: true,
      message: "주문 상태가 업데이트되었습니다.",
      order: newOrder,
    });
  } catch (error) {
    logger.error(
      "[PUT /api/admin/orders/[id]/status] ❌ 예외 발생:",
      error
    );
    logger.groupEnd();
    return NextResponse.json(
      {
        success: false,
        message: "주문 상태 업데이트 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
