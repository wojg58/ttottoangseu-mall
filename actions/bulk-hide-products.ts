/**
 * @file actions/bulk-hide-products.ts
 * @description 선택한 상품 일괄 숨김 처리 Server Action
 *
 * 관리자 페이지에서 선택한 상품들을 일괄로 숨김 처리합니다.
 */

"use server";

import { isAdmin } from "./admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

/**
 * 선택한 상품들을 일괄로 숨김 처리
 * @param productIds 숨김 처리할 상품 ID 배열
 */
export async function bulkHideProducts(
  productIds: string[],
): Promise<{
  success: boolean;
  message: string;
  hiddenCount?: number;
}> {
  console.group("[bulkHideProducts] 상품 일괄 숨김 처리 시작");
  console.log("선택한 상품 수:", productIds.length);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
    };
  }

  if (!productIds || productIds.length === 0) {
    console.log("선택한 상품이 없음");
    console.groupEnd();
    return {
      success: false,
      message: "선택한 상품이 없습니다.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    // 선택한 상품들을 숨김 처리
    const { data, error } = await supabase
      .from("products")
      .update({
        status: "hidden",
        updated_at: new Date().toISOString(),
      })
      .in("id", productIds)
      .is("deleted_at", null)
      .select("id");

    if (error) {
      console.error("상품 숨김 처리 에러:", error);
      console.groupEnd();
      return {
        success: false,
        message: `상품 숨김 처리에 실패했습니다: ${error.message}`,
      };
    }

    const hiddenCount = data?.length || 0;

    console.log(`숨김 처리된 상품 수: ${hiddenCount}`);

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("상품 일괄 숨김 처리 완료");
    console.groupEnd();

    return {
      success: true,
      message: `${hiddenCount}개 상품이 숨김 처리되었습니다.`,
      hiddenCount,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return {
      success: false,
      message: `상품 숨김 처리에 실패했습니다: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}

