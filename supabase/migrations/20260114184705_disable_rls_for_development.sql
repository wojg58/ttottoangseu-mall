-- ============================================================================
-- 개발 환경용 RLS 비활성화
-- ============================================================================
-- 
-- 규칙에 따라 개발 환경에서는 RLS를 비활성화합니다.
-- 배포 환경도 개발 환경이므로 RLS를 비활성화합니다.
-- 
-- 프로덕션 배포 전에는 적절한 RLS 정책을 활성화해야 합니다.
-- ============================================================================

-- orders 테이블 RLS 비활성화
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- order_items 테이블 RLS 비활성화
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;

-- users 테이블 RLS 비활성화
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- payments 테이블 RLS 비활성화
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- carts 테이블 RLS 비활성화
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;

-- cart_items 테이블 RLS 비활성화
ALTER TABLE public.cart_items DISABLE ROW LEVEL SECURITY;

-- chat_sessions 테이블 RLS 비활성화
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;

-- chat_messages 테이블 RLS 비활성화
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- products 테이블 RLS 비활성화
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- categories 테이블 RLS 비활성화
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- coupons 테이블 RLS 비활성화
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
