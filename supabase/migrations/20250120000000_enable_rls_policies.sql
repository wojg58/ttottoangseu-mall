-- ============================================================================
-- RLS (Row Level Security) 정책 활성화 및 작성
-- ============================================================================
-- 
-- 프로덕션 배포 전 필수 보안 정책
-- Clerk 인증을 사용하므로 auth.jwt()->>'sub'로 clerk_user_id 확인
-- 
-- 포함 내용:
-- - users: 사용자는 자신의 정보만 조회/수정 가능
-- - orders: 사용자는 자신의 주문만 조회 가능
-- - payments: 사용자는 자신의 결제 정보만 조회 가능
-- - chat_sessions: 사용자는 자신의 세션만 조회 가능
-- - chat_messages: 사용자는 자신의 메시지만 조회 가능
-- - carts: 사용자는 자신의 장바구니만 조회 가능
-- - products: 공개 데이터, 모든 사용자가 조회 가능
-- ============================================================================

-- ============================================================================
-- 1. users 테이블 RLS 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 정보만 조회 가능
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (
  clerk_user_id = (auth.jwt()->>'sub')::text
);

-- 정책: 사용자는 자신의 정보만 수정 가능
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (
  clerk_user_id = (auth.jwt()->>'sub')::text
)
WITH CHECK (
  clerk_user_id = (auth.jwt()->>'sub')::text
);

-- 정책: 서비스 롤은 모든 사용자 정보 접근 가능 (동기화 등)
CREATE POLICY "Service role can manage all users"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 2. orders 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = orders.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 주문 접근 가능
CREATE POLICY "Service role can manage all orders"
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 3. order_items 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 주문 상품 접근 가능
CREATE POLICY "Service role can manage all order items"
ON public.order_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 4. payments 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 결제 정보 접근 가능 (결제 처리용)
CREATE POLICY "Service role can manage all payments"
ON public.payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 5. chat_sessions 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = chat_sessions.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 챗봇 세션 접근 가능
CREATE POLICY "Service role can manage all chat sessions"
ON public.chat_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 6. chat_messages 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 챗봇 메시지 접근 가능
CREATE POLICY "Service role can manage all chat messages"
ON public.chat_messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 7. carts 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 사용자는 자신의 장바구니만 생성/수정 가능
CREATE POLICY "Users can manage own cart"
ON public.carts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = carts.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = carts.user_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.carts
    JOIN public.users ON users.id = carts.user_id
    WHERE carts.id = cart_items.cart_id
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 장바구니 상품 접근 가능
CREATE POLICY "Service role can manage all cart items"
ON public.cart_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 9. products 테이블 RLS 정책 (공개 데이터)
-- ============================================================================

-- RLS 활성화
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자(인증/비인증)가 활성 상품 조회 가능
CREATE POLICY "Anyone can view active products"
ON public.products
FOR SELECT
TO public
USING (
  is_active = true
  AND deleted_at IS NULL
);

-- 정책: 서비스 롤은 모든 상품 관리 가능
CREATE POLICY "Service role can manage all products"
ON public.products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 10. categories 테이블 RLS 정책 (공개 데이터)
-- ============================================================================

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

-- 정책: 서비스 롤은 모든 카테고리 관리 가능
CREATE POLICY "Service role can manage all categories"
ON public.categories
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 11. coupons 테이블 RLS 정책
-- ============================================================================

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
    AND users.clerk_user_id = (auth.jwt()->>'sub')::text
  )
);

-- 정책: 서비스 롤은 모든 쿠폰 관리 가능
CREATE POLICY "Service role can manage all coupons"
ON public.coupons
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 주석
-- ============================================================================

COMMENT ON POLICY "Users can view own profile" ON public.users IS 
'사용자는 자신의 프로필 정보만 조회 가능 (Clerk user ID 기반)';

COMMENT ON POLICY "Users can view own orders" ON public.orders IS 
'사용자는 자신의 주문만 조회 가능';

COMMENT ON POLICY "Users can view own payments" ON public.payments IS 
'사용자는 자신의 결제 정보만 조회 가능';

COMMENT ON POLICY "Users can view own chat sessions" ON public.chat_sessions IS 
'사용자는 자신의 챗봇 세션만 조회 가능';

COMMENT ON POLICY "Anyone can view active products" ON public.products IS 
'모든 사용자가 활성 상품을 조회 가능 (공개 데이터)';

