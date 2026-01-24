/**
 * @file actions/bulk-delete-products.ts
 * @description 모든 상품 일괄 삭제 처리 Server Action
 *
 * 주의: 이 작업은 되돌릴 수 없습니다.
 * 모든 활성 상품의 deleted_at을 설정하여 소프트 삭제 처리합니다.
 */

"use server";

import { isAdmin } from "./admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

/**
 * 모든 활성 상품을 소프트 삭제 처리
 */
export async function deleteAllProducts(): Promise<{
  success: boolean;
  message: string;
  deletedCount?: number;
}> {
  console.group("[deleteAllProducts] 모든 상품 삭제 처리 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    // 삭제 전 활성 상품 수 확인
    const { count: beforeCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    console.log(`삭제 전 활성 상품 수: ${beforeCount}`);

    // 모든 활성 상품 소프트 삭제 처리
    const { data, error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .is("deleted_at", null)
      .select("*");
    
    const count = data?.length || 0;

    if (error) {
      console.error("상품 삭제 에러:", error);
      console.groupEnd();
      return {
        success: false,
        message: `상품 삭제에 실패했습니다: ${error.message}`,
      };
    }

    console.log(`삭제된 상품 수: ${count || beforeCount}`);

    // 관련 데이터도 정리 (선택사항)
    // product_categories는 외래키 제약조건으로 자동 처리되지만,
    // 명시적으로 정리할 수도 있습니다.

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("모든 상품 삭제 처리 완료");
    console.groupEnd();

    return {
      success: true,
      message: `${count || beforeCount}개 상품이 삭제 처리되었습니다.`,
      deletedCount: count || beforeCount || 0,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return {
      success: false,
      message: `상품 삭제에 실패했습니다: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}

/**
 * 숨김 처리된 상품만 소프트 삭제 처리
 */
export async function deleteHiddenProducts(): Promise<{
  success: boolean;
  message: string;
  deletedCount?: number;
}> {
  logger.group("[deleteHiddenProducts] 숨김 처리된 상품 삭제 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[deleteHiddenProducts] 관리자 권한 없음");
    logger.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    // 삭제 전 숨김 처리된 상품 수 확인
    const { count: beforeCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "hidden")
      .is("deleted_at", null);

    logger.info(`[deleteHiddenProducts] 삭제 전 숨김 처리된 상품 수: ${beforeCount}`);

    if (!beforeCount || beforeCount === 0) {
      logger.info("[deleteHiddenProducts] 삭제할 숨김 처리된 상품이 없습니다.");
      logger.groupEnd();
      return {
        success: true,
        message: "삭제할 숨김 처리된 상품이 없습니다.",
        deletedCount: 0,
      };
    }

    // 숨김 처리된 상품만 소프트 삭제 처리
    const { data, error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("status", "hidden")
      .is("deleted_at", null)
      .select("id, name");

    const count = data?.length || 0;

    if (error) {
      logger.error("[deleteHiddenProducts] 상품 삭제 에러", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      logger.groupEnd();
      return {
        success: false,
        message: `상품 삭제에 실패했습니다: ${error.message}`,
      };
    }

    logger.info(`[deleteHiddenProducts] 삭제된 상품 수: ${count}`);
    if (data && data.length > 0) {
      logger.info("[deleteHiddenProducts] 삭제된 상품 목록 (처음 10개)", {
        products: data.slice(0, 10).map((p) => ({ id: p.id, name: p.name })),
      });
    }

    // 캐시 무효화
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    revalidatePath("/products");

    logger.info("[deleteHiddenProducts] 숨김 처리된 상품 삭제 완료");
    logger.groupEnd();

    return {
      success: true,
      message: `${count}개 숨김 처리된 상품이 삭제 처리되었습니다.`,
      deletedCount: count,
    };
  } catch (error) {
    logger.error("[deleteHiddenProducts] 예외 발생", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.groupEnd();
    return {
      success: false,
      message: `상품 삭제에 실패했습니다: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}
