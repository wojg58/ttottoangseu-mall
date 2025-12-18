/**
 * @file lib/utils/download-calendar.ts
 * @description 캘린더 배경화면 다운로드 유틸리티
 *
 * 주요 기능:
 * 1. JPG 이미지 파일을 fetch로 가져오기
 * 2. Blob으로 변환하여 다운로드 링크 생성
 * 3. 새 페이지(새 탭)에서 다운로드 링크 열기
 *
 * @dependencies
 * - 브라우저 API (fetch, Blob, URL)
 */

/**
 * 이미지 파일을 다운로드합니다.
 * @param imageUrl - 다운로드할 이미지의 URL 경로
 * @param fileName - 다운로드될 파일명
 */
export async function downloadCalendarImage(
  imageUrl: string,
  fileName: string,
): Promise<void> {
  console.group("[downloadCalendarImage] 이미지 다운로드 시작");
  console.log("이미지 URL:", imageUrl);
  console.log("파일명:", fileName);

  try {
    // 이미지 fetch
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `이미지 다운로드 실패: ${response.status} ${response.statusText}`,
      );
    }

    // Blob으로 변환
    const blob = await response.blob();
    console.log("Blob 생성 완료, 크기:", blob.size, "bytes");

    // Blob URL 생성
    const blobUrl = URL.createObjectURL(blob);

    // 새 창에서 다운로드 링크 열기
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.target = "_blank"; // 새 탭에서 열기
    link.rel = "noopener noreferrer"; // 보안을 위한 속성

    // DOM에 추가하고 클릭
    document.body.appendChild(link);
    link.click();

    // DOM에서 제거
    document.body.removeChild(link);

    // 메모리 정리 (약간의 지연 후)
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      console.log("Blob URL 정리 완료");
    }, 100);

    console.log("✅ 이미지 다운로드 성공");
    console.groupEnd();
  } catch (error) {
    console.error("❌ 이미지 다운로드 실패:", error);
    console.groupEnd();
    throw error;
  }
}

/**
 * PC용 캘린더 이미지 다운로드
 */
export async function downloadPCCalendar(): Promise<void> {
  await downloadCalendarImage(
    "/image/calendar_pc_jp.jpg",
    "calendar_pc_jp.jpg",
  );
}

/**
 * 모바일용 캘린더 이미지 다운로드
 */
export async function downloadMobileCalendar(): Promise<void> {
  await downloadCalendarImage(
    "/image/calendar_mobile_jp.jpg",
    "calendar_mobile_jp.jpg",
  );
}

/**
 * 캐릭터 이미지 다운로드 (달력 없는 이미지)
 */
export async function downloadCharacterImage(): Promise<void> {
  await downloadCalendarImage("/image/character.png", "character.png");
}

