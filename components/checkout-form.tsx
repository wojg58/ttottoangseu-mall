/**
 * @file components/checkout-form.tsx
 * @description 주문/결제 폼 컴포넌트
 */

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser } from "@clerk/nextjs";
import { X } from "lucide-react";
import { createOrder } from "@/actions/orders";
import { removeFromCart } from "@/actions/cart";
import { getAvailableCoupons, type Coupon } from "@/actions/coupons";
import { calculateCouponDiscount } from "@/lib/coupon-utils";
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
import OrderCancelButton from "@/components/order-cancel-button";

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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // 쿠폰 목록 가져오기
  useEffect(() => {
    if (isLoaded && user) {
      console.log("[CheckoutForm] 쿠폰 목록 조회 시작", { userId: user.id });
      getAvailableCoupons()
        .then((couponList) => {
          console.log(`[CheckoutForm] ${couponList.length}개의 쿠폰 조회 완료`, couponList);
          setCoupons(couponList);
        })
        .catch((error) => {
          console.error("[CheckoutForm] 쿠폰 조회 실패:", error);
          setCoupons([]);
        });
    }
  }, [isLoaded, user]);

  // 쿠폰 할인 금액 계산
  const couponDiscount = selectedCoupon
    ? calculateCouponDiscount(selectedCoupon, subtotal)
    : 0;

  // 최종 결제 금액 계산 (쿠폰 할인 적용)
  const finalTotal = Math.max(0, total - couponDiscount);

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
        couponId: selectedCoupon?.id || null,
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
                            {items.map((item) => {
                              const [isRemoving, setIsRemoving] = useState(false);
                              
                              const handleRemove = async () => {
                                if (!confirm("이 상품을 주문에서 제외하시겠습니까?")) {
                                  return;
                                }
                                
                                console.log("[CheckoutForm] 상품 제거:", item.id);
                                setIsRemoving(true);
                                
                                startTransition(async () => {
                                  const result = await removeFromCart(item.id);
                                  if (result.success) {
                                    console.log("[CheckoutForm] 상품 제거 성공:", result.message);
                                    // 페이지 새로고침하여 장바구니 상태 반영
                                    router.refresh();
                                  } else {
                                    console.error("[CheckoutForm] 상품 제거 실패:", result.message);
                                    alert(result.message);
                                    setIsRemoving(false);
                                  }
                                });
                              };

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-2 border-b border-[#f5d5e3] last:border-b-0 group"
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
                                    <button
                                      onClick={handleRemove}
                                      disabled={isRemoving || isPending}
                                      className="p-1.5 text-[#8b7d84] hover:text-[#ff6b9d] hover:bg-[#ffeef5] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                                      title="주문에서 제외"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
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

          {/* 쿠폰 선택 */}
          <div className="mb-4 pb-4 border-b border-[#f5d5e3]">
            <h3 className="text-sm font-bold text-[#4a3f48] mb-2">쿠폰</h3>
            {coupons.length > 0 ? (
              <>
                <select
                  value={selectedCoupon?.id || ""}
                  onChange={(e) => {
                    const coupon = coupons.find((c) => c.id === e.target.value);
                    setSelectedCoupon(coupon || null);
                    console.log("[CheckoutForm] 쿠폰 선택:", coupon);
                  }}
                  className="w-full px-3 py-2 border border-[#f5d5e3] rounded-lg text-sm focus:border-[#ff6b9d] focus:ring-[#ff6b9d] focus:outline-none"
                >
                  <option value="">쿠폰 선택 안함</option>
                  {coupons.map((coupon) => (
                    <option key={coupon.id} value={coupon.id}>
                      {coupon.name} (
                      {coupon.discount_type === "fixed"
                        ? `${coupon.discount_amount.toLocaleString("ko-KR")}원 할인`
                        : `${coupon.discount_amount}% 할인`}
                      )
                    </option>
                  ))}
                </select>
                {selectedCoupon && (
                  <p className="text-xs text-[#ff6b9d] mt-1">
                    {selectedCoupon.name} 적용됨
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-[#8b7d84]">
                사용 가능한 쿠폰이 없습니다.
              </p>
            )}
          </div>

          <div className="space-y-3 pb-4 border-b border-[#f5d5e3]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8b7d84]">
                상품 금액 ({cartItems.length}개)
              </span>
              <span className="text-[#4a3f48]">
                {subtotal.toLocaleString("ko-KR")}원
              </span>
            </div>
            {selectedCoupon && couponDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8b7d84]">쿠폰 할인</span>
                <span className="text-[#ff6b9d] font-bold">
                  -{couponDiscount.toLocaleString("ko-KR")}원
                </span>
              </div>
            )}
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
              {finalTotal.toLocaleString("ko-KR")}원
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
                {isPending ? "처리 중..." : `${finalTotal.toLocaleString("ko-KR")}원 결제하기`}
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

      {/* 주문 상태 및 취소 섹션 */}
      {showPaymentWidget && orderId && orderNumber && (
        <div className="lg:col-span-3 mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#4a3f48] mb-2">주문 정보</h2>
                <p className="text-sm text-[#8b7d84] mb-2">
                  주문번호: <span className="font-medium text-[#4a3f48]">{orderNumber}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#8b7d84]">주문 상태:</span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#ffeef5] text-[#ff6b9d]">
                    결제 대기
                  </span>
                </div>
              </div>
              <div className="w-48">
                <OrderCancelButton
                  orderId={orderId}
                  orderStatus="pending"
                  onCancelSuccess={() => {
                    console.log("[CheckoutForm] 주문 취소 성공, 장바구니로 이동");
                    // 주문 상태 초기화
                    setOrderId(null);
                    setOrderNumber(null);
                    setShowPaymentWidget(false);
                    // 장바구니로 리다이렉트
                    router.push("/cart");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 결제 위젯 섹션 */}
      {showPaymentWidget && orderId && orderNumber && isLoaded && user && (
        <div id="payment-section" className="lg:col-span-3 mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#4a3f48] mb-6">결제</h2>
            <PaymentWidget
              orderId={orderId}
              orderNumber={orderNumber}
              amount={finalTotal}
              customerName={form.getValues("shippingName")}
              customerEmail={user.emailAddresses[0]?.emailAddress || ""}
            />
          </div>
        </div>
      )}
    </div>
  );
}
