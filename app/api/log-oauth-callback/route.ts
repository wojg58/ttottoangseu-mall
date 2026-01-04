import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * OAuth 콜백 결과를 서버에 로깅하는 API
 * 
 * 클라이언트에서 OAuth 콜백 후 세션 상태를 서버에 전송하여 로그로 남깁니다.
 * 이 로그는 서버 터미널에서 확인할 수 있습니다.
 */
export async function POST(request: Request) {
  // 즉시 로그 출력 (요청 도달 확인)
  console.log("🔔 [OAuth 콜백 로그] API 요청 수신됨");
  console.log("시간:", new Date().toISOString());
  
  try {
    const body = await request.json();
    console.log("📥 요청 본문 파싱 완료");
    const {
      timestamp,
      url,
      isSignedIn,
      userId,
      sessionId,
      userLoaded,
      hasUser,
      userInfo,
      externalAccounts,
      clerkStatus,
      clerkRedirectUrl,
      hasToken,
      tokenLength,
      verificationResult,
    } = body;

    // 서버 콘솔에 상세 로그 출력
    console.group("🔐 [OAuth 콜백 로그] 네이버 로그인 결과");
    console.log("시간:", timestamp || new Date().toISOString());
    console.log("URL:", url);
    console.log("--- 세션 상태 ---");
    console.log("isSignedIn:", isSignedIn);
    console.log("userId:", userId || "없음");
    console.log("sessionId:", sessionId || "없음");
    console.log("userLoaded:", userLoaded);
    console.log("hasUser:", hasUser);
    console.log("hasToken:", hasToken);
    if (tokenLength) {
      console.log("tokenLength:", tokenLength);
    }
    
    if (userInfo) {
      console.log("--- 사용자 정보 ---");
      console.log("ID:", userInfo.id || "없음");
      console.log("Email:", userInfo.email || "없음");
      console.log("Name:", userInfo.name || "없음");
      console.log("External Accounts 개수:", userInfo.externalAccounts || 0);
      if (userInfo.externalAccountDetails) {
        console.log("External Account 상세:", JSON.stringify(userInfo.externalAccountDetails, null, 2));
      }
    }
    
    if (externalAccounts) {
      console.log("--- External Accounts ---");
      console.log("개수:", externalAccounts.length || 0);
      externalAccounts.forEach((acc: any, index: number) => {
        console.log(`  [${index + 1}] Provider: ${acc.provider}, UserId: ${acc.providerUserId}, Verified: ${acc.verified}`);
      });
    }
    
    if (clerkStatus) {
      console.log("--- Clerk 파라미터 ---");
      console.log("__clerk_status:", clerkStatus);
      console.log("__clerk_redirect_url:", clerkRedirectUrl || "없음");
    }
    
    if (verificationResult) {
      console.log("--- 검증 결과 ---");
      console.log("성공:", verificationResult.success ? "✅" : "❌");
      if (verificationResult.error) {
        console.error("에러:", verificationResult.error);
      }
      if (verificationResult.warnings) {
        verificationResult.warnings.forEach((warning: string) => {
          console.warn("경고:", warning);
        });
      }
    }
    
    // 검증 판정
    if (!isSignedIn || !userId || !sessionId) {
      console.error("❌ [검증 실패] 세션이 생성되지 않았습니다!");
      console.error("   → 가능한 원인:");
      console.error("      1. Clerk Dashboard의 Attribute Mapping 설정 문제");
      console.error("      2. Proxy 서버 응답의 sub/email 값 문제");
      console.error("      3. 네이버에서 제공한 사용자 정보 부족");
    } else if (hasUser && (!externalAccounts || externalAccounts.length === 0)) {
      console.error("❌ [중요] 세션은 생성되었지만 External Account가 연결되지 않았습니다!");
      console.error("   → 'The External Account was not found' 에러의 원인입니다.");
      console.error("   → Proxy 서버 응답의 sub 값이 Clerk가 기대하는 형식과 일치하지 않을 수 있습니다.");
    } else {
      console.log("✅ [검증 성공] 세션과 External Account가 모두 정상입니다!");
    }
    
    console.groupEnd();

    return NextResponse.json({ 
      success: true,
      message: "로그가 서버에 저장되었습니다. 터미널을 확인하세요." 
    });
  } catch (error) {
    console.error("❌ [OAuth 콜백 로그] 로그 저장 실패:", error);
    return NextResponse.json(
      { error: "로그 저장 실패", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

