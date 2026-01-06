/**
 * @file actions/cart.ts
 * @description 장바구니 관련 Server Actions
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import logger from "@/lib/logger";
import type { CartItemWithProduct } from "@/types/database";

// 현재 사용자의 Supabase user ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const authResult = await auth();
  const { userId: clerkUserId } = authResult;

  logger.group("[getCurrentUserId] 사용자 ID 조회 시작");
  logger.info("[getCurrentUserId] Clerk userId:", clerkUserId);

  if (!clerkUserId) {
    logger.warn("[getCurrentUserId] Clerk userId가 없음 - 로그인하지 않음");
    logger.groupEnd();
    return null;
  }

  // Clerk 토큰 확인 (PGRST301 에러 방지)
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.warn(
      "[getCurrentUserId] Clerk 토큰이 없음 - service role 클라이언트 사용",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();
  } else {
    logger.info("[getCurrentUserId] Clerk 토큰 확인됨 - 일반 클라이언트 사용");
    supabase = await createClient();
  }

  let { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  logger.info("[getCurrentUserId] Supabase 사용자 조회 결과:", {
    found: !!user,
    error: error?.message,
    errorCode: error?.code,
    hasToken: !!token,
  });

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (error && error.code === "PGRST301") {
    logger.warn(
      "[getCurrentUserId] PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const serviceSupabase = getServiceRoleClient();

    const { data: retryUser, error: retryError } = await serviceSupabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();

    if (retryError) {
      logger.error(
        "[getCurrentUserId] service role 클라이언트로도 조회 실패:",
        {
          error: retryError.message,
          code: retryError.code,
        },
      );
      logger.groupEnd();
      return null;
    }

    if (retryUser) {
      logger.info(
        "[getCurrentUserId] service role 클라이언트로 조회 성공:",
        retryUser.id,
      );
      logger.groupEnd();
      return retryUser.id;
    }
  }

  // 사용자가 없으면 동기화 시도
  if (!user && !error) {
    logger.info("[getCurrentUserId] 사용자가 없음 - 동기화 시도");
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );

      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);

      if (clerkUser) {
        logger.info("[getCurrentUserId] Clerk 사용자 정보 조회 성공:", {
          id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
        });

        const serviceSupabase = getServiceRoleClient();
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

        const { data: newUser, error: insertError } = await serviceSupabase
          .from("users")
          .insert(userData)
          .select("id")
          .single();

        if (!insertError && newUser) {
          logger.info("[getCurrentUserId] 사용자 동기화 성공:", newUser.id);
          logger.groupEnd();
          return newUser.id;
        } else {
          logger.error("[getCurrentUserId] 사용자 동기화 실패:", insertError);
        }
      } else {
        logger.warn("[getCurrentUserId] Clerk 사용자 정보 조회 실패");
      }
    } catch (syncError) {
      logger.error("[getCurrentUserId] 사용자 동기화 중 예외 발생:", syncError);
    }

    // 동기화 후 다시 조회 (동일한 클라이언트 사용)
    const { data: retryUser, error: retryError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();

    if (retryError) {
      logger.error("[getCurrentUserId] 재조회 실패:", {
        error: retryError.message,
        code: retryError.code,
      });
    } else if (retryUser) {
      logger.info("[getCurrentUserId] 재조회 성공:", retryUser.id);
    }

    user = retryUser;
  }

  // 일반 에러 처리 (PGRST301이 아닌 경우)
  if (error && error.code !== "PGRST301") {
    logger.error("[getCurrentUserId] 사용자 조회 실패:", {
      error: error.message,
      code: error.code,
    });
    logger.groupEnd();
    return null;
  }

  const result = user?.id ?? null;
  logger.info("[getCurrentUserId] 최종 결과:", result);
  logger.groupEnd();
  return result;
}

// 장바구니 ID 조회/생성
async function getOrCreateCartId(userId: string): Promise<string> {
  // PGRST301 에러 방지를 위해 토큰 확인
  const authResult = await auth();
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.warn(
      "[getOrCreateCartId] Clerk 토큰이 없음 - service role 클라이언트 사용",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();
  } else {
    supabase = await createClient();
  }

  let { data: existingCart, error: selectError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (selectError && selectError.code === "PGRST301") {
    logger.warn(
      "[getOrCreateCartId] PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();

    const { data: retryCart, error: retrySelectError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (retrySelectError && retrySelectError.code !== "PGRST116") {
      // PGRST116은 "no rows returned" 에러이므로 정상
      logger.error("[getOrCreateCartId] 재조회 실패:", retrySelectError);
    } else {
      existingCart = retryCart;
    }
  }

  if (existingCart) return existingCart.id;

  // 장바구니 생성
  let { data: newCart, error: insertError } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (insertError && insertError.code === "PGRST301") {
    logger.warn(
      "[getOrCreateCartId] INSERT 시 PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();

    const { data: retryNewCart, error: retryInsertError } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (retryInsertError) {
      logger.error("[getOrCreateCartId] 장바구니 생성 실패", retryInsertError);
      throw new Error("장바구니 생성에 실패했습니다.");
    }

    newCart = retryNewCart;
  } else if (insertError) {
    logger.error("장바구니 생성 실패", insertError);
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  if (!newCart) {
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  return newCart.id;
}

// 장바구니 아이템 조회
export async function getCartItems(): Promise<CartItemWithProduct[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  // PGRST301 에러 방지를 위해 토큰 확인
  const authResult = await auth();
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.warn(
      "[getCartItems] Clerk 토큰이 없음 - service role 클라이언트 사용",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();
  } else {
    supabase = await createClient();
  }

  let { data: cart, error: cartError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (cartError && cartError.code === "PGRST301") {
    logger.warn(
      "[getCartItems] PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();

    const { data: retryCart, error: retryCartError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (retryCartError && retryCartError.code !== "PGRST116") {
      // PGRST116은 "no rows returned" 에러이므로 정상
      logger.error("[getCartItems] 장바구니 조회 실패:", retryCartError);
      return [];
    }

    cart = retryCart;
  } else if (cartError && cartError.code !== "PGRST116") {
    // PGRST116은 "no rows returned" 에러이므로 정상
    logger.error("[getCartItems] 장바구니 조회 실패:", cartError);
    return [];
  }

  if (!cart) return [];

  const { data: items, error } = await supabase
    .from("cart_items")
    .select(
      `
      *,
      product:products!fk_cart_items_product_id(
        *,
        images:product_images(id, image_url, is_primary, alt_text)
      ),
      variant:product_variants!fk_cart_items_variant_id(*)
    `,
    )
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: false });

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (error && error.code === "PGRST301") {
    logger.warn(
      "[getCartItems] cart_items 조회 시 PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const serviceSupabase = getServiceRoleClient();

    const { data: retryItems, error: retryError } = await serviceSupabase
      .from("cart_items")
      .select(
        `
        *,
        product:products!fk_cart_items_product_id(
          *,
          images:product_images(id, image_url, is_primary, alt_text)
        ),
        variant:product_variants!fk_cart_items_variant_id(*)
      `,
      )
      .eq("cart_id", cart.id)
      .order("created_at", { ascending: false });

    if (retryError) {
      logger.error("[getCartItems] cart_items 재조회 실패:", retryError);
      return [];
    }

    // 재시도 성공 시 retryItems 사용
    return (retryItems || []).map((item) => {
      const product = item.product as {
        id: string;
        category_id: string;
        name: string;
        slug: string;
        price: number;
        discount_price: number | null;
        description: string | null;
        status: "active" | "hidden" | "sold_out";
        stock: number;
        is_featured: boolean;
        is_new: boolean;
        deleted_at: string | null;
        created_at: string;
        updated_at: string;
        images: Array<{
          id: string;
          image_url: string;
          is_primary: boolean;
          alt_text: string | null;
        }>;
      };

      const primaryImage =
        product.images?.find((img) => img.is_primary) ||
        product.images?.[0] ||
        null;

      return {
        id: item.id,
        cart_id: item.cart_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        price: item.price,
        created_at: item.created_at,
        updated_at: item.updated_at,
        product: {
          id: product.id,
          category_id: product.category_id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          discount_price: product.discount_price,
          description: product.description,
          status: product.status,
          stock: product.stock,
          is_featured: product.is_featured,
          is_new: product.is_new,
          deleted_at: product.deleted_at,
          created_at: product.created_at,
          updated_at: product.updated_at,
        },
        variant: item.variant,
        primary_image: primaryImage
          ? {
              id: primaryImage.id,
              product_id: product.id,
              image_url: primaryImage.image_url,
              is_primary: primaryImage.is_primary,
              sort_order: 0,
              alt_text: primaryImage.alt_text,
              created_at: product.created_at,
            }
          : null,
      };
    });
  }

  if (error) {
    logger.error("장바구니 조회 실패", error);
    return [];
  }

  return (items || []).map((item) => {
    const product = item.product as {
      id: string;
      category_id: string;
      name: string;
      slug: string;
      price: number;
      discount_price: number | null;
      description: string | null;
      status: "active" | "hidden" | "sold_out";
      stock: number;
      is_featured: boolean;
      is_new: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      images: Array<{
        id: string;
        image_url: string;
        is_primary: boolean;
        alt_text: string | null;
      }>;
    };

    const primaryImage =
      product.images?.find((img) => img.is_primary) ||
      product.images?.[0] ||
      null;

    return {
      id: item.id,
      cart_id: item.cart_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      price: item.price,
      created_at: item.created_at,
      updated_at: item.updated_at,
      product: {
        id: product.id,
        category_id: product.category_id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        discount_price: product.discount_price,
        description: product.description,
        status: product.status,
        stock: product.stock,
        is_featured: product.is_featured,
        is_new: product.is_new,
        deleted_at: product.deleted_at,
        created_at: product.created_at,
        updated_at: product.updated_at,
      },
      variant: item.variant,
      primary_image: primaryImage
        ? {
            id: primaryImage.id,
            product_id: product.id,
            image_url: primaryImage.image_url,
            is_primary: primaryImage.is_primary,
            sort_order: 0,
            alt_text: primaryImage.alt_text,
            created_at: product.created_at,
          }
        : null,
    };
  });
}

// 장바구니에 상품 추가
export async function addToCart(
  productId: string,
  quantity: number = 1,
  variantId?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    let { data: product, error: productError } = await supabase
      .from("products")
      .select("id, price, discount_price, stock, status")
      .eq("id", productId)
      .is("deleted_at", null)
      .single();

    // PGRST301 에러 발생 시 service role 클라이언트로 재시도
    if (productError && productError.code === "PGRST301") {
      logger.warn(
        "[addToCart] PGRST301 에러 발생 - service role 클라이언트로 재시도",
        { productId },
      );
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      const serviceSupabase = getServiceRoleClient();

      const { data: retryProduct, error: retryError } = await serviceSupabase
        .from("products")
        .select("id, price, discount_price, stock, status")
        .eq("id", productId)
        .is("deleted_at", null)
        .single();

      if (retryError) {
        logger.error(
          "[addToCart] service role 클라이언트로도 상품 조회 실패:",
          {
            error: retryError.message,
            code: retryError.code,
            productId,
          },
        );
        return { success: false, message: "상품을 찾을 수 없습니다." };
      }

      product = retryProduct;
    } else if (productError) {
      logger.error("[addToCart] 상품 조회 실패:", {
        error: productError.message,
        code: productError.code,
        productId,
      });
      return { success: false, message: "상품을 찾을 수 없습니다." };
    }

    if (!product) {
      logger.warn("[addToCart] 상품을 찾을 수 없음:", productId);
      return { success: false, message: "상품을 찾을 수 없습니다." };
    }

    if (product.status === "sold_out" || product.stock === 0) {
      return { success: false, message: "품절된 상품입니다." };
    }

    if (product.stock < quantity) {
      return {
        success: false,
        message: `재고가 부족합니다. (현재 재고: ${product.stock}개)`,
      };
    }

    const cartId = await getOrCreateCartId(userId);

    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", productId)
      .eq("variant_id", variantId ?? null)
      .single();

    const price = product.discount_price ?? product.price;

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return {
          success: false,
          message: `재고가 부족합니다. (현재 재고: ${product.stock}개)`,
        };
      }

      await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id);
    } else {
      await supabase.from("cart_items").insert({
        cart_id: cartId,
        product_id: productId,
        variant_id: variantId ?? null,
        quantity,
        price,
      });
    }

    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: true, message: "장바구니에 추가되었습니다." };
  } catch (error) {
    logger.error("장바구니 추가 실패", error);
    return { success: false, message: "장바구니 추가에 실패했습니다." };
  }
}

// 바로 구매하기: 장바구니에 추가 후 체크아웃 페이지로 리다이렉트
export async function buyNowAndRedirect(
  productId: string,
  quantity: number = 1,
  variantId?: string,
): Promise<never> {
  logger.group("[buyNowAndRedirect] 바로 구매 시작");
  logger.info("상품 정보:", { productId, quantity, variantId });

  const result = await addToCart(productId, quantity, variantId);
  
  if (!result.success) {
    logger.error("[buyNowAndRedirect] 장바구니 추가 실패:", result.message);
    logger.groupEnd();
    // 에러는 클라이언트에서 처리하도록 하기 위해 throw
    throw new Error(result.message);
  }

  logger.info("[buyNowAndRedirect] ✅ 장바구니 추가 성공 - 체크아웃 페이지로 리다이렉트");
  logger.groupEnd();
  
  // Server Action에서 직접 리다이렉트 (DB 트랜잭션이 완료된 후 실행됨)
  redirect("/checkout");
}

// 옵션이 여러 개인 상품의 바로 구매하기
export async function buyNowWithOptionsAndRedirect(
  productId: string,
  options: Array<{ variantId: string; quantity: number }>,
): Promise<never> {
  logger.group("[buyNowWithOptionsAndRedirect] 옵션 여러 개 바로 구매 시작");
  logger.info("상품 정보:", { productId, optionsCount: options.length });

  // 모든 옵션을 순차적으로 장바구니에 추가
  for (const option of options) {
    const result = await addToCart(productId, option.quantity, option.variantId);
    if (!result.success) {
      logger.error("[buyNowWithOptionsAndRedirect] 장바구니 추가 실패:", {
        variantId: option.variantId,
        message: result.message,
      });
      logger.groupEnd();
      throw new Error(`${option.variantId}: ${result.message}`);
    }
  }

  logger.info("[buyNowWithOptionsAndRedirect] ✅ 모든 옵션 장바구니 추가 성공 - 체크아웃 페이지로 리다이렉트");
  logger.groupEnd();
  
  // Server Action에서 직접 리다이렉트
  redirect("/checkout");
}

// 장바구니 아이템 수량 변경
export async function updateCartItemQuantity(
  itemId: string,
  quantity: number,
): Promise<{ success: boolean; message: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    if (quantity < 1) {
      return { success: false, message: "수량은 1개 이상이어야 합니다." };
    }

    const supabase = await createClient();

    const { data: item } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        cart:carts!fk_cart_items_cart_id(user_id),
        product:products!fk_cart_items_product_id(stock, status)
      `,
      )
      .eq("id", itemId)
      .single();

    if (!item) {
      return { success: false, message: "장바구니 아이템을 찾을 수 없습니다." };
    }

    const cart = item.cart as { user_id: string };
    if (cart.user_id !== userId) {
      return { success: false, message: "권한이 없습니다." };
    }

    const product = item.product as { stock: number; status: string };
    if (product.stock < quantity) {
      return {
        success: false,
        message: `재고가 부족합니다. (현재 재고: ${product.stock}개)`,
      };
    }

    await supabase
      .from("cart_items")
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    revalidatePath("/cart");
    return { success: true, message: "수량이 변경되었습니다." };
  } catch (error) {
    logger.error("수량 변경 실패", error);
    return { success: false, message: "수량 변경에 실패했습니다." };
  }
}

// 장바구니 아이템 삭제
export async function removeFromCart(
  itemId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    const { data: item } = await supabase
      .from("cart_items")
      .select("cart:carts!fk_cart_items_cart_id(user_id)")
      .eq("id", itemId)
      .single();

    if (!item) {
      return { success: false, message: "장바구니 아이템을 찾을 수 없습니다." };
    }

    const cart = item.cart as unknown as { user_id: string } | null;
    if (!cart || cart.user_id !== userId) {
      return { success: false, message: "권한이 없습니다." };
    }

    await supabase.from("cart_items").delete().eq("id", itemId);

    revalidatePath("/cart");
    return { success: true, message: "상품이 삭제되었습니다." };
  } catch (error) {
    logger.error("아이템 삭제 실패", error);
    return { success: false, message: "삭제에 실패했습니다." };
  }
}

// 장바구니 비우기
export async function clearCart(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!cart) {
      return { success: true, message: "장바구니가 이미 비어있습니다." };
    }

    await supabase.from("cart_items").delete().eq("cart_id", cart.id);

    revalidatePath("/cart");
    return { success: true, message: "장바구니를 비웠습니다." };
  } catch (error) {
    logger.error("장바구니 비우기 실패", error);
    return { success: false, message: "장바구니 비우기에 실패했습니다." };
  }
}

// 장바구니 아이템 개수 조회
export async function getCartItemCount(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const supabase = await createClient();

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!cart) return 0;

  const { count } = await supabase
    .from("cart_items")
    .select("*", { count: "exact", head: true })
    .eq("cart_id", cart.id);

  return count ?? 0;
}
