-- ============================================================================
-- 결제 내역 뷰 삭제 마이그레이션
-- ============================================================================
-- 
-- 이 마이그레이션은 다음 VIEW들을 삭제합니다:
-- - payment_history_view: 주문별 결제 내역 뷰
-- - payment_history_detail_view: 주문 상품별 결제 내역 상세 뷰
-- 
-- 주의: VIEW를 삭제해도 실제 데이터(orders, payments, order_items 등)는 삭제되지 않습니다.
-- VIEW는 단순히 데이터를 조회하는 쿼리 결과를 보여주는 것이므로, 
-- VIEW를 삭제해도 원본 테이블의 데이터에는 영향을 주지 않습니다.
-- ============================================================================

-- payment_history_detail_view 삭제 (상세 뷰를 먼저 삭제 - 의존성 때문)
DROP VIEW IF EXISTS public.payment_history_detail_view CASCADE;

-- payment_history_view 삭제
DROP VIEW IF EXISTS public.payment_history_view CASCADE;

-- 삭제 완료 확인 (에러가 발생하지 않으면 성공)
-- SELECT 'payment_history_view와 payment_history_detail_view가 삭제되었습니다.' AS result;
