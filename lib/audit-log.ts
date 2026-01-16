/**
 * @file lib/audit-log.ts
 * @description 관리자 활동 로그 (Audit Log) 유틸리티
 *
 * 주요 기능:
 * 1. 관리자 활동 로그 기록
 * 2. 변경 전/후 값 비교 및 저장
 * 3. IP 주소 및 User Agent 추적
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { currentUser } from "@clerk/nextjs/server";
import logger from "@/lib/logger";

export interface AuditLogData {
  action: string; // 액션 (예: "order_status_changed", "product_price_updated")
  entityType: string; // 엔티티 타입 (예: "order", "product")
  entityId: string; // 엔티티 ID
  entityName?: string; // 엔티티 이름 (예: 주문번호, 상품명)
  fieldName?: string; // 변경된 필드명
  oldValue?: any; // 변경 전 값
  newValue?: any; // 변경 후 값
  description?: string; // 설명
  ipAddress?: string; // IP 주소
  userAgent?: string; // User Agent
}

/**
 * 관리자 활동 로그 기록
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  logger.group("[createAuditLog] 관리자 활동 로그 기록 시작");
  logger.info("[createAuditLog] 액션:", data.action);
  logger.info("[createAuditLog] 엔티티:", data.entityType, data.entityId);

  try {
    const user = await currentUser();
    if (!user) {
      logger.warn("[createAuditLog] ❌ 사용자 정보 없음 - 로그 기록 중단");
      logger.groupEnd();
      return;
    }

    // 관리자 권한 확인 (간단 체크)
    const isAdmin =
      user.publicMetadata?.role === "admin" ||
      user.publicMetadata?.isAdmin === true;

    if (!isAdmin) {
      logger.info("[createAuditLog] 일반 사용자 - 로그 기록 안 함");
      logger.groupEnd();
      return;
    }

    // users 테이블에서 관리자 정보 조회
    const supabase = getServiceRoleClient();
    const { data: userData } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("clerk_user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!userData) {
      logger.warn("[createAuditLog] ❌ 사용자 데이터 없음 - 로그 기록 중단");
      logger.groupEnd();
      return;
    }

    // 변경 전/후 값을 JSON 문자열로 변환
    const oldValueStr = data.oldValue
      ? JSON.stringify(data.oldValue)
      : null;
    const newValueStr = data.newValue ? JSON.stringify(data.newValue) : null;

    // 로그 기록
    const { error } = await supabase.from("audit_logs").insert({
      admin_user_id: userData.id,
      admin_email: userData.email,
      admin_name: userData.name,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId,
      entity_name: data.entityName,
      field_name: data.fieldName,
      old_value: oldValueStr,
      new_value: newValueStr,
      description: data.description,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
    });

    if (error) {
      logger.error("[createAuditLog] ❌ 로그 기록 실패", {
        code: error.code,
        message: error.message,
      });
    } else {
      logger.info("[createAuditLog] ✅ 로그 기록 성공");
    }

    logger.groupEnd();
  } catch (error) {
    logger.error("[createAuditLog] ❌ 예외 발생:", error);
    logger.groupEnd();
    // 로그 기록 실패해도 메인 로직은 계속 진행
  }
}

/**
 * 주문 상태 변경 로그 기록
 */
export async function logOrderStatusChange(
  orderId: string,
  orderNumber: string,
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[],
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  for (const change of changes) {
    await createAuditLog({
      action: "order_status_changed",
      entityType: "order",
      entityId: orderId,
      entityName: orderNumber,
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      description: `주문 ${orderNumber}의 ${change.field} 변경: ${change.oldValue} → ${change.newValue}`,
      ipAddress,
      userAgent,
    });
  }
}

/**
 * 상품 가격 변경 로그 기록
 */
export async function logProductPriceChange(
  productId: string,
  productName: string,
  oldPrice: number,
  newPrice: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    action: "product_price_updated",
    entityType: "product",
    entityId: productId,
    entityName: productName,
    fieldName: "price",
    oldValue: oldPrice,
    newValue: newPrice,
    description: `상품 ${productName}의 가격 변경: ${oldPrice.toLocaleString()}원 → ${newPrice.toLocaleString()}원`,
    ipAddress,
    userAgent,
  });
}

/**
 * 재고 변경 로그 기록
 */
export async function logInventoryChange(
  productId: string,
  productName: string,
  variantId: string | null,
  variantName: string | null,
  oldStock: number,
  newStock: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const entityName = variantName
    ? `${productName} (${variantName})`
    : productName;

  await createAuditLog({
    action: "inventory_updated",
    entityType: "inventory",
    entityId: variantId || productId,
    entityName,
    fieldName: "stock",
    oldValue: oldStock,
    newValue: newStock,
    description: `${entityName}의 재고 변경: ${oldStock}개 → ${newStock}개`,
    ipAddress,
    userAgent,
  });
}
