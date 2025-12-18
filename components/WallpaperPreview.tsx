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
 */

import Link from "next/link";

type Props = {
  src: string; // 배경화면 이미지 URL (모바일용)
  pcSrc?: string; // PC용 배경화면 이미지 URL (선택)
  alt?: string;
  title?: string; // 제목 (기본: "배경화면")
  description?: string; // 설명 (기본: "스마트폰에 저장해서 예쁘게 써보세요 💗")
};

export default function WallpaperPreview({
  src,
  pcSrc,
  alt = "wallpaper",
  title = "배경화면",
  description = "스마트폰에 저장해서 예쁘게 써보세요 💗",
}: Props) {
  return (
    <section className="wp">
      {/* 블러 배경 */}
      <div className="wp__bg" style={{ backgroundImage: `url(${src})` }} />

      {/* 콘텐츠 */}
      <div className="wp__inner">
        <div className="wp__phone">
          {/* 폰 화면(배경화면) */}
          <div
            className="wp__screen"
            style={{ backgroundImage: `url(${src})` }}
          />

          {/* 노치 */}
          <div className="wp__notch" />
        </div>

        <div className="wp__actions">
          <h2 className="wp__title">{title}</h2>
          <p className="wp__desc">{description}</p>

          <div className="wp__btns">
            <a className="wp__btn" href={src} download>
              모바일용 다운로드
            </a>
            {/* PC용 파일이 따로 있으면 pcSrc로 바꿔서 추가 */}
            {pcSrc && (
              <a className="wp__btn wp__btn--ghost" href={pcSrc} download>
                PC용 다운로드
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

