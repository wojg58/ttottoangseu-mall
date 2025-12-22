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

  console.log("[CheckoutPage] 렌더링");

  const params = await searchParams;
  const orderId = params.orderId;

  const cartItems = await getCartItems();

  // 주문이 생성된 상태(orderId가 있는 경우)가 아니고 장바구니가 비어있으면 장바구니 페이지로
  // 주문이 생성된 후에는 장바구니가 비워지므로, orderId가 있으면 체크를 건너뜀
  if (!orderId && cartItems.length === 0) {
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
}
