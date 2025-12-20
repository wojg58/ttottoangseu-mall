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
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const supabase = await createClient();
  let { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .is("deleted_at", null)
    .maybeSingle();

  // 사용자가 없으면 동기화 시도
  if (!user && !error) {
    try {
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
          return newUser.id;
        }
      }
    } catch (syncError) {
      logger.error("사용자 동기화 실패", syncError);
    }

    const { data: retryUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();

    user = retryUser;
  }

  if (error) {
    logger.error("사용자 조회 실패", error);
    return null;
  }

  return user?.id ?? null;
}

// 장바구니 ID 조회/생성
async function getOrCreateCartId(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existingCart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existingCart) return existingCart.id;

  const { data: newCart, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) {
    logger.error("장바구니 생성 실패", error);
    throw new Error("장바구니 생성에 실패했습니다.");
  }

  return newCart.id;
}

// 장바구니 아이템 조회
export async function getCartItems(): Promise<CartItemWithProduct[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const supabase = await createClient();

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

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

    const { data: product } = await supabase
      .from("products")
      .select("id, price, discount_price, stock, status")
      .eq("id", productId)
      .is("deleted_at", null)
      .single();

    if (!product) {
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
    return { success: true, message: "장바구니에 추가되었습니다." };
  } catch (error) {
    logger.error("장바구니 추가 실패", error);
    return { success: false, message: "장바구니 추가에 실패했습니다." };
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
