/**
 * @file components/bulk-show-products-button.tsx
 * @description 선택한 상품 일괄 판매중으로 변경 버튼 컴포넌트
 */

"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { bulkShowProducts } from "@/actions/bulk-show-products";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BulkShowProductsButtonProps {
  selectedProductIds: string[];
  onSuccess?: () => void;
}

export default function BulkShowProductsButton({
  selectedProductIds,
  onSuccess,
}: BulkShowProductsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleShow = () => {
    if (selectedProductIds.length === 0) {
      alert("선택한 상품이 없습니다.");
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedProductIds.length}개 상품을 판매중으로 변경하시겠습니까?\n\n변경된 상품은 고객에게 표시됩니다.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      console.group("[BulkShowProductsButton] 일괄 판매중 변경 시작");
      console.log("선택한 상품 ID:", selectedProductIds);

      const result = await bulkShowProducts(selectedProductIds);

      if (result.success) {
        console.log("일괄 판매중 변경 성공:", result.message);
        alert(result.message);
        if (onSuccess) {
          onSuccess();
        }
        router.refresh();
      } else {
        console.error("일괄 판매중 변경 실패:", result.message);
        alert(`판매중 변경 실패: ${result.message}`);
      }
      console.groupEnd();
    });
  };

  if (selectedProductIds.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleShow}
      disabled={isPending}
      variant="outline"
      className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600"
    >
      {isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          판매중 변경 중...
        </>
      ) : (
        <>
          <Eye className="w-4 h-4" />
          선택한 {selectedProductIds.length}개 판매중으로 변경
        </>
      )}
    </Button>
  );
}

