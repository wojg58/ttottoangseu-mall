/**
 * @file actions/inquiries.ts
 * @description 문의 관련 Server Actions
 *
 * 주요 기능:
 * 1. 문의 작성
 * 2. 문의 목록 조회
 * 3. 문의 답변 (관리자용)
 *
 * @dependencies
 * - Supabase: 데이터베이스 쿼리
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// 현재 사용자의 Supabase user ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  return user?.id ?? null;
}

export interface Inquiry {
  id: string;
  product_id: string;
  user_id: string | null;
  title: string;
  content: string;
  is_secret: boolean;
  status: "pending" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
  } | null;
}

export interface CreateInquiryInput {
  product_id: string;
  title: string;
  content: string;
  is_secret?: boolean;
}

// 문의 작성
export async function createInquiry(input: CreateInquiryInput) {
  console.group("[createInquiry] 문의 작성");
  console.log("입력:", input);

  const userId = await getCurrentUserId(); // 비회원도 문의 가능하므로 null 허용

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        product_id: input.product_id,
        user_id: userId || null,
        title: input.title,
        content: input.content,
        is_secret: input.is_secret || false,
      })
      .select()
      .single();

    if (error) {
      console.error("문의 작성 실패:", error);
      return { success: false, error: error.message };
    }

    console.log("문의 작성 성공:", data);
    return { success: true, data };
  } catch (error) {
    console.error("문의 작성 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "문의 작성에 실패했습니다.",
    };
  } finally {
    console.groupEnd();
  }
}

// 상품별 문의 목록 조회
export async function getProductInquiries(productId: string) {
  console.group("[getProductInquiries] 상품 문의 목록 조회");
  console.log("상품 ID:", productId);

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `
        id,
        product_id,
        user_id,
        title,
        content,
        is_secret,
        status,
        answer,
        answered_at,
        created_at,
        updated_at,
        user:users!inquiries_user_id_fkey (
          name
        )
      `,
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("문의 조회 실패:", error);
      return { success: false, error: error.message, data: [] };
    }

    console.log("문의 조회 성공, 개수:", data?.length || 0);
    return { success: true, data: (data || []) as Inquiry[] };
  } catch (error) {
    console.error("문의 조회 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "문의 조회에 실패했습니다.",
      data: [],
    };
  } finally {
    console.groupEnd();
  }
}

// 상품별 문의 개수 조회
export async function getProductInquiryCount(productId: string) {
  console.group("[getProductInquiryCount] 문의 개수 조회");
  console.log("상품 ID:", productId);

  const supabase = await createClient();

  try {
    const { count, error } = await supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId)
      .is("deleted_at", null);

    if (error) {
      console.error("문의 개수 조회 실패:", error);
      return { success: false, count: 0 };
    }

    console.log("문의 개수:", count || 0);
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error("문의 개수 조회 예외:", error);
    return { success: false, count: 0 };
  } finally {
    console.groupEnd();
  }
}

