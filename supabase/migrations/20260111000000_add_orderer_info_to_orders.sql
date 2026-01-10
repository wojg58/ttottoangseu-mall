-- ============================================================================
-- orders 테이블에 주문자 정보 컬럼 추가
-- ============================================================================
-- 
-- 주문자 정보(orderer_name, orderer_phone, orderer_email)를 orders 테이블에 저장
-- 배송 정보와 주문자 정보를 분리하여 관리
-- 
-- 사용 방법:
-- - Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================================

-- 1. 주문자 정보 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS orderer_name TEXT,
ADD COLUMN IF NOT EXISTS orderer_phone TEXT,
ADD COLUMN IF NOT EXISTS orderer_email TEXT;

-- 2. 주석 추가
COMMENT ON COLUMN public.orders.orderer_name IS '주문자 이름';
COMMENT ON COLUMN public.orders.orderer_phone IS '주문자 연락처';
COMMENT ON COLUMN public.orders.orderer_email IS '주문자 이메일';

-- 3. 인덱스 추가 (주문자 이메일로 검색 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_orders_orderer_email ON public.orders(orderer_email)
WHERE orderer_email IS NOT NULL;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

