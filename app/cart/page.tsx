/**
 * @file app/cart/page.tsx
 * @description 장바구니 페이지
 */

import Link from "next/link";
import { Home, ShoppingBag } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCartItems } from "@/actions/cart";
import CartItemList from "@/components/cart-item-list";
import CartSummary from "@/components/cart-summary";

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default async function CartPage() {
  const { userId } = await auth();

  // 비로그인 시 로그인 페이지로 리다이렉트
  if (!userId) {
    redirect("/sign-in?redirect_url=/cart");
  }

  const cartItems = await getCartItems();

  // 총 금액 계산
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shippingFee = subtotal >= 50000 ? 0 : 3000; // 5만원 이상 무료배송
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
          <span className="text-[#4a3f48]">장바구니</span>
        </nav>

        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">장바구니</h1>

        {cartItems.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 장바구니 아이템 목록 */}
            <div className="lg:col-span-2">
              <CartItemList items={cartItems} />
            </div>

            {/* 주문 요약 */}
            <div className="lg:col-span-1">
              <CartSummary
                subtotal={subtotal}
                shippingFee={shippingFee}
                total={total}
                itemCount={cartItems.length}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-[#ffeef5] rounded-xl">
            <ShoppingBag className="w-16 h-16 mx-auto text-[#fad2e6] mb-4" />
            <h2 className="text-lg font-bold text-[#4a3f48] mb-2">
              장바구니가 비어있습니다
            </h2>
            <p className="text-[#8b7d84] mb-6">
              마음에 드는 상품을 장바구니에 담아보세요!
            </p>
            <Link href="/products" className="shop-btn-accent inline-block">
              쇼핑하러 가기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
