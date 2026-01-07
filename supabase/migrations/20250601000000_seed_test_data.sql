-- =============================================
-- 테스트 데이터 시딩: 또또앙스 쇼핑몰
-- =============================================

-- 1. 카테고리 데이터
INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES
('산리오❣️', 'sanrio', '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈', 1, true),
('치이카와🧡', 'character', '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터', 2, true),
('모프샌드💛', 'phone-strap', '사랑스럽고 귀여운 고양이', 3, true),
('유키오💚', 'keyring', '순수하고 말없이 곁에 있어주는 납작한 친구', 4, true),
('짱구💙', 'fashion', '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이', 5, true),
('라부부🤎', 'bear', '귀엽고 엉뚱한 몬스터', 6, true)
ON CONFLICT DO NOTHING;

-- 2. 상품 데이터 (카테고리 ID 참조)
-- 산리오 상품
INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new) 
SELECT 
  c.id,
  '짱구 신짱 미니 가마구치 키링 실리콘 파우치 동전지갑',
  'shin-chan-mini-keyring',
  9000,
  8000,
  '♦️일본 라이센스 정품입니다. 만 14세 이상 구매 가능합니다. 짱구 신짱의 귀여운 얼굴이 담긴 미니 가마구치 키링입니다. 실리콘 소재로 부드럽고 내구성이 좋습니다.',
  'active',
  50,
  true,
  false
FROM categories c WHERE c.slug = 'sanrio'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '산리오 스퀴시북 종이 인형 놀이 책 만들기 헬로키티',
  'sanrio-squishy-book-hello-kitty',
  5000,
  3500,
  '✔️만 14세 이상 구매 가능합니다. 산리오 캐릭터들과 함께하는 스퀴시북 종이인형 놀이! 헬로키티와 친구들의 귀여운 일러스트가 담겨있습니다.',
  'sold_out',
  0,
  true,
  false
FROM categories c WHERE c.slug = 'sanrio'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '헬로키티 블랙앤젤 퀄팅 하트 파우치 동전지갑 실버',
  'hello-kitty-quilted-heart-pouch',
  33000,
  30900,
  '♦️일본 라이센스 정품입니다. 만 14세 이상 구매 가능합니다. 헬로키티의 블랙앤젤 시리즈 퀄팅 하트 파우치입니다. 실버 컬러로 세련된 느낌을 더했습니다.',
  'active',
  30,
  true,
  true
FROM categories c WHERE c.slug = 'sanrio'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '헬로키티 화이트 레드 토트백 손가방 에코백 천가방',
  'hello-kitty-tote-bag',
  23000,
  19000,
  '만 14세 이상 구매가능합니다. 헬로키티 패치워크 토트백으로, 화이트와 레드 두 가지 컬러가 있습니다. 가볍고 실용적인 에코백입니다.',
  'active',
  45,
  true,
  false
FROM categories c WHERE c.slug = 'fashion'
ON CONFLICT DO NOTHING;

-- 캐릭터 상품
INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '미니어쳐 간식 초코 과자 봉지 가방꾸미기 열쇠고리 키링',
  'miniature-snack-keyring',
  4000,
  3000,
  '만 14세 이상 구매가능합니다. 미니어쳐 간식 키링으로 가방이나 핸드폰을 귀엽게 꾸밀 수 있습니다. 다양한 간식 디자인 중 랜덤 발송됩니다.',
  'active',
  100,
  true,
  false
FROM categories c WHERE c.slug = 'keyring'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '쿠로미 마이멜로디 리본 헤어핀 세트',
  'kuromi-mymelody-hairpin-set',
  12000,
  9800,
  '산리오 쿠로미와 마이멜로디 캐릭터 리본 헤어핀 세트입니다. 귀여운 디자인으로 헤어스타일에 포인트를 줄 수 있습니다.',
  'active',
  60,
  false,
  true
FROM categories c WHERE c.slug = 'sanrio'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '포켓몬 피카츄 실리콘 핸드폰 스트랩',
  'pikachu-phone-strap',
  6500,
  5500,
  '귀여운 피카츄 캐릭터 핸드폰 스트랩입니다. 실리콘 소재로 부드럽고 내구성이 좋습니다. 모든 핸드폰 케이스에 호환됩니다.',
  'active',
  80,
  false,
  true
FROM categories c WHERE c.slug = 'phone-strap'
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '곰돌이 푸 미니 인형 키링',
  'winnie-the-pooh-mini-keyring',
  8500,
  7500,
  '디즈니 곰돌이 푸 미니 인형 키링입니다. 부드러운 봉제 소재로 만들어졌으며, 가방이나 열쇠에 달기 좋습니다.',
  'active',
  40,
  false,
  false
FROM categories c WHERE c.slug = 'bear'
ON CONFLICT DO NOTHING;

-- "가챠,리멘트" 카테고리 삭제로 인해 해당 카테고리 상품 제거됨

INSERT INTO products (category_id, name, slug, price, discount_price, description, status, stock, is_featured, is_new)
SELECT 
  c.id,
  '짱구 크록스 지비츠 참 세트 6종',
  'shin-chan-crocs-jibbitz-set',
  15000,
  12000,
  '짱구 캐릭터 크록스 지비츠 참 6종 세트입니다. 크록스를 귀엽게 꾸밀 수 있습니다.',
  'active',
  70,
  false,
  true
FROM categories c WHERE c.slug = 'keyring'
ON CONFLICT DO NOTHING;

-- 3. 상품 이미지 데이터 (플레이스홀더 이미지)
INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/fad2e6/333333?text=Product+1', true, 1, p.name
FROM products p WHERE p.slug = 'shin-chan-mini-keyring'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/ffd1dc/333333?text=Hello+Kitty', true, 1, p.name
FROM products p WHERE p.slug = 'sanrio-squishy-book-hello-kitty'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/f0c0d0/333333?text=Quilted+Pouch', true, 1, p.name
FROM products p WHERE p.slug = 'hello-kitty-quilted-heart-pouch'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/ffe4e9/333333?text=Tote+Bag', true, 1, p.name
FROM products p WHERE p.slug = 'hello-kitty-tote-bag'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/ffb6c1/333333?text=Snack+Keyring', true, 1, p.name
FROM products p WHERE p.slug = 'miniature-snack-keyring'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/dda0dd/333333?text=Hairpin+Set', true, 1, p.name
FROM products p WHERE p.slug = 'kuromi-mymelody-hairpin-set'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/fffacd/333333?text=Pikachu+Strap', true, 1, p.name
FROM products p WHERE p.slug = 'pikachu-phone-strap'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/ffefd5/333333?text=Pooh+Keyring', true, 1, p.name
FROM products p WHERE p.slug = 'winnie-the-pooh-mini-keyring'
ON CONFLICT DO NOTHING;

-- "가챠,리멘트" 카테고리 삭제로 인해 해당 상품 이미지 제거됨

INSERT INTO product_images (product_id, image_url, is_primary, sort_order, alt_text)
SELECT p.id, 'https://placehold.co/600x600/ffc0cb/333333?text=Jibbitz+Set', true, 1, p.name
FROM products p WHERE p.slug = 'shin-chan-crocs-jibbitz-set'
ON CONFLICT DO NOTHING;

