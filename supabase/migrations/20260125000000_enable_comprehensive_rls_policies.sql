-- ============================================================================
-- RLS (Row Level Security) 정책 활성화 및 작성 (포괄적 버전)
-- ============================================================================
-- 
-- 프로덕션 배포 전 필수 보안 정책
-- Clerk 인증을 사용하므로 auth.jwt()->>'sub'로 clerk_user_id 확인
-- 
-- 포함 내용:
-- - 모든 테이블에 대한 RLS 정책
-- - 관리자 권한 확인 헬퍼 함수
-- - 사용자별 접근 제어
-- - 공개 데이터 접근 제어
-- ============================================================================

-- ============================================================================
-- 0. 관리자 권한 확인 헬퍼 함수
-- ============================================================================

-- 기존 함수가 있으면 삭제
DROP FUNCTION IF EXISTS public.is_admin_user() CASCADE;

-- 관리자 권한 확인 함수
-- users 테이블에서 clerk_user_id와 role을 확인하여 관리자 여부 판단
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
    AND users.role = 'admin'
    AND users.deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin_user() IS '현재 인증된 사용자가 관리자인지 확인 (Clerk user ID 기반)';

-- ============================================================================
-- 1. users 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admin can view all users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 정보만 조회 가능
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (
  clerk_user_id = (auth.jwt()->>'sub')::TEXT
);

-- 정책: 사용자는 자신의 정보만 수정 가능
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (
  clerk_user_id = (auth.jwt()->>'sub')::TEXT
)
WITH CHECK (
  clerk_user_id = (auth.jwt()->>'sub')::TEXT
);

-- 정책: 관리자는 모든 사용자 조회 가능
CREATE POLICY "Admin can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 사용자 수정 가능
CREATE POLICY "Admin can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 사용자 정보 접근 가능 (동기화 등)
CREATE POLICY "Service role can manage all users"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 2. products 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin can manage all products" ON public.products;
DROP POLICY IF EXISTS "Service role can manage all products" ON public.products;

-- RLS 활성화
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 활성 상품 조회 가능
CREATE POLICY "Anyone can view active products"
ON public.products
FOR SELECT
TO public
USING (
  status = 'active'
  AND deleted_at IS NULL
);

-- 정책: 관리자는 모든 상품 조회 가능 (숨김/품절 포함)
CREATE POLICY "Admin can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 상품 관리 가능 (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin can manage all products"
ON public.products
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 상품 관리 가능
CREATE POLICY "Service role can manage all products"
ON public.products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 3. categories 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can manage all categories" ON public.categories;
DROP POLICY IF EXISTS "Service role can manage all categories" ON public.categories;

-- RLS 활성화
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 활성 카테고리 조회 가능
CREATE POLICY "Anyone can view active categories"
ON public.categories
FOR SELECT
TO public
USING (
  is_active = true
  AND deleted_at IS NULL
);

-- 정책: 관리자는 모든 카테고리 조회 가능
CREATE POLICY "Admin can view all categories"
ON public.categories
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 카테고리 관리 가능
CREATE POLICY "Admin can manage all categories"
ON public.categories
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 카테고리 관리 가능
CREATE POLICY "Service role can manage all categories"
ON public.categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 4. product_images 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view product images" ON public.product_images;
DROP POLICY IF EXISTS "Admin can manage all product images" ON public.product_images;
DROP POLICY IF EXISTS "Service role can manage all product images" ON public.product_images;

-- RLS 활성화
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 상품 이미지 조회 가능
CREATE POLICY "Anyone can view product images"
ON public.product_images
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_images.product_id
    AND products.status = 'active'
    AND products.deleted_at IS NULL
  )
);

-- 정책: 관리자는 모든 상품 이미지 관리 가능
CREATE POLICY "Admin can manage all product images"
ON public.product_images
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 상품 이미지 관리 가능
CREATE POLICY "Service role can manage all product images"
ON public.product_images
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 5. product_variants 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin can manage all product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Service role can manage all product variants" ON public.product_variants;

-- RLS 활성화
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 상품 옵션 조회 가능
CREATE POLICY "Anyone can view product variants"
ON public.product_variants
FOR SELECT
TO public
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_variants.product_id
    AND products.status = 'active'
    AND products.deleted_at IS NULL
  )
);

-- 정책: 관리자는 모든 상품 옵션 관리 가능
CREATE POLICY "Admin can manage all product variants"
ON public.product_variants
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 상품 옵션 관리 가능
CREATE POLICY "Service role can manage all product variants"
ON public.product_variants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 6. product_categories 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admin can manage all product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Service role can manage all product categories" ON public.product_categories;

-- RLS 활성화
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 상품-카테고리 관계 조회 가능
CREATE POLICY "Anyone can view product categories"
ON public.product_categories
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_categories.product_id
    AND products.status = 'active'
    AND products.deleted_at IS NULL
  )
);

-- 정책: 관리자는 모든 상품-카테고리 관계 관리 가능
CREATE POLICY "Admin can manage all product categories"
ON public.product_categories
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 상품-카테고리 관계 관리 가능
CREATE POLICY "Service role can manage all product categories"
ON public.product_categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 7. carts 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can manage own cart" ON public.carts;
DROP POLICY IF EXISTS "Admin can view all carts" ON public.carts;
DROP POLICY IF EXISTS "Service role can manage all carts" ON public.carts;

-- RLS 활성화
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 장바구니만 조회 가능
CREATE POLICY "Users can view own cart"
ON public.carts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = carts.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 장바구니만 생성/수정/삭제 가능
CREATE POLICY "Users can manage own cart"
ON public.carts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = carts.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = carts.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 장바구니 조회 가능
CREATE POLICY "Admin can view all carts"
ON public.carts
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 장바구니 접근 가능
CREATE POLICY "Service role can manage all carts"
ON public.carts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 8. cart_items 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Admin can view all cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Service role can manage all cart items" ON public.cart_items;

-- RLS 활성화
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 장바구니 상품만 조회 가능
CREATE POLICY "Users can view own cart items"
ON public.cart_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.carts
    JOIN public.users ON users.id = carts.user_id
    WHERE carts.id = cart_items.cart_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 장바구니 상품만 생성/수정/삭제 가능
CREATE POLICY "Users can manage own cart items"
ON public.cart_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.carts
    JOIN public.users ON users.id = carts.user_id
    WHERE carts.id = cart_items.cart_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.carts
    JOIN public.users ON users.id = carts.user_id
    WHERE carts.id = cart_items.cart_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 장바구니 상품 조회 가능
CREATE POLICY "Admin can view all cart items"
ON public.cart_items
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 장바구니 상품 접근 가능
CREATE POLICY "Service role can manage all cart items"
ON public.cart_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 9. orders 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;

-- RLS 활성화
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 주문만 조회 가능
CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = orders.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 주문만 생성 가능
CREATE POLICY "Users can create own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = orders.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 주문만 수정 가능 (상태 변경 등)
CREATE POLICY "Users can update own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = orders.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = orders.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 주문 조회 가능
CREATE POLICY "Admin can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 주문 관리 가능
CREATE POLICY "Admin can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 주문 접근 가능
CREATE POLICY "Service role can manage all orders"
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 10. order_items 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admin can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Service role can manage all order items" ON public.order_items;

-- RLS 활성화
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 주문 상품만 조회 가능
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.users ON users.id = orders.user_id
    WHERE orders.id = order_items.order_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 주문 상품만 생성 가능
CREATE POLICY "Users can create own order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.users ON users.id = orders.user_id
    WHERE orders.id = order_items.order_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 주문 상품 조회 가능
CREATE POLICY "Admin can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 주문 상품 접근 가능
CREATE POLICY "Service role can manage all order items"
ON public.order_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 11. payments 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admin can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Service role can manage all payments" ON public.payments;

-- RLS 활성화
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 결제 정보만 조회 가능
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.users ON users.id = orders.user_id
    WHERE orders.id = payments.order_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 결제 정보 조회 가능
CREATE POLICY "Admin can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 결제 정보 접근 가능 (결제 처리용)
CREATE POLICY "Service role can manage all payments"
ON public.payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 12. refunds 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admin can view all refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admin can manage all refunds" ON public.refunds;
DROP POLICY IF EXISTS "Service role can manage all refunds" ON public.refunds;

-- RLS 활성화
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 환불 정보만 조회 가능
CREATE POLICY "Users can view own refunds"
ON public.refunds
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.users ON users.id = orders.user_id
    WHERE orders.id = refunds.order_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 환불 정보 조회 가능
CREATE POLICY "Admin can view all refunds"
ON public.refunds
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 환불 정보 관리 가능
CREATE POLICY "Admin can manage all refunds"
ON public.refunds
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 환불 정보 접근 가능
CREATE POLICY "Service role can manage all refunds"
ON public.refunds
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 13. coupons 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin can view all coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admin can manage all coupons" ON public.coupons;
DROP POLICY IF EXISTS "Service role can manage all coupons" ON public.coupons;

-- RLS 활성화
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 쿠폰만 조회 가능
CREATE POLICY "Users can view own coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = coupons.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 쿠폰 조회 가능
CREATE POLICY "Admin can view all coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 쿠폰 관리 가능
CREATE POLICY "Admin can manage all coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 쿠폰 관리 가능
CREATE POLICY "Service role can manage all coupons"
ON public.coupons
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 14. reviews 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view active reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admin can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage all reviews" ON public.reviews;

-- RLS 활성화
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 활성 리뷰 조회 가능
CREATE POLICY "Anyone can view active reviews"
ON public.reviews
FOR SELECT
TO public
USING (
  deleted_at IS NULL
);

-- 정책: 사용자는 자신의 리뷰만 생성 가능
CREATE POLICY "Users can create own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = reviews.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 리뷰만 수정 가능
CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = reviews.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = reviews.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 리뷰 관리 가능
CREATE POLICY "Admin can manage all reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 리뷰 접근 가능
CREATE POLICY "Service role can manage all reviews"
ON public.reviews
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 15. inquiries 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can create own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admin can view all inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admin can manage all inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Service role can manage all inquiries" ON public.inquiries;

-- RLS 활성화
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 문의만 조회 가능 (비공개 문의는 본인만)
CREATE POLICY "Users can view own inquiries"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  (
    user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = inquiries.user_id
      AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
    )
  )
  OR (
    is_secret = false
    AND deleted_at IS NULL
  )
);

-- 정책: 사용자는 자신의 문의만 생성 가능
CREATE POLICY "Users can create own inquiries"
ON public.inquiries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = inquiries.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 문의만 수정 가능
CREATE POLICY "Users can update own inquiries"
ON public.inquiries
FOR UPDATE
TO authenticated
USING (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = inquiries.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = inquiries.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 문의 조회 가능
CREATE POLICY "Admin can view all inquiries"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자는 모든 문의 관리 가능 (답변 등)
CREATE POLICY "Admin can manage all inquiries"
ON public.inquiries
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 문의 접근 가능
CREATE POLICY "Service role can manage all inquiries"
ON public.inquiries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 16. chat_sessions 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Admin can view all chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Service role can manage all chat sessions" ON public.chat_sessions;

-- RLS 활성화
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 챗봇 세션만 조회 가능
CREATE POLICY "Users can view own chat sessions"
ON public.chat_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = chat_sessions.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 챗봇 세션만 생성 가능
CREATE POLICY "Users can create own chat sessions"
ON public.chat_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = chat_sessions.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 챗봇 세션만 수정 가능
CREATE POLICY "Users can update own chat sessions"
ON public.chat_sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = chat_sessions.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = chat_sessions.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 챗봇 세션 조회 가능
CREATE POLICY "Admin can view all chat sessions"
ON public.chat_sessions
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 챗봇 세션 접근 가능
CREATE POLICY "Service role can manage all chat sessions"
ON public.chat_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 17. chat_messages 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin can view all chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Service role can manage all chat messages" ON public.chat_messages;

-- RLS 활성화
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 챗봇 메시지만 조회 가능
CREATE POLICY "Users can view own chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions
    JOIN public.users ON users.id = chat_sessions.user_id
    WHERE chat_sessions.id = chat_messages.session_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 사용자는 자신의 챗봇 메시지만 생성 가능
CREATE POLICY "Users can create own chat messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions
    JOIN public.users ON users.id = chat_sessions.user_id
    WHERE chat_sessions.id = chat_messages.session_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
  )
);

-- 정책: 관리자는 모든 챗봇 메시지 조회 가능
CREATE POLICY "Admin can view all chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 챗봇 메시지 접근 가능
CREATE POLICY "Service role can manage all chat messages"
ON public.chat_messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 18. member_additional_info 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own member info" ON public.member_additional_info;
DROP POLICY IF EXISTS "Users can update own member info" ON public.member_additional_info;
DROP POLICY IF EXISTS "Admin can view all member info" ON public.member_additional_info;
DROP POLICY IF EXISTS "Service role can manage all member info" ON public.member_additional_info;

-- RLS 활성화
ALTER TABLE public.member_additional_info ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 추가 정보만 조회 가능
CREATE POLICY "Users can view own member info"
ON public.member_additional_info
FOR SELECT
TO authenticated
USING (
  clerk_id = (auth.jwt()->>'sub')::TEXT
);

-- 정책: 사용자는 자신의 추가 정보만 수정 가능
CREATE POLICY "Users can update own member info"
ON public.member_additional_info
FOR UPDATE
TO authenticated
USING (
  clerk_id = (auth.jwt()->>'sub')::TEXT
)
WITH CHECK (
  clerk_id = (auth.jwt()->>'sub')::TEXT
);

-- 정책: 관리자는 모든 추가 정보 조회 가능
CREATE POLICY "Admin can view all member info"
ON public.member_additional_info
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 추가 정보 접근 가능
CREATE POLICY "Service role can manage all member info"
ON public.member_additional_info
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 19. naver_sync_queue 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admin can view all sync queue" ON public.naver_sync_queue;
DROP POLICY IF EXISTS "Admin can manage all sync queue" ON public.naver_sync_queue;
DROP POLICY IF EXISTS "Service role can manage all sync queue" ON public.naver_sync_queue;

-- RLS 활성화
ALTER TABLE public.naver_sync_queue ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 동기화 큐 조회 가능
CREATE POLICY "Admin can view all sync queue"
ON public.naver_sync_queue
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 관리자만 동기화 큐 관리 가능
CREATE POLICY "Admin can manage all sync queue"
ON public.naver_sync_queue
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 동기화 큐 접근 가능
CREATE POLICY "Service role can manage all sync queue"
ON public.naver_sync_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 20. shipping_settings 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제 (이미 RLS 활성화되어 있을 수 있음)
DROP POLICY IF EXISTS "Anyone can view shipping settings" ON public.shipping_settings;
DROP POLICY IF EXISTS "Admin can manage shipping settings" ON public.shipping_settings;
DROP POLICY IF EXISTS "Service role can manage shipping settings" ON public.shipping_settings;

-- RLS 활성화
ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 배송비 설정 조회 가능
CREATE POLICY "Anyone can view shipping settings"
ON public.shipping_settings
FOR SELECT
TO public
USING (
  is_active = true
);

-- 정책: 관리자만 배송비 설정 관리 가능
CREATE POLICY "Admin can manage shipping settings"
ON public.shipping_settings
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 배송비 설정 접근 가능
CREATE POLICY "Service role can manage shipping settings"
ON public.shipping_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 21. return_policies 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제 (이미 RLS 활성화되어 있을 수 있음)
DROP POLICY IF EXISTS "Anyone can view return policies" ON public.return_policies;
DROP POLICY IF EXISTS "Admin can manage return policies" ON public.return_policies;
DROP POLICY IF EXISTS "Service role can manage return policies" ON public.return_policies;

-- RLS 활성화
ALTER TABLE public.return_policies ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 반품 정책 조회 가능
CREATE POLICY "Anyone can view return policies"
ON public.return_policies
FOR SELECT
TO public
USING (
  is_active = true
);

-- 정책: 관리자만 반품 정책 관리 가능
CREATE POLICY "Admin can manage return policies"
ON public.return_policies
FOR ALL
TO authenticated
USING (
  public.is_admin_user()
)
WITH CHECK (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 반품 정책 접근 가능
CREATE POLICY "Service role can manage return policies"
ON public.return_policies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 22. system_logs 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제 (이미 RLS 활성화되어 있을 수 있음)
DROP POLICY IF EXISTS "Admin can view all system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Service role can manage all system logs" ON public.system_logs;

-- RLS 활성화
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 시스템 로그 조회 가능
CREATE POLICY "Admin can view all system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 시스템 로그 접근 가능 (로그 기록용)
CREATE POLICY "Service role can manage all system logs"
ON public.system_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 23. audit_logs 테이블 RLS 정책
-- ============================================================================

-- 기존 정책 삭제 (이미 RLS 활성화되어 있을 수 있음)
DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can manage all audit logs" ON public.audit_logs;

-- RLS 활성화
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 감사 로그 조회 가능
CREATE POLICY "Admin can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin_user()
);

-- 정책: 서비스 롤은 모든 감사 로그 접근 가능 (로그 기록용)
CREATE POLICY "Service role can manage all audit logs"
ON public.audit_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 24. admin_activity_logs 테이블 RLS 정책
-- ============================================================================
-- 주의: 이 테이블은 이미 RLS 정책이 있을 수 있음 (20260116000000_create_admin_activity_logs.sql)
-- 기존 정책과 충돌하지 않도록 확인 필요

-- 기존 정책 확인 후 필요시 업데이트
-- 기존 정책이 있으면 그대로 유지하고, 없으면 생성

-- RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 없으면 생성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_activity_logs'
    AND policyname = 'admin_only_select_admin_activity_logs'
  ) THEN
    CREATE POLICY "admin_only_select_admin_activity_logs"
    ON public.admin_activity_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
        AND users.role = 'admin'
        AND users.deleted_at IS NULL
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_activity_logs'
    AND policyname = 'admin_only_insert_admin_activity_logs'
  ) THEN
    CREATE POLICY "admin_only_insert_admin_activity_logs"
    ON public.admin_activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.clerk_user_id = (auth.jwt()->>'sub')::TEXT
        AND users.role = 'admin'
        AND users.deleted_at IS NULL
      )
    );
  END IF;
END $$;

-- 정책: 서비스 롤은 모든 관리자 활동 로그 접근 가능
DROP POLICY IF EXISTS "Service role can manage all admin activity logs" ON public.admin_activity_logs;
CREATE POLICY "Service role can manage all admin activity logs"
ON public.admin_activity_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 주석 및 설명
-- ============================================================================

COMMENT ON FUNCTION public.is_admin_user() IS 
'현재 인증된 사용자가 관리자인지 확인하는 헬퍼 함수 (Clerk user ID 기반)';

COMMENT ON POLICY "Users can view own profile" ON public.users IS 
'사용자는 자신의 프로필 정보만 조회 가능 (Clerk user ID 기반)';

COMMENT ON POLICY "Admin can view all users" ON public.users IS 
'관리자는 모든 사용자 정보 조회 가능';

COMMENT ON POLICY "Anyone can view active products" ON public.products IS 
'모든 사용자가 활성 상품을 조회 가능 (공개 데이터)';

COMMENT ON POLICY "Users can view own orders" ON public.orders IS 
'사용자는 자신의 주문만 조회 가능';

COMMENT ON POLICY "Admin can view all orders" ON public.orders IS 
'관리자는 모든 주문 조회 가능';

COMMENT ON POLICY "Users can view own payments" ON public.payments IS 
'사용자는 자신의 결제 정보만 조회 가능';

COMMENT ON POLICY "Anyone can view active reviews" ON public.reviews IS 
'모든 사용자가 활성 리뷰를 조회 가능 (공개 데이터)';

COMMENT ON POLICY "Users can view own inquiries" ON public.inquiries IS 
'사용자는 자신의 문의만 조회 가능 (비공개 문의는 본인만)';

COMMENT ON POLICY "Admin can view all inquiries" ON public.inquiries IS 
'관리자는 모든 문의 조회 가능 (답변 작성용)';
