/**
 * @file scripts/list-storage-images.ts
 * @description Supabase Storage product-images 버킷의 파일 목록 조회 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/list-storage-images.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 환경 변수 로드
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { getServiceRoleClient } from "@/lib/supabase/service-role";

async function listStorageImages() {
  console.log("=".repeat(60));
  console.log("Supabase Storage product-images 버킷 파일 목록 조회");
  console.log("=".repeat(60));

  const supabase = getServiceRoleClient();

  try {
    // product-images 버킷의 모든 파일 목록 조회
    const { data: files, error } = await supabase.storage
      .from("product-images")
      .list("", {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      throw new Error(`파일 목록 조회 실패: ${error.message}`);
    }

    console.log(`\n총 파일 개수: ${files?.length || 0}개\n`);

    if (files && files.length > 0) {
      console.log("파일 목록:");
      console.log("-".repeat(60));
      files.forEach((file, index) => {
        const sizeKB = file.metadata?.size ? (file.metadata.size / 1024).toFixed(2) : "알 수 없음";
        const updatedAt = file.updated_at ? new Date(file.updated_at).toLocaleString("ko-KR") : "알 수 없음";
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   크기: ${sizeKB} KB`);
        console.log(`   수정일: ${updatedAt}`);
        console.log(`   타입: ${file.metadata?.mimetype || "알 수 없음"}`);
        console.log("");
      });
    } else {
      console.log("파일이 없습니다.");
    }

    // 하위 폴더도 확인 (재귀적으로)
    if (files) {
      const folders = files.filter((f) => !f.name.includes("."));
      if (folders.length > 0) {
        console.log("\n폴더 발견:", folders.length, "개");
        for (const folder of folders) {
          console.log(`\n폴더: ${folder.name}`);
          const { data: folderFiles, error: folderError } = await supabase.storage
            .from("product-images")
            .list(folder.name, {
              limit: 1000,
              offset: 0,
              sortBy: { column: "name", order: "asc" },
            });

          if (folderError) {
            console.log(`  ⚠ 폴더 조회 실패: ${folderError.message}`);
          } else {
            console.log(`  파일 개수: ${folderFiles?.length || 0}개`);
            if (folderFiles && folderFiles.length > 0) {
              folderFiles.forEach((file, index) => {
                const sizeKB = file.metadata?.size ? (file.metadata.size / 1024).toFixed(2) : "알 수 없음";
                console.log(`  ${index + 1}. ${file.name} (${sizeKB} KB)`);
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("\n✗ 오류 발생:", error);
    if (error instanceof Error) {
      console.error("메시지:", error.message);
      console.error("스택:", error.stack);
    }
    process.exit(1);
  }
}

// 스크립트 실행
listStorageImages()
  .then(() => {
    console.log("\n✓ 스크립트 실행 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ 스크립트 실행 실패:", error);
    process.exit(1);
  });

