/**
 * @file actions/reviews.ts
 * @description 리뷰 관련 Server Actions
 *
 * 주요 기능:
 * 1. 리뷰 작성
 * 2. 리뷰 목록 조회
 * 3. 리뷰 평균 평점 계산
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

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  content: string;
  images: string[];
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
  };
}

export interface CreateReviewInput {
  product_id: string;
  order_id?: string;
  rating: number;
  content: string;
  images?: string[];
}

// 리뷰 작성
export async function createReview(input: CreateReviewInput) {
  console.group("[createReview] 리뷰 작성");
  console.log("입력:", input);

  const userId = await getCurrentUserId();
  if (!userId) {
    console.error("인증되지 않은 사용자");
    return { success: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        product_id: input.product_id,
        user_id: userId,
        order_id: input.order_id || null,
        rating: input.rating,
        content: input.content,
        images: input.images || [],
      })
      .select()
      .single();

    if (error) {
      console.error("리뷰 작성 실패:", error);
      return { success: false, error: error.message };
    }

    console.log("리뷰 작성 성공:", data);
    return { success: true, data };
  } catch (error) {
    console.error("리뷰 작성 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리뷰 작성에 실패했습니다.",
    };
  } finally {
    console.groupEnd();
  }
}

// 상품별 리뷰 목록 조회
export async function getProductReviews(productId: string) {
  console.group("[getProductReviews] 상품 리뷰 목록 조회");
  console.log("상품 ID:", productId);

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        product_id,
        user_id,
        order_id,
        rating,
        content,
        images,
        created_at,
        updated_at,
        user:users!reviews_user_id_fkey (
          name
        )
      `,
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("리뷰 조회 실패:", error);
      return { success: false, error: error.message, data: [] };
    }

    console.log("리뷰 조회 성공, 개수:", data?.length || 0);
    return { success: true, data: (data || []) as Review[] };
  } catch (error) {
    console.error("리뷰 조회 예외:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "리뷰 조회에 실패했습니다.",
      data: [],
    };
  } finally {
    console.groupEnd();
  }
}

// 상품별 평균 평점 계산
export async function getProductAverageRating(productId: string) {
  console.group("[getProductAverageRating] 평균 평점 계산");
  console.log("상품 ID:", productId);

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("rating")
      .eq("product_id", productId)
      .is("deleted_at", null);

    if (error) {
      console.error("평점 계산 실패:", error);
      return { success: false, averageRating: 0, reviewCount: 0 };
    }

    if (!data || data.length === 0) {
      console.log("리뷰 없음");
      return { success: true, averageRating: 0, reviewCount: 0 };
    }

    const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / data.length;
    const reviewCount = data.length;

    console.log("평균 평점:", averageRating, "리뷰 개수:", reviewCount);
    return {
      success: true,
      averageRating: Math.round(averageRating * 10) / 10, // 소수점 첫째자리까지
      reviewCount,
    };
  } catch (error) {
    console.error("평점 계산 예외:", error);
    return { success: false, averageRating: 0, reviewCount: 0 };
  } finally {
    console.groupEnd();
  }
}

