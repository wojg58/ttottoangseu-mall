/**
 * @file components/admin/fulfillment-order-list.tsx
 * @description 배송 대기 주문 목록 및 송장번호 등록 컴포넌트
 *
 * 주요 기능:
 * 1. 배송 대기 주문 목록 표시
 * 2. 단건 송장번호 등록
 * 3. 일괄 송장번호 등록
 * 4. 배송 상태 업데이트
 *
 * @dependencies
 * - actions/admin: updateOrderStatus, bulkUpdateTrackingNumbers
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Package, CheckCircle2 } from "lucide-react";
import type { Order } from "@/types/database";
import { updateOrderStatus, bulkUpdateTrackingNumbers } from "@/actions/admin";
import NumberDisplay from "@/components/number-display";
import DateDisplay from "@/components/date-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logger from "@/lib/logger-client";

interface FulfillmentOrderListProps {
  orders: Order[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export default function FulfillmentOrderList({
  orders,
  totalPages,
  currentPage,
}: FulfillmentOrderListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkTrackingNumber, setBulkTrackingNumber] = useState("");

  const handleTrackingNumberChange = (orderId: string, value: string) => {
    setTrackingNumbers((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  };

  const handleSingleUpdate = async (orderId: string) => {
    const trackingNumber = trackingNumbers[orderId]?.trim();
    if (!trackingNumber) {
      alert("송장번호를 입력해주세요.");
      return;
    }

    logger.group("[FulfillmentOrderList] 단건 송장번호 등록");
    logger.info(
      `[FulfillmentOrderList] 주문 ID: ${orderId}, 송장번호: ${trackingNumber}`
    );

    startTransition(async () => {
      const result = await updateOrderStatus(
        orderId,
        undefined,
        "SHIPPED",
        trackingNumber,
      );

      if (result.success) {
        logger.info("[FulfillmentOrderList] ✅ 송장번호 등록 성공");
        // 송장번호 입력 필드 초기화
        setTrackingNumbers((prev) => {
          const newState = { ...prev };
          delete newState[orderId];
          return newState;
        });
        router.refresh();
      } else {
        logger.error("[FulfillmentOrderList] ❌ 송장번호 등록 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedOrders.size === 0) {
      alert("선택된 주문이 없습니다.");
      return;
    }

    if (!bulkTrackingNumber.trim()) {
      alert("송장번호를 입력해주세요.");
      return;
    }

    logger.group("[FulfillmentOrderList] 일괄 송장번호 등록");
    logger.info(
      `[FulfillmentOrderList] 선택된 주문 수: ${selectedOrders.size}, 송장번호: ${bulkTrackingNumber}`
    );

    startTransition(async () => {
      const updates = Array.from(selectedOrders).map((orderId) => ({
        orderId,
        trackingNumber: bulkTrackingNumber.trim(),
      }));

      const result = await bulkUpdateTrackingNumbers(updates);

      if (result.success) {
        logger.info(
          `[FulfillmentOrderList] ✅ 일괄 송장번호 등록 성공: ${result.updated}개`
        );
        setSelectedOrders(new Set());
        setBulkTrackingNumber("");
        router.refresh();
      } else {
        logger.error("[FulfillmentOrderList] ❌ 일괄 송장번호 등록 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.id)));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-16 text-center">
        <Package className="w-16 h-16 text-[#8b7d84] mx-auto mb-4" />
        <p className="text-[#8b7d84] text-lg mb-2">배송 대기 주문이 없습니다.</p>
        <p className="text-sm text-[#8b7d84]">모든 주문이 처리되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 일괄 처리 섹션 */}
      {selectedOrders.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-[#4a3f48]">
                {selectedOrders.size}개 주문 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="일괄 송장번호 입력"
                value={bulkTrackingNumber}
                onChange={(e) => setBulkTrackingNumber(e.target.value)}
                className="w-48 bg-white"
              />
              <Button
                onClick={handleBulkUpdate}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                일괄 등록
              </Button>
              <Button
                onClick={() => setSelectedOrders(new Set())}
                variant="outline"
                className="border-gray-300"
              >
                선택 해제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
                  />
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  주문번호
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  주문자
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  연락처
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  금액
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  주문일시
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  송장번호
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                      className="w-4 h-4 text-[#ff6b9d] border-gray-300 rounded focus:ring-[#ff6b9d]"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-medium text-[#4a3f48]">
                      {order.order_number}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#4a3f48]">
                    {order.shipping_name}
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    {order.shipping_phone}
                  </td>
                  <td className="py-4 px-4 text-[#4a3f48] font-medium">
                    <NumberDisplay value={order.total_amount} suffix="원" />
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    <DateDisplay date={order.created_at} format="date" />
                  </td>
                  <td className="py-4 px-4">
                    {order.tracking_number ? (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-green-500" />
                        <span className="text-[#4a3f48] font-medium">
                          {order.tracking_number}
                        </span>
                      </div>
                    ) : (
                      <Input
                        type="text"
                        placeholder="송장번호 입력"
                        value={trackingNumbers[order.id] || ""}
                        onChange={(e) =>
                          handleTrackingNumberChange(order.id, e.target.value)
                        }
                        className="w-40 bg-white border-gray-200"
                      />
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {order.tracking_number ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600">
                        등록됨
                      </span>
                    ) : (
                      <Button
                        onClick={() => handleSingleUpdate(order.id)}
                        disabled={isPending || !trackingNumbers[order.id]?.trim()}
                        size="sm"
                        className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
                      >
                        등록
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <a
              key={pageNum}
              href={`/admin/fulfillment?page=${pageNum}`}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                pageNum === currentPage
                  ? "bg-[#ff6b9d] text-white"
                  : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
              }`}
            >
              {pageNum}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
