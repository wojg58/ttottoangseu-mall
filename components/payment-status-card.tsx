/**
 * @file components/payment-status-card.tsx
 * @description 결제 상태 표시용 공통 카드 컴포넌트
 */

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentAction {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}

interface PaymentStatusCardProps {
  /** 상태 아이콘 */
  icon: LucideIcon;
  /** 아이콘 배경 색상 클래스 */
  iconBgClass: string;
  /** 아이콘 색상 클래스 */
  iconColorClass: string;
  /** 제목 */
  title: string;
  /** 메인 메시지 */
  message: string;
  /** 보조 메시지 (선택) */
  subMessage?: string;
  /** 주문번호 (선택) */
  orderNumber?: string;
  /** 액션 버튼들 */
  actions: PaymentAction[];
}

export default function PaymentStatusCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  title,
  message,
  subMessage,
  orderNumber,
  actions,
}: PaymentStatusCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <div className="flex justify-center mb-6">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center ${iconBgClass}`}
        >
          <Icon className={`w-12 h-12 ${iconColorClass}`} />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">{title}</h1>
      <p className="text-sm text-[#8b7d84] mb-4">{message}</p>
      {subMessage && (
        <p className="text-xs text-[#8b7d84] mb-8">{subMessage}</p>
      )}

      {orderNumber && (
        <div className="bg-[#ffeef5] rounded-lg p-4 mb-8">
          <p className="text-sm text-[#8b7d84] mb-1">주문번호</p>
          <p className="text-lg font-bold text-[#4a3f48]">{orderNumber}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return action.primary ? (
            <Button
              key={action.href}
              asChild
              className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              <Link href={action.href}>
                <ActionIcon className="w-4 h-4 mr-2" />
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button
              key={action.href}
              asChild
              variant="outline"
              className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
            >
              <Link href={action.href}>
                <ActionIcon className="w-4 h-4 mr-2" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
