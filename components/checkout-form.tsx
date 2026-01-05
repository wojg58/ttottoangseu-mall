/**
 * @file components/checkout-form.tsx
 * @description 주문/결제 폼 컴포넌트
 */

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser } from "@clerk/nextjs";
import { X, Plus, Minus } from "lucide-react";
import { createOrder, getOrderById } from "@/actions/orders";
import { removeFromCart, updateCartItemQuantity } from "@/actions/cart";
import { getAvailableCoupons, type Coupon } from "@/actions/coupons";
import { calculateCouponDiscount } from "@/lib/coupon-utils";
import type { CartItemWithProduct } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PaymentWidget from "@/components/payment-widget";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import logger from "@/lib/logger";

// Daum Postcode API 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          address: string;
          addressEnglish: string;
          addressType: 'R' | 'J';
          userSelectedType: 'R' | 'J';
          noSelected: 'Y' | 'N';
          userLanguageType: 'K' | 'E';
          roadAddress: string;
          roadAddressEnglish: string;
          jibunAddress: string;
          jibunAddressEnglish: string;
          autoRoadAddress: string;
          autoRoadAddressEnglish: string;
          autoJibunAddress: string;
          autoJibunAddressEnglish: string;
          buildingCode: string;
          buildingName: string;
          apartment: 'Y' | 'N';
          sido: string;
          sigungu: string;
          sigunguCode: string;
          roadnameCode: string;
          bcode: string;
          roadname: string;
          bname: string;
          bname1: string;
          bname2: string;
          hname: string;
          query: string;
          postCodeType: string;
        }) => void;
        width?: string | number;
        height?: string | number;
      }) => {
        open: () => void;
        embed: (element: HTMLElement) => void;
      };
    };
  }
}

// 주문 상품 아이템 컴포넌트 (Hooks 규칙 준수를 위해 분리)
interface CheckoutCartItemProps {
  item: CartItemWithProduct;
  isPending: boolean;
}

function CheckoutCartItem({ item, isPending }: CheckoutCartItemProps) {
  const [isRemoving, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const handleRemove = () => {
    if (!confirm("이 상품을 주문에서 제외하시겠습니까?")) {
      return;
    }

    console.log("[CheckoutCartItem] 상품 제거:", item.id);

    startTransition(async () => {
      const result = await removeFromCart(item.id);
      if (result.success) {
        console.log("[CheckoutCartItem] 상품 제거 성공:", result.message);
        // 페이지 새로고침하여 장바구니 상태 반영
        router.refresh();
      } else {
        console.error("[CheckoutCartItem] 상품 제거 실패:", result.message);
        alert(result.message);
      }
    });
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;
    if (newQuantity === item.quantity) return;

    console.log("[CheckoutCartItem] 수량 변경:", item.id, item.quantity, "->", newQuantity);

    setIsUpdating(true);
    startTransition(async () => {
      const result = await updateCartItemQuantity(item.id, newQuantity);
      if (result.success) {
        console.log("[CheckoutCartItem] 수량 변경 성공:", result.message);
        router.refresh();
      } else {
        console.error("[CheckoutCartItem] 수량 변경 실패:", result.message);
        alert(result.message);
      }
      setIsUpdating(false);
    });
  };

  const handleDecrease = () => {
    if (item.quantity > 1) {
      handleQuantityChange(item.quantity - 1);
    }
  };

  const handleIncrease = () => {
    handleQuantityChange(item.quantity + 1);
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-[#fef8fb] rounded-lg group">
      <div className="flex-1 min-w-0">
        {/* 상품 옵션 */}
        <p className="text-sm text-[#4a3f48] font-medium mb-1">
          {item.variant ? (
            <span>{item.variant.variant_value}</span>
          ) : (
            <span className="text-[#8b7d84]">기본 옵션</span>
          )}
        </p>
        {/* 개별 단가 */}
        <p className="text-xs text-[#8b7d84]">
          단가: {item.price.toLocaleString("ko-KR")}원
        </p>
      </div>
      <div className="flex items-center gap-4">
        {/* 수량 변경 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8b7d84]">수량</span>
          <div className="flex items-center gap-1 border border-[#f5d5e3] rounded-md">
            <button
              onClick={handleDecrease}
              disabled={isUpdating || isRemoving || isPending || item.quantity <= 1}
              className="p-1.5 text-[#4a3f48] hover:bg-[#fef8fb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="수량 감소"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-[#4a3f48] min-w-[2rem] text-center">
              {item.quantity}
            </span>
            <button
              onClick={handleIncrease}
              disabled={isUpdating || isRemoving || isPending}
              className="p-1.5 text-[#4a3f48] hover:bg-[#fef8fb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="수량 증가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* 합계 금액 */}
        <p className="text-sm font-bold text-[#4a3f48] w-28 text-right">
          {(item.price * item.quantity).toLocaleString("ko-KR")}원
        </p>
        {/* 삭제 버튼 */}
        <button
          onClick={handleRemove}
          disabled={isRemoving || isPending || isUpdating}
          className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="주문에서 제외"
        >
          <X className="w-3.5 h-3.5" />
          <span>{isRemoving ? "삭제 중..." : "삭제"}</span>
        </button>
      </div>
    </div>
  );
}

// 폼 스키마
const checkoutSchema = z.object({
  // 주문자 정보
  ordererName: z.string().min(2, "주문자 이름을 입력해주세요."),
  ordererPhone: z
    .string()
    .min(10, "연락처를 입력해주세요.")
    .regex(/^[0-9-]+$/, "올바른 연락처 형식을 입력해주세요."),
  ordererEmail: z.string().email("올바른 이메일 형식을 입력해주세요."),
  
  // 배송 정보
  shippingName: z.string().min(2, "수령인 이름을 입력해주세요."),
  shippingPhone: z
    .string()
    .min(10, "연락처를 입력해주세요.")
    .regex(/^[0-9-]+$/, "올바른 연락처 형식을 입력해주세요."),
  shippingZipCode: z.string().min(5, "우편번호를 입력해주세요."),
  shippingAddress: z.string().min(5, "배송지 주소를 입력해주세요."),
  shippingMemo: z.string().optional(),
  
  // 결제 수단 (토스페이먼츠 사용)
  paymentMethod: z.literal("TOSS_PAYMENTS", {
    errorMap: () => ({ message: "결제 수단을 선택해주세요." }),
  }),
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [showPaymentWidget, setShowPaymentWidget] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"카드" | "계좌이체" | null>(null);
  const [depositorName, setDepositorName] = useState("");
  const [useEscrow, setUseEscrow] = useState(false);
  const [orderData, setOrderData] = useState<{
    subtotal: number;
    shippingFee: number;
    couponDiscount: number;
    total: number;
    items: Array<{
      id: string;
      product_name: string;
      variant_info: string | null;
      quantity: number;
      price: number;
    }>;
  } | null>(null);
  const { user, isLoaded } = useUser();
  
  // 배송지 옵션 상태 (true: 회원 정보와 동일, false: 새로운 배송지)
  const [useMemberInfo, setUseMemberInfo] = useState(true);

  // Daum Postcode API 스크립트 로드
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // 주소 검색 함수
  const handleAddressSearch = () => {
    if (!window.daum) {
      console.error("[CheckoutForm] Daum Postcode API가 로드되지 않았습니다");
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    console.log("[CheckoutForm] 주소 검색 팝업 열기");

    new window.daum.Postcode({
      oncomplete: function (data) {
        console.group("[CheckoutForm] 주소 선택 완료");
        console.log("우편번호:", data.zonecode);
        console.log("주소:", data.address);
        console.log("주소 타입:", data.addressType);
        console.groupEnd();

        // 우편번호와 주소를 폼에 자동 입력
        form.setValue("shippingZipCode", data.zonecode);
        form.setValue("shippingAddress", data.address);

        // 유효성 검사 트리거
        form.trigger(["shippingZipCode", "shippingAddress"]);
      },
      width: "100%",
      height: "100%",
    }).open();
  };

  // URL에 orderId가 있으면 주문 정보 로드
  useEffect(() => {
    const urlOrderId = searchParams.get("orderId");
    if (urlOrderId && !orderNumber) {
      console.log("[CheckoutForm] URL에서 orderId 발견, 주문 정보 로드:", urlOrderId);
      getOrderById(urlOrderId)
        .then((order) => {
          if (order) {
            console.group("[CheckoutForm] 주문 정보 로드 완료");
            console.log("주문번호:", order.order_number);
            console.log("주문 금액:", order.total_amount);
            console.log("주문 아이템 수:", order.items.length);
            console.groupEnd();

            setOrderNumber(order.order_number);

            // 주문 아이템에서 금액 정보 계산
            const itemsSubtotal = order.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0,
            );
            const shipping = itemsSubtotal >= 50000 ? 0 : 3000;
            const couponDisc = itemsSubtotal + shipping - order.total_amount;
            
            console.group("[CheckoutForm] 금액 계산");
            console.log("상품 금액:", itemsSubtotal);
            console.log("배송비:", shipping);
            console.log("쿠폰 할인:", couponDisc);
            console.log("총 금액:", order.total_amount);
            console.groupEnd();

            setOrderData({
              subtotal: itemsSubtotal,
              shippingFee: shipping,
              couponDiscount: Math.max(0, couponDisc),
              total: order.total_amount,
              items: order.items.map((item) => ({
                id: item.id,
                product_name: item.product_name,
                variant_info: item.variant_info,
                quantity: item.quantity,
                price: item.price,
              })),
            });
          }
        })
        .catch((error) => {
          console.error("[CheckoutForm] 주문 정보 로드 실패:", error);
        });
    }
  }, [searchParams, orderNumber]);

  // 쿠폰 목록 가져오기
  useEffect(() => {
    if (isLoaded && user) {
      console.group("[CheckoutForm] 쿠폰 목록 조회 시작");
      console.log("사용자 ID:", user.id);
      console.log("사용자 로드 상태:", isLoaded);
      
      getAvailableCoupons()
        .then((couponList) => {
          console.log(`[CheckoutForm] ✅ ${couponList.length}개의 쿠폰 조회 완료`);
          if (couponList.length > 0) {
            console.log("쿠폰 목록:", couponList.map(c => ({ 
              id: c.id, 
              name: c.name, 
              discount: c.discount_amount,
              type: c.discount_type,
              status: c.status,
              expires_at: c.expires_at
            })));
          } else {
            console.log("[CheckoutForm] ⚠️ 사용 가능한 쿠폰이 없습니다.");
          }
          setCoupons(couponList);
          console.groupEnd();
        })
        .catch((error) => {
          console.error("[CheckoutForm] ❌ 쿠폰 조회 실패:", error);
          console.error("에러 상세:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          setCoupons([]);
          console.groupEnd();
        });
    } else {
      console.log("[CheckoutForm] 쿠폰 조회 스킵 - 로그인 필요", {
        isLoaded,
        hasUser: !!user
      });
    }
  }, [isLoaded, user]);

  // 주문 생성 후에는 orderData 사용, 그 전에는 props 사용
  const displaySubtotal = orderData?.subtotal ?? subtotal;
  const displayShippingFee = orderData?.shippingFee ?? shippingFee;
  const displayCouponDiscount = orderData?.couponDiscount ?? (selectedCoupon ? calculateCouponDiscount(selectedCoupon, subtotal) : 0);
  const displayTotal = orderData?.total ?? Math.max(0, total - (selectedCoupon ? calculateCouponDiscount(selectedCoupon, subtotal) : 0));
  const displayItemCount = orderData ? orderData.items.length : cartItems.length;

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      ordererName: user?.fullName || "",
      ordererPhone: "",
      ordererEmail: user?.primaryEmailAddress?.emailAddress || "",
      shippingName: "",
      shippingPhone: "",
      shippingZipCode: "",
      shippingAddress: "",
      shippingMemo: "",
      paymentMethod: "TOSS_PAYMENTS",
    },
  });

  // 회원 정보와 동일 옵션 선택 시 배송 정보 자동 채우기
  useEffect(() => {
    if (useMemberInfo && isLoaded && user) {
      const ordererName = form.getValues("ordererName");
      const ordererPhone = form.getValues("ordererPhone");
      
      console.log("[CheckoutForm] 회원 정보로 배송 정보 자동 채우기", {
        ordererName,
        ordererPhone,
      });
      
      if (ordererName) {
        form.setValue("shippingName", ordererName);
      }
      if (ordererPhone) {
        form.setValue("shippingPhone", ordererPhone);
      }
    } else if (!useMemberInfo) {
      // 새로운 배송지 선택 시 필드 초기화
      form.setValue("shippingName", "");
      form.setValue("shippingPhone", "");
      form.setValue("shippingZipCode", "");
      form.setValue("shippingAddress", "");
      form.setValue("shippingMemo", "");
    }
  }, [useMemberInfo, isLoaded, user, form]);

  // 주문자 정보 변경 시 배송 정보도 업데이트 (회원 정보와 동일 옵션 선택 시)
  const ordererName = form.watch("ordererName");
  const ordererPhone = form.watch("ordererPhone");
  
  useEffect(() => {
    if (useMemberInfo) {
      if (ordererName) {
        form.setValue("shippingName", ordererName);
      }
      if (ordererPhone) {
        form.setValue("shippingPhone", ordererPhone);
      }
    }
  }, [ordererName, ordererPhone, useMemberInfo, form]);

  const onSubmit = (data: CheckoutFormData) => {
    logger.group("[CheckoutForm] 주문 생성 시작");
    logger.log("주문자 정보:", {
      name: data.ordererName,
      phone: data.ordererPhone,
      email: data.ordererEmail,
    });
    logger.log("배송 정보:", {
      name: data.shippingName,
      phone: data.shippingPhone,
      address: data.shippingAddress,
      zipCode: data.shippingZipCode,
      memo: data.shippingMemo,
    });
    logger.log("선택된 쿠폰:", selectedCoupon);
    logger.log("최종 결제 금액:", displayTotal);
    logger.log("결제 수단:", data.paymentMethod);
    logger.groupEnd();

    startTransition(async () => {
      const result = await createOrder({
        ordererName: data.ordererName,
        ordererPhone: data.ordererPhone,
        ordererEmail: data.ordererEmail,
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddress: data.shippingAddress,
        shippingZipCode: data.shippingZipCode,
        shippingMemo: data.shippingMemo,
        couponId: selectedCoupon?.id || null,
      });

      logger.group("[CheckoutForm] 주문 생성 결과");
      logger.log("성공 여부:", result.success);
      logger.log("주문 ID:", result.orderId);
      logger.log("주문 번호:", result.orderNumber);
      logger.log("메시지:", result.message);
      logger.groupEnd();

      if (result.success && result.orderId && result.orderNumber) {
        logger.log("[CheckoutForm] ✅ 주문 생성 성공 - 토스페이먼츠 결제 시작");
        
        // 주문 정보 상태 저장
        setOrderId(result.orderId);
        setOrderNumber(result.orderNumber);
        
        // 토스페이먼츠 결제 위젯 표시
        logger.log("[CheckoutForm] 토스페이먼츠 결제 위젯 표시", {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: displayTotal,
        });
        
        // Next.js 라우터를 사용하여 URL에 orderId 추가
        // router.replace()를 사용하면 서버 컴포넌트도 새로운 URL을 인지합니다
        logger.log("[CheckoutForm] URL에 orderId 추가 (router.replace):", result.orderId);
        router.replace(`/checkout?orderId=${result.orderId}`, { scroll: false });
        
        setShowPaymentWidget(true);
      } else {
        logger.error("[CheckoutForm] ❌ 주문 생성 실패:", result.message);
        alert(result.message);
      }
    });
  };

  // 주문 생성 후 결제 위젯 표시
  if (showPaymentWidget && orderId && orderNumber && user) {
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
                {displayTotal.toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>
        </div>

        {/* 결제 위젯 */}
        <PaymentWidget
          orderId={orderId}
          orderNumber={orderNumber}
          amount={displayTotal}
          customerName={form.getValues("ordererName")}
          customerEmail={form.getValues("ordererEmail")}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 주문서 작성 */}
      <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 주문 상품 목록 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-[#4a3f48] mb-4">
                주문 상품 ({cartItems.length}개)
              </h3>
              <div className="space-y-4">
                {/* 장바구니 아이템 표시 */}
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
                                src={firstItem.primary_image?.image_url || "/placeholder.png"}
                                alt={firstItem.product.name || "상품 이미지"}
                                fill
                                sizes="64px"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#4a3f48] font-medium line-clamp-1">
                                {firstItem.product.name}
                              </p>
                            </div>
                          </div>

                          {/* 옵션별 아이템 */}
                          <div className="space-y-2">
                            {items.map((item) => (
                              <CheckoutCartItem
                                key={item.id}
                                item={item}
                                isPending={isPending}
                              />
                            ))}
                          </div>

                          {/* 상품별 총계 */}
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

            {/* 주문자 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#4a3f48] mb-6">주문자 정보</h2>
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="ordererName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#4a3f48]">
                        이름 <span className="text-[#ff6b9d]">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="주문자 이름"
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ordererPhone"
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

                  <FormField
                    control={form.control}
                    name="ordererEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#4a3f48]">
                          이메일 <span className="text-[#ff6b9d]">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@email.com"
                            className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#4a3f48] mb-6">배송 정보</h2>

              <div className="space-y-4">
                {/* 배송지 옵션 선택 */}
                <div className="flex gap-4 pb-4 border-b border-[#f5d5e3]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMemberInfo}
                      onChange={(e) => {
                        setUseMemberInfo(e.target.checked);
                        if (e.target.checked) {
                          // 회원 정보와 동일 선택 시 새로운 배송지 체크 해제
                        }
                      }}
                      className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-[#fad2e6] focus:ring-2"
                    />
                    <span className="text-sm text-[#4a3f48] font-medium">회원 정보와 동일</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!useMemberInfo}
                      onChange={(e) => {
                        setUseMemberInfo(!e.target.checked);
                      }}
                      className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-[#fad2e6] focus:ring-2"
                    />
                    <span className="text-sm text-[#4a3f48] font-medium">새로운 배송지</span>
                  </label>
                </div>

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
                          disabled={useMemberInfo}
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
                          disabled={useMemberInfo}
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
                          onClick={handleAddressSearch}
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
              </div>
            </div>
          </form>
        </Form>
      </div>

      {/* 결제 요약 */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
          <h2 className="text-lg font-bold text-[#4a3f48] mb-6">결제 금액</h2>

          {/* 쿠폰 선택 */}
          <div className="mb-4 pb-4 border-b border-[#f5d5e3]">
            <h3 className="text-sm font-bold text-[#4a3f48] mb-2">쿠폰</h3>
            {isLoaded && user ? (
              <>
                <select
                  value={selectedCoupon?.id || ""}
                  onChange={(e) => {
                    const coupon = coupons.find((c) => c.id === e.target.value);
                    setSelectedCoupon(coupon || null);
                    logger.log("[CheckoutForm] 쿠폰 선택:", coupon);
                  }}
                  className="w-full px-3 py-2 border border-[#f5d5e3] rounded-lg text-sm focus:border-[#ff6b9d] focus:ring-[#ff6b9d] focus:outline-none"
                  disabled={coupons.length === 0}
                >
                  <option value="">
                    {coupons.length > 0 ? "쿠폰 선택 안함" : "사용 가능한 쿠폰이 없습니다."}
                  </option>
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
                {coupons.length === 0 && (
                  <p className="text-xs text-[#8b7d84] mt-1">
                    사용 가능한 쿠폰이 없습니다.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-[#8b7d84]">
                로그인 후 쿠폰을 사용할 수 있습니다.
              </p>
            )}
          </div>

          <div className="space-y-3 pb-4 border-b border-[#f5d5e3]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8b7d84]">
                상품 금액 ({displayItemCount}개)
              </span>
              <span className="text-[#4a3f48]">
                {displaySubtotal.toLocaleString("ko-KR")}원
              </span>
            </div>
            {displayCouponDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8b7d84]">쿠폰 할인</span>
                <span className="text-[#ff6b9d] font-bold">
                  -{displayCouponDiscount.toLocaleString("ko-KR")}원
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#8b7d84]">배송비</span>
              <span className="text-[#4a3f48]">
                {displayShippingFee === 0 ? (
                  <span className="text-[#ff6b9d]">무료</span>
                ) : (
                  `${displayShippingFee.toLocaleString("ko-KR")}원`
                )}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center py-4 mb-4 border-b border-[#f5d5e3]">
            <span className="text-base font-bold text-[#4a3f48]">
              총 결제 금액
            </span>
            <span className="text-xl font-bold text-[#ff6b9d]">
              {displayTotal.toLocaleString("ko-KR")}원
            </span>
          </div>

          {/* 결제 수단 선택 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-[#4a3f48] mb-3">결제수단 선택</h3>
            <div className="space-y-3">
              {/* 신용카드 결제 */}
              <label 
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedPaymentMethod === "카드" 
                    ? "border-black bg-white" 
                    : "border-[#f5d5e3] hover:bg-[#fef8fb]"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="카드"
                  checked={selectedPaymentMethod === "카드"}
                  onChange={() => {
                    logger.log("[결제수단] 신용카드 결제 선택");
                    setSelectedPaymentMethod("카드");
                    form.setValue("paymentMethod", "TOSS_PAYMENTS");
                  }}
                  className="w-5 h-5 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm font-medium text-[#4a3f48]">신용카드</span>
              </label>

              {/* 에스크로(실시간 계좌이체) */}
              <label 
                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedPaymentMethod === "계좌이체" 
                    ? "border-black bg-white" 
                    : "border-[#f5d5e3] hover:bg-[#fef8fb]"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="계좌이체"
                  checked={selectedPaymentMethod === "계좌이체"}
                  onChange={() => {
                    logger.log("[결제수단] 에스크로(실시간 계좌이체) 선택");
                    setSelectedPaymentMethod("계좌이체");
                    form.setValue("paymentMethod", "TOSS_PAYMENTS");
                  }}
                  className="w-5 h-5 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm font-medium text-[#4a3f48]">에스크로(계좌이체)</span>
              </label>
            </div>
            
            {/* 소액 결제 안내 */}
            <p className="text-xs text-[#8b7d84] mt-2">
              - 소액 결제의 경우 PG사 정책에 따라 결제 금액 제한이 있을 수 있습니다.
            </p>
          </div>

          {/* 결제 수단 상세 설정 */}
          {selectedPaymentMethod && (
            <div className="mb-6 space-y-4">

              {/* 에스크로(실시간 계좌이체) 선택 시 추가 입력 필드 */}
              {selectedPaymentMethod === "계좌이체" && (
                <div className="space-y-4">
                  {/* 예금주명 */}
                  <div>
                    <label className="block text-sm font-medium text-[#4a3f48] mb-2">
                      예금주명<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={depositorName}
                      onChange={(e) => {
                        logger.log("[예금주명] 입력:", e.target.value);
                        setDepositorName(e.target.value);
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 border border-[#d4d4d4] rounded text-sm focus:outline-none focus:border-[#ff6b9d] focus:ring-1 focus:ring-[#ff6b9d]"
                    />
                  </div>

                  {/* 에스크로 서비스 체크박스 */}
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="escrow-checkout"
                      checked={useEscrow}
                      onChange={(e) => {
                        logger.log("[에스크로] 체크:", e.target.checked);
                        setUseEscrow(e.target.checked);
                      }}
                      className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
                    />
                    <label htmlFor="escrow-checkout" className="text-sm text-[#4a3f48] cursor-pointer">
                      에스크로(구매안전서비스를 적용합니다.
                    </label>
                  </div>
                </div>
              )}

              {/* 결제수단과 입력정보를 다음에도 사용 체크박스 */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="save-payment-info"
                  className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
                />
                <label htmlFor="save-payment-info" className="text-sm text-[#4a3f48] cursor-pointer">
                  결제수단과 입력정보를 다음에도 사용
                </label>
              </div>

            </div>
          )}

          {/* 적립 혜택 */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4a3f48]">적립 혜택</h3>
              <div className="flex items-center gap-1">
                <span className="text-sm text-[#4a3f48]">0원</span>
                <span className="text-xs text-[#8b7d84]">▼</span>
              </div>
            </div>
          </div>

          {/* 배송정보 제공방침 동의 */}
          <div className="mb-4">
            <p className="text-xs text-[#8b7d84]">
              배송정보 제공방침 동의 <span className="text-[#4a3f48] underline cursor-pointer">자세히 &gt;</span>
            </p>
          </div>

          {/* 주문 내용 확인 및 약관 동의 */}
          <div className="mb-6">
            <p className="text-xs text-[#4a3f48]">
              주문 내용을 확인하였으며 약관에 동의합니다.
            </p>
          </div>

          <Button
            onClick={() => {
              logger.log("[CheckoutForm] 결제하기 버튼 클릭");
              if (!selectedPaymentMethod) {
                alert("결제 수단을 선택해주세요");
                return;
              }
              form.handleSubmit(onSubmit)();
            }}
            disabled={
              isPending || 
              !selectedPaymentMethod ||
              (selectedPaymentMethod === "계좌이체" && !depositorName.trim())
            }
            className="w-full h-14 bg-black hover:bg-gray-800 text-white rounded-lg text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending 
              ? "처리 중..." 
              : !selectedPaymentMethod 
              ? "결제 수단을 선택해주세요" 
              : selectedPaymentMethod === "계좌이체" && !depositorName.trim()
              ? "예금주명을 입력해주세요"
              : `${displayTotal.toLocaleString("ko-KR")}원 결제하기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
