-- ============================================================================
-- 중복 상품 삭제 SQL (최종 실행 버전)
-- ============================================================================
-- 
-- 목적: 로컬 사이트 관리자 페이지에 표시되는 323개 상품만 유지하고
--       나머지 중복 상품들을 모두 삭제 처리
-- 
-- 현재 상태:
-- - 로컬 사이트에 표시되는 상품: 323개
-- - Supabase 활성 상품: 323개 (일치함)
-- 
-- ⚠️ 주의: 이 작업은 되돌릴 수 없습니다!
-- 
-- 실행 방법:
-- 1. Supabase Dashboard > SQL Editor에서 실행
-- 2. 단계별로 실행하여 확인 후 다음 단계 진행
-- ============================================================================

-- ============================================================================
-- 1단계: 현재 상태 확인
-- ============================================================================

-- 1-1. 삭제되지 않은 전체 상품 수 확인 (323개여야 함)
SELECT 
  COUNT(*) as total_active_products,
  '삭제되지 않은 전체 상품 수 (323개여야 함)' as description
FROM products
WHERE deleted_at IS NULL;

-- 1-2. 이미 삭제된 상품 수 확인
SELECT 
  COUNT(*) as already_deleted_products,
  '이미 삭제 처리된 상품 수' as description
FROM products
WHERE deleted_at IS NOT NULL;

-- 1-3. 전체 상품 수 확인
SELECT 
  COUNT(*) as total_products,
  '전체 상품 수 (삭제 포함)' as description
FROM products;

-- ============================================================================
-- 2단계: 유지할 상품 ID 목록 확인
-- ============================================================================

-- 로컬 사이트에 표시되는 323개 상품 ID 목록
-- (scripts/get-local-products-ids.ts 실행 결과)
SELECT 
  id,
  name,
  status,
  stock,
  created_at
FROM products
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- ============================================================================
-- 3단계: 중복 상품 확인 및 삭제
-- ============================================================================

-- 3-1. 같은 이름을 가진 중복 상품 확인
SELECT 
  name,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as product_ids,
  '중복 상품 확인' as description
FROM products
WHERE deleted_at IS NULL
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3-2. 같은 slug를 가진 중복 상품 확인
SELECT 
  slug,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as product_ids,
  '중복 slug 확인' as description
FROM products
WHERE deleted_at IS NULL
GROUP BY slug
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================================================
-- 4단계: 실제 삭제 실행
-- ============================================================================

-- ⚠️ 중요: 현재 Supabase에 활성 상품이 323개이고, 로컬 사이트에도 323개가 표시됩니다.
--          따라서 이미 중복이 없는 상태입니다.
-- 
-- 만약 중복 상품이 발견되었다면, 아래 쿼리를 사용하여 삭제할 수 있습니다:

-- 방법 1: 같은 이름을 가진 중복 상품 중 최신 것만 유지하고 나머지 삭제
-- (created_at이 가장 최신인 것만 유지)
-- 
-- WITH keep_products AS (
--   SELECT DISTINCT ON (name) id
--   FROM products
--   WHERE deleted_at IS NULL
--   ORDER BY name, created_at DESC
-- )
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (SELECT id FROM keep_products);

-- 방법 2: 같은 slug를 가진 중복 상품 중 최신 것만 유지하고 나머지 삭제
-- 
-- WITH keep_products AS (
--   SELECT DISTINCT ON (slug) id
--   FROM products
--   WHERE deleted_at IS NULL
--   ORDER BY slug, created_at DESC
-- )
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (SELECT id FROM keep_products);

-- 방법 3: 특정 상품 ID 목록을 제외하고 나머지 삭제
-- (로컬 사이트에 표시되는 323개 상품의 ID를 직접 지정)
-- 
-- ⚠️ 주의: 현재는 활성 상품이 323개이므로 이 쿼리를 실행하면 모든 상품이 삭제됩니다!
--          따라서 이 방법은 사용하지 마세요.
-- 
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (
--     -- 아래 ID 목록을 scripts/get-local-products-ids.ts 실행 결과로 교체
--     'ttotto_pr_896',
--     'ttotto_pr_895',
--     -- ... (323개 ID 목록)
--   );

-- ============================================================================
-- 5단계: 삭제 후 확인
-- ============================================================================

-- 5-1. 삭제 후 남은 상품 수 확인 (323개여야 함)
SELECT 
  COUNT(*) as remaining_products,
  '삭제 후 남은 상품 수 (323개여야 함)' as description
FROM products
WHERE deleted_at IS NULL;

-- 5-2. 삭제 후 상태별 상품 수 확인
SELECT 
  status,
  COUNT(*) as count,
  '삭제 후 상태별 상품 수' as description
FROM products
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- ============================================================================
-- 6단계: 재고 항목 확인 (1043개 유지 확인)
-- ============================================================================

-- 6-1. 총 재고 항목 수 확인 (상품 재고 + 옵션별 재고)
SELECT 
  (
    -- 상품 재고 항목 수
    (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL)
    +
    -- 옵션별 재고 항목 수
    (SELECT COUNT(*) 
     FROM product_variants pv
     INNER JOIN products p ON pv.product_id = p.id
     WHERE p.deleted_at IS NULL 
       AND pv.deleted_at IS NULL)
  ) as total_inventory_items,
  '총 재고 항목 수 (1043개여야 함)' as description;

-- 6-2. 상품별 재고 항목 상세 확인
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.stock as product_stock,
  COUNT(pv.id) as variant_count,
  COALESCE(SUM(pv.stock), 0) as total_variant_stock,
  (1 + COUNT(pv.id)) as total_stock_items  -- 상품 1개 + 옵션 개수
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id 
  AND pv.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.stock
ORDER BY (1 + COUNT(pv.id)) DESC
LIMIT 50;

-- ============================================================================
-- 참고: 삭제 취소 (복구) 방법
-- ============================================================================

-- 만약 실수로 삭제했다면, 다음 쿼리로 복구 가능:
-- 
-- UPDATE products
-- SET 
--   deleted_at = NULL,
--   updated_at = NOW()
-- WHERE deleted_at IS NOT NULL
--   AND deleted_at >= '2025-01-XX XX:XX:XX'  -- 삭제한 시간 지정
--   AND deleted_at <= '2025-01-XX XX:XX:XX';  -- 삭제한 시간 지정
