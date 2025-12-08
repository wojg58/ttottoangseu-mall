/**
 * @file components/bulk-delete-products-button.tsx
 * @description 모든 상품 일괄 삭제 버튼 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteAllProducts } from "@/actions/bulk-delete-products";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function BulkDeleteProductsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    if (
      !confirm(
        "⚠️ 경고: 모든 상품이 삭제 처리됩니다.\n이 작업은 되돌릴 수 없습니다.\n\n정말로 진행하시겠습니까?",
      )
    ) {
      setShowConfirm(false);
      return;
    }

    startTransition(async () => {
      const result = await deleteAllProducts();
      if (result.success) {
        alert(result.message);
        router.refresh();
      } else {
        alert(`삭제 실패: ${result.message}`);
      }
      setShowConfirm(false);
    });
  };

  return (
    <Button
      onClick={handleDelete}
      disabled={isPending}
      variant="destructive"
      className="flex items-center gap-2"
    >
      {isPending ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          삭제 중...
        </>
      ) : showConfirm ? (
        <>
          <AlertTriangle className="w-4 h-4" />
          정말 삭제하시겠습니까?
        </>
      ) : (
        <>
          <Trash2 className="w-4 h-4" />
          전체 삭제
        </>
      )}
    </Button>
  );
}

