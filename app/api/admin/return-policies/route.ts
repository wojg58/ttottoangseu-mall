/**
 * @file app/api/admin/return-policies/route.ts
 * @description 반품 정책 API 라우트
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";

export async function GET() {
  logger.group("[ReturnPolicies API] 반품 정책 조회 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ReturnPolicies API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("return_policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[ReturnPolicies API] ❌ 조회 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "반품 정책 조회에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ReturnPolicies API] ✅ 조회 성공:", data?.length || 0);
  logger.groupEnd();

  return NextResponse.json({ policies: data || [] });
}

export async function POST(request: NextRequest) {
  logger.group("[ReturnPolicies API] 반품 정책 추가 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ReturnPolicies API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const body = await request.json();
  logger.info("[ReturnPolicies API] 요청 데이터:", body);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("return_policies")
    .insert({
      title: body.title,
      content: body.content,
      return_period_days: body.return_period_days,
      exchange_period_days: body.exchange_period_days,
      return_shipping_fee: body.return_shipping_fee,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    logger.error("[ReturnPolicies API] ❌ 추가 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "반품 정책 추가에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ReturnPolicies API] ✅ 추가 성공:", data.id);
  logger.groupEnd();

  return NextResponse.json({ policy: data });
}
