-- ============================================================================
-- 삭제 가능한 중복 상품 확인 SQL
-- ============================================================================
-- 
-- 목적: 스마트스토어 동기화 대상 상품(1420개 재고 항목)을 유지하고
--       삭제 가능한 중복 상품 수를 확인
-- 
-- ⚠️ 중요: smartstore_product_id가 NULL인 상품만 삭제 가능합니다!
-- ============================================================================

-- ============================================================================
-- 1단계: 전체 현황 확인
-- ============================================================================

-- 1-1. 전체 활성 상품 수 (323개여야 함)
SELECT 
  COUNT(*) as total_active_products,
  '전체 활성 상품 수 (323개여야 함)' as description
FROM products
WHERE deleted_at IS NULL;

-- 1-2. 스마트스토어 동기화 대상 상품 수 (유지 필요)
SELECT 
  COUNT(*) as synced_products,
  '스마트스토어 동기화 대상 상품 수 (유지 필요)' as description
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NOT NULL;

-- 1-3. 삭제 가능한 중복 상품 수 (스마트스토어 동기화 대상 아님)
SELECT 
  COUNT(*) as deletable_products,
  '삭제 가능한 중복 상품 수 (스마트스토어 동기화 대상 아님)' as description
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NULL;

-- ============================================================================
-- 2단계: 상세 통계
-- ============================================================================

SELECT 
  '전체 활성 상품' as category,
  COUNT(*) as count,
  '유지/삭제 여부' as status
FROM products
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  '스마트스토어 동기화 대상 (유지 필요)' as category,
  COUNT(*) as count,
  '유지' as status
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NOT NULL

UNION ALL

SELECT 
  '스마트스토어 동기화 대상 아님 (삭제 가능)' as category,
  COUNT(*) as count,
  '삭제 가능' as status
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NULL

ORDER BY category;

-- ============================================================================
-- 3단계: 삭제 가능한 상품 목록
-- ============================================================================

-- 3-1. 삭제 가능한 상품 목록 (처음 50개)
SELECT 
  id,
  name,
  status,
  stock,
  smartstore_product_id,
  created_at,
  '삭제 가능 (스마트스토어 동기화 대상 아님)' as deletable_reason
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 3-2. 삭제 가능한 상품을 상태별로 확인
SELECT 
  status,
  COUNT(*) as count,
  '삭제 가능한 상품 상태별 수' as description
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NULL
GROUP BY status
ORDER BY status;

-- ============================================================================
-- 4단계: 유지해야 할 상품 확인
-- ============================================================================

-- 4-1. 스마트스토어 동기화 대상 상품 목록 (처음 50개)
SELECT 
  id,
  name,
  status,
  stock,
  smartstore_product_id,
  created_at,
  '유지 필요 (스마트스토어 동기화 대상)' as keep_reason
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;

-- 4-2. 스마트스토어 동기화 대상 상품을 상태별로 확인
SELECT 
  status,
  COUNT(*) as count,
  '스마트스토어 동기화 대상 상품 상태별 수' as description
FROM products
WHERE deleted_at IS NULL
  AND smartstore_product_id IS NOT NULL
GROUP BY status
ORDER BY status;

-- ============================================================================
-- 5단계: 재고 항목 수 확인 (1420개 확인)
-- ============================================================================

-- 5-1. 스마트스토어 동기화 대상 재고 항목 수 (1420개여야 함)
SELECT 
  (
    -- 상품 수
    (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)
    +
    -- smartstore_option_id가 있는 옵션 수
    (SELECT COUNT(*) 
     FROM product_variants pv
     INNER JOIN products p ON pv.product_id = p.id
     WHERE p.deleted_at IS NULL 
       AND pv.deleted_at IS NULL
       AND pv.smartstore_option_id IS NOT NULL)
  ) as total_synced_inventory_items,
  '스마트스토어 동기화 대상 재고 항목 수 (1420개여야 함)' as description;

-- 5-2. 삭제 후 예상 재고 항목 수 계산
-- (smartstore_product_id가 있는 상품만 남겼을 때)
SELECT 
  (
    -- 유지할 상품 수 (smartstore_product_id가 있는 상품)
    (SELECT COUNT(*) 
     FROM products 
     WHERE deleted_at IS NULL 
       AND smartstore_product_id IS NOT NULL)
    +
    -- smartstore_option_id가 있는 옵션 수
    (SELECT COUNT(*) 
     FROM product_variants pv
     INNER JOIN products p ON pv.product_id = p.id
     WHERE p.deleted_at IS NULL 
       AND pv.deleted_at IS NULL
       AND pv.smartstore_option_id IS NOT NULL
       AND p.smartstore_product_id IS NOT NULL)
  ) as expected_inventory_items_after_delete,
  '삭제 후 예상 재고 항목 수 (스마트스토어 동기화 대상만)' as description;

-- ============================================================================
-- 6단계: 삭제 실행 쿼리 (준비)
-- ============================================================================

-- ⚠️ 주의: 이 쿼리를 실행하기 전에 반드시 위의 확인 쿼리들을 실행하여
--          삭제할 상품 수를 확인하세요!

-- 삭제 가능한 중복 상품 삭제 (스마트스토어 동기화 대상이 아닌 상품만)
-- 
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND smartstore_product_id IS NULL;

-- ============================================================================
-- 7단계: 삭제 후 확인
-- ============================================================================

-- 삭제 후 남은 상품 수 확인
-- 
-- SELECT 
--   COUNT(*) as remaining_products,
--   '삭제 후 남은 상품 수 (스마트스토어 동기화 대상만)' as description
-- FROM products
-- WHERE deleted_at IS NULL;

-- 삭제 후 재고 항목 수 확인
-- 
-- SELECT 
--   (
--     (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)
--     +
--     (SELECT COUNT(*) 
--      FROM product_variants pv
--      INNER JOIN products p ON pv.product_id = p.id
--      WHERE p.deleted_at IS NULL 
--        AND pv.deleted_at IS NULL
--        AND pv.smartstore_option_id IS NOT NULL)
--   ) as total_inventory_items_after_delete,
--   '삭제 후 재고 항목 수' as description;
