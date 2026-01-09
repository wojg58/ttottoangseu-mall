-- ============================================================================
-- 인덱스 및 성능 최적화 통합 쿼리
-- ============================================================================
-- 
-- 이 쿼리는 다음 쿼리를 통합한 것입니다:
-- 1. "Indexes for users.clerk_user_id and products(id, deleted_at)"
-- 
-- 목적: 자주 사용되는 쿼리의 성능을 향상시키기 위한 인덱스 생성
-- 
-- ⚠️ 중요: 이 파일에는 여러 SQL 문이 포함되어 있습니다.
--          각 인덱스 생성 쿼리를 개별적으로 실행하거나, 필요한 것만 선택해서 실행하세요.
--          EXPLAIN을 사용하려면 SELECT 쿼리만 선택해야 합니다.
-- ============================================================================

-- ============================================================================
-- 단계 1: users 테이블 인덱스
-- ============================================================================

-- 1-1. clerk_user_id 인덱스 (이미 UNIQUE 제약조건으로 존재할 수 있음)
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id_active
    ON users(clerk_user_id)
    WHERE deleted_at IS NULL;

-- 1-2. email 인덱스 (이미 UNIQUE 제약조건으로 존재할 수 있음)
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_users_email_active
    ON users(email)
    WHERE deleted_at IS NULL;

-- 1-3. role 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON users(role)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- 단계 2: products 테이블 인덱스
-- ============================================================================

-- 2-1. id와 deleted_at 복합 인덱스 (soft delete 쿼리 최적화)
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_products_id_deleted_at
    ON products(id, deleted_at)
    WHERE deleted_at IS NULL;

-- 2-2. deleted_at 인덱스 (삭제된 상품 조회 최적화)
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_products_deleted_at
    ON products(deleted_at)
    WHERE deleted_at IS NOT NULL;

-- 2-3. category_id와 deleted_at 복합 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_products_category_deleted_at
    ON products(category_id, deleted_at)
    WHERE deleted_at IS NULL;

-- 2-4. status와 deleted_at 복합 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_products_status_deleted_at
    ON products(status, deleted_at)
    WHERE deleted_at IS NULL;

-- 2-5. created_at 인덱스 (최신 상품 조회)
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc
    ON products(created_at DESC)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- 단계 3: 기타 테이블 인덱스
-- ============================================================================

-- 3-1. product_variants.product_id 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id_active
    ON product_variants(product_id, deleted_at)
    WHERE deleted_at IS NULL;

-- 3-2. cart_items.cart_id 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id_active
    ON cart_items(cart_id);

-- 3-3. order_items.order_id 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_active
    ON order_items(order_id);

-- 3-4. orders.user_id 인덱스
-- 이 쿼리만 선택해서 실행하세요.
CREATE INDEX IF NOT EXISTS idx_orders_user_id_active
    ON orders(user_id);

-- ============================================================================
-- 단계 4: 인덱스 확인 (SELECT 쿼리 - EXPLAIN 사용 가능)
-- ============================================================================

-- 4-1. users 테이블 인덱스 확인
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users'
    AND schemaname = 'public'
ORDER BY indexname;

-- 4-2. products 테이블 인덱스 확인
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
    AND schemaname = 'public'
ORDER BY indexname;

-- 4-3. 인덱스 사용 통계 확인 (PostgreSQL 9.2+)
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname IN ('users', 'products', 'product_variants', 'cart_items', 'order_items', 'orders')
ORDER BY idx_scan DESC;

-- ============================================================================
-- 단계 5: 성능 최적화 팁
-- ============================================================================

-- 5-1. 테이블 통계 업데이트 (쿼리 플래너 최적화)
-- 각 ANALYZE 문을 개별적으로 실행하세요.
ANALYZE users;
ANALYZE products;
ANALYZE product_variants;
ANALYZE cart_items;
ANALYZE order_items;
ANALYZE orders;

-- 5-2. 인덱스 크기 확인
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND relname IN ('users', 'products')
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 마무리
-- ============================================================================
-- 
-- 인덱스 생성이 완료되었습니다.
-- 
-- 다음 단계:
-- 1. EXPLAIN ANALYZE로 쿼리 성능 확인
-- 2. 사용하지 않는 인덱스 제거 (필요한 경우)
-- 3. 정기적으로 ANALYZE 실행
-- ============================================================================

