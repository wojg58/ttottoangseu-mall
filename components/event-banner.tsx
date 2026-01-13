/**
 * @file components/event-banner.tsx
 * @description 이벤트 배너 컴포넌트 (자동 슬라이드)
 *
 * 주요 기능:
 * 1. 리뷰 이벤트 배너 (1,000P 적립)
 * 2. 신규가입 쿠폰 배너 (1,000원 할인)
 * 3. 자동 슬라이드 애니메이션 (왼쪽 → 오른쪽)
 * 4. 무한 루프
 * 5. 호버 시 일시 정지
 *
 * @dependencies
 * - event-banner.css: 배너 스타일 및 슬라이드 애니메이션
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./event-banner.css";

export default function EventBanner() {
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState<string | null>(null);

  // 카카오톡 채널 URL 가져오기
  useEffect(() => {
    const channelUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL;
    const channelId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID;

    if (channelUrl) {
      setKakaoChannelUrl(channelUrl);
    } else if (channelId) {
      if (channelId.startsWith("http")) {
        setKakaoChannelUrl(channelId);
      } else {
        setKakaoChannelUrl(`https://pf.kakao.com/_${channelId}`);
      }
    }
  }, []);

  // 배너 카드 컴포넌트
  const ReviewBanner = () => (
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
  );

  const SignupBanner = () => (
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
  );

  const KakaoBanner = () => {
    if (!kakaoChannelUrl) return null;

    return (
      <a
        href={kakaoChannelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="event-banner-link"
      >
        <div className="event-banner yellow">
          <div className="text">
            <h3>카카오톡 친구추가 혜택</h3>
            <p>
              친구추가 시 <strong>1,000원</strong> 쿠폰 즉시 증정!
            </p>
          </div>
          <div className="coupon">
            <span>쿠폰</span>
            <strong>1,000원</strong>
          </div>
        </div>
      </a>
    );
  };

  return (
    <section className="event-wrapper">
      <div className="event-slide-container">
        <div className="event-slide-track">
          {/* 첫 번째 세트 (원본) */}
          <ReviewBanner />
          <SignupBanner />
          <KakaoBanner />
          {/* 두 번째 세트 (무한 루프용 복제) */}
          <ReviewBanner />
          <SignupBanner />
          <KakaoBanner />
        </div>
      </div>
    </section>
  );
}

