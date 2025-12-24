/**
 * @file components/event-banner.tsx
 * @description 이벤트 배너 컴포넌트
 *
 * 주요 기능:
 * 1. 리뷰 이벤트 배너 (1,000P 적립)
 * 2. 신규가입 쿠폰 배너 (1,000원 할인)
 *
 * @dependencies
 * - event-banner.css: 배너 스타일
 */

import Link from "next/link";
import "./event-banner.css";

export default function EventBanner() {
  console.log("[EventBanner] 이벤트 배너 렌더링");

  return (
    <section className="event-wrapper">
      {/* 리뷰 이벤트 */}
      <Link href="/events/review" className="event-banner-link">
        <div className="event-banner pink">
          <div className="text">
            <h3>또또앙스 스토어 리뷰 이벤트</h3>
            <p>
              상품구매 후기 작성 시 <strong>1,000p</strong> 적립!
            </p>
          </div>
          <div className="coupon">
            <span>적립</span>
            <strong>1,000P</strong>
          </div>
        </div>
      </Link>

      {/* 신규가입 쿠폰 */}
      <Link href="/sign-up/join" className="event-banner-link">
        <div className="event-banner blue">
          <div className="text">
            <h3>신규가입 시 1천원 쿠폰 증정</h3>
            <p>
              신규가입하고 <strong>1,000원</strong> 할인받자!
            </p>
          </div>
          <div className="coupon">
            <span>할인</span>
            <strong>1,000원</strong>
          </div>
        </div>
      </Link>
    </section>
  );
}

