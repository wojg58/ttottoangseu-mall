/**
 * @file app/api/admin/shipping-settings/[id]/route.ts
 * @description 배송비 설정 상세 API 라우트
 *
 * 주요 기능:
 * 1. 배송비 설정 수정 (PUT)
 * 2. 배송비 설정 삭제 (DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.group("[ShippingSettings API] 배송비 설정 수정 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ShippingSettings API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  logger.info("[ShippingSettings API] 설정 ID:", id);
  logger.info("[ShippingSettings API] 요청 데이터:", body);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("shipping_settings")
    .update({
      name: body.name,
      base_shipping_fee: body.base_shipping_fee,
      free_shipping_threshold: body.free_shipping_threshold || null,
      is_active: body.is_active ?? true,
      description: body.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("[ShippingSettings API] ❌ 수정 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "배송비 설정 수정에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ShippingSettings API] ✅ 수정 성공:", data.id);
  logger.groupEnd();

  return NextResponse.json({ setting: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.group("[ShippingSettings API] 배송비 설정 삭제 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ShippingSettings API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;
  logger.info("[ShippingSettings API] 설정 ID:", id);

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("shipping_settings")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("[ShippingSettings API] ❌ 삭제 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "배송비 설정 삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ShippingSettings API] ✅ 삭제 성공");
  logger.groupEnd();

  return NextResponse.json({ success: true });
}
