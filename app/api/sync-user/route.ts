import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Clerk 사용자를 Supabase users 테이블에 동기화하는 API
 *
 * 클라이언트에서 로그인 후 이 API를 호출하여 사용자 정보를 Supabase에 저장합니다.
 * 이미 존재하는 경우 업데이트하고, 없으면 새로 생성합니다.
 */
export async function POST(request: Request) {
  try {
    console.group("🔐 API: 사용자 동기화 요청");

    // Clerk 인증 확인
    const authResult = await auth();
    let userId = authResult?.userId;

    console.log("auth() 결과:", { userId, hasAuth: !!authResult });

    // auth()로 userId를 못 가져온 경우, Authorization 헤더에서 토큰 확인
    if (!userId) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        console.log("Authorization 헤더에서 토큰 발견, 재시도...");
        // 토큰이 있으면 auth()를 다시 시도 (미들웨어가 처리했을 수 있음)
        const retryAuth = await auth();
        userId = retryAuth?.userId;
        console.log("재시도 결과:", { userId });
      }
    }

    if (!userId) {
      console.error("❌ 인증 실패: userId가 없습니다");
      console.log("요청 헤더:", Object.fromEntries(request.headers.entries()));
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
      emailAddresses: clerkUser.emailAddresses,
      externalAccounts: clerkUser.externalAccounts,
      createdAt: clerkUser.createdAt,
    });
    
    // External Accounts 상세 로그
    if (clerkUser.externalAccounts && clerkUser.externalAccounts.length > 0) {
      console.log("🔗 External Accounts:", clerkUser.externalAccounts.map(acc => ({
        provider: acc.provider,
        providerUserId: acc.providerUserId,
        emailAddress: acc.emailAddress,
        verified: acc.verification?.status,
      })));
    } else {
      console.warn("⚠️ External Accounts가 없습니다. 네이버 로그인이 제대로 연결되지 않았을 수 있습니다.");
    }

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

    // 먼저 clerk_user_id로 기존 사용자 조회 (삭제되지 않은 사용자만)
    console.log("🔍 clerk_user_id로 사용자 조회 중...");
    const { data: existingUserByClerkId, error: fetchErrorByClerkId } =
      await supabase
        .from("users")
        .select("*")
        .eq("clerk_user_id", clerkUser.id)
        .is("deleted_at", null)
        .maybeSingle();

    if (fetchErrorByClerkId) {
      console.error("❌ 사용자 조회 에러:", fetchErrorByClerkId);
      console.groupEnd();
      return NextResponse.json(
        {
          error: "Failed to fetch user",
          details: fetchErrorByClerkId.message,
        },
        { status: 500 },
      );
    }

    let existingUser = existingUserByClerkId;

    // clerk_user_id로 찾지 못했고, 이메일이 있는 경우 이메일로도 조회
    if (!existingUser && userData.email) {
      console.log("🔍 이메일로 사용자 조회 중...");
      const { data: existingUserByEmail, error: fetchErrorByEmail } =
        await supabase
          .from("users")
          .select("*")
          .eq("email", userData.email)
          .is("deleted_at", null)
          .maybeSingle();

      if (fetchErrorByEmail) {
        console.error("❌ 이메일로 사용자 조회 에러:", fetchErrorByEmail);
        // 이메일 조회 실패는 치명적이지 않으므로 계속 진행
      } else if (existingUserByEmail) {
        console.log(
          "⚠️ 같은 이메일을 가진 사용자 발견, clerk_user_id 연결 중...",
        );
        existingUser = existingUserByEmail;
      }
    }

    let result;
    if (existingUser) {
      // 기존 사용자 업데이트
      console.log("기존 사용자 발견, 업데이트 중...");
      const updateData: {
        name: string;
        email: string;
        role: string;
        clerk_user_id?: string;
      } = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
      };

      // clerk_user_id가 없거나 다른 경우 업데이트
      if (existingUser.clerk_user_id !== clerkUser.id) {
        console.log(
          `clerk_user_id 업데이트: ${existingUser.clerk_user_id} → ${clerkUser.id}`,
        );
        updateData.clerk_user_id = clerkUser.id;
      }

      const { data, error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error("❌ 사용자 업데이트 에러:", updateError);
        console.groupEnd();
        return NextResponse.json(
          { error: "Failed to update user", details: updateError.message },
          { status: 500 },
        );
      }
      result = data;
    } else {
      // 새 사용자 생성
      console.log("새 사용자 생성 중...");
      const { data, error: insertError } = await supabase
        .from("users")
        .insert(userData)
        .select()
        .single();

      if (insertError) {
        console.error("❌ 사용자 생성 에러:", insertError);
        console.groupEnd();
        return NextResponse.json(
          { error: "Failed to create user", details: insertError.message },
          { status: 500 },
        );
      }
      result = data;

      // 신규 가입 시 1,000원 쿠폰 발급
      console.log("🎁 신규 가입 쿠폰 발급 중...");
      const couponCode = `WELCOME-${result.id.toString().substring(0, 8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

      const { error: couponError } = await supabase.from("coupons").insert({
        user_id: result.id,
        code: couponCode,
        name: "신규가입 환영 쿠폰",
        discount_type: "fixed",
        discount_amount: 1000,
        min_order_amount: 0,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });

      if (couponError) {
        console.error("❌ 쿠폰 발급 에러:", couponError);
        // 쿠폰 발급 실패해도 사용자 생성은 성공한 것으로 처리
      } else {
        console.log("✅ 쿠폰 발급 완료:", couponCode);
      }
    }

    console.log("✅ Supabase 동기화 완료:", result);
    console.groupEnd();

    return NextResponse.json({
      success: true,
      user: result,
    });
  } catch (error) {
    console.error("❌ 동기화 중 예외 발생:", error);
    console.groupEnd();
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
