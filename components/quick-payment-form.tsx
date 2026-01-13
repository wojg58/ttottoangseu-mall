/**
 * @file components/quick-payment-form.tsx
 * @description 간편 결제 폼 컴포넌트 (12,200원 고정)
 *
 * 주요 기능:
 * 1. 최소한의 정보 입력 (이름, 이메일, 전화번호)
 * 2. 간단한 주문 생성
 * 3. 토스페이먼츠 결제 위젯 표시
 *
 * @dependencies
 * - react-hook-form: 폼 관리
 * - zod: 유효성 검사
 * - @tosspayments/payment-widget-sdk: 토스페이먼츠 결제 위젯
 */

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PaymentWidget from "@/components/payment-widget";
import { createQuickOrder } from "@/actions/orders";
import logger from "@/lib/logger-client";

// 결제 금액 (고정)
const PAYMENT_AMOUNT = 12200;

// 폼 스키마
const quickPaymentSchema = z.object({
  customerName: z.string().min(1, "이름을 입력해주세요."),
  customerEmail: z.string().email("올바른 이메일을 입력해주세요."),
  customerPhone: z
    .string()
    .min(1, "전화번호를 입력해주세요.")
    .regex(/^[0-9-]+$/, "올바른 전화번호 형식이 아닙니다."),
});

type QuickPaymentFormData = z.infer<typeof quickPaymentSchema>;

export default function QuickPaymentForm() {
  const { user, isLoaded } = useUser();
  const [isPending, startTransition] = useTransition();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [showPaymentWidget, setShowPaymentWidget] = useState(false);

  const form = useForm<QuickPaymentFormData>({
    resolver: zodResolver(quickPaymentSchema),
    defaultValues: {
      customerName: user?.fullName || "",
      customerEmail: user?.primaryEmailAddress?.emailAddress || "",
      customerPhone: "",
    },
  });

  // Clerk 사용자 정보가 로드되면 폼 기본값 업데이트
  if (isLoaded && user) {
    if (!form.getValues("customerName") && user.fullName) {
      form.setValue("customerName", user.fullName);
    }
    if (
      !form.getValues("customerEmail") &&
      user.primaryEmailAddress?.emailAddress
    ) {
      form.setValue("customerEmail", user.primaryEmailAddress.emailAddress);
    }
  }

  const onSubmit = (data: QuickPaymentFormData) => {
    startTransition(async () => {
      const result = await createQuickOrder({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        amount: PAYMENT_AMOUNT,
      });

      if (result.success && result.orderId && result.orderNumber) {
        logger.debug("[QuickPaymentForm] 주문 생성 성공");
        setOrderId(result.orderId);
        setOrderNumber(result.orderNumber);
        setShowPaymentWidget(true);
      } else {
        logger.error("[QuickPaymentForm] 주문 생성 실패", {
          message: result.message,
        });
        alert(result.message || "주문 생성에 실패했습니다.");
      }
    });
  };

  if (showPaymentWidget && orderId && orderNumber) {
    return (
      <div className="space-y-6">
        {/* 주문 정보 요약 */}
        <div className="bg-[#ffeef5] border border-[#f5d5e3] rounded-lg p-6">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-4">주문 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8b7d84]">주문번호</span>
              <span className="font-bold text-[#4a3f48]">{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b7d84]">결제 금액</span>
              <span className="font-bold text-[#ff6b9d]">
                {PAYMENT_AMOUNT.toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>
        </div>

        {/* 결제 위젯 */}
        <PaymentWidget
          orderId={orderId}
          orderName={`간편 결제 주문 (${orderNumber})`}
          amount={PAYMENT_AMOUNT}
          customerName={form.getValues("customerName")}
          customerEmail={form.getValues("customerEmail")}
          paymentMethod="CARD"
        />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* 결제 금액 표시 */}
      <div className="bg-[#ffeef5] border border-[#f5d5e3] rounded-lg p-6">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-[#4a3f48]">결제 금액</span>
          <span className="text-2xl font-bold text-[#ff6b9d]">
            {PAYMENT_AMOUNT.toLocaleString("ko-KR")}원
          </span>
        </div>
      </div>

      {/* 입력 폼 */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="customerName" className="text-[#4a3f48]">
            이름 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="customerName"
            {...form.register("customerName")}
            className="mt-1"
            placeholder="이름을 입력해주세요"
          />
          {form.formState.errors.customerName && (
            <p className="text-sm text-red-500 mt-1">
              {form.formState.errors.customerName.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="customerEmail" className="text-[#4a3f48]">
            이메일 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="customerEmail"
            type="email"
            {...form.register("customerEmail")}
            className="mt-1"
            placeholder="이메일을 입력해주세요"
          />
          {form.formState.errors.customerEmail && (
            <p className="text-sm text-red-500 mt-1">
              {form.formState.errors.customerEmail.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="customerPhone" className="text-[#4a3f48]">
            전화번호 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="customerPhone"
            {...form.register("customerPhone")}
            className="mt-1"
            placeholder="010-1234-5678"
          />
          {form.formState.errors.customerPhone && (
            <p className="text-sm text-red-500 mt-1">
              {form.formState.errors.customerPhone.message}
            </p>
          )}
        </div>
      </div>

      {/* 결제 버튼 */}
      <div className="pt-4">
        <p className="text-xs text-[#8b7d84] mb-4">
          주문 내용을 확인했으며, 결제에 동의합니다.
        </p>
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold disabled:opacity-50"
        >
          {isPending
            ? "처리 중..."
            : `${PAYMENT_AMOUNT.toLocaleString("ko-KR")}원 결제하기`}
        </Button>
      </div>
    </form>
  );
}

