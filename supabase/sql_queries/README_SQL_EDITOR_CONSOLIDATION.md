# Supabase SQL Editor 쿼리 통합 가이드

## 📋 개요

Supabase 대시보드의 SQL Editor에 저장된 18개의 쿼리를 관련 항목끼리 묶어서 정리하는 방법입니다.

## 🎯 현재 쿼리 목록 및 그룹화

### 그룹 1: 상품 복구 관련 (3개)
- "Restore Soft-Deleted Products"
- "Soft-deleted products with '-restored-' slugs"
- "Rename Conflicting Deleted Product Slugs Before Restore"

**통합 쿼리**: `01_restore_soft_deleted_products.sql`

### 그룹 2: 스키마 생성 (1개)
- "또또앙스 쇼핑몰 스키마 생성 (Soft Delete 포함)"

**통합 쿼리**: 이미 마이그레이션 파일로 존재 (`update_shopping_mall_schema.sql`)

### 그룹 3: 상품 ID 마이그레이션 (1개)
- "Products ID Migration to TEXT with Automated ttotto_## IDs"

**통합 쿼리**: 이미 마이그레이션 파일로 존재 (`20251210104352_change_product_id_to_text.sql`)

### 그룹 4: 카테고리 관련 (2개)
- "카테고리명·설명 일괄 업데이트"
- "상품-카테고리 다대다 관계 마이그레이션"

**통합 쿼리**: `02_categories_management.sql`

### 그룹 5: 네이버 스마트스토어 연동 (2개)
- "Add smartstore_product_id Column and Partial Index"
- "Add variant_id column for option-level inventory sync"

**통합 쿼리**: 이미 마이그레이션 파일로 존재

### 그룹 6: 스토리지 버킷 (2개)
- "Product Images Bucket and RLS Policies"
- "Product images storage bucket and access policies"

**통합 쿼리**: `03_storage_buckets.sql`

### 그룹 7: 테이블 생성 (3개)
- "Coupons table with constraints & order link"
- "Chat sessions & messages schema"
- "RLS & Access Policies for Ttottoangseumall"

**통합 쿼리**: 이미 마이그레이션 파일로 존재

### 그룹 8: 인덱스 및 성능 (1개)
- "Indexes for users.clerk_user_id and products(id, deleted_at)"

**통합 쿼리**: `04_indexes_and_performance.sql`

### 그룹 9: 조회 쿼리 (2개)
- "Products listing"
- "Untitled query"

**통합 쿼리**: `05_common_queries.sql` (조회용, 실행하지 않음)

## 🚀 통합 방법

### 방법 1: Supabase 대시보드에서 직접 통합 (권장)

1. **새 통합 쿼리 생성**
   - SQL Editor에서 "+ New query" 클릭
   - 통합 SQL 파일 내용 복사/붙여넣기
   - 적절한 이름으로 저장 (예: "01. 상품 복구 통합")

2. **기존 쿼리 삭제 또는 아카이브**
   - 통합된 기존 쿼리들을 삭제하거나
   - 이름 앞에 "[OLD]" 또는 "[ARCHIVED]" 추가

3. **폴더 구조 (Supabase는 폴더 미지원, 이름으로 구분)**
   - `01. 상품 복구 통합`
   - `02. 카테고리 관리 통합`
   - `03. 스토리지 버킷 통합`
   - `04. 인덱스 및 성능 최적화`
   - `05. 공통 조회 쿼리`

### 방법 2: 로컬 파일로 관리

1. `supabase/sql_queries/` 폴더에 통합 SQL 파일 저장
2. 필요할 때만 Supabase 대시보드에 복사/붙여넣기
3. 버전 관리 가능 (Git)

## 📝 통합 쿼리 파일 구조

```
supabase/sql_queries/
├── 01_restore_soft_deleted_products.sql
├── 02_categories_management.sql
├── 03_storage_buckets.sql
├── 04_indexes_and_performance.sql
├── 05_common_queries.sql
└── README_SQL_EDITOR_CONSOLIDATION.md (이 파일)
```

## ⚠️ 주의사항

1. **기존 쿼리 백업**: 삭제하기 전에 내용을 확인하고 백업하세요.
2. **의존성 확인**: 쿼리 실행 순서가 중요할 수 있습니다.
3. **테스트**: 통합 쿼리를 실행하기 전에 테스트 환경에서 먼저 확인하세요.

## 🔄 정리 후 예상 구조

### Before (18개)
- Restore Soft-Deleted Products
- Soft-deleted products with '-restored-' slugs
- Rename Conflicting Deleted Product Slugs Before Restore
- 카테고리명·설명 일괄 업데이트
- ... (기타 14개)

### After (5-7개)
- 01. 상품 복구 통합
- 02. 카테고리 관리 통합
- 03. 스토리지 버킷 통합
- 04. 인덱스 및 성능 최적화
- 05. 공통 조회 쿼리
- [OLD] 기존 쿼리들 (아카이브용)

---

**작성일**: 2026년 1월 10일  
**목적**: Supabase SQL Editor 쿼리 정리 및 통합

