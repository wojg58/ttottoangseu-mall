/**
 * @file components/checkout-form.tsx
 * @description 주문/결제 폼 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser } from "@clerk/nextjs";
import { createOrder, CreateOrderInput } from "@/actions/orders";
import type { CartItemWithProduct } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import PaymentWidget from "@/components/payment-widget";

// 폼 스키마
const checkoutSchema = z.object({
  shippingName: z.string().min(2, "수령인 이름을 입력해주세요."),
  shippingPhone: z
    .string()
    .min(10, "연락처를 입력해주세요.")
    .regex(/^[0-9-]+$/, "올바른 연락처 형식을 입력해주세요."),
  shippingZipCode: z.string().min(5, "우편번호를 입력해주세요."),
  shippingAddress: z.string().min(5, "배송지 주소를 입력해주세요."),
  shippingMemo: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

interface CheckoutFormProps {
  cartItems: CartItemWithProduct[];
  subtotal: number;
  shippingFee: number;
  total: number;
}

export default function CheckoutForm({
  cartItems,
  subtotal,
  shippingFee,
  total,
}: CheckoutFormProps) {
  const [isPending, startTransition] = useTransition();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [showPaymentWidget, setShowPaymentWidget] = useState(false);
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingName: "",
      shippingPhone: "",
      shippingZipCode: "",
      shippingAddress: "",
      shippingMemo: "",
    },
  });

  const onSubmit = (data: CheckoutFormData) => {
    console.log("[CheckoutForm] 주문 생성:", data);

    startTransition(async () => {
      const result = await createOrder({
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddress: data.shippingAddress,
        shippingZipCode: data.shippingZipCode,
        shippingMemo: data.shippingMemo,
      });

      if (result.success && result.orderId && result.orderNumber) {
        console.log("[CheckoutForm] 주문 생성 성공, 결제 위젯 표시");
        setOrderId(result.orderId);
        setOrderNumber(result.orderNumber);
        setShowPaymentWidget(true);
        // 스크롤을 결제 위젯으로 이동
        setTimeout(() => {
          document.getElementById("payment-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      } else {
        alert(result.message);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 배송 정보 입력 */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-6">배송 정보</h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shippingName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#4a3f48]">
                        수령인 <span className="text-[#ff6b9d]">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="수령인 이름"
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shippingPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#4a3f48]">
                        연락처 <span className="text-[#ff6b9d]">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="010-0000-0000"
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="shippingZipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#4a3f48]">
                      우편번호 <span className="text-[#ff6b9d]">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder="우편번호"
                          className="flex-1 border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
                          onClick={() => {
                            // TODO: 주소 검색 API 연동 (다음 우편번호 서비스 등)
                            alert("주소 검색 기능은 추후 지원될 예정입니다.");
                          }}
                        >
                          주소 검색
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#4a3f48]">
                      배송지 주소 <span className="text-[#ff6b9d]">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="상세 주소를 입력해주세요"
                        className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingMemo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#4a3f48]">배송 메모</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="배송 시 요청사항을 입력해주세요 (선택)"
                        className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6] resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 주문 상품 목록 */}
              <div className="mt-8">
                <h3 className="text-base font-bold text-[#4a3f48] mb-4">
                  주문 상품 ({cartItems.length}개)
                </h3>
                <div className="space-y-4">
                  {/* 상품별로 그룹화 */}
                  {(() => {
                    // 상품 ID별로 그룹화
                    const groupedItems = cartItems.reduce((acc, item) => {
                      const productId = item.product_id;
                      if (!acc[productId]) {
                        acc[productId] = [];
                      }
                      acc[productId].push(item);
                      return acc;
                    }, {} as Record<string, typeof cartItems>);

                    return Object.entries(groupedItems).map(([productId, items]) => {
                      const firstItem = items[0];
                      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                      const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

                      return (
                        <div
                          key={productId}
                          className="border border-[#f5d5e3] rounded-lg p-4 bg-white"
                        >
                          {/* 상품 기본 정보 */}
                          <div className="flex gap-3 mb-3">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white shrink-0">
                              <Image
                                src={
                                  firstItem.primary_image?.image_url ||
                                  "https://placehold.co/200x200/fad2e6/333333?text=No+Image"
                                }
                                alt={firstItem.product.name}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#4a3f48] font-medium line-clamp-1">
                                {firstItem.product.name}
                              </p>
                            </div>
                          </div>

                          {/* 옵션별 상세 정보 */}
                          <div className="space-y-2 pl-20">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-2 border-b border-[#f5d5e3] last:border-b-0"
                              >
                                <div className="flex-1">
                                  <p className="text-sm text-[#4a3f48]">
                                    {item.variant ? (
                                      <span>{item.variant.variant_value}</span>
                                    ) : (
                                      <span className="text-[#8b7d84]">기본 옵션</span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-[#8b7d84]">수량</span>
                                    <span className="text-sm font-bold text-[#4a3f48]">
                                      {item.quantity}개
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold text-[#4a3f48] w-24 text-right">
                                    {(item.price * item.quantity).toLocaleString("ko-KR")}원
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* 총계 */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f5d5e3]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#8b7d84]">총 수량</span>
                              <span className="text-sm font-bold text-[#4a3f48]">
                                {totalQuantity}개
                              </span>
                            </div>
                            <p className="text-base font-bold text-[#ff6b9d]">
                              {totalPrice.toLocaleString("ko-KR")}원
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* 결제 요약 */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-6">결제 금액</h2>

          <div className="space-y-3 pb-4 border-b border-[#f5d5e3]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8b7d84]">
                상품 금액 ({cartItems.length}개)
              </span>
              <span className="text-[#4a3f48]">
                {subtotal.toLocaleString("ko-KR")}원
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8b7d84]">배송비</span>
              <span className="text-[#4a3f48]">
                {shippingFee === 0 ? (
                  <span className="text-[#ff6b9d]">무료</span>
                ) : (
                  `${shippingFee.toLocaleString("ko-KR")}원`
                )}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center py-4">
            <span className="text-base font-bold text-[#4a3f48]">
              총 결제 금액
            </span>
            <span className="text-xl font-bold text-[#ff6b9d]">
              {total.toLocaleString("ko-KR")}원
            </span>
          </div>

          {!showPaymentWidget ? (
            <>
              <p className="text-xs text-[#8b7d84] mb-4">
                주문 내용을 확인했으며, 결제에 동의합니다.
              </p>

              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={isPending}
                className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold disabled:opacity-50"
              >
                {isPending ? "처리 중..." : `${total.toLocaleString("ko-KR")}원 결제하기`}
              </Button>
            </>
          ) : (
            <div className="mt-4">
              <p className="text-xs text-[#8b7d84] mb-4">
                주문이 생성되었습니다. 아래에서 결제를 진행해주세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 결제 위젯 섹션 */}
      {showPaymentWidget && orderId && orderNumber && isLoaded && user && (
        <div id="payment-section" className="lg:col-span-3 mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#4a3f48] mb-6">결제</h2>
            <PaymentWidget
              orderId={orderId}
              orderNumber={orderNumber}
              amount={total}
              customerName={form.getValues("shippingName")}
              customerEmail={user.emailAddresses[0]?.emailAddress || ""}
            />
          </div>
        </div>
      )}
    </div>
  );
}
