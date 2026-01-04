/**
 * @file components/bulk-hide-products-button.tsx
 * @description 선택한 상품 일괄 숨김 처리 버튼 컴포넌트
 */

"use client";

import { useTransition } from "react";
import { EyeOff } from "lucide-react";
import { bulkHideProducts } from "@/actions/bulk-hide-products";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BulkHideProductsButtonProps {
  selectedProductIds: string[];
  onSuccess?: () => void;
}

export default function BulkHideProductsButton({
  selectedProductIds,
  onSuccess,
}: BulkHideProductsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleHide = () => {
    if (selectedProductIds.length === 0) {
      alert("선택한 상품이 없습니다.");
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedProductIds.length}개 상품을 숨김 처리하시겠습니까?\n\n숨김 처리된 상품은 고객에게 보이지 않습니다.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      console.group("[BulkHideProductsButton] 일괄 숨김 처리 시작");
      console.log("선택한 상품 ID:", selectedProductIds);

      const result = await bulkHideProducts(selectedProductIds);

      if (result.success) {
        console.log("일괄 숨김 처리 성공:", result.message);
        alert(result.message);
        if (onSuccess) {
          onSuccess();
        }
        router.refresh();
      } else {
        console.error("일괄 숨김 처리 실패:", result.message);
        alert(`숨김 처리 실패: ${result.message}`);
      }
      console.groupEnd();
    });
  };

  if (selectedProductIds.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleHide}
      disabled={isPending}
      variant="outline"
      className="flex items-center gap-2 border-[#8b7d84] text-[#4a3f48] hover:bg-[#ffeef5] hover:border-[#ff6b9d]"
    >
      {isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-[#4a3f48] border-t-transparent rounded-full animate-spin" />
          숨김 처리 중...
        </>
      ) : (
        <>
          <EyeOff className="w-4 h-4" />
          선택한 {selectedProductIds.length}개 숨김 처리
        </>
      )}
    </Button>
  );
}

