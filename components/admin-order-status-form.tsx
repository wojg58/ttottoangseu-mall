/**
 * @file components/admin-order-status-form.tsx
 * @description 관리자 주문 상태 변경 폼 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/actions/admin";
import type { Order, OrderPaymentStatus, OrderFulfillmentStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminOrderStatusFormProps {
  order: Order;
}

const PAYMENT_STATUS_OPTIONS: { value: OrderPaymentStatus; label: string }[] = [
  { value: "PENDING", label: "결제 대기" },
  { value: "PAID", label: "결제 완료" },
  { value: "CANCELED", label: "주문 취소" },
  { value: "REFUNDED", label: "환불 완료" },
];

const FULFILLMENT_STATUS_OPTIONS: { value: OrderFulfillmentStatus; label: string }[] = [
  { value: "UNFULFILLED", label: "미처리" },
  { value: "PREPARING", label: "상품 준비중" },
  { value: "SHIPPED", label: "배송중" },
  { value: "DELIVERED", label: "배송 완료" },
  { value: "CANCELED", label: "주문 취소" },
];

export default function AdminOrderStatusForm({ order }: AdminOrderStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>(order.payment_status);
  const [fulfillmentStatus, setFulfillmentStatus] = useState<OrderFulfillmentStatus>(
    order.fulfillment_status,
  );
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log("[AdminOrderStatusForm] 주문 상태 변경:", {
      orderId: order.id,
      paymentStatus,
      fulfillmentStatus,
      trackingNumber,
    });

    startTransition(async () => {
      const result = await updateOrderStatus(
        order.id,
        paymentStatus !== order.payment_status ? paymentStatus : undefined,
        fulfillmentStatus !== order.fulfillment_status ? fulfillmentStatus : undefined,
        trackingNumber !== order.tracking_number ? trackingNumber : undefined,
      );

      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  };

  const hasChanges =
    paymentStatus !== order.payment_status ||
    fulfillmentStatus !== order.fulfillment_status ||
    trackingNumber !== (order.tracking_number || "");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 결제 상태 */}
      <div>
        <label className="block text-sm font-medium text-[#4a3f48] mb-2">
          결제 상태
        </label>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as OrderPaymentStatus)}
          disabled={isPending}
          className="w-full px-4 py-2 border border-[#f5d5e3] rounded-lg text-sm text-[#4a3f48] focus:outline-none focus:ring-2 focus:ring-[#fad2e6] disabled:opacity-50"
        >
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 배송 상태 */}
      <div>
        <label className="block text-sm font-medium text-[#4a3f48] mb-2">
          배송 상태
        </label>
        <select
          value={fulfillmentStatus}
          onChange={(e) => setFulfillmentStatus(e.target.value as OrderFulfillmentStatus)}
          disabled={isPending}
          className="w-full px-4 py-2 border border-[#f5d5e3] rounded-lg text-sm text-[#4a3f48] focus:outline-none focus:ring-2 focus:ring-[#fad2e6] disabled:opacity-50"
        >
          {FULFILLMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 운송장 번호 */}
      <div>
        <label className="block text-sm font-medium text-[#4a3f48] mb-2">
          운송장 번호
        </label>
        <Input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="운송장 번호를 입력하세요"
          disabled={isPending}
          className="w-full"
        />
        <p className="mt-1 text-xs text-[#8b7d84]">
          배송 상태를 &quot;배송중&quot;으로 변경하면 자동으로 배송 시작 시간이 기록됩니다.
        </p>
      </div>

      {/* 저장 버튼 */}
      {hasChanges && (
        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#ff6b9d] text-white hover:bg-[#ff5a8a] disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "변경사항 저장"}
        </Button>
      )}

      {!hasChanges && (
        <p className="text-sm text-[#8b7d84] text-center">
          변경된 내용이 없습니다.
        </p>
      )}
    </form>
  );
}




