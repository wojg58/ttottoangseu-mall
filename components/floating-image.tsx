/**
 * @file components/floating-image.tsx
 * @description 둥둥 떠다니는 애니메이션이 적용된 이미지 컴포넌트 (hydration 오류 방지)
 * 
 * 서버와 클라이언트에서 CSS 애니메이션이 다르게 렌더링될 수 있어 hydration 오류가 발생할 수 있습니다.
 * 이 컴포넌트는 클라이언트에서만 애니메이션을 적용하여 문제를 해결합니다.
 */

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FloatingImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
}

export default function FloatingImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  quality,
  sizes,
}: FloatingImageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative w-full">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${mounted ? "floating-animation" : ""}`}
        priority={priority}
        quality={quality}
        sizes={sizes}
      />
    </div>
  );
}

