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
import { getOrderById } from "@/actions/orders";
import { removeFromCart, updateCartItemQuantity } from "@/actions/cart";
import { getAvailableCoupons, type Coupon } from "@/actions/coupons";
import { getMemberAdditionalInfo } from "@/actions/member-actions";
import { calculateCouponDiscount } from "@/lib/coupon-utils";
import type { CartItemWithProduct } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import logger from "@/lib/logger-client";

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

    logger.debug("[CheckoutCartItem] 상품 제거 시작", {
      itemId: item.id,
    });

    startTransition(async () => {
      const result = await removeFromCart(item.id);
      if (result.success) {
        logger.debug("[CheckoutCartItem] 상품 제거 성공");
        // 페이지 새로고침하여 장바구니 상태 반영
        router.refresh();
      } else {
        logger.error("[CheckoutCartItem] 상품 제거 실패", {
          message: result.message,
        });
        alert(result.message);
      }
    });
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;
    if (newQuantity === item.quantity) return;

    logger.debug("[CheckoutCartItem] 수량 변경", {
      itemId: item.id,
      oldQuantity: item.quantity,
      newQuantity,
    });

    setIsUpdating(true);
    startTransition(async () => {
      const result = await updateCartItemQuantity(item.id, newQuantity);
      if (result.success) {
        logger.debug("[CheckoutCartItem] 수량 변경 성공");
        router.refresh();
      } else {
        logger.error("[CheckoutCartItem] 수량 변경 실패", {
          message: result.message,
        });
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
              disabled={
                isUpdating || isRemoving || isPending || item.quantity <= 1
              }
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
  shippingAddressDetail: z.string().optional(),
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
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [showPaymentWidget, setShowPaymentWidget] = useState(false);
  const [paymentWidgetData, setPaymentWidgetData] = useState<{
    orderId: string;
    amount: number;
    orderName: string;
    customerName: string;
    customerEmail: string;
  } | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "CARD" | "TRANSFER" | null
  >(null);
  const [depositorName, setDepositorName] = useState("");
  const [useEscrow, setUseEscrow] = useState(false);

  // 약관 동의 상태
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreePurchase, setAgreePurchase] = useState(false); // 필수 동의

  // 배송정보 제공방침 모달 상태
  const [showShippingPolicyModal, setShowShippingPolicyModal] = useState(false);
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
      logger.error("[CheckoutForm] Daum Postcode API가 로드되지 않음");
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    logger.debug("[CheckoutForm] 주소 검색 팝업 열기");

    new window.daum.Postcode({
      oncomplete: function (data) {
        logger.group("[CheckoutForm] 주소 선택 완료");
        // 주소 정보는 민감 정보이므로 로깅하지 않음
        logger.debug("[CheckoutForm] 주소 선택 완료", {
          hasZonecode: !!data.zonecode,
          hasAddress: !!data.address,
          addressType: data.addressType,
        });
        logger.groupEnd();

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
      logger.debug("[CheckoutForm] URL에서 orderId 발견, 주문 정보 로드", {
        hasOrderId: !!urlOrderId,
      });
      getOrderById(urlOrderId)
        .then((order) => {
          if (order) {
            logger.group("[CheckoutForm] 주문 정보 로드 완료");
            logger.debug("[CheckoutForm] 주문 정보", {
              hasOrderNumber: !!order.order_number,
              totalAmount: order.total_amount,
              itemsCount: order.items.length,
            });
            console.groupEnd();

            setOrderNumber(order.order_number);

            // 주문 아이템에서 금액 정보 계산
            const itemsSubtotal = order.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0,
            );
            // 결제 테스트 상품(상품명에 "1원" 포함)은 배송비 제외
            const hasTestProduct = order.items.some(
              (item) => item.product_name.includes("1원")
            );
            const shipping = hasTestProduct ? 0 : itemsSubtotal >= 50000 ? 0 : 3000;
            const couponDisc = itemsSubtotal + shipping - order.total_amount;

            logger.group("[CheckoutForm] 금액 계산");
            logger.info("상품 금액:", itemsSubtotal);
            logger.info("배송비:", shipping);
            logger.info("쿠폰 할인:", Math.max(0, couponDisc));
            logger.info("주문 총 금액 (DB):", order.total_amount);
            logger.info(
              "계산된 총 금액:",
              itemsSubtotal + shipping - Math.max(0, couponDisc),
            );
            logger.groupEnd();

            // 주문 정보에 저장된 total_amount를 그대로 사용 (서버에서 계산한 정확한 값)
            setOrderData({
              subtotal: itemsSubtotal,
              shippingFee: shipping,
              couponDiscount: Math.max(0, couponDisc),
              total: order.total_amount, // DB에 저장된 정확한 금액 사용
              items: order.items.map((item) => ({
                id: item.id,
                product_name: item.product_name,
                variant_info: item.variant_info,
                quantity: item.quantity,
                price: item.price,
              })),
            });

            // 주문 정보 로드 후 결제 위젯 표시
            setOrderId(urlOrderId);

            // 사용자 정보가 있으면 폼에 채우기 (주문자 정보)
            if (user) {
              const ordererName = user.fullName || user.firstName || "";
              const ordererEmail = user.primaryEmailAddress?.emailAddress || "";
              const ordererPhone = user.phoneNumbers?.[0]?.phoneNumber || "";

              if (ordererName) {
                form.setValue("ordererName", ordererName);
              }
              if (ordererEmail) {
                form.setValue("ordererEmail", ordererEmail);
              }
              if (ordererPhone) {
                form.setValue("ordererPhone", ordererPhone);
              }
            }

            setShowPaymentWidget(true);
          }
        })
        .catch((error) => {
          logger.error("[CheckoutForm] 주문 정보 로드 실패", error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orderNumber]);

  // 쿠폰 목록 가져오기
  useEffect(() => {
    if (isLoaded && user) {
      logger.group("[CheckoutForm] 쿠폰 목록 조회 시작");
      logger.debug("[CheckoutForm] 사용자 확인 완료", {
        hasUser: !!user,
        isLoaded,
      });

      getAvailableCoupons()
        .then((couponList) => {
          logger.debug("[CheckoutForm] 쿠폰 조회 완료", {
            count: couponList.length,
          });
          setCoupons(couponList);
          logger.groupEnd();
        })
        .catch((error) => {
          logger.error("[CheckoutForm] 쿠폰 조회 실패", error);
          setCoupons([]);
          console.groupEnd();
        });
    } else {
      logger.debug("[CheckoutForm] 쿠폰 조회 스킵 - 로그인 필요", {
        isLoaded,
        hasUser: !!user,
      });
    }
  }, [isLoaded, user]);

  // 주문 생성 후에는 orderData 사용, 그 전에는 props 사용
  const displaySubtotal = orderData?.subtotal ?? subtotal;
  const displayShippingFee = orderData?.shippingFee ?? shippingFee;
  const displayCouponDiscount =
    orderData?.couponDiscount ??
    (selectedCoupon ? calculateCouponDiscount(selectedCoupon, subtotal) : 0);
  const displayTotal =
    orderData?.total ??
    Math.max(
      0,
      total -
        (selectedCoupon
          ? calculateCouponDiscount(selectedCoupon, subtotal)
          : 0),
    );
  const displayItemCount = orderData
    ? orderData.items.length
    : cartItems.length;

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
      shippingAddressDetail: "",
      shippingMemo: "",
      paymentMethod: "TOSS_PAYMENTS",
    },
  });

  // 회원 정보와 동일 옵션 선택 시 배송 정보 자동 채우기
  useEffect(() => {
    if (useMemberInfo && isLoaded && user) {
      const ordererName = form.getValues("ordererName");
      const ordererPhone = form.getValues("ordererPhone");

      logger.debug("[CheckoutForm] 회원 정보로 배송 정보 자동 채우기", {
        ordererName,
        ordererPhone,
      });

      if (ordererName) {
        form.setValue("shippingName", ordererName);
      }
      if (ordererPhone) {
        form.setValue("shippingPhone", ordererPhone);
      }

      // 회원 추가 정보에서 주소 정보 가져오기
      getMemberAdditionalInfo()
        .then((result) => {
          if (result.success && result.data) {
            logger.debug("[CheckoutForm] 회원 주소 정보 로드 완료", {
              postcode: result.data.postcode,
              addr1: result.data.addr1,
              addr2: result.data.addr2,
            });

            // 우편번호
            if (result.data.postcode) {
              form.setValue("shippingZipCode", result.data.postcode);
            }
            // 기본 주소
            if (result.data.addr1) {
              form.setValue("shippingAddress", result.data.addr1);
            }
            // 상세 주소
            if (result.data.addr2) {
              form.setValue("shippingAddressDetail", result.data.addr2);
            }

            // 유효성 검사 트리거
            form.trigger(["shippingZipCode", "shippingAddress", "shippingAddressDetail"]);
          } else {
            logger.debug("[CheckoutForm] 회원 주소 정보 없음 또는 로드 실패");
          }
        })
        .catch((error) => {
          logger.error("[CheckoutForm] 회원 주소 정보 로드 실패", error);
        });
    } else if (!useMemberInfo) {
      // 새로운 배송지 선택 시 필드 초기화
      form.setValue("shippingName", "");
      form.setValue("shippingPhone", "");
      form.setValue("shippingZipCode", "");
      form.setValue("shippingAddress", "");
      form.setValue("shippingAddressDetail", "");
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

  // 약관 동의 핸들러
  const handleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
    setAgreePurchase(checked);
  };

  const handleAgreePurchase = (checked: boolean) => {
    setAgreePurchase(checked);
    if (!checked) {
      setAgreeAll(false);
    } else {
      // 모든 필수 동의가 체크되면 전체 동의도 체크
      setAgreeAll(true);
    }
  };

  // 결제하기 버튼 클릭 핸들러 (토스페이먼츠 결제위젯 오버레이 방식)
  const handlePaymentClick = async () => {
    logger.group("[CheckoutForm] 결제하기 버튼 클릭");
    logger.info(
      "[CheckoutForm] 현재 selectedPaymentMethod state:",
      selectedPaymentMethod,
    );

    // 0. 필수 약관 동의 확인
    if (!agreePurchase) {
      logger.warn("[CheckoutForm] 필수 약관 미동의");
      alert("구매조건 확인 및 결제진행에 동의해주세요.");
      logger.groupEnd();
      return;
    }

    // 1. 결제수단 선택 확인 (가장 먼저 검증)
    if (
      !selectedPaymentMethod ||
      (selectedPaymentMethod !== "CARD" && selectedPaymentMethod !== "TRANSFER")
    ) {
      logger.warn("[CheckoutForm] 결제수단 미선택 또는 잘못된 값", {
        selectedPaymentMethod,
      });
      alert("결제수단이 아직 선택되지 않았어요. 결제수단을 선택해 주세요.");
      logger.groupEnd();
      return;
    }

    // 2. 폼 유효성 검사
    const isValid = await form.trigger();
    if (!isValid) {
      const errors = form.formState.errors;
      logger.warn("[CheckoutForm] 폼 유효성 검사 실패");
      logger.error("[CheckoutForm] 유효성 검사 에러 목록:", {
        ordererName: errors.ordererName?.message,
        ordererPhone: errors.ordererPhone?.message,
        ordererEmail: errors.ordererEmail?.message,
        shippingName: errors.shippingName?.message,
        shippingPhone: errors.shippingPhone?.message,
        shippingAddress: errors.shippingAddress?.message,
        shippingZipCode: errors.shippingZipCode?.message,
        allErrors: errors,
      });
      alert(
        "입력 정보를 확인해주세요.\n\n주문자 정보와 배송 정보를 모두 입력해야 합니다.",
      );
      logger.groupEnd();
      return;
    }

    // 3. 계좌이체 선택 시 예금주명 확인
    if (selectedPaymentMethod === "TRANSFER" && !depositorName.trim()) {
      logger.warn("[CheckoutForm] 예금주명 미입력");
      alert("예금주명을 입력해주세요");
      logger.groupEnd();
      return;
    }

    const formData = form.getValues();
    // 기본 주소와 상세 주소를 합쳐서 최종 배송지 주소 생성
    const fullShippingAddress = formData.shippingAddressDetail
      ? `${formData.shippingAddress} ${formData.shippingAddressDetail}`.trim()
      : formData.shippingAddress;

    // 민감 정보는 로깅하지 않음 (주문자 정보, 배송 정보)
    logger.debug("[CheckoutForm] 결제 정보 확인", {
      hasOrdererInfo: !!(formData.ordererName && formData.ordererPhone && formData.ordererEmail),
      hasShippingInfo: !!(formData.shippingName && formData.shippingPhone && formData.shippingAddress),
      hasCoupon: !!selectedCoupon,
      totalAmount: displayTotal,
      paymentMethod: selectedPaymentMethod,
    });
    logger.groupEnd();

    startTransition(async () => {
      try {
        // 4. 토스페이먼츠 결제 준비 API 호출 (주문 생성 + 결제 준비)
        logger.group("[CheckoutForm] 토스페이먼츠 결제 준비 API 호출");
        // 기본 주소와 상세 주소를 합쳐서 최종 배송지 주소 생성
        const fullShippingAddress = formData.shippingAddressDetail
          ? `${formData.shippingAddress} ${formData.shippingAddressDetail}`.trim()
          : formData.shippingAddress;

        // 민감 정보는 로깅하지 않음 (배송 정보)
        logger.debug("[CheckoutForm] 결제 준비 API 호출 시작", {
          hasOrdererInfo: !!(formData.ordererName && formData.ordererPhone && formData.ordererEmail),
          hasShippingInfo: !!(formData.shippingName && formData.shippingPhone && formData.shippingAddress),
          hasShippingMemo: !!formData.shippingMemo,
        });
        
        const prepareResponse = await fetch("/api/payments/toss/prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: displayTotal,
            // 주문자 정보
            ordererName: formData.ordererName,
            ordererPhone: formData.ordererPhone,
            ordererEmail: formData.ordererEmail,
            // 배송 정보
            shippingName: formData.shippingName,
            shippingPhone: formData.shippingPhone,
            shippingAddress: fullShippingAddress,
            shippingZipCode: formData.shippingZipCode,
            shippingMemo: formData.shippingMemo || undefined,
          }),
        });

        const prepareData = await prepareResponse.json();
        logger.info("결제 준비 API 응답:", {
          success: prepareData.success,
          orderId: prepareData.orderId,
          amount: prepareData.amount,
        });
        logger.groupEnd();

        if (!prepareData.success || !prepareData.orderId) {
          logger.error(
            "[CheckoutForm] ❌ 결제 준비 실패:",
            prepareData.message,
          );
          alert(prepareData.message || "결제 준비에 실패했습니다.");
          return;
        }

        // 6. 결제 전용 페이지로 리다이렉트
        logger.info(
          "[CheckoutForm] ✅ 결제 준비 완료 - 결제 페이지로 이동",
        );
        
        // 결제 정보를 URL 파라미터로 전달하여 결제 페이지로 이동
        try {
          const paymentParams = new URLSearchParams({
            orderId: prepareData.orderId,
            amount: prepareData.amount.toString(),
            orderName: prepareData.orderName,
            customerName: prepareData.customerName,
            customerEmail: prepareData.customerEmail,
            paymentMethod: selectedPaymentMethod,
            ...(selectedPaymentMethod === "TRANSFER" && depositorName.trim()
              ? { depositorName: depositorName.trim() }
              : {}),
            ...(selectedPaymentMethod === "TRANSFER" && useEscrow
              ? { useEscrow: "true" }
              : {}),
          });
          
          const paymentUrl = `/checkout/payment?${paymentParams.toString()}`;
          logger.info("[CheckoutForm] 결제 페이지 URL:", paymentUrl);
          
          // window.location을 사용하여 새 페이지로 이동 (더 안정적)
          window.location.href = paymentUrl;
          logger.info("[CheckoutForm] ✅ 결제 페이지로 리다이렉트 완료");
        } catch (redirectError) {
          logger.error("[CheckoutForm] ❌ 리다이렉트 에러:", redirectError);
          logger.error("[CheckoutForm] 에러 상세:", {
            message: redirectError instanceof Error ? redirectError.message : String(redirectError),
            stack: redirectError instanceof Error ? redirectError.stack : undefined,
            name: redirectError instanceof Error ? redirectError.name : undefined,
          });
          alert("결제 페이지로 이동하는 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      } catch (error) {
        logger.error("[CheckoutForm] ❌ 결제 프로세스 에러:", error);
        logger.error("[CheckoutForm] 에러 상세:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
          fullError: error,
        });
        alert("결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onSubmit = (_data: CheckoutFormData) => {
    // 이 함수는 더 이상 사용하지 않지만, 폼 제출을 위해 유지
    // 실제 결제는 handlePaymentClick에서 처리
    logger.warn("[CheckoutForm] onSubmit 호출됨 (사용되지 않음)");
  };

  return (
    <>
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

                    return Object.entries(groupedItems).map(
                      ([productId, items]) => {
                        const firstItem = items[0];
                        const totalQuantity = items.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        );
                        const totalPrice = items.reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0,
                        );

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
                                    "/placeholder.png"
                                  }
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
                                <span className="text-xs text-[#8b7d84]">
                                  총 수량
                                </span>
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
                      },
                    );
                  })()}
                </div>
              </div>

              {/* 주문자 정보 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-[#4a3f48] mb-6">
                  주문자 정보
                </h2>

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
                <h2 className="text-lg font-bold text-[#4a3f48] mb-6">
                  배송 정보
                </h2>

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
                      <span className="text-sm text-[#4a3f48] font-medium">
                        회원 정보와 동일
                      </span>
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
                      <span className="text-sm text-[#4a3f48] font-medium">
                        새로운 배송지
                      </span>
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
                            placeholder="기본 주소"
                            readOnly
                            className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6] bg-gray-50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingAddressDetail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[#4a3f48]">
                          상세 주소
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="동/호수 등을 입력해주세요 (선택)"
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
                        <FormLabel className="text-[#4a3f48]">
                          배송 메모
                        </FormLabel>
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
                      const coupon = coupons.find(
                        (c) => c.id === e.target.value,
                      );
                      setSelectedCoupon(coupon || null);
                      logger.info("[CheckoutForm] 쿠폰 선택:", coupon);
                    }}
                    className="w-full px-3 py-2 border border-[#f5d5e3] rounded-lg text-sm focus:border-[#ff6b9d] focus:ring-[#ff6b9d] focus:outline-none"
                    disabled={coupons.length === 0}
                  >
                    <option value="">
                      {coupons.length > 0
                        ? "쿠폰 선택 안함"
                        : "사용 가능한 쿠폰이 없습니다."}
                    </option>
                    {coupons.map((coupon) => (
                      <option key={coupon.id} value={coupon.id}>
                        {coupon.name} (
                        {coupon.discount_type === "fixed"
                          ? `${coupon.discount_amount.toLocaleString(
                              "ko-KR",
                            )}원 할인`
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

            {/* 결제 수단 선택 - 약관 동의보다 먼저 표시 */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#4a3f48] mb-3">
                결제수단 선택
              </h3>
              <div className="space-y-3">
                {/* 신용카드 결제 */}
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedPaymentMethod === "CARD"
                      ? "border-black bg-white"
                      : "border-[#f5d5e3] hover:bg-[#fef8fb]"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={selectedPaymentMethod === "CARD"}
                    onChange={(e) => {
                      const value = e.target.value as "CARD";
                      logger.info("[결제수단] 신용카드 선택:", { value });
                      setSelectedPaymentMethod(value);
                      form.setValue("paymentMethod", "TOSS_PAYMENTS");
                    }}
                    className="w-5 h-5 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                  />
                  <span className="text-sm font-medium text-[#4a3f48]">
                    신용카드
                  </span>
                </label>

                {/* 에스크로(실시간 계좌이체) */}
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedPaymentMethod === "TRANSFER"
                      ? "border-black bg-white"
                      : "border-[#f5d5e3] hover:bg-[#fef8fb]"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="TRANSFER"
                    checked={selectedPaymentMethod === "TRANSFER"}
                    onChange={(e) => {
                      const value = e.target.value as "TRANSFER";
                      logger.info("[결제수단] 에스크로 선택:", { value });
                      setSelectedPaymentMethod(value);
                      form.setValue("paymentMethod", "TOSS_PAYMENTS");
                    }}
                    className="w-5 h-5 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                  />
                  <span className="text-sm font-medium text-[#4a3f48]">
                    에스크로(계좌이체)
                  </span>
                </label>
              </div>
            </div>

            {/* 결제 수단 상세 설정 */}
            {selectedPaymentMethod && (
              <div className="mb-6 space-y-4">
                {/* 에스크로(실시간 계좌이체) 선택 시 추가 입력 필드 */}
                {selectedPaymentMethod === "TRANSFER" && (
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
                          logger.info("[예금주명] 입력:", e.target.value);
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
                          logger.info("[에스크로] 체크:", e.target.checked);
                          setUseEscrow(e.target.checked);
                        }}
                        className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
                      />
                      <label
                        htmlFor="escrow-checkout"
                        className="text-sm text-[#4a3f48] cursor-pointer"
                      >
                        에스크로(구매안전서비스를 적용합니다.
                      </label>
                    </div>
                  </div>
                )}
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
                배송정보 제공방침 동의{" "}
                <span
                  onClick={() => setShowShippingPolicyModal(true)}
                  className="text-[#4a3f48] underline cursor-pointer hover:text-[#ff6b9d] transition-colors"
                >
                  자세히 &gt;
                </span>
              </p>
            </div>

            {/* 약관 동의 */}
            <div className="mb-6 space-y-3 p-4 bg-[#fef8fb] rounded-lg border border-[#f5d5e3]">
              {/* 전체 동의 */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeAll}
                  onChange={(e) => handleAgreeAll(e.target.checked)}
                  className="w-5 h-5 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
                />
                <span className="text-sm font-bold text-[#4a3f48]">
                  전체 동의
                </span>
              </label>

              {/* 구분선 */}
              <div className="border-t border-[#f5d5e3]"></div>

              {/* 필수 동의 항목 */}
              <label className="flex items-start gap-2 pl-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreePurchase}
                  onChange={(e) => handleAgreePurchase(e.target.checked)}
                  className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
                />
                <span className="text-sm text-[#4a3f48]">
                  구매조건 확인 및 결제진행에 동의{" "}
                  <span className="text-[#ff6b9d]">(필수)</span>
                </span>
              </label>
            </div>

            <Button
              onClick={handlePaymentClick}
              disabled={
                isPending ||
                !selectedPaymentMethod ||
                !agreePurchase ||
                (selectedPaymentMethod === "TRANSFER" && !depositorName.trim())
              }
              className="w-full h-14 bg-black hover:bg-gray-800 text-white rounded-lg text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? "처리 중..."
                : !selectedPaymentMethod
                ? "결제 수단을 선택해주세요"
                : !agreePurchase
                ? "약관에 동의해주세요"
                : selectedPaymentMethod === "TRANSFER" && !depositorName.trim()
                ? "예금주명을 입력해주세요"
                : `${displayTotal.toLocaleString("ko-KR")}원 결제하기`}
            </Button>
          </div>
        </div>
      </div>

      {/* PaymentWidget - Toss Payments SDK가 자체 오버레이를 생성하므로 여기서는 컴포넌트만 렌더링 */}
      {showPaymentWidget && paymentWidgetData && selectedPaymentMethod && (
        <PaymentWidget
          key={`${
            paymentWidgetData.orderId
          }-${selectedPaymentMethod}-${Date.now()}`}
          orderId={paymentWidgetData.orderId}
          amount={paymentWidgetData.amount}
          orderName={paymentWidgetData.orderName}
          customerName={paymentWidgetData.customerName}
          customerEmail={paymentWidgetData.customerEmail}
          paymentMethod={selectedPaymentMethod}
          depositorName={
            selectedPaymentMethod === "TRANSFER" ? depositorName : undefined
          }
          useEscrow={selectedPaymentMethod === "TRANSFER" ? useEscrow : false}
          onClose={() => {
            logger.info("[CheckoutForm] PaymentWidget 닫기");
            setShowPaymentWidget(false);
            setPaymentWidgetData(null);
          }}
        />
      )}

      {/* 배송정보 제공방침 모달 */}
      <Dialog
        open={showShippingPolicyModal}
        onOpenChange={setShowShippingPolicyModal}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#4a3f48]">
              배송정보 제공방침
            </DialogTitle>
            <DialogDescription className="text-sm text-[#8b7d84]">
              고객님의 개인정보 보호를 위한 배송정보 제공방침입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-[#4a3f48]">
            <div>
              <h3 className="font-bold mb-2">1. 개인정보 제공 목적</h3>
              <p className="text-[#8b7d84]">
                상품 배송 및 배송 관련 안내를 위해 필요한 최소한의 개인정보를
                배송업체에 제공합니다.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">2. 제공되는 개인정보 항목</h3>
              <ul className="list-disc list-inside text-[#8b7d84] space-y-1">
                <li>수령인 성명</li>
                <li>수령인 연락처</li>
                <li>배송지 주소</li>
                <li>우편번호</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-2">3. 개인정보를 제공받는 자</h3>
              <p className="text-[#8b7d84]">
                CJ대한통운, 한진택배, 롯데택배 등 상품 배송을 위해 계약한
                배송업체
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">4. 개인정보 보유 및 이용 기간</h3>
              <p className="text-[#8b7d84]">
                배송 완료 후 최대 3개월까지 보관하며, 이후 즉시 파기합니다. 단,
                관련 법령에 의거하여 보존할 필요가 있는 경우 해당 기간 동안
                보관합니다.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-2">5. 동의 거부 권리 및 불이익</h3>
              <p className="text-[#8b7d84]">
                고객님께서는 개인정보 제공 동의를 거부하실 수 있으나, 동의하지
                않으실 경우 상품 배송이 불가능합니다.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setShowShippingPolicyModal(false)}
              className="bg-[#ff6b9d] hover:bg-[#ff5a8d] text-white"
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
