/**
 * @file app/api/admin/shipping-settings/route.ts
 * @description 배송비 설정 API 라우트
 *
 * 주요 기능:
 * 1. 배송비 설정 목록 조회 (GET)
 * 2. 배송비 설정 추가 (POST)
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";

export async function GET() {
  logger.group("[ShippingSettings API] 배송비 설정 조회 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ShippingSettings API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("shipping_settings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[ShippingSettings API] ❌ 조회 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "배송비 설정 조회에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ShippingSettings API] ✅ 조회 성공:", data?.length || 0);
  logger.groupEnd();

  return NextResponse.json({ settings: data || [] });
}

export async function POST(request: NextRequest) {
  logger.group("[ShippingSettings API] 배송비 설정 추가 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[ShippingSettings API] ❌ 관리자 권한 없음");
    logger.groupEnd();
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }

  const body = await request.json();
  logger.info("[ShippingSettings API] 요청 데이터:", body);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("shipping_settings")
    .insert({
      name: body.name,
      base_shipping_fee: body.base_shipping_fee,
      free_shipping_threshold: body.free_shipping_threshold || null,
      is_active: body.is_active ?? true,
      description: body.description || null,
    })
    .select()
    .single();

  if (error) {
    logger.error("[ShippingSettings API] ❌ 추가 실패", {
      code: error.code,
      message: error.message,
    });
    logger.groupEnd();
    return NextResponse.json(
      { message: "배송비 설정 추가에 실패했습니다." },
      { status: 500 }
    );
  }

  logger.info("[ShippingSettings API] ✅ 추가 성공:", data.id);
  logger.groupEnd();

  return NextResponse.json({ setting: data });
}
