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
import { logger } from "@/lib/logger";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; buyNow?: string }>;
}) {
  try {
    const { userId } = await auth();

    if (!userId) {
      redirect("/sign-in?redirect_url=/checkout");
    }

    const params = await searchParams;
    const orderId = params.orderId;
    const buyNow = params.buyNow === "true";

    // 장바구니 조회 (PGRST301 에러 처리 포함)
    let cartItems: Awaited<ReturnType<typeof getCartItems>> = [];
    
    try {
      cartItems = await getCartItems();
    } catch (error) {
      logger.error("[CheckoutPage] getCartItems() 호출 실패", error);
      // 에러 발생 시 빈 배열로 처리하고 계속 진행
      cartItems = [];
    }

    // 바로 구매하기로 온 경우, 장바구니가 비어있을 수 있으므로 더 긴 대기 후 재시도
    if (!orderId && cartItems.length === 0) {
      // 바로구매인 경우 더 긴 대기 시간 (DB 반영 시간 확보)
      const waitTime = buyNow ? 1500 : 500;
      const maxRetries = buyNow ? 3 : 1;
      
      for (let retry = 1; retry <= maxRetries; retry++) {
        // revalidatePath 후 데이터 반영을 위해 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        try {
          cartItems = await getCartItems();
          
          // 장바구니에 아이템이 있으면 재시도 중단
          if (cartItems.length > 0) {
            break;
          }
        } catch (error) {
          logger.error(`[CheckoutPage] getCartItems() 재시도 ${retry} 실패`, error);
          // 에러 발생 시 빈 배열로 처리하고 계속 진행
          cartItems = [];
        }
      }
    }

  // 주문이 생성된 상태(orderId가 있는 경우)가 아니고 장바구니가 비어있으면 장바구니 페이지로
  // 주문이 생성된 후에는 장바구니가 비워지므로, orderId가 있으면 체크를 건너뜀
  if (!orderId && cartItems.length === 0) {
    logger.warn("[CheckoutPage] 장바구니 비어있음 - /cart로 리다이렉트", {
      orderId: orderId || null,
      cartItemsCount: cartItems.length,
    });
    redirect("/cart");
  }

  // 금액 계산
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shippingFee = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shippingFee;

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
  } catch (error) {
    logger.error("[CheckoutPage] Server Component 렌더링 에러", error);

    // redirect() 에러인 경우 다시 throw (Next.js가 처리)
    if (
      error &&
      typeof error === "object" &&
      ("digest" in error || "message" in error)
    ) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorDigest = (error as any)?.digest;

      if (
        errorMessage === "NEXT_REDIRECT" ||
        errorMessage?.includes("NEXT_REDIRECT") ||
        errorDigest?.includes("NEXT_REDIRECT")
      ) {
        // redirect 에러는 다시 throw (Next.js가 처리)
        throw error;
      }
    }

    // 다른 에러는 장바구니로 리다이렉트
    redirect("/cart");
  }
}
