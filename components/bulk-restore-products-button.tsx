/**
 * @file components/bulk-restore-products-button.tsx
 * @description 모든 삭제된 상품 일괄 복구 버튼 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import { RotateCcw, AlertCircle } from "lucide-react";
import { restoreAllProducts } from "@/actions/bulk-restore-products";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function BulkRestoreProductsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRestore = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    if (
      !confirm(
        "✅ 모든 삭제된 상품을 복구하시겠습니까?\n\n삭제된 상품들이 다시 활성화됩니다.\nslug 충돌이 있는 경우 자동으로 slug가 변경됩니다.",
      )
    ) {
      setShowConfirm(false);
      return;
    }

    startTransition(async () => {
      const result = await restoreAllProducts();
      if (result.success) {
        alert(result.message);
        router.refresh();
      } else {
        alert(`복구 실패: ${result.message}`);
      }
      setShowConfirm(false);
    });
  };

  return (
    <Button
      onClick={handleRestore}
      disabled={isPending}
      variant="default"
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
    >
      {isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          복구 중...
        </>
      ) : showConfirm ? (
        <>
          <AlertCircle className="w-4 h-4" />
          정말 복구하시겠습니까?
        </>
      ) : (
        <>
          <RotateCcw className="w-4 h-4" />
          전체상품 복구하기
        </>
      )}
    </Button>
  );
}

