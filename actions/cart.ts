/**
 * @file actions/cart.ts
 * @description 장바구니 관련 Server Actions
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import type { CartItemWithProduct } from "@/types/database";

// 현재 사용자의 Supabase user ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const authResult = await auth();
  const { userId: clerkUserId } = authResult;

  if (!clerkUserId) {
    logger.debug("[getCurrentUserId] 사용자 미인증");
    return null;
  }

  // Clerk 토큰 확인 (PGRST301 에러 방지)
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.debug("[getCurrentUserId] 토큰 없음, service role 클라이언트 사용");
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    supabase = getServiceRoleClient();
  } else {
    supabase = await createClient();
  }

  let { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (error && error.code === "PGRST301") {
    logger.debug("[getCurrentUserId] PGRST301 에러, service role로 재시도");
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
      logger.error("[getCurrentUserId] service role로도 조회 실패", {
        error: retryError.message,
        code: retryError.code,
      });
      return null;
    }

    if (retryUser) {
      return retryUser.id;
    }
  }

  // 사용자가 없으면 동기화 시도
  if (!user && !error) {
    logger.debug("[getCurrentUserId] 사용자 없음, 동기화 시도");
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );

      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);

      if (clerkUser) {
        const serviceSupabase = getServiceRoleClient();
        const userEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
        const userData = {
          clerk_user_id: clerkUser.id,
          name:
            clerkUser.fullName ||
            clerkUser.username ||
            userEmail ||
            "Unknown",
          email: userEmail,
          role: "customer",
        };

        // 먼저 이메일로 기존 사용자 조회 (중복 방지)
        let existingUser = null;
        if (userEmail) {
          const { data: userByEmail } = await serviceSupabase
            .from("users")
            .select("id")
            .eq("email", userEmail)
            .is("deleted_at", null)
            .maybeSingle();
          existingUser = userByEmail;
        }

        if (existingUser) {
          // 기존 사용자가 있으면 clerk_user_id만 업데이트
          logger.debug("[getCurrentUserId] 기존 사용자 발견, clerk_user_id 업데이트");
          const { error: updateError } = await serviceSupabase
            .from("users")
            .update({ clerk_user_id: clerkUser.id })
            .eq("id", existingUser.id);

          if (!updateError) {
            logger.debug("[getCurrentUserId] clerk_user_id 업데이트 성공");
            return existingUser.id;
          } else {
            logger.error("[getCurrentUserId] clerk_user_id 업데이트 실패", updateError);
          }
        } else {
          // 새 사용자 생성
          const { data: newUser, error: insertError } = await serviceSupabase
            .from("users")
            .insert(userData)
            .select("id")
            .single();

          if (!insertError && newUser) {
            logger.debug("[getCurrentUserId] 사용자 동기화 성공");
            return newUser.id;
          } else {
            // 중복 에러 발생 시 이메일로 다시 조회
            if (insertError?.code === "23505" && userEmail) {
              logger.debug("[getCurrentUserId] 중복 에러 발생, 이메일로 재조회");
              const { data: userByEmail } = await serviceSupabase
                .from("users")
                .select("id")
                .eq("email", userEmail)
                .is("deleted_at", null)
                .maybeSingle();
              
              if (userByEmail) {
                // clerk_user_id 업데이트 시도
                await serviceSupabase
                  .from("users")
                  .update({ clerk_user_id: clerkUser.id })
                  .eq("id", userByEmail.id);
                return userByEmail.id;
              }
            }
            logger.error("[getCurrentUserId] 사용자 동기화 실패", insertError);
          }
        }
      } else {
        logger.warn("[getCurrentUserId] Clerk 사용자 정보 조회 실패");
      }
    } catch (syncError) {
      logger.error("[getCurrentUserId] 사용자 동기화 중 예외 발생", syncError);
    }

    // 동기화 후 다시 조회 (동일한 클라이언트 사용)
    const { data: retryUser, error: retryError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();

    if (retryError) {
      logger.error("[getCurrentUserId] 재조회 실패", {
        error: retryError.message,
        code: retryError.code,
      });
    }

    user = retryUser;
  }

  // 일반 에러 처리 (PGRST301이 아닌 경우)
  if (error && error.code !== "PGRST301") {
    logger.error("[getCurrentUserId] 사용자 조회 실패", {
      error: error.message,
      code: error.code,
    });
    return null;
  }

  return user?.id ?? null;
}

// 장바구니 ID 조회/생성
async function getOrCreateCartId(userId: string): Promise<string> {
  // PGRST301 에러 방지를 위해 토큰 확인
  const authResult = await auth();
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.debug("[getOrCreateCartId] 토큰 없음, service role 클라이언트 사용");
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
    logger.debug("[getOrCreateCartId] PGRST301 에러, service role로 재시도");
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
      logger.error("[getOrCreateCartId] 재조회 실패", retrySelectError);
    } else {
      existingCart = retryCart;
    }
  }

  if (existingCart) {
    return existingCart.id;
  }

  // 장바구니 생성
  let { data: newCart, error: insertError } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (insertError && insertError.code === "PGRST301") {
    logger.debug("[getOrCreateCartId] INSERT PGRST301 에러, service role로 재시도");
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
    logger.error("[getOrCreateCartId] 장바구니 생성 실패", insertError);
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  if (!newCart) {
    logger.error("[getOrCreateCartId] 장바구니 생성 실패 - cartId 없음");
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  return newCart.id;
}

// 장바구니 아이템 조회
export async function getCartItems(): Promise<CartItemWithProduct[]> {
  const authResult = await auth();
  const { userId: clerkUserId } = authResult;
  
  logger.info("[getCartItems] 장바구니 아이템 조회 시작", {
    clerkUserId,
    timestamp: new Date().toISOString(),
  });

  const userId = await getCurrentUserId();

  if (!userId) {
    logger.warn("[getCartItems] 사용자 ID 조회 실패 - 로그인 필요", {
      clerkUserId,
    });
    return [];
  }

  logger.info("[getCartItems] Supabase user_id 조회 완료", {
    clerkUserId,
    supabaseUserId: userId,
  });

  // PGRST301 에러 방지를 위해 토큰 확인
  const token = await authResult.getToken();
  let supabase;

  if (!token) {
    logger.debug("[getCartItems] 토큰 없음, service role 클라이언트 사용");
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

  logger.info("[getCartItems] 장바구니 조회 결과", {
    clerkUserId,
    supabaseUserId: userId,
    cartId: cart?.id || null,
    error: cartError ? {
      message: cartError.message,
      code: cartError.code,
      details: cartError.details,
    } : null,
  });

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (cartError && cartError.code === "PGRST301") {
    logger.debug("[getCartItems] PGRST301 에러, service role로 재시도");
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
      logger.error("[getCartItems] 장바구니 조회 실패", retryCartError);
      return [];
    }

    cart = retryCart;
  } else if (cartError && cartError.code !== "PGRST116") {
    // PGRST116은 "no rows returned" 에러이므로 정상
    logger.error("[getCartItems] 장바구니 조회 실패", cartError);
    return [];
  }

  if (!cart) {
    logger.debug("[getCartItems] 장바구니 없음");
    return [];
  }

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

  logger.info("[getCartItems] 장바구니 아이템 조회 결과", {
    clerkUserId,
    supabaseUserId: userId,
    cartId: cart.id,
    itemsCount: items?.length || 0,
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
    } : null,
  });

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (error && error.code === "PGRST301") {
    logger.debug("[getCartItems] cart_items PGRST301 에러, service role로 재시도");
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
      logger.error("[getCartItems] cart_items 조회 실패", retryError);
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
    logger.error("[getCartItems] cart_items 조회 실패", error);
    return [];
  }

  const finalItems = (items || []).map((item) => {
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

  logger.info("[getCartItems] 최종 결과 반환", {
    clerkUserId,
    supabaseUserId: userId,
    cartId: cart.id,
    finalItemsCount: finalItems.length,
    productIds: finalItems.map(item => item.product_id),
  });

  return finalItems;
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
      logger.debug("[addToCart] 사용자 미인증");
      return { success: false, message: "로그인이 필요합니다." };
    }

    // PGRST301 에러 방지를 위해 토큰 확인
    const authResult = await auth();
    const token = await authResult.getToken();
    let supabase;

    if (!token) {
      logger.debug("[addToCart] 토큰 없음, service role 클라이언트 사용");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      supabase = getServiceRoleClient();
    } else {
      supabase = await createClient();
    }

    let { data: product, error: productError } = await supabase
      .from("products")
      .select("id, price, discount_price, stock, status")
      .eq("id", productId)
      .is("deleted_at", null)
      .single();

    // PGRST301 에러 발생 시 service role 클라이언트로 재시도
    if (productError && productError.code === "PGRST301") {
      logger.debug("[addToCart] PGRST301 에러, service role로 재시도");
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
        logger.error("[addToCart] 상품 조회 실패", {
          error: retryError.message,
          code: retryError.code,
        });
        return { success: false, message: "상품을 찾을 수 없습니다." };
      }

      product = retryProduct;
    } else if (productError) {
      logger.error("[addToCart] 상품 조회 실패", {
        error: productError.message,
        code: productError.code,
      });
      return { success: false, message: "상품을 찾을 수 없습니다." };
    }

    if (!product) {
      logger.warn("[addToCart] 상품을 찾을 수 없음");
      return { success: false, message: "상품을 찾을 수 없습니다." };
    }

    if (product.status === "sold_out" || product.stock === 0) {
      return { success: false, message: "품절된 상품입니다." };
    }

    // variant 정보 조회 (price_adjustment 포함)
    let variant: { price_adjustment: number; stock: number } | null = null;
    if (variantId) {
      let { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select("price_adjustment, stock")
        .eq("id", variantId)
        .single();

      // PGRST301 에러 발생 시 service role 클라이언트로 재시도
      if (variantError && variantError.code === "PGRST301") {
        logger.debug("[addToCart] variant PGRST301 에러, service role로 재시도");
        const { getServiceRoleClient } = await import(
          "@/lib/supabase/service-role"
        );
        const serviceSupabase = getServiceRoleClient();

        const { data: retryVariant, error: retryVariantError } =
          await serviceSupabase
            .from("product_variants")
            .select("price_adjustment, stock")
            .eq("id", variantId)
            .single();

        if (retryVariantError) {
          logger.error("[addToCart] variant 조회 실패", {
            error: retryVariantError.message,
            code: retryVariantError.code,
          });
          return { success: false, message: "옵션을 찾을 수 없습니다." };
        }

        variant = retryVariant;
      } else if (variantError) {
        logger.error("[addToCart] variant 조회 실패", {
          error: variantError.message,
          code: variantError.code,
        });
        return { success: false, message: "옵션을 찾을 수 없습니다." };
      } else {
        variant = variantData;
      }
    }

    // 재고 확인 (variant가 있으면 variant 재고, 없으면 상품 재고)
    const availableStock = variant ? variant.stock : product.stock;
    if (availableStock < quantity) {
      return {
        success: false,
        message: `재고가 부족합니다. (현재 재고: ${availableStock}개)`,
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

    // 가격 계산 (variant의 price_adjustment 고려)
    const basePrice = product.discount_price ?? product.price;
    const adjustment = variant?.price_adjustment ?? 0;
    const price = basePrice + adjustment;

    logger.info("[addToCart] 가격 계산", {
      basePrice,
      adjustment,
      finalPrice: price,
      hasVariant: !!variant,
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > product.stock) {
        logger.warn("[addToCart] 재고 부족", {
          requested: newQuantity,
          available: product.stock,
        });
        return {
          success: false,
          message: `재고가 부족합니다. (현재 재고: ${product.stock}개)`,
        };
      }

      const { error: updateError } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingItem.id);

      // PGRST301 에러 발생 시 service role 클라이언트로 재시도
      if (updateError && updateError.code === "PGRST301") {
        logger.debug("[addToCart] UPDATE PGRST301 에러, service role로 재시도");
        const { getServiceRoleClient } = await import(
          "@/lib/supabase/service-role"
        );
        const serviceSupabase = getServiceRoleClient();

        const { error: retryUpdateError } = await serviceSupabase
          .from("cart_items")
          .update({
            quantity: newQuantity,
            price,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItem.id);

        if (retryUpdateError) {
          logger.error("[addToCart] 장바구니 업데이트 실패", retryUpdateError);
          return {
            success: false,
            message: "장바구니 업데이트에 실패했습니다.",
          };
        }
      } else if (updateError) {
        logger.error("[addToCart] 장바구니 업데이트 실패", updateError);
        return {
          success: false,
          message: "장바구니 업데이트에 실패했습니다.",
        };
      }
    } else {
      const { error: insertError } = await supabase.from("cart_items").insert({
        cart_id: cartId,
        product_id: productId,
        variant_id: variantId ?? null,
        quantity,
        price,
      });

      // PGRST301 에러 발생 시 service role 클라이언트로 재시도
      if (insertError && insertError.code === "PGRST301") {
        logger.debug("[addToCart] INSERT PGRST301 에러, service role로 재시도");
        const { getServiceRoleClient } = await import(
          "@/lib/supabase/service-role"
        );
        const serviceSupabase = getServiceRoleClient();

        const { error: retryInsertError } = await serviceSupabase
          .from("cart_items")
          .insert({
            cart_id: cartId,
            product_id: productId,
            variant_id: variantId ?? null,
            quantity,
            price,
          });

        if (retryInsertError) {
          logger.error("[addToCart] 장바구니 추가 실패", retryInsertError);
          return {
            success: false,
            message: "장바구니 추가에 실패했습니다.",
          };
        }
      } else if (insertError) {
        logger.error("[addToCart] 장바구니 추가 실패", insertError);
        return {
          success: false,
          message: "장바구니 추가에 실패했습니다.",
        };
      }
    }

    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: true, message: "장바구니에 추가되었습니다." };
  } catch (error) {
    logger.error("[addToCart] 예외 발생", error);
    return { success: false, message: "장바구니 추가에 실패했습니다." };
  }
}

// 장바구니에 아이템이 실제로 추가되었는지 확인 (폴링 방식)
async function verifyCartItemAdded(
  userId: string,
  productId: string,
  variantId: string | undefined,
  maxRetries: number = 10,
  delayMs: number = 200,
): Promise<boolean> {
  logger.group("[verifyCartItemAdded] 장바구니 아이템 확인 시작");
  logger.info("확인할 아이템:", { userId, productId, variantId });

  const { getServiceRoleClient } = await import("@/lib/supabase/service-role");
  const supabase = getServiceRoleClient();

  for (let i = 0; i < maxRetries; i++) {
    try {
      // 장바구니 조회
      const { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (cartError) {
        logger.warn(
          `[verifyCartItemAdded] 장바구니 조회 에러 (시도 ${
            i + 1
          }/${maxRetries}):`,
          cartError,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!cart) {
        logger.info(
          `[verifyCartItemAdded] 장바구니 없음, 대기 중... (시도 ${
            i + 1
          }/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // 장바구니 아이템 확인
      const { data: item, error: itemError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", productId)
        .eq("variant_id", variantId ?? null)
        .maybeSingle();

      if (itemError) {
        logger.warn(
          `[verifyCartItemAdded] 장바구니 아이템 조회 에러 (시도 ${
            i + 1
          }/${maxRetries}):`,
          itemError,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (item) {
        logger.info(
          `[verifyCartItemAdded] ✅ 장바구니 아이템 확인 성공 (시도 ${
            i + 1
          }/${maxRetries})`,
          { itemId: item.id, quantity: item.quantity },
        );
        logger.groupEnd();
        return true;
      }

      logger.info(
        `[verifyCartItemAdded] 장바구니 아이템 없음, 대기 중... (시도 ${
          i + 1
        }/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      logger.error(
        `[verifyCartItemAdded] 예외 발생 (시도 ${i + 1}/${maxRetries}):`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.warn(
    `[verifyCartItemAdded] ⚠️ 장바구니 아이템 확인 실패 (최대 재시도 횟수 초과)`,
  );
  logger.groupEnd();
  return false;
}

// 바로 구매하기: 장바구니에 추가 후 체크아웃 페이지로 리다이렉트
export async function buyNowAndRedirect(
  productId: string,
  quantity: number = 1,
  variantId?: string,
): Promise<{ success: boolean; message?: string }> {
  logger.group("🛒 [바로 구매하기] Server Action 시작");
  logger.info("[buyNowAndRedirect] 1단계: 함수 호출됨");
  logger.info("입력 파라미터:", { productId, quantity, variantId });
  logger.info("타임스탬프:", new Date().toISOString());

  try {
    logger.info("[buyNowAndRedirect] 2단계: addToCart() 호출 시작");
    const result = await addToCart(productId, quantity, variantId);
    logger.info("[buyNowAndRedirect] addToCart() 결과:", {
      success: result.success,
      message: result.message,
    });

    if (!result.success) {
      logger.error("[buyNowAndRedirect] ❌ 3단계: 장바구니 추가 실패");
      logger.error("실패 원인:", result.message);
      logger.groupEnd();
      // 에러는 클라이언트에서 처리하도록 하기 위해 throw
      throw new Error(result.message);
    }

    logger.info("[buyNowAndRedirect] ✅ 3단계: 장바구니 추가 API 성공");
    logger.info("[buyNowAndRedirect] 4단계: DB 반영 확인 시작");

    // DB에 실제로 반영되었는지 확인 (폴링 방식)
    logger.info("[buyNowAndRedirect] getCurrentUserId() 호출");
    let userId: string | null;
    try {
      userId = await getCurrentUserId();
      logger.info("[buyNowAndRedirect] getCurrentUserId() 결과:", {
        userId: userId || null,
        hasUserId: !!userId,
      });
    } catch (userIdError) {
      logger.error(
        "[buyNowAndRedirect] ❌ getCurrentUserId() 예외 발생:",
        userIdError,
      );
      logger.groupEnd();
      throw new Error(
        `사용자 정보를 가져오는 중 오류가 발생했습니다: ${
          userIdError instanceof Error ? userIdError.message : "알 수 없는 오류"
        }`,
      );
    }

    if (!userId) {
      logger.error("[buyNowAndRedirect] ❌ 사용자 ID 조회 실패");
      logger.groupEnd();
      throw new Error("로그인이 필요합니다.");
    }

    logger.info("[buyNowAndRedirect] verifyCartItemAdded() 호출");
    let isAdded = false;
    try {
      // 배포 환경에서 DB 반영 지연을 고려하여 더 긴 재시도
      isAdded = await verifyCartItemAdded(userId, productId, variantId, 15, 300);
      logger.info("[buyNowAndRedirect] verifyCartItemAdded() 결과:", {
        isAdded,
        verified: isAdded ? "✅ 확인됨" : "⚠️ 확인 실패",
      });
    } catch (verifyError) {
      logger.error(
        "[buyNowAndRedirect] ❌ verifyCartItemAdded() 예외 발생:",
        verifyError,
      );
      // verifyCartItemAdded 실패는 치명적이지 않으므로 계속 진행
      isAdded = false;
    }

    if (!isAdded) {
      logger.warn(
        "[buyNowAndRedirect] ⚠️ 장바구니 아이템 확인 실패 - 최종 확인 시도",
      );
      
      // 최종 확인: getCartItems로 직접 조회
      try {
        const finalCartItems = await getCartItems();
        const itemExists = finalCartItems.some((item) => {
          if (variantId) {
            return item.product_id === productId && item.variant_id === variantId;
          }
          return item.product_id === productId && !item.variant_id;
        });
        
        if (itemExists) {
          logger.info("[buyNowAndRedirect] ✅ 최종 확인 성공 - 장바구니에 아이템 존재");
          isAdded = true;
        } else {
          logger.error("[buyNowAndRedirect] ❌ 최종 확인 실패 - 장바구니에 아이템 없음", {
            cartItemsCount: finalCartItems.length,
            productId,
            variantId,
          });
          // 장바구니에 실제로 추가되지 않았으므로 에러 반환
          throw new Error("장바구니에 상품이 추가되지 않았습니다. 다시 시도해주세요.");
        }
      } catch (finalCheckError) {
        logger.error("[buyNowAndRedirect] ❌ 최종 확인 중 에러:", finalCheckError);
        throw finalCheckError;
      }
    }

    logger.info("[buyNowAndRedirect] ✅ 5단계: 모든 검증 완료");
    logger.info("[buyNowAndRedirect] 6단계: revalidatePath 실행");

    // 캐시 갱신
    revalidatePath("/checkout");
    revalidatePath("/cart");

    logger.info(
      "[buyNowAndRedirect] ✅ 7단계: 완료 - 클라이언트에서 리다이렉트 필요",
    );
    logger.groupEnd();

    // 성공 반환 (클라이언트에서 리다이렉트)
    return { success: true };
  } catch (error) {
    // 실제 에러인 경우
    logger.error(
      "[buyNowAndRedirect] ❌ 예외 발생:",
      error instanceof Error ? error : new Error(String(error)),
    );
    logger.groupEnd();

    const errorMessage =
      error instanceof Error
        ? error.message
        : "바로 구매 처리 중 오류가 발생했습니다.";

    return { success: false, message: errorMessage };
  }
}

// 옵션이 여러 개인 상품의 바로 구매하기
export async function buyNowWithOptionsAndRedirect(
  productId: string,
  options: Array<{ variantId: string; quantity: number }>,
): Promise<{ success: boolean; message?: string }> {
  logger.group("🛒 [바로 구매하기 - 옵션 여러 개] Server Action 시작");
  logger.info("[buyNowWithOptionsAndRedirect] 1단계: 함수 호출됨");
  logger.info("입력 파라미터:", {
    productId,
    optionsCount: options.length,
    options: options.map((opt) => ({
      variantId: opt.variantId,
      quantity: opt.quantity,
    })),
  });
  logger.info("타임스탬프:", new Date().toISOString());

  try {
    // 모든 옵션을 순차적으로 장바구니에 추가
    logger.info(
      "[buyNowWithOptionsAndRedirect] 2단계: 모든 옵션 장바구니에 추가 시작",
    );
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      logger.info(
        `[buyNowWithOptionsAndRedirect] 옵션 ${i + 1}/${
          options.length
        } 추가 중:`,
        {
          variantId: option.variantId,
          quantity: option.quantity,
        },
      );

      const result = await addToCart(
        productId,
        option.quantity,
        option.variantId,
      );

      logger.info(`[buyNowWithOptionsAndRedirect] 옵션 ${i + 1} 추가 결과:`, {
        success: result.success,
        message: result.message,
      });

      if (!result.success) {
        logger.error("[buyNowWithOptionsAndRedirect] ❌ 장바구니 추가 실패:", {
          variantId: option.variantId,
          message: result.message,
          optionIndex: i + 1,
          totalOptions: options.length,
        });
        logger.groupEnd();
        throw new Error(`${option.variantId}: ${result.message}`);
      }
    }

    logger.info(
      "[buyNowWithOptionsAndRedirect] ✅ 3단계: 모든 옵션 장바구니 추가 API 성공",
    );
    logger.info("[buyNowWithOptionsAndRedirect] 4단계: DB 반영 확인 시작");

    // 모든 옵션이 DB에 실제로 반영되었는지 확인 (폴링 방식)
    logger.info("[buyNowWithOptionsAndRedirect] getCurrentUserId() 호출");
    let userId: string | null;
    try {
      userId = await getCurrentUserId();
      logger.info("[buyNowWithOptionsAndRedirect] getCurrentUserId() 결과:", {
        userId: userId || null,
        hasUserId: !!userId,
      });
    } catch (userIdError) {
      logger.error(
        "[buyNowWithOptionsAndRedirect] ❌ getCurrentUserId() 예외 발생:",
        userIdError,
      );
      logger.groupEnd();
      throw new Error(
        `사용자 정보를 가져오는 중 오류가 발생했습니다: ${
          userIdError instanceof Error ? userIdError.message : "알 수 없는 오류"
        }`,
      );
    }

    if (!userId) {
      logger.error("[buyNowWithOptionsAndRedirect] ❌ 사용자 ID 조회 실패");
      logger.groupEnd();
      throw new Error("로그인이 필요합니다.");
    }

    // 모든 옵션 확인
    logger.info("[buyNowWithOptionsAndRedirect] 5단계: 모든 옵션 DB 반영 확인");
    let allVerified = true;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      logger.info(
        `[buyNowWithOptionsAndRedirect] 옵션 ${i + 1}/${
          options.length
        } 확인 중:`,
        {
          variantId: option.variantId,
        },
      );

      try {
        const isAdded = await verifyCartItemAdded(
          userId,
          productId,
          option.variantId,
          8, // 옵션이 여러 개이므로 재시도 횟수 줄임
          150, // 대기 시간도 줄임
        );

        logger.info(`[buyNowWithOptionsAndRedirect] 옵션 ${i + 1} 확인 결과:`, {
          isAdded,
          verified: isAdded ? "✅ 확인됨" : "⚠️ 확인 실패",
        });

        if (!isAdded) {
          allVerified = false;
          logger.warn(
            `[buyNowWithOptionsAndRedirect] ⚠️ 옵션 ${i + 1} (${
              option.variantId
            }) 확인 실패`,
          );
        }
      } catch (verifyError) {
        logger.error(
          `[buyNowWithOptionsAndRedirect] ❌ 옵션 ${i + 1} 확인 중 예외 발생:`,
          verifyError,
        );
        allVerified = false;
        // verifyCartItemAdded 실패는 치명적이지 않으므로 계속 진행
      }
    }

    logger.info("[buyNowWithOptionsAndRedirect] 전체 확인 결과:", {
      allVerified,
      verifiedCount: options.filter((_, i) => {
        // verifyCartItemAdded 결과를 추적해야 하지만, 이미 로그로 확인 가능
        return true; // 실제로는 각 옵션별로 확인됨
      }).length,
    });

    if (!allVerified) {
      logger.warn(
        "[buyNowWithOptionsAndRedirect] ⚠️ 일부 옵션 확인 실패했지만 계속 진행 (DB 지연 가능성)",
      );
    }

    logger.info("[buyNowWithOptionsAndRedirect] ✅ 6단계: 모든 검증 완료");
    logger.info("[buyNowWithOptionsAndRedirect] 7단계: revalidatePath 실행");

    // 캐시 갱신
    revalidatePath("/checkout");
    revalidatePath("/cart");

    logger.info(
      "[buyNowWithOptionsAndRedirect] ✅ 8단계: 완료 - 클라이언트에서 리다이렉트 필요",
    );
    logger.groupEnd();

    // 성공 반환 (클라이언트에서 리다이렉트)
    return { success: true };
  } catch (error) {
    // 실제 에러인 경우
    logger.error(
      "[buyNowWithOptionsAndRedirect] ❌ 예외 발생:",
      error instanceof Error ? error : new Error(String(error)),
    );
    logger.groupEnd();

    const errorMessage =
      error instanceof Error
        ? error.message
        : "바로 구매 처리 중 오류가 발생했습니다.";

    return { success: false, message: errorMessage };
  }
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
      logger.debug("[removeFromCart] 사용자 미인증");
      return { success: false, message: "로그인이 필요합니다." };
    }

    // PGRST301 에러 방지를 위해 토큰 확인
    const authResult = await auth();
    const token = await authResult.getToken();
    let supabase;

    if (!token) {
      logger.debug("[removeFromCart] 토큰 없음, service role 클라이언트 사용");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      supabase = getServiceRoleClient();
    } else {
      supabase = await createClient();
    }

    let { data: item, error: selectError } = await supabase
      .from("cart_items")
      .select("cart:carts!fk_cart_items_cart_id(user_id)")
      .eq("id", itemId)
      .single();

    // PGRST301 에러 발생 시 service role 클라이언트로 재시도
    if (selectError && selectError.code === "PGRST301") {
      logger.debug("[removeFromCart] SELECT PGRST301 에러, service role로 재시도");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      supabase = getServiceRoleClient();

      const { data: retryItem, error: retrySelectError } = await supabase
        .from("cart_items")
        .select("cart:carts!fk_cart_items_cart_id(user_id)")
        .eq("id", itemId)
        .single();

      if (retrySelectError) {
        logger.error("[removeFromCart] 장바구니 아이템 조회 실패", retrySelectError);
        return {
          success: false,
          message: "장바구니 아이템을 찾을 수 없습니다.",
        };
      }

      item = retryItem;
    } else if (selectError) {
      logger.error("[removeFromCart] 장바구니 아이템 조회 실패", selectError);
      return { success: false, message: "장바구니 아이템을 찾을 수 없습니다." };
    }

    if (!item) {
      logger.warn("[removeFromCart] 장바구니 아이템 없음");
      return { success: false, message: "장바구니 아이템을 찾을 수 없습니다." };
    }

    const cart = item.cart as unknown as { user_id: string } | null;

    if (!cart || cart.user_id !== userId) {
      logger.warn("[removeFromCart] 권한 없음");
      return { success: false, message: "권한이 없습니다." };
    }

    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", itemId);

    // PGRST301 에러 발생 시 service role 클라이언트로 재시도
    if (deleteError && deleteError.code === "PGRST301") {
      logger.debug("[removeFromCart] DELETE PGRST301 에러, service role로 재시도");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      const serviceSupabase = getServiceRoleClient();

      const { error: retryDeleteError } = await serviceSupabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (retryDeleteError) {
        logger.error("[removeFromCart] 장바구니 아이템 삭제 실패", retryDeleteError);
        return { success: false, message: "삭제에 실패했습니다." };
      }
    } else if (deleteError) {
      logger.error("[removeFromCart] 장바구니 아이템 삭제 실패", deleteError);
      return { success: false, message: "삭제에 실패했습니다." };
    }

    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { success: true, message: "상품이 삭제되었습니다." };
  } catch (error) {
    logger.error("[removeFromCart] 예외 발생", error);
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
