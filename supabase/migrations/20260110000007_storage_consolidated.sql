-- ============================================================================
-- Storage 버킷 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - uploads 버킷 (사용자 파일 업로드용)
-- - product-images 버킷 (상품 이미지용)
-- ============================================================================

-- ============================================================================
-- 1. uploads 버킷 생성 및 RLS 정책 설정
-- ============================================================================

-- uploads 버킷 생성 (이미 존재하면 무시됨)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,  -- private bucket
  6291456,  -- 6MB 제한 (6 * 1024 * 1024)
  NULL  -- 모든 파일 타입 허용
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 6291456;

-- INSERT: 인증된 사용자만 자신의 폴더에 업로드 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload to own folder'
    ) THEN
        CREATE POLICY "Users can upload to own folder"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'uploads' AND
          (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
        );
    END IF;
END $$;

-- SELECT: 인증된 사용자만 자신의 파일 조회 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view own files'
    ) THEN
        CREATE POLICY "Users can view own files"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'uploads' AND
          (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
        );
    END IF;
END $$;

-- DELETE: 인증된 사용자만 자신의 파일 삭제 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete own files'
    ) THEN
        CREATE POLICY "Users can delete own files"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'uploads' AND
          (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
        );
    END IF;
END $$;

-- UPDATE: 인증된 사용자만 자신의 파일 업데이트 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update own files'
    ) THEN
        CREATE POLICY "Users can update own files"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'uploads' AND
          (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
        )
        WITH CHECK (
          bucket_id = 'uploads' AND
          (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
        );
    END IF;
END $$;

-- ============================================================================
-- 2. product-images 버킷 생성 및 RLS 정책 설정
-- ============================================================================

-- product-images 버킷 생성 (이미 존재하면 무시됨)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- public bucket (모든 사용자가 조회 가능)
  10485760,  -- 10MB 제한 (10 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- 이미지 파일만 허용
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- INSERT: 인증된 사용자만 업로드 가능 (관리자 권한은 애플리케이션 레벨에서 체크)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload product images'
    ) THEN
        CREATE POLICY "Authenticated users can upload product images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'product-images');
    END IF;
END $$;

-- SELECT: 모든 사용자가 조회 가능 (공개 버킷)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Anyone can view product images'
    ) THEN
        CREATE POLICY "Anyone can view product images"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'product-images');
    END IF;
END $$;

-- DELETE: 인증된 사용자만 삭제 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can delete product images'
    ) THEN
        CREATE POLICY "Authenticated users can delete product images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'product-images');
    END IF;
END $$;

-- UPDATE: 인증된 사용자만 업데이트 가능
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can update product images'
    ) THEN
        CREATE POLICY "Authenticated users can update product images"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'product-images')
        WITH CHECK (bucket_id = 'product-images');
    END IF;
END $$;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

