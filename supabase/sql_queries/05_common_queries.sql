-- ============================================================================
-- 공통 조회 쿼리 모음
-- ============================================================================
-- 
-- 이 쿼리는 다음 쿼리들을 통합한 것입니다:
-- 1. "Products listing"
-- 2. "Untitled query"
-- 
-- 목적: 자주 사용하는 조회 쿼리 모음
-- 
-- ⚠️ 중요: 이 파일에는 여러 SELECT 쿼리가 포함되어 있습니다.
--          각 쿼리를 개별적으로 선택해서 실행하거나 EXPLAIN을 사용하세요.
--          모든 쿼리가 SELECT이므로 EXPLAIN 사용 가능합니다.
-- ============================================================================

-- ============================================================================
-- 1. 상품 목록 조회
-- ============================================================================

-- 1-1. 활성 상품 목록 (기본)
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.status,
    p.stock,
    p.is_featured,
    p.is_new,
    c.name as category_name,
    c.slug as category_slug,
    p.created_at,
    p.updated_at
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- 1-2. 활성 상품 목록 (카테고리별)
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.status,
    p.stock,
    c.name as category_name,
    COUNT(pc.category_id) as category_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_categories pc ON p.id = pc.product_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.slug, p.price, p.discount_price, p.status, p.stock, c.name
ORDER BY c.name, p.created_at DESC;

-- 1-3. 베스트 상품 목록
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.status,
    p.stock,
    p.is_featured,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL
    AND p.is_featured = true
    AND p.status = 'active'
ORDER BY p.created_at DESC;

-- 1-4. 신상품 목록
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.status,
    p.stock,
    p.is_new,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL
    AND p.is_new = true
    AND p.status = 'active'
ORDER BY p.created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. 상품 상세 정보 조회
-- ============================================================================

-- 2-1. 상품 상세 (이미지 포함)
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.discount_price,
    p.description,
    p.status,
    p.stock,
    p.is_featured,
    p.is_new,
    c.name as category_name,
    c.slug as category_slug,
    (
        SELECT json_agg(
            json_build_object(
                'id', pi.id,
                'url', pi.image_url,
                'is_primary', pi.is_primary,
                'sort_order', pi.sort_order
            ) ORDER BY pi.is_primary DESC, pi.sort_order
        )
        FROM product_images pi
        WHERE pi.product_id = p.id
    ) as images,
    (
        SELECT json_agg(
            json_build_object(
                'id', pv.id,
                'variant_name', pv.variant_name,
                'variant_value', pv.variant_value,
                'stock', pv.stock,
                'price_adjustment', pv.price_adjustment
            )
        )
        FROM product_variants pv
        WHERE pv.product_id = p.id
            AND pv.deleted_at IS NULL
    ) as variants,
    p.created_at,
    p.updated_at
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.id = 'ttotto_pr_001'  -- 상품 ID 변경
    AND p.deleted_at IS NULL;

-- ============================================================================
-- 3. 카테고리별 상품 통계
-- ============================================================================

-- 3-1. 카테고리별 상품 개수
SELECT 
    c.id,
    c.name,
    c.slug,
    COUNT(p.id) as product_count,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_count,
    COUNT(CASE WHEN p.is_featured = true THEN 1 END) as featured_count
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
    AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.slug
ORDER BY c.sort_order, c.name;

-- ============================================================================
-- 4. 주문 통계
-- ============================================================================

-- 4-1. 일별 주문 통계
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as order_count,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_order_value
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- 4-2. 주문 상태별 통계
SELECT 
    status,
    COUNT(*) as order_count,
    SUM(total_amount) as total_amount
FROM orders
GROUP BY status
ORDER BY order_count DESC;

-- ============================================================================
-- 5. 재고 관리
-- ============================================================================

-- 5-1. 재고 부족 상품
SELECT 
    p.id,
    p.name,
    p.stock,
    p.status,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.deleted_at IS NULL
    AND p.stock < 10
ORDER BY p.stock ASC;

-- 5-2. 옵션별 재고 현황
SELECT 
    p.id as product_id,
    p.name as product_name,
    pv.variant_name,
    pv.variant_value,
    pv.stock,
    pv.sku
FROM products p
INNER JOIN product_variants pv ON p.id = pv.product_id
WHERE p.deleted_at IS NULL
    AND pv.deleted_at IS NULL
    AND pv.stock < 10
ORDER BY p.name, pv.variant_name, pv.variant_value;

-- ============================================================================
-- 마무리
-- ============================================================================
-- 
-- 이 파일은 참고용 조회 쿼리 모음입니다.
-- 실제로 실행하지 않고, 필요할 때 복사해서 사용하세요.
-- ============================================================================

