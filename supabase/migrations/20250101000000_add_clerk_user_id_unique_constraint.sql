-- clerk_user_id에 UNIQUE 제약조건 추가
-- ON CONFLICT를 사용하기 위해 필요
-- 
-- 참고: 기존에 부분 인덱스(uq_users_clerk_user_id_active)가 있지만,
-- WHERE deleted_at IS NULL 조건이 있어서 ON CONFLICT에서 직접 사용할 수 없음
-- 따라서 전체 UNIQUE 제약조건을 추가

-- 기존 제약조건이 있는지 확인 후 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'uq_users_clerk_user_id'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT uq_users_clerk_user_id 
        UNIQUE (clerk_user_id);
        
        COMMENT ON CONSTRAINT uq_users_clerk_user_id ON users IS 
            'Clerk 사용자 ID 유니크 제약조건 (ON CONFLICT 사용을 위해 필요)';
    END IF;
END $$;

