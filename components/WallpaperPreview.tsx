/**
 * @file components/WallpaperPreview.tsx
 * @description 배경화면 미리보기 컴포넌트 (스마트폰 목업)
 *
 * 주요 기능:
 * 1. 스마트폰 목업 형태로 배경화면 미리보기
 * 2. 블러 배경 효과
 * 3. 모바일/PC용 다운로드 버튼
 *
 * @dependencies
 * - CSS: app/globals.css의 .wp 클래스들
 * - next/image: 이미지 최적화
 */

import Link from "next/link";
import Image from "next/image";

type Props = {
  src: string; // 배경화면 이미지 URL (모바일용 - 폰 화면에 표시)
  bgSrc?: string; // 바탕 배경 이미지 URL (블러 배경용, 선택)
  title?: string; // 제목 (기본: "배경화면")
  description?: string; // 설명 (기본: "스마트폰/PC에 저장해서 예쁘게 써보세요 💗")
};

export default function WallpaperPreview({
  src,
  bgSrc,
  title = "배경화면",
  description = "스마트폰/PC에 저장해서 예쁘게 써보세요 💗",
}: Props) {
  // bgSrc가 없으면 src를 사용
  const backgroundImage = bgSrc || src;

  return (
    <section className="wp">
      {/* 블러 배경 */}
      <div className="wp__bg relative overflow-hidden">
        <Image
          src={backgroundImage}
          alt="배경화면 배경"
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>

      {/* 콘텐츠 */}
      <div className="wp__inner">
        <div className="wp__phone">
          {/* 폰 화면(배경화면) */}
          <div className="wp__screen relative overflow-hidden">
            <Image
              src={src}
              alt="배경화면 미리보기"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 400px"
              priority
            />
          </div>

          {/* 노치 */}
          <div className="wp__notch" />
        </div>

        <div className="wp__actions">
          <h2 className="wp__title">{title}</h2>
          <p className="wp__desc">{description}</p>

          <div className="wp__btns">
            <Link href="/wallpaper" className="wp__btn">
              배경화면 다운로드
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

