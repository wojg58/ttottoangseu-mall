/**
 * @file components/order-cancel-button.tsx
 * @description 주문 취소 버튼 컴포넌트
 *
 * 주요 기능:
 * 1. 주문 취소 버튼 표시
 * 2. 취소 가능한 상태 확인 (pending, confirmed만 취소 가능)
 * 3. 취소 확인 다이얼로그
 * 4. 취소 처리 및 결과 표시
 */

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cancelOrder } from "@/actions/orders";
import { Button } from "@/components/ui/button";

interface OrderCancelButtonProps {
  orderId: string;
  orderStatus: string;
  onCancelSuccess?: () => void;
}

export default function OrderCancelButton({
  orderId,
  orderStatus,
  onCancelSuccess,
}: OrderCancelButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 취소 가능한 상태 확인
  const canCancel =
    orderStatus === "PENDING" || orderStatus === "PAID";

  if (!canCancel) {
    return null;
  }

  const handleCancel = () => {
    if (!confirm("정말 주문을 취소하시겠습니까?\n취소된 주문은 복구할 수 없습니다.")) {
      return;
    }

    console.log("[OrderCancelButton] 주문 취소 요청:", orderId);
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (result.success) {
        console.log("[OrderCancelButton] 주문 취소 성공:", result.message);
        alert(result.message);
        if (onCancelSuccess) {
          onCancelSuccess();
        } else {
          router.refresh(); // 페이지 새로고침
        }
      } else {
        console.error("[OrderCancelButton] 주문 취소 실패:", result.message);
        alert(result.message);
      }
    });
  };

  return (
    <Button
      onClick={handleCancel}
      disabled={isPending}
      variant="outline"
      className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <X className="w-4 h-4 mr-2" />
      {isPending ? "취소 중..." : "주문 취소"}
    </Button>
  );
}

