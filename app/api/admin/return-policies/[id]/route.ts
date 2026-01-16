/**
 * @file app/api/admin/return-policies/[id]/route.ts
 * @description 반품 정책 상세 API 라우트
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.group("[ReturnPolicies API] 반품 정책 수정 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ReturnPolicies API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  logger.info("[ReturnPolicies API] 정책 ID:", id);
  logger.info("[ReturnPolicies API] 요청 데이터:", body);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("return_policies")
    .update({
      title: body.title,
      content: body.content,
      return_period_days: body.return_period_days,
      exchange_period_days: body.exchange_period_days,
      return_shipping_fee: body.return_shipping_fee,
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("[ReturnPolicies API] ❌ 수정 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "반품 정책 수정에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ReturnPolicies API] ✅ 수정 성공:", data.id);
  logger.groupEnd();

  return NextResponse.json({ policy: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  logger.group("[ReturnPolicies API] 반품 정책 삭제 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ReturnPolicies API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;
  logger.info("[ReturnPolicies API] 정책 ID:", id);

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("return_policies")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("[ReturnPolicies API] ❌ 삭제 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "반품 정책 삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ReturnPolicies API] ✅ 삭제 성공");
  logger.groupEnd();

  return NextResponse.json({ success: true });
}
