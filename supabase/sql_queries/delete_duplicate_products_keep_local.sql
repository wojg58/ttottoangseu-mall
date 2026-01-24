-- ============================================================================
-- 중복 상품 삭제 SQL (로컬 사이트에 표시되는 상품만 유지)
-- ============================================================================
-- 
-- 목적: 로컬 사이트 관리자 페이지에 표시되는 323개 상품만 유지하고
--       나머지 중복 상품들을 모두 삭제 처리
-- 
-- 조건:
-- - 상품 관리 페이지: 총 323개 상품 유지
-- - 재고 관리 페이지: 총 1043개 재고 항목 유지
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

-- 1-1. 삭제되지 않은 전체 상품 수 확인
SELECT 
  COUNT(*) as total_active_products,
  '삭제되지 않은 전체 상품 수' as description
FROM products
WHERE deleted_at IS NULL;

-- 1-2. 삭제되지 않은 상품을 상태별로 확인
SELECT 
  status,
  COUNT(*) as count,
  '상태별 상품 수' as description
FROM products
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- 1-3. 삭제되지 않은 상품 ID 목록 (최신순, 처음 50개)
SELECT 
  id,
  name,
  status,
  stock,
  created_at
FROM products
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- 2단계: 삭제 전 백업 확인 (선택사항)
-- ============================================================================

-- 삭제될 상품 수 확인 (323개를 초과하는 경우)
-- 주의: 이 쿼리는 삭제할 상품 수를 예상하는 것이며,
--       실제로는 로컬 사이트에 표시되는 323개 상품의 ID를 기준으로 삭제해야 합니다.

-- 만약 현재 삭제되지 않은 상품이 323개보다 많다면:
-- WITH keep_products AS (
--   SELECT id
--   FROM products
--   WHERE deleted_at IS NULL
--   ORDER BY created_at DESC  -- 또는 다른 기준 (예: updated_at, id)
--   LIMIT 323
-- )
-- SELECT 
--   COUNT(*) as products_to_delete,
--   '삭제될 상품 수 (323개 제외)' as description
-- FROM products
-- WHERE deleted_at IS NULL
--   AND id NOT IN (SELECT id FROM keep_products);

-- ============================================================================
-- 3단계: 로컬 사이트 상품 ID 목록 확인
-- ============================================================================

-- ⚠️ 중요: 먼저 다음 스크립트를 실행하여 로컬 사이트에 표시되는 상품 ID를 확인하세요:
-- pnpm tsx scripts/get-local-products-ids.ts
-- 
-- 이 스크립트는 로컬 사이트 관리자 페이지와 동일한 조건으로 상품을 조회하여
-- 유지해야 할 상품 ID 목록을 출력합니다.

-- ============================================================================
-- 4단계: 실제 삭제 실행
-- ============================================================================

-- ⚠️ 중요: 이 쿼리를 실행하기 전에 반드시 확인하세요!
-- 
-- 방법 1: 최신 323개 상품만 유지하고 나머지 삭제
-- (created_at 기준으로 최신 323개 유지)
-- 주의: 이 방법은 로컬 사이트에 표시되는 상품과 다를 수 있습니다!
-- 
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (
--     SELECT id
--     FROM products
--     WHERE deleted_at IS NULL
--     ORDER BY created_at DESC
--     LIMIT 323
--   );

-- 방법 2: 특정 상품 ID 목록을 제외하고 나머지 삭제 (권장)
-- (로컬 사이트에 표시되는 323개 상품의 ID를 직접 지정)
-- 
-- 1. 먼저 scripts/get-local-products-ids.ts를 실행하여 ID 목록을 확인
-- 2. 아래 쿼리에서 ID 목록을 업데이트
-- 3. 쿼리 실행
-- 
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (
--     -- 아래 ID 목록을 scripts/get-local-products-ids.ts 실행 결과로 교체하세요
--     'ttotto_pr_001',
--     'ttotto_pr_002',
--     -- ... 로컬 사이트에 표시되는 323개 상품 ID 목록
--   );

-- 방법 3: updated_at 기준으로 최신 323개 유지
-- (최근에 수정된 상품 우선 유지)
-- 
-- UPDATE products
-- SET 
--   deleted_at = NOW(),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND id NOT IN (
--     SELECT id
--     FROM products
--     WHERE deleted_at IS NULL
--     ORDER BY updated_at DESC
--     LIMIT 323
--   );

-- ============================================================================
-- 5단계: 삭제 후 확인
-- ============================================================================

-- 4-1. 삭제 후 남은 상품 수 확인 (323개여야 함)
SELECT 
  COUNT(*) as remaining_products,
  '삭제 후 남은 상품 수 (323개여야 함)' as description
FROM products
WHERE deleted_at IS NULL;

-- 4-2. 삭제 후 상태별 상품 수 확인
SELECT 
  status,
  COUNT(*) as count,
  '삭제 후 상태별 상품 수' as description
FROM products
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- 4-3. 삭제된 상품 수 확인
SELECT 
  COUNT(*) as deleted_products,
  '삭제 처리된 상품 수' as description
FROM products
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 6단계: 재고 항목 확인 (1043개 유지 확인)
-- ============================================================================

-- 5-1. 삭제되지 않은 상품의 재고 항목 수 확인
-- (상품 재고 + 옵션별 재고)
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

-- 5-2. 상품별 재고 항목 상세 확인
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.stock as product_stock,
  COUNT(pv.id) as variant_count,
  COALESCE(SUM(pv.stock), 0) as total_variant_stock,
  (p.stock + COALESCE(SUM(pv.stock), 0)) as total_stock_items
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id 
  AND pv.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.stock
ORDER BY p.created_at DESC
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
