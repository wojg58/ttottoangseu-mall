/**
 * @file components/admin-order-row.tsx
 * @description 관리자 주문 테이블 행 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateOrderStatus } from "@/actions/admin";
import type { Order } from "@/types/database";
import { Button } from "@/components/ui/button";
import DateDisplay from "@/components/date-display";

interface AdminOrderRowProps {
  order: Order;
}

const STATUS_OPTIONS: { value: Order["status"]; label: string }[] = [
  { value: "PENDING", label: "결제 대기" },
  { value: "PAID", label: "결제 완료" },
  { value: "CANCELED", label: "주문 취소" },
  { value: "REFUNDED", label: "환불 완료" },
];

export default function AdminOrderRow({ order }: AdminOrderRowProps) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState(order.status);

  const handleStatusChange = (newStatus: Order["status"]) => {
    console.log("[AdminOrderRow] 상태 변경:", order.order_number, newStatus);

    startTransition(async () => {
      const result = await updateOrderStatus(order.id, newStatus);
      if (result.success) {
        setCurrentStatus(newStatus);
      } else {
        alert(result.message);
      }
    });
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="py-4 px-4">
        <Link
          href={`/admin/orders/${order.id}`}
          className="text-[#ff6b9d] hover:underline font-medium"
        >
          {order.order_number}
        </Link>
      </td>
      <td className="py-4 px-4 text-[#4a3f48]">{order.shipping_name}</td>
      <td className="py-4 px-4 text-[#4a3f48]">{order.shipping_phone}</td>
      <td className="py-4 px-4 text-[#4a3f48] font-medium">
        {order.total_amount.toLocaleString("ko-KR")}원
      </td>
      <td className="py-4 px-4">
        <select
          value={currentStatus}
          onChange={(e) =>
            handleStatusChange(e.target.value as Order["status"])
          }
          disabled={isPending}
          className={`px-3 py-1.5 rounded-lg text-xs border-0 focus:ring-2 focus:ring-[#fad2e6] ${
            currentStatus === "PAID"
              ? "bg-green-100 text-green-600"
              : currentStatus === "CANCELED"
              ? "bg-gray-100 text-gray-600"
              : currentStatus === "REFUNDED"
              ? "bg-orange-100 text-orange-600"
              : "bg-[#ffeef5] text-[#ff6b9d]"
          } disabled:opacity-50`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-4 px-4 text-[#8b7d84]">
        <DateDisplay date={order.created_at} format="short" />
      </td>
      <td className="py-4 px-4">
        <Link href={`/admin/orders/${order.id}`}>
          <Button
            variant="outline"
            size="sm"
            className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
          >
            상세
          </Button>
        </Link>
      </td>
    </tr>
  );
}
