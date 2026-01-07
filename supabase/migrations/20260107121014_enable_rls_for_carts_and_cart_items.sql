-- ============================================================================
-- RLS 정책 활성화: carts 및 cart_items 테이블
-- ============================================================================
-- 
-- 이 마이그레이션은 carts와 cart_items 테이블에 Row Level Security (RLS)를
-- 활성화하고 적절한 정책을 생성합니다.
-- 
-- Clerk 인증을 사용하므로 auth.jwt()->>'sub'로 Clerk user ID를 확인하고,
-- users 테이블의 clerk_user_id와 매칭하여 현재 사용자의 Supabase user ID를 찾습니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. carts 테이블 RLS 활성화 및 정책 생성
-- ----------------------------------------------------------------------------

-- RLS 활성화
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- SELECT 정책: 자신의 장바구니만 조회 가능
CREATE POLICY "Users can view their own cart"
ON carts
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id
    FROM users
    WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND deleted_at IS NULL
  )
);

-- INSERT 정책: 자신의 장바구니만 생성 가능
CREATE POLICY "Users can create their own cart"
ON carts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT id
    FROM users
    WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND deleted_at IS NULL
  )
);

-- UPDATE 정책: 자신의 장바구니만 수정 가능
CREATE POLICY "Users can update their own cart"
ON carts
FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT id
    FROM users
    WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND deleted_at IS NULL
  )
)
WITH CHECK (
  user_id IN (
    SELECT id
    FROM users
    WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND deleted_at IS NULL
  )
);

-- DELETE 정책: 자신의 장바구니만 삭제 가능
CREATE POLICY "Users can delete their own cart"
ON carts
FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT id
    FROM users
    WHERE clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND deleted_at IS NULL
  )
);

-- ----------------------------------------------------------------------------
-- 2. cart_items 테이블 RLS 활성화 및 정책 생성
-- ----------------------------------------------------------------------------

-- RLS 활성화
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- SELECT 정책: 자신의 장바구니 아이템만 조회 가능
CREATE POLICY "Users can view their own cart items"
ON cart_items
FOR SELECT
TO authenticated
USING (
  cart_id IN (
    SELECT c.id
    FROM carts c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND u.deleted_at IS NULL
  )
);

-- INSERT 정책: 자신의 장바구니에만 아이템 추가 가능
CREATE POLICY "Users can add items to their own cart"
ON cart_items
FOR INSERT
TO authenticated
WITH CHECK (
  cart_id IN (
    SELECT c.id
    FROM carts c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND u.deleted_at IS NULL
  )
);

-- UPDATE 정책: 자신의 장바구니 아이템만 수정 가능
CREATE POLICY "Users can update their own cart items"
ON cart_items
FOR UPDATE
TO authenticated
USING (
  cart_id IN (
    SELECT c.id
    FROM carts c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND u.deleted_at IS NULL
  )
)
WITH CHECK (
  cart_id IN (
    SELECT c.id
    FROM carts c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND u.deleted_at IS NULL
  )
);

-- DELETE 정책: 자신의 장바구니 아이템만 삭제 가능
CREATE POLICY "Users can delete their own cart items"
ON cart_items
FOR DELETE
TO authenticated
USING (
  cart_id IN (
    SELECT c.id
    FROM carts c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.clerk_user_id = (SELECT auth.jwt()->>'sub')
    AND u.deleted_at IS NULL
  )
);

-- ----------------------------------------------------------------------------
-- 3. 성능 최적화를 위한 인덱스 확인
-- ----------------------------------------------------------------------------
-- 
-- RLS 정책에서 사용하는 컬럼에 인덱스가 있는지 확인하고,
-- 없으면 추가하는 것을 권장합니다:
-- 
-- - users.clerk_user_id (이미 UNIQUE 제약조건으로 인덱스가 있을 가능성 높음)
-- - carts.user_id (FK 제약조건으로 인덱스가 있을 가능성 높음)
-- - cart_items.cart_id (FK 제약조건으로 인덱스가 있을 가능성 높음)
-- 
-- 필요시 다음 인덱스를 추가할 수 있습니다:
-- 
-- CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
-- CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
-- CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id_active 
--   ON users(clerk_user_id) WHERE deleted_at IS NULL;
-- ============================================================================

