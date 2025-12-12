-- =============================================
-- 상품 slug 및 이미지 URL 수정
-- =============================================
-- 문제: ttotto_pr_092 상품의 slug가 이미지 URL로 잘못 저장됨
-- 해결: 올바른 slug로 수정하고 대표 이미지 URL 업데이트

-- 1. slug를 올바른 형식으로 수정
UPDATE products 
SET slug = 'sanrio-character-mirror-brush-set'
WHERE id = 'ttotto_pr_092';

-- 2. 대표 이미지를 네이버 이미지 URL로 업데이트
UPDATE product_images 
SET image_url = 'http://shop1.phinf.naver.net/20241229_77/1735439211520ch5g7_JPEG/19894572318900562_947030107.jpg'
WHERE product_id = 'ttotto_pr_092' AND is_primary = true;

