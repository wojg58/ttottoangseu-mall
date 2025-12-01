import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Clerk 사용자를 Supabase users 테이블에 동기화하는 API
 *
 * 클라이언트에서 로그인 후 이 API를 호출하여 사용자 정보를 Supabase에 저장합니다.
 * 이미 존재하는 경우 업데이트하고, 없으면 새로 생성합니다.
 */
export async function POST() {
  try {
    console.group("🔐 API: 사용자 동기화 요청");
    
    // Clerk 인증 확인
    const authResult = await auth();
    const { userId } = authResult;
    
    console.log("auth() 결과:", { userId, hasAuth: !!authResult });

    if (!userId) {
      console.error("❌ 인증 실패: userId가 없습니다");
      console.groupEnd();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("✅ 인증 확인됨, userId:", userId);

    // Clerk에서 사용자 정보 가져오기
    console.log("📥 Clerk에서 사용자 정보 가져오는 중...");
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    if (!clerkUser) {
      console.error("❌ Clerk 사용자를 찾을 수 없습니다");
      console.groupEnd();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    console.log("✅ Clerk 사용자 정보:", {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username,
      email: clerkUser.emailAddresses[0]?.emailAddress,
    });

    // Supabase에 사용자 정보 동기화
    console.log("💾 Supabase에 사용자 정보 동기화 중...");
    const supabase = getServiceRoleClient();

    const userData = {
      clerk_user_id: clerkUser.id,
      name:
        clerkUser.fullName ||
        clerkUser.username ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "Unknown",
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      role: "customer",
    };
    
    console.log("저장할 데이터:", userData);

    const { data, error } = await supabase
      .from("users")
      .upsert(userData, {
        onConflict: "clerk_user_id",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase 동기화 에러:", error);
      console.groupEnd();
      return NextResponse.json(
        { error: "Failed to sync user", details: error.message },
        { status: 500 }
      );
    }

    console.log("✅ Supabase 동기화 완료:", data);
    console.groupEnd();
    
    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (error) {
    console.error("❌ 동기화 중 예외 발생:", error);
    console.groupEnd();
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
