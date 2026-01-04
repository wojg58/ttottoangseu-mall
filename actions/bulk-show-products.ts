/**
 * @file actions/bulk-show-products.ts
 * @description 선택한 상품 일괄 판매중으로 변경 Server Action
 *
 * 관리자 페이지에서 선택한 숨김 처리된 상품들을 일괄로 판매중 상태로 변경합니다.
 */

"use server";

import { isAdmin } from "./admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

/**
 * 선택한 상품들을 일괄로 판매중으로 변경
 * @param productIds 판매중으로 변경할 상품 ID 배열
 */
export async function bulkShowProducts(
  productIds: string[],
): Promise<{
  success: boolean;
  message: string;
  shownCount?: number;
}> {
  console.group("[bulkShowProducts] 상품 일괄 판매중으로 변경 시작");
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

    // 선택한 상품들을 판매중으로 변경
    const { data, error } = await supabase
      .from("products")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .in("id", productIds)
      .is("deleted_at", null)
      .select("id");

    if (error) {
      console.error("상품 판매중 변경 에러:", error);
      console.groupEnd();
      return {
        success: false,
        message: `상품 판매중 변경에 실패했습니다: ${error.message}`,
      };
    }

    const shownCount = data?.length || 0;

    console.log(`판매중으로 변경된 상품 수: ${shownCount}`);

    revalidatePath("/admin/products");
    revalidatePath("/products");

    console.log("상품 일괄 판매중 변경 완료");
    console.groupEnd();

    return {
      success: true,
      message: `${shownCount}개 상품이 판매중으로 변경되었습니다.`,
      shownCount,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return {
      success: false,
      message: `상품 판매중 변경에 실패했습니다: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}

