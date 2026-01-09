-- ============================================================================
-- RLS 정책 테스트 스크립트
-- ============================================================================
-- 
-- 프로덕션 배포 전 RLS 정책 검증용
-- 
-- 사용 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 각 테스트 케이스의 결과 확인
-- 3. 실패한 테스트는 RLS 정책 수정 필요
-- 
-- 주의: 이 스크립트는 테스트용이므로 프로덕션에서 실행하지 마세요.
-- ============================================================================

-- ============================================================================
-- 테스트 데이터 준비 (실제 데이터가 있으면 스킵)
-- ============================================================================

-- 테스트용 사용자 생성 (Clerk user ID는 실제 값으로 변경 필요)
DO $$
DECLARE
  test_user_id_1 UUID;
  test_user_id_2 UUID;
  test_order_id UUID;
  test_payment_id UUID;
  test_chat_session_id UUID;
  test_cart_id UUID;
BEGIN
  -- 테스트용 사용자 1 (clerk_user_id: 'test_user_1')
  INSERT INTO public.users (clerk_user_id, email, name, role)
  VALUES ('test_user_1', 'test1@example.com', '테스트 사용자 1', 'customer')
  ON CONFLICT (clerk_user_id) DO NOTHING
  RETURNING id INTO test_user_id_1;

  -- 테스트용 사용자 2 (clerk_user_id: 'test_user_2')
  INSERT INTO public.users (clerk_user_id, email, name, role)
  VALUES ('test_user_2', 'test2@example.com', '테스트 사용자 2', 'customer')
  ON CONFLICT (clerk_user_id) DO NOTHING
  RETURNING id INTO test_user_id_2;

  -- 테스트용 주문 생성 (사용자 1)
  IF test_user_id_1 IS NOT NULL THEN
    INSERT INTO public.orders (user_id, order_number, total_amount, status)
    VALUES (test_user_id_1, 'TEST-ORDER-001', 10000, 'pending')
    ON CONFLICT DO NOTHING
    RETURNING id INTO test_order_id;

    -- 테스트용 결제 정보 생성
    IF test_order_id IS NOT NULL THEN
      INSERT INTO public.payments (order_id, payment_key, payment_method, amount, status)
      VALUES (test_order_id, 'test_payment_key_1', 'card', 10000, 'DONE')
      ON CONFLICT DO NOTHING
      RETURNING id INTO test_payment_id;
    END IF;

    -- 테스트용 챗봇 세션 생성
    INSERT INTO public.chat_sessions (user_id)
    VALUES (test_user_id_1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO test_chat_session_id;

    -- 테스트용 장바구니 생성
    INSERT INTO public.carts (user_id)
    VALUES (test_user_id_1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO test_cart_id;
  END IF;

  RAISE NOTICE '테스트 데이터 준비 완료';
  RAISE NOTICE 'test_user_id_1: %', test_user_id_1;
  RAISE NOTICE 'test_user_id_2: %', test_user_id_2;
  RAISE NOTICE 'test_order_id: %', test_order_id;
END $$;

-- ============================================================================
-- 테스트 1: users 테이블 RLS 정책 검증
-- ============================================================================

-- 테스트 1-1: 인증된 사용자가 자신의 정보 조회 가능한지 확인
-- 예상 결과: 성공 (자신의 clerk_user_id와 일치하는 경우)
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 1-1: users SELECT 정책 (자신의 정보) ===';
  -- 실제 테스트는 Supabase Dashboard에서 JWT 토큰으로 실행해야 함
  RAISE NOTICE '수동 테스트 필요: SELECT * FROM users WHERE clerk_user_id = (auth.jwt()->>''sub'')::text;';
END $$;

-- 테스트 1-2: 인증된 사용자가 다른 사용자 정보 조회 불가능한지 확인
-- 예상 결과: 실패 (다른 사용자의 clerk_user_id)
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 1-2: users SELECT 정책 (다른 사용자 정보) ===';
  RAISE NOTICE '수동 테스트 필요: 다른 사용자의 clerk_user_id로 조회 시도';
END $$;

-- ============================================================================
-- 테스트 2: orders 테이블 RLS 정책 검증
-- ============================================================================

-- 테스트 2-1: 인증된 사용자가 자신의 주문 조회 가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 2-1: orders SELECT 정책 (자신의 주문) ===';
  RAISE NOTICE '수동 테스트 필요: SELECT * FROM orders WHERE user_id = (자신의 user_id);';
END $$;

-- 테스트 2-2: 인증된 사용자가 다른 사용자 주문 조회 불가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 2-2: orders SELECT 정책 (다른 사용자 주문) ===';
  RAISE NOTICE '수동 테스트 필요: 다른 사용자의 주문 조회 시도';
END $$;

-- ============================================================================
-- 테스트 3: payments 테이블 RLS 정책 검증
-- ============================================================================

-- 테스트 3-1: 인증된 사용자가 자신의 결제 정보 조회 가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 3-1: payments SELECT 정책 (자신의 결제) ===';
  RAISE NOTICE '수동 테스트 필요: SELECT * FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = 자신의 user_id);';
END $$;

-- 테스트 3-2: 인증된 사용자가 다른 사용자 결제 정보 조회 불가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 3-2: payments SELECT 정책 (다른 사용자 결제) ===';
  RAISE NOTICE '수동 테스트 필요: 다른 사용자의 결제 정보 조회 시도';
END $$;

-- ============================================================================
-- 테스트 4: chat_sessions 테이블 RLS 정책 검증
-- ============================================================================

-- 테스트 4-1: 인증된 사용자가 자신의 챗봇 세션 조회 가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 4-1: chat_sessions SELECT 정책 (자신의 세션) ===';
  RAISE NOTICE '수동 테스트 필요: SELECT * FROM chat_sessions WHERE user_id = (자신의 user_id);';
END $$;

-- 테스트 4-2: 인증된 사용자가 다른 사용자 세션 조회 불가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 4-2: chat_sessions SELECT 정책 (다른 사용자 세션) ===';
  RAISE NOTICE '수동 테스트 필요: 다른 사용자의 세션 조회 시도';
END $$;

-- ============================================================================
-- 테스트 5: products 테이블 RLS 정책 검증 (공개 데이터)
-- ============================================================================

-- 테스트 5-1: 비인증 사용자도 활성 상품 조회 가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 5-1: products SELECT 정책 (공개 데이터) ===';
  RAISE NOTICE '수동 테스트 필요: anon 역할로 SELECT * FROM products WHERE is_active = true AND deleted_at IS NULL;';
END $$;

-- 테스트 5-2: 비활성 상품은 조회 불가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 5-2: products SELECT 정책 (비활성 상품) ===';
  RAISE NOTICE '수동 테스트 필요: is_active = false인 상품 조회 시도';
END $$;

-- ============================================================================
-- 테스트 6: 서비스 롤 권한 검증
-- ============================================================================

-- 테스트 6-1: 서비스 롤이 모든 데이터 접근 가능한지 확인
DO $$
BEGIN
  RAISE NOTICE '=== 테스트 6-1: 서비스 롤 권한 ===';
  RAISE NOTICE '서비스 롤은 모든 테이블에 대해 SELECT, INSERT, UPDATE, DELETE 가능해야 함';
  RAISE NOTICE '수동 테스트 필요: service_role로 각 테이블 조회/수정 시도';
END $$;

-- ============================================================================
-- 테스트 결과 요약
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS 정책 테스트 가이드';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Supabase Dashboard > SQL Editor에서 테스트 실행';
  RAISE NOTICE '2. 각 테스트는 실제 JWT 토큰으로 실행해야 함';
  RAISE NOTICE '3. Clerk 인증을 통해 사용자 역할로 테스트';
  RAISE NOTICE '4. 서비스 롤은 SUPABASE_SERVICE_ROLE_KEY로 테스트';
  RAISE NOTICE '';
  RAISE NOTICE '테스트 체크리스트:';
  RAISE NOTICE '□ users: 자신의 정보만 조회/수정 가능';
  RAISE NOTICE '□ orders: 자신의 주문만 조회 가능';
  RAISE NOTICE '□ payments: 자신의 결제 정보만 조회 가능';
  RAISE NOTICE '□ chat_sessions: 자신의 세션만 조회 가능';
  RAISE NOTICE '□ products: 공개 데이터 조회 가능 (비인증 포함)';
  RAISE NOTICE '□ 서비스 롤: 모든 데이터 접근 가능';
  RAISE NOTICE '';
END $$;

