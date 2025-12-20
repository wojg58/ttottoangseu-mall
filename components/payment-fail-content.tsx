/**
 * @file components/payment-fail-content.tsx
 * @description 결제 실패 콘텐츠 컴포넌트
 */

"use client";

import { useSearchParams } from "next/navigation";
import { XCircle, Home, RefreshCw } from "lucide-react";
import PaymentStatusCard from "@/components/payment-status-card";

export default function PaymentFailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제에 실패했습니다.";

  return (
    <PaymentStatusCard
      icon={XCircle}
      iconBgClass="bg-red-50"
      iconColorClass="text-red-500"
      title="결제에 실패했습니다"
      message={message}
      subMessage="문제가 지속되면 고객센터로 문의해주세요."
      actions={[
        { label: "홈으로", href: "/", icon: Home },
        { label: "다시 시도", href: "/cart", icon: RefreshCw, primary: true },
      ]}
    />
  );
}
