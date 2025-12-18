/**
 * @file actions/coupons.ts
 * @description 쿠폰 관련 Server Actions
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// 현재 사용자의 Supabase user ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    console.log("[getCurrentUserId] Clerk 인증 없음");
    return null;
  }

  const supabase = await createClient();
  let { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  // 사용자가 없으면 동기화 시도
  if (!user && !error) {
    console.log("[getCurrentUserId] 사용자 없음, 동기화 시도:", clerkUserId);
    try {
      // 동기화 로직 직접 실행
      const { clerkClient } = await import("@clerk/nextjs/server");
      const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
      
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      
      if (clerkUser) {
        const serviceSupabase = getServiceRoleClient();
        const userData = {
          clerk_user_id: clerkUser.id,
          name: clerkUser.fullName || clerkUser.username || clerkUser.emailAddresses[0]?.emailAddress || "Unknown",
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          role: "customer",
        };

        const { data: newUser, error: insertError } = await serviceSupabase
          .from("users")
          .insert(userData)
          .select("id")
          .single();

        if (!insertError && newUser) {
          console.log("[getCurrentUserId] 동기화 성공, 사용자 ID:", newUser.id);
          
          // 신규 가입 시 쿠폰 발급
          const couponCode = `WELCOME-${newUser.id.toString().substring(0, 8).toUpperCase()}`;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          
          await serviceSupabase.from("coupons").insert({
            user_id: newUser.id,
            code: couponCode,
            name: "신규가입 환영 쿠폰",
            discount_type: "fixed",
            discount_amount: 1000,
            min_order_amount: 0,
            status: "active",
            expires_at: expiresAt.toISOString(),
          });
          
          return newUser.id;
        } else {
          console.error("[getCurrentUserId] 동기화 실패:", insertError);
        }
      }
    } catch (syncError) {
      console.error("[getCurrentUserId] 동기화 중 예외:", syncError);
    }
    
    // 동기화 후 다시 조회
    const { data: retryUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();
    
    user = retryUser;
  }

  if (error) {
    console.error("[getCurrentUserId] 사용자 조회 에러:", error);
    return null;
  }

  return user?.id ?? null;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percentage";
  discount_amount: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  status: "active" | "used" | "expired";
  expires_at: string;
}

/**
 * 사용 가능한 쿠폰 목록 조회
 * 기존 사용자도 쿠폰이 없으면 자동으로 발급
 */
export async function getAvailableCoupons(): Promise<Coupon[]> {
  console.group("[getAvailableCoupons] 사용 가능한 쿠폰 조회");

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log("로그인 필요");
      console.groupEnd();
      return [];
    }

    const supabase = await createClient();

    // 사용 가능한 쿠폰 조회
    const { data: coupons, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 쿠폰 조회 에러:", error);
      console.error("에러 코드:", error.code);
      console.error("에러 메시지:", error.message);
      console.error("에러 상세:", error.details);
      console.groupEnd();
      return [];
    }

    // 쿠폰이 없으면 자동 발급
    if (!coupons || coupons.length === 0) {
      console.log("⚠️ 사용 가능한 쿠폰이 없습니다. 자동 발급 시도...");
      
      // 기존에 "신규가입 환영 쿠폰"이 있는지 확인 (사용됨/만료 포함)
      const { data: existingCoupon } = await supabase
        .from("coupons")
        .select("id")
        .eq("user_id", userId)
        .eq("name", "신규가입 환영 쿠폰")
        .maybeSingle();

      // 기존 쿠폰이 없으면 새로 발급
      if (!existingCoupon) {
        console.log("🎁 신규가입 환영 쿠폰 자동 발급 중...");
        const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
        const serviceSupabase = getServiceRoleClient();
        
        const couponCode = `WELCOME-${userId.toString().substring(0, 8).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

        const { data: newCoupon, error: couponError } = await serviceSupabase
          .from("coupons")
          .insert({
            user_id: userId,
            code: couponCode,
            name: "신규가입 환영 쿠폰",
            discount_type: "fixed",
            discount_amount: 1000,
            min_order_amount: 0,
            status: "active",
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (couponError) {
          console.error("❌ 쿠폰 발급 에러:", couponError);
        } else {
          console.log("✅ 신규가입 환영 쿠폰 발급 완료:", newCoupon);
          // 발급된 쿠폰을 반환
          console.log(`✅ 1개의 쿠폰 조회 완료 (자동 발급)`);
          console.groupEnd();
          return [newCoupon as Coupon];
        }
      } else {
        console.log("ℹ️ 이미 발급된 쿠폰이 있지만 사용됨/만료됨");
      }
    }

    console.log(`✅ ${coupons?.length || 0}개의 사용 가능한 쿠폰 조회 완료`);
    if (coupons && coupons.length > 0) {
      console.log("쿠폰 목록:", coupons.map(c => ({ name: c.name, discount: c.discount_amount })));
    }
    console.groupEnd();

    return (coupons || []) as Coupon[];
  } catch (error) {
    console.error("쿠폰 조회 중 예외:", error);
    console.groupEnd();
    return [];
  }
}


