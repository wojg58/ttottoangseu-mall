/**
 * @file app/checkout/page.tsx
 * @description 주문/결제 페이지
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import { getCartItems } from "@/actions/cart";
import CheckoutForm from "@/components/checkout-form";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/checkout");
  }

  console.group("🛒 [CheckoutPage] 체크아웃 페이지 렌더링 시작");
  console.log("[CheckoutPage] 1단계: 페이지 렌더링 시작");
  console.log("상태:", {
    userId: userId || null,
    hasUserId: !!userId,
    timestamp: new Date().toISOString(),
  });

  const params = await searchParams;
  const orderId = params.orderId;
  console.log("[CheckoutPage] 2단계: searchParams 확인");
  console.log("orderId:", orderId || "없음");

  // 장바구니 조회 (PGRST301 에러 처리 포함)
  console.log("[CheckoutPage] 3단계: getCartItems() 첫 번째 호출");
  let cartItems = await getCartItems();
  console.log("[CheckoutPage] 첫 번째 조회 결과:", {
    itemsCount: cartItems.length,
    items: cartItems.map((item) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
    })),
  });

  // 바로 구매하기로 온 경우, 장바구니가 비어있을 수 있으므로 잠시 대기 후 재시도
  if (!orderId && cartItems.length === 0) {
    console.log("[CheckoutPage] 4단계: 장바구니 비어있음 - 500ms 대기 후 재시도");
    // revalidatePath 후 데이터 반영을 위해 잠시 대기
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("[CheckoutPage] 5단계: getCartItems() 두 번째 호출");
    cartItems = await getCartItems();
    console.log("[CheckoutPage] 두 번째 조회 결과:", {
      itemsCount: cartItems.length,
      items: cartItems.map((item) => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity,
      })),
    });
  }

  // 주문이 생성된 상태(orderId가 있는 경우)가 아니고 장바구니가 비어있으면 장바구니 페이지로
  // 주문이 생성된 후에는 장바구니가 비워지므로, orderId가 있으면 체크를 건너뜀
  console.log("[CheckoutPage] 6단계: 리다이렉트 조건 확인");
  console.log("조건:", {
    hasOrderId: !!orderId,
    cartItemsLength: cartItems.length,
    shouldRedirect: !orderId && cartItems.length === 0,
  });

  if (!orderId && cartItems.length === 0) {
    console.error("[CheckoutPage] ❌ 7단계: 장바구니 비어있음 - /cart로 리다이렉트");
    console.error("리다이렉트 이유:", {
      orderId: orderId || "없음",
      cartItemsCount: cartItems.length,
      timestamp: new Date().toISOString(),
    });
    console.groupEnd();
    redirect("/cart");
  }

  console.log("[CheckoutPage] ✅ 7단계: 체크아웃 페이지 표시");
  console.log("최종 상태:", {
    orderId: orderId || "없음",
    cartItemsCount: cartItems.length,
    willShowCheckout: true,
    cartItems: cartItems.map((item) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      price: item.price,
    })),
  });

  // 금액 계산
  console.log("[CheckoutPage] 8단계: 금액 계산");
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shippingFee = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shippingFee;

  console.log("[CheckoutPage] 금액 계산 결과:", {
    subtotal,
    shippingFee,
    total,
  });
  console.log("[CheckoutPage] ✅ 9단계: 체크아웃 페이지 렌더링 완료");
  console.groupEnd();

  return (
    <main className="py-8">
      <div className="shop-container">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-[#8b7d84] mb-6">
          <Link
            href="/"
            className="hover:text-[#ff6b9d] flex items-center gap-1"
          >
            <Home className="w-4 h-4" />홈
          </Link>
          <span>/</span>
          <Link href="/cart" className="hover:text-[#ff6b9d]">
            장바구니
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">주문/결제</span>
        </nav>

        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">주문/결제</h1>

        <CheckoutForm
          cartItems={cartItems}
          subtotal={subtotal}
          shippingFee={shippingFee}
          total={total}
        />
      </div>
    </main>
  );
}
