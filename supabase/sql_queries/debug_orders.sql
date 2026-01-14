-- ============================================================================
-- 주문 내역 디버깅 쿼리
-- ============================================================================
-- 
-- 목적: 주문이 DB에 저장되었는지, user_id가 올바르게 저장되었는지 확인
-- 
-- 사용 방법:
-- 1. Supabase Dashboard → SQL Editor 이동
-- 2. 아래 쿼리 중 필요한 것만 선택해서 실행
-- ============================================================================

-- ============================================================================
-- 1. 최근 주문 10개 조회 (모든 사용자)
-- ============================================================================
-- 이 쿼리로 주문이 실제로 DB에 저장되었는지 확인
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.clerk_user_id,
    u.email as user_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.paid_at
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. 특정 Clerk User ID로 주문 조회
-- ============================================================================
-- 아래 'YOUR_CLERK_USER_ID'를 실제 Clerk User ID로 변경하세요
-- Clerk User ID는 Vercel 로그의 clerkUserId에서 확인 가능
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.clerk_user_id,
    u.email as user_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.paid_at
FROM orders o
INNER JOIN users u ON o.user_id = u.id
WHERE u.clerk_user_id = 'YOUR_CLERK_USER_ID'  -- 여기를 변경하세요
ORDER BY o.created_at DESC;

-- ============================================================================
-- 3. 특정 사용자의 모든 주문 조회 (user_id로)
-- ============================================================================
-- 아래 'YOUR_USER_ID'를 실제 Supabase user_id (UUID)로 변경하세요
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.clerk_user_id,
    u.email as user_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.paid_at
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.user_id = 'YOUR_USER_ID'::uuid  -- 여기를 변경하세요
ORDER BY o.created_at DESC;

-- ============================================================================
-- 4. 결제 완료된 주문만 조회
-- ============================================================================
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.clerk_user_id,
    u.email as user_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.paid_at,
    p.payment_key,
    p.method as payment_method
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN payments p ON o.id = p.order_id
WHERE o.payment_status = 'PAID'
ORDER BY o.created_at DESC
LIMIT 20;

-- ============================================================================
-- 5. 주문과 사용자 매칭 확인
-- ============================================================================
-- 주문은 있지만 사용자 정보가 없는 경우 확인
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    o.payment_status,
    o.created_at,
    CASE 
        WHEN u.id IS NULL THEN '사용자 없음'
        ELSE u.clerk_user_id
    END as clerk_user_id,
    CASE 
        WHEN u.id IS NULL THEN '사용자 없음'
        ELSE u.email
    END as user_email
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '24 hours'  -- 최근 24시간 내 주문만
ORDER BY o.created_at DESC;

-- ============================================================================
-- 6. 사용자별 주문 통계
-- ============================================================================
SELECT 
    u.clerk_user_id,
    u.email,
    COUNT(o.id) as total_orders,
    COUNT(CASE WHEN o.payment_status = 'PAID' THEN 1 END) as paid_orders,
    SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END) as total_paid_amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.clerk_user_id IS NOT NULL
GROUP BY u.id, u.clerk_user_id, u.email
HAVING COUNT(o.id) > 0
ORDER BY total_orders DESC;
