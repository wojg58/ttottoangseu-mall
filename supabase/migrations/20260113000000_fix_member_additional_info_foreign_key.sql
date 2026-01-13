-- ============================================================================
-- member_additional_info 외래 키 제약 조건 수정
-- ============================================================================
-- 
-- 문제: users.clerk_user_id를 업데이트할 때 외래 키 제약 조건 위반 발생
-- 해결: ON UPDATE CASCADE 추가하여 users.clerk_user_id 변경 시 
--       member_additional_info.clerk_id도 자동으로 업데이트되도록 수정
-- ============================================================================

-- 기존 외래 키 제약 조건 삭제
DO $$
BEGIN
    -- fk_member_info_clerk_id 제약 조건 삭제
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_member_info_clerk_id'
    ) THEN
        ALTER TABLE public.member_additional_info
            DROP CONSTRAINT fk_member_info_clerk_id;
        RAISE NOTICE '기존 외래 키 제약 조건 fk_member_info_clerk_id 삭제됨';
    END IF;
    
    -- fk_member_additional_info_clerk_id 제약 조건 삭제 (다른 이름일 수도 있음)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_member_additional_info_clerk_id'
    ) THEN
        ALTER TABLE public.member_additional_info
            DROP CONSTRAINT fk_member_additional_info_clerk_id;
        RAISE NOTICE '기존 외래 키 제약 조건 fk_member_additional_info_clerk_id 삭제됨';
    END IF;
END $$;

-- 올바른 외래 키 제약 조건 재생성 (ON UPDATE CASCADE 포함)
DO $$
BEGIN
    -- users 테이블에 clerk_user_id 컬럼이 있는지 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'clerk_user_id'
    ) THEN
        -- member_additional_info 테이블이 있는지 확인
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'member_additional_info'
        ) THEN
            -- 외래 키 제약 조건이 없으면 추가
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_member_additional_info_clerk_id'
            ) THEN
                ALTER TABLE public.member_additional_info
                    ADD CONSTRAINT fk_member_additional_info_clerk_id
                    FOREIGN KEY (clerk_id) 
                    REFERENCES public.users(clerk_user_id) 
                    ON DELETE CASCADE 
                    ON UPDATE CASCADE;
                
                RAISE NOTICE '외래 키 제약 조건 fk_member_additional_info_clerk_id 생성됨 (ON UPDATE CASCADE 포함)';
            ELSE
                RAISE NOTICE '외래 키 제약 조건이 이미 존재함';
            END IF;
        ELSE
            RAISE NOTICE 'member_additional_info 테이블이 존재하지 않음';
        END IF;
    ELSE
        RAISE NOTICE 'users 테이블에 clerk_user_id 컬럼이 존재하지 않음';
    END IF;
END $$;

-- 주석 업데이트
COMMENT ON CONSTRAINT fk_member_additional_info_clerk_id ON public.member_additional_info IS 
    'Clerk 사용자 ID 외래 키 (users.clerk_user_id 참조, ON UPDATE CASCADE 포함)';
