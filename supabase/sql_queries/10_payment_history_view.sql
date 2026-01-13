-- ============================================================================
-- 결제 내역 조회용 뷰 생성 (구매 담당자용)
-- ============================================================================
-- 
-- 이 스크립트는 구매 담당자가 결제 내역을 조회할 수 있는 뷰를 생성합니다.
-- 
-- 주요 특징:
-- 1. 모든 시간 필드는 한국 시간(KST)으로 변환하여 표시
-- 2. 원본 테이블은 수정하지 않음 (읽기 전용 뷰)
-- 3. 구매 담당자가 궁금해할만한 모든 정보 포함
-- 
-- 생성되는 뷰:
-- - payment_history_view: 주문별 결제 내역 (orders + payments + users)
-- - payment_history_detail_view: 주문 상품별 결제 내역 (위 + order_items)
-- 
-- 사용 방법:
-- - Supabase 대시보드 → SQL Editor에서 실행
-- - 조회: SELECT * FROM payment_history_view ORDER BY order_created_at_kst DESC;
-- ============================================================================

-- ============================================================================
-- 1. 주문별 결제 내역 뷰 생성
-- ============================================================================
-- 주문, 결제, 고객 정보를 통합한 뷰
-- ============================================================================

CREATE OR REPLACE VIEW public.payment_history_view AS
SELECT 
    -- 주문 기본 정보
    o.id AS order_id,
    o.order_number,
    o.payment_status,
    o.fulfillment_status,
    o.total_amount,
    
    -- 주문 시간 (한국 시간)
    o.created_at AS order_created_at_utc,
    (o.created_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS order_created_at_kst,
    TO_CHAR((o.created_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS order_created_at_kst_text,
    
    -- 결제 완료 시간 (한국 시간)
    o.paid_at AS paid_at_utc,
    (o.paid_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS paid_at_kst,
    TO_CHAR((o.paid_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS paid_at_kst_text,
    
    -- 고객 정보
    u.id AS user_id,
    u.name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    
    -- 배송 정보
    o.shipping_name,
    o.shipping_phone,
    o.shipping_address,
    o.shipping_zip_code,
    o.shipping_memo,
    o.shipping_status,
    o.tracking_number,
    
    -- 배송 시간 (한국 시간)
    o.shipped_at AS shipped_at_utc,
    (o.shipped_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS shipped_at_kst,
    TO_CHAR((o.shipped_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS shipped_at_kst_text,
    
    o.delivered_at AS delivered_at_utc,
    (o.delivered_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS delivered_at_kst,
    TO_CHAR((o.delivered_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS delivered_at_kst_text,
    
    -- 결제 정보
    p.id AS payment_id,
    p.payment_key,
    p.toss_payment_id,
    p.method AS payment_method,
    CASE 
        WHEN p.method = 'card' THEN '카드'
        WHEN p.method = 'virtual_account' THEN '가상계좌'
        WHEN p.method = 'transfer' THEN '계좌이체'
        WHEN p.method = 'mobile' THEN '휴대폰'
        ELSE '기타'
    END AS payment_method_kr,
    p.status AS payment_status_detail,
    CASE 
        WHEN p.status = 'pending' THEN '대기'
        WHEN p.status = 'ready' THEN '준비'
        WHEN p.status = 'in_progress' THEN '진행중'
        WHEN p.status = 'done' THEN '완료'
        WHEN p.status = 'cancelled' THEN '취소'
        WHEN p.status = 'failed' THEN '실패'
        WHEN p.status = 'expired' THEN '만료'
        ELSE p.status
    END AS payment_status_detail_kr,
    p.amount AS payment_amount,
    
    -- 결제 시간 (한국 시간)
    p.requested_at AS payment_requested_at_utc,
    (p.requested_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS payment_requested_at_kst,
    TO_CHAR((p.requested_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS payment_requested_at_kst_text,
    
    p.approved_at AS payment_approved_at_utc,
    (p.approved_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS payment_approved_at_kst,
    TO_CHAR((p.approved_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS payment_approved_at_kst_text,
    
    p.failed_at AS payment_failed_at_utc,
    (p.failed_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS payment_failed_at_kst,
    TO_CHAR((p.failed_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS payment_failed_at_kst_text,
    
    p.cancelled_at AS payment_cancelled_at_utc,
    (p.cancelled_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS payment_cancelled_at_kst,
    TO_CHAR((p.cancelled_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS payment_cancelled_at_kst_text,
    
    -- 카드 정보
    p.card_company,
    p.card_number,
    p.installment_plan_months,
    CASE 
        WHEN p.installment_plan_months IS NULL OR p.installment_plan_months = 0 THEN '일시불'
        ELSE p.installment_plan_months::TEXT || '개월 할부'
    END AS installment_info,
    
    -- 기타 결제 정보
    p.receipt_url,
    p.failure_code,
    p.failure_message,
    p.cancel_reason,
    p.metadata AS payment_metadata,
    
    -- 업데이트 시간 (한국 시간)
    o.updated_at AS order_updated_at_utc,
    (o.updated_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS order_updated_at_kst,
    TO_CHAR((o.updated_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS order_updated_at_kst_text

FROM public.orders o
LEFT JOIN public.users u ON u.id = o.user_id
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
ORDER BY o.created_at DESC;

-- 뷰 주석
COMMENT ON VIEW public.payment_history_view IS '주문별 결제 내역 뷰 (구매 담당자용) - 모든 시간은 한국 시간(KST)으로 변환';

-- ============================================================================
-- 2. 주문 상품별 결제 내역 상세 뷰 생성
-- ============================================================================
-- 주문 상품 정보까지 포함한 상세 뷰
-- ============================================================================

CREATE OR REPLACE VIEW public.payment_history_detail_view AS
SELECT 
    -- 주문 기본 정보
    o.id AS order_id,
    o.order_number,
    o.payment_status,
    o.fulfillment_status,
    o.total_amount,
    
    -- 주문 시간 (한국 시간)
    o.created_at AS order_created_at_utc,
    (o.created_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS order_created_at_kst,
    TO_CHAR((o.created_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS order_created_at_kst_text,
    
    -- 결제 완료 시간 (한국 시간)
    o.paid_at AS paid_at_utc,
    (o.paid_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS paid_at_kst,
    TO_CHAR((o.paid_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS paid_at_kst_text,
    
    -- 고객 정보
    u.id AS user_id,
    u.name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    
    -- 배송 정보
    o.shipping_name,
    o.shipping_phone,
    o.shipping_address,
    o.shipping_zip_code,
    o.shipping_memo,
    o.shipping_status,
    o.tracking_number,
    
    -- 배송 시간 (한국 시간)
    o.shipped_at AS shipped_at_utc,
    (o.shipped_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS shipped_at_kst,
    TO_CHAR((o.shipped_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS shipped_at_kst_text,
    
    o.delivered_at AS delivered_at_utc,
    (o.delivered_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS delivered_at_kst,
    TO_CHAR((o.delivered_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS delivered_at_kst_text,
    
    -- 결제 정보
    p.id AS payment_id,
    p.payment_key,
    p.toss_payment_id,
    p.method AS payment_method,
    CASE 
        WHEN p.method = 'card' THEN '카드'
        WHEN p.method = 'virtual_account' THEN '가상계좌'
        WHEN p.method = 'transfer' THEN '계좌이체'
        WHEN p.method = 'mobile' THEN '휴대폰'
        ELSE '기타'
    END AS payment_method_kr,
    p.status AS payment_status_detail,
    CASE 
        WHEN p.status = 'pending' THEN '대기'
        WHEN p.status = 'ready' THEN '준비'
        WHEN p.status = 'in_progress' THEN '진행중'
        WHEN p.status = 'done' THEN '완료'
        WHEN p.status = 'cancelled' THEN '취소'
        WHEN p.status = 'failed' THEN '실패'
        WHEN p.status = 'expired' THEN '만료'
        ELSE p.status
    END AS payment_status_detail_kr,
    p.amount AS payment_amount,
    
    -- 결제 시간 (한국 시간)
    p.approved_at AS payment_approved_at_utc,
    (p.approved_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS payment_approved_at_kst,
    TO_CHAR((p.approved_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS payment_approved_at_kst_text,
    
    -- 카드 정보
    p.card_company,
    p.card_number,
    p.installment_plan_months,
    CASE 
        WHEN p.installment_plan_months IS NULL OR p.installment_plan_months = 0 THEN '일시불'
        ELSE p.installment_plan_months::TEXT || '개월 할부'
    END AS installment_info,
    
    -- 주문 상품 정보
    oi.id AS order_item_id,
    oi.product_id,
    oi.variant_id,
    oi.product_name,
    oi.variant_info,
    oi.quantity,
    oi.price AS item_price,
    (oi.price * oi.quantity) AS item_total_price,
    
    -- 업데이트 시간 (한국 시간)
    o.updated_at AS order_updated_at_utc,
    (o.updated_at AT TIME ZONE 'Asia/Seoul')::TIMESTAMP AS order_updated_at_kst,
    TO_CHAR((o.updated_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD HH24:MI:SS') AS order_updated_at_kst_text

FROM public.orders o
LEFT JOIN public.users u ON u.id = o.user_id
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
LEFT JOIN public.order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC, oi.id;

-- 뷰 주석
COMMENT ON VIEW public.payment_history_detail_view IS '주문 상품별 결제 내역 상세 뷰 (구매 담당자용) - 모든 시간은 한국 시간(KST)으로 변환';

-- ============================================================================
-- 3. 사용 예시 쿼리
-- ============================================================================
-- 구매 담당자가 자주 사용할만한 쿼리 예시
-- ============================================================================

-- 3.1. 최근 결제 완료 주문 조회 (주문별)
-- SELECT 
--     order_number,
--     customer_name,
--     customer_email,
--     order_created_at_kst_text,
--     paid_at_kst_text,
--     payment_method_kr,
--     payment_amount,
--     payment_status,
--     fulfillment_status
-- FROM payment_history_view
-- WHERE payment_status = 'PAID'
-- ORDER BY paid_at_kst DESC
-- LIMIT 20;

-- 3.2. 특정 기간 결제 내역 조회
-- SELECT 
--     order_number,
--     customer_name,
--     payment_method_kr,
--     payment_amount,
--     paid_at_kst_text
-- FROM payment_history_view
-- WHERE paid_at_kst >= '2025-01-01 00:00:00'::TIMESTAMP
--   AND paid_at_kst < '2025-02-01 00:00:00'::TIMESTAMP
--   AND payment_status = 'PAID'
-- ORDER BY paid_at_kst DESC;

-- 3.3. 결제 수단별 통계
-- SELECT 
--     payment_method_kr,
--     COUNT(*) AS order_count,
--     SUM(payment_amount) AS total_amount
-- FROM payment_history_view
-- WHERE payment_status = 'PAID'
-- GROUP BY payment_method_kr
-- ORDER BY total_amount DESC;

-- 3.4. 주문 상품별 상세 내역 조회
-- SELECT 
--     order_number,
--     customer_name,
--     product_name,
--     variant_info,
--     quantity,
--     item_price,
--     item_total_price,
--     paid_at_kst_text
-- FROM payment_history_detail_view
-- WHERE payment_status = 'PAID'
-- ORDER BY paid_at_kst DESC
-- LIMIT 50;

-- 3.5. 배송 대기 중인 주문 조회
-- SELECT 
--     order_number,
--     customer_name,
--     shipping_name,
--     shipping_address,
--     paid_at_kst_text,
--     fulfillment_status
-- FROM payment_history_view
-- WHERE payment_status = 'PAID'
--   AND fulfillment_status IN ('UNFULFILLED', 'PREPARING')
-- ORDER BY paid_at_kst ASC;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

