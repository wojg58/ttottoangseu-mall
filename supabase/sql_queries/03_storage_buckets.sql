-- ============================================================================
-- 스토리지 버킷 통합 쿼리
-- ============================================================================
-- 
-- 이 쿼리는 다음 2개의 쿼리를 통합한 것입니다:
-- 1. "Product Images Bucket and RLS Policies"
-- 2. "Product images storage bucket and access policies"
-- 
-- 주의: 이미 마이그레이션 파일로 존재합니다.
--       이 쿼리는 수동으로 버킷을 생성하거나 정책을 업데이트할 때 사용합니다.
-- 
-- ⚠️ 중요: 이 파일에는 여러 SQL 문이 포함되어 있습니다.
--          각 단계를 개별적으로 실행하거나, 필요한 쿼리만 선택해서 실행하세요.
--          EXPLAIN을 사용하려면 SELECT 쿼리만 선택해야 합니다.
-- ============================================================================

-- ============================================================================
-- 단계 1: uploads 버킷 생성 및 RLS 정책 설정
-- ============================================================================
-- 
-- 목적: 사용자 파일 업로드용 private 버킷
-- ============================================================================

-- 1-1. uploads 버킷 생성 (이미 존재하면 무시됨)
-- 이 쿼리만 선택해서 실행하세요.
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

-- 1-2. INSERT 정책: 인증된 사용자만 자신의 폴더에 업로드 가능
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- 1-3. SELECT 정책: 인증된 사용자만 자신의 파일 조회 가능
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- 1-4. DELETE 정책: 인증된 사용자만 자신의 파일 삭제 가능
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- 1-5. UPDATE 정책: 인증된 사용자만 자신의 파일 업데이트 가능
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
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

-- ============================================================================
-- 단계 2: product-images 버킷 생성 및 RLS 정책 설정
-- ============================================================================
-- 
-- 목적: 상품 이미지용 public 버킷 (모든 사용자가 조회 가능)
-- ============================================================================

-- 2-1. product-images 버킷 생성 (이미 존재하면 무시됨)
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

-- 2-2. INSERT 정책: 인증된 사용자만 업로드 가능 (관리자 권한은 애플리케이션 레벨에서 체크)
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- 2-3. SELECT 정책: 모든 사용자가 조회 가능 (공개 버킷)
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 2-4. DELETE 정책: 인증된 사용자만 삭제 가능
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- 2-5. UPDATE 정책: 인증된 사용자만 업데이트 가능
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- ============================================================================
-- 단계 3: 버킷 확인
-- ============================================================================

-- 3-1. 모든 버킷 조회 (SELECT 쿼리 - EXPLAIN 사용 가능)
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY created_at;

-- 3-2. 버킷별 정책 확인 (SELECT 쿼리 - EXPLAIN 사용 가능)
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- ============================================================================
-- 마무리
-- ============================================================================
-- 
-- 스토리지 버킷 설정이 완료되었습니다.
-- 
-- 참고: 이미 마이그레이션 파일로 존재합니다.
--       (20250603000000_create_product_images_bucket.sql, setup_storage.sql)
-- ============================================================================

