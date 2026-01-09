/**
 * @file app/mypage/page.tsx
 * @description 마이페이지
 */

import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  User,
  Package,
  Heart,
  Settings,
  ChevronRight,
  Home,
} from "lucide-react";
import { getOrders } from "@/actions/orders";
import { getMemberAdditionalInfo } from "@/actions/member-actions";
import DateDisplay from "@/components/date-display";
import NumberDisplay from "@/components/number-display";

export default async function MyPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/mypage");
  }

  const user = await currentUser();
  const orders = await getOrders();
  const memberInfoResult = await getMemberAdditionalInfo();

  // 최근 주문 3개만
  const recentOrders = orders.slice(0, 3);

  // 회원 추가 정보
  const memberInfo = memberInfoResult.success ? memberInfoResult.data : null;

  // 성별 표시 텍스트
  const genderText = memberInfo?.gender === "M" ? "남자" : memberInfo?.gender === "F" ? "여자" : "-";

  // 생년월일 포맷팅 (YYYY-MM-DD -> YYYY년 MM월 DD일)
  let birthDateText = "-";
  if (memberInfo?.birth_date) {
    try {
      const [year, month, day] = memberInfo.birth_date.split("-");
      birthDateText = `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
      if (memberInfo.is_solar_calendar === false) {
        birthDateText += " (음력)";
      }
    } catch (error) {
      birthDateText = memberInfo.birth_date;
    }
  }

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
          <span className="text-[#4a3f48]">마이페이지</span>
        </nav>

        {/* 사용자 정보 */}
        <div className="bg-gradient-to-r from-[#ffeef5] to-[#fad2e6] rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.firstName || "사용자"}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-[#ff6b9d]" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-[#4a3f48] mb-3">
                {user?.firstName || "회원"}님 안녕하세요! 👋
              </h1>
              <div className="space-y-1.5 text-sm text-[#8b7d84]">
                <p>
                  <span className="font-medium text-[#4a3f48]">회원이름:</span>{" "}
                  {user?.firstName || "-"}
                </p>
                <p>
                  <span className="font-medium text-[#4a3f48]">이메일주소:</span>{" "}
                  {user?.emailAddresses[0]?.emailAddress || "-"}
                </p>
                <p>
                  <span className="font-medium text-[#4a3f48]">성별:</span> {genderText}
                </p>
                <p>
                  <span className="font-medium text-[#4a3f48]">생년월일:</span>{" "}
                  {birthDateText}
                </p>
                <p>
                  <span className="font-medium text-[#4a3f48]">휴대전화번호:</span>{" "}
                  {memberInfo?.mobile || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 메뉴 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-[#4a3f48] mb-4">메뉴</h2>
              <nav className="space-y-1">
                <Link
                  href="/mypage/orders"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffeef5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-[#ff6b9d]" />
                    <span className="text-[#4a3f48]">주문 내역</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b7d84]" />
                </Link>
                <Link
                  href="/wishlist"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffeef5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-[#ff6b9d]" />
                    <span className="text-[#4a3f48]">찜 목록</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b7d84]" />
                </Link>
                <Link
                  href="/mypage/settings"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffeef5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-[#ff6b9d]" />
                    <span className="text-[#4a3f48]">설정</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b7d84]" />
                </Link>
              </nav>
            </div>
          </div>

          {/* 최근 주문 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#4a3f48]">최근 주문</h2>
                <Link
                  href="/mypage/orders"
                  className="text-sm text-[#ff6b9d] hover:underline"
                >
                  전체 보기
                </Link>
              </div>

              {recentOrders.length > 0 ? (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/mypage/orders/${order.id}`}
                      className="block p-4 bg-[#ffeef5] rounded-lg hover:bg-[#fad2e6]/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#4a3f48]">
                          {order.order_number}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            order.status === "delivered"
                              ? "bg-green-100 text-green-600"
                              : order.status === "shipped"
                              ? "bg-blue-100 text-blue-600"
                              : order.status === "cancelled"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-[#fad2e6] text-[#ff6b9d]"
                          }`}
                        >
                          {order.status === "pending" && "결제 대기"}
                          {order.status === "confirmed" && "결제 완료"}
                          {order.status === "preparing" && "상품 준비중"}
                          {order.status === "shipped" && "배송중"}
                          {order.status === "delivered" && "배송 완료"}
                          {order.status === "cancelled" && "주문 취소"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <DateDisplay
                          date={order.created_at}
                          format="date"
                          className="text-[#8b7d84]"
                        />
                        <NumberDisplay
                          value={order.total_amount}
                          suffix="원"
                          className="font-bold text-[#4a3f48]"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-[#fad2e6] mb-4" />
                  <p className="text-[#8b7d84]">주문 내역이 없습니다.</p>
                  <Link
                    href="/products"
                    className="text-[#ff6b9d] hover:underline text-sm mt-2 inline-block"
                  >
                    쇼핑하러 가기
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
