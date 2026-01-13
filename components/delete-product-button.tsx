/**
 * @file components/delete-product-button.tsx
 * @description 상품 삭제 버튼 컴포넌트
 */

"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProduct } from "@/actions/admin-products";
import { useRouter } from "next/navigation";
import logger from "@/lib/logger-client";

interface DeleteProductButtonProps {
  productId: string;
}

export default function DeleteProductButton({
  productId,
}: DeleteProductButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!confirm("정말 이 상품을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (result.success) {
        logger.debug("[DeleteProductButton] 상품 삭제 성공");
        alert(result.message);
        router.refresh();
      } else {
        logger.error("[DeleteProductButton] 상품 삭제 실패", {
          message: result.message,
        });
        alert(result.message);
      }
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-2 text-[#8b7d84] hover:text-red-500 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

