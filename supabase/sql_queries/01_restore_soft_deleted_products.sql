-- ============================================================================
-- 상품 복구 통합 쿼리
-- ============================================================================
-- 
-- 이 쿼리는 다음 3개의 쿼리를 통합한 것입니다:
-- 1. "Restore Soft-Deleted Products"
-- 2. "Soft-deleted products with '-restored-' slugs"
-- 3. "Rename Conflicting Deleted Product Slugs Before Restore"
-- 
-- ⚠️ 중요: 이 파일에는 여러 SQL 문이 포함되어 있습니다.
--          각 단계를 개별적으로 실행하거나, 필요한 쿼리만 선택해서 실행하세요.
--          EXPLAIN을 사용하려면 하나의 SQL 문만 선택해야 합니다.
-- ============================================================================

-- ============================================================================
-- 단계 1-1: 삭제된 상품 중 slug 충돌 확인 (SELECT만 실행)
-- ============================================================================
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
    p1.id,
    p1.name,
    p1.slug,
    p1.deleted_at,
    '충돌: 활성 상품과 같은 slug' as conflict_reason
FROM products p1
WHERE p1.deleted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM products p2 
    WHERE p2.slug = p1.slug 
      AND p2.deleted_at IS NULL
      AND p2.id != p1.id
  )
ORDER BY p1.deleted_at DESC;

-- ============================================================================
-- 단계 1-2: 충돌하는 삭제된 상품의 slug를 고유하게 변경 (복구 전)
-- ============================================================================
-- ⚠️ 이 쿼리는 데이터를 변경합니다. 실행 전에 단계 1-1로 충돌을 확인하세요.
-- 이 쿼리만 선택해서 실행하세요.
-- 
-- 참고: 활성 상품과 slug가 충돌하는 삭제된 상품의 slug를 먼저 변경합니다.
UPDATE products p_deleted
SET 
    slug = p_deleted.slug || '-restored-' || p_deleted.id || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at = now()
WHERE EXISTS (
    SELECT 1 
    FROM products p_active
    WHERE p_active.slug = p_deleted.slug
      AND p_active.deleted_at IS NULL
      AND p_deleted.deleted_at IS NOT NULL
);

-- ============================================================================
-- 단계 2: slug가 변경된 상품 확인
-- ============================================================================
-- 이 쿼리만 선택해서 실행하세요.
-- 
-- 참고: '-restored-' slug를 가진 삭제된 상품을 확인합니다.
SELECT 
    id,
    name,
    slug,
    deleted_at
FROM products
WHERE slug LIKE '%-restored-%'
  AND deleted_at IS NOT NULL
LIMIT 10;

-- ============================================================================
-- 단계 3-1: 복구할 상품 개수 확인
-- ============================================================================
-- 이 쿼리만 선택해서 실행하세요.
SELECT COUNT(*) as products_to_restore
FROM products
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 단계 3-2: 모든 삭제된 상품 복구
-- ============================================================================
-- ⚠️ 주의: 이 쿼리는 모든 삭제된 상품을 복구합니다.
--          특정 상품만 복구하려면 WHERE 조건을 수정하세요.
--          예: WHERE deleted_at IS NOT NULL AND id IN ('ttotto_pr_001', 'ttotto_pr_002')
-- 이 쿼리만 선택해서 실행하세요.
-- 
-- 참고: MD5 해시를 추가하여 slug 고유성을 더욱 보장합니다.
UPDATE products
SET 
    slug = COALESCE(
        NULLIF(slug, ''),
        'product'
    ) || '-restored-' || id || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || SUBSTRING(MD5(RANDOM()::text || id) FROM 1 FOR 8),
    deleted_at = NULL,
    updated_at = now()
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 단계 4-1: 복구된 상품 확인
-- ============================================================================
-- 이 쿼리만 선택해서 실행하세요.
SELECT 
    id,
    name,
    slug,
    deleted_at,
    updated_at
FROM products
WHERE slug LIKE '%-restored-%'
  AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================================================
-- 단계 4-2: 여전히 삭제된 상품 확인
-- ============================================================================
-- 이 쿼리만 선택해서 실행하세요.
SELECT COUNT(*) as still_deleted
FROM products
WHERE deleted_at IS NOT NULL;
