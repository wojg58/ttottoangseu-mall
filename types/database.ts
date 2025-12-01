/**
 * @file types/database.ts
 * @description Supabase 데이터베이스 타입 정의
 *
 * 이 파일은 또또앙스 쇼핑몰의 데이터베이스 테이블에 대한 TypeScript 타입을 정의합니다.
 * PRD의 데이터베이스 구조(11개 테이블)를 기반으로 작성되었습니다.
 */

// =============================================
// 공통 타입
// =============================================

export type ProductStatus = "active" | "hidden" | "sold_out";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentMethod =
  | "card"
  | "virtual_account"
  | "transfer"
  | "mobile"
  | "etc";
export type PaymentStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "done"
  | "cancelled"
  | "failed"
  | "expired";
export type RefundStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";
export type UserRole = "customer" | "admin";
export type ShippingStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "in_transit"
  | "delivered";

// =============================================
// 회원 (Users)
// =============================================

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// 카테고리 (Categories)
// =============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// 상품 (Products)
// =============================================

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  description: string | null;
  status: ProductStatus;
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  alt_text: string | null;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_value: string;
  stock: number;
  price_adjustment: number;
  sku: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 상품 + 이미지 + 카테고리 조인된 타입
export interface ProductWithDetails extends Product {
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
}

// 상품 리스트용 간소화된 타입 (이미지 1개만 포함)
export interface ProductListItem extends Product {
  category: Pick<Category, "id" | "name" | "slug">;
  primary_image: ProductImage | null;
}

// =============================================
// 장바구니 (Cart)
// =============================================

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
  variant: ProductVariant | null;
  primary_image: ProductImage | null;
}

// =============================================
// 주문 (Orders)
// =============================================

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_zip_code: string | null;
  shipping_memo: string | null;
  shipping_status: ShippingStatus | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_info: string | null;
  quantity: number;
  price: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// =============================================
// 결제 (Payments)
// =============================================

export interface Payment {
  id: string;
  order_id: string;
  payment_key: string | null;
  toss_payment_id: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  requested_at: string;
  approved_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  cancel_reason: string | null;
  receipt_url: string | null;
  card_company: string | null;
  card_number: string | null;
  installment_plan_months: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// 환불 (Refunds)
// =============================================

export interface Refund {
  id: string;
  payment_id: string;
  order_id: string;
  refund_amount: number;
  refund_reason: string;
  refund_status: RefundStatus;
  toss_refund_id: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  refund_account_bank: string | null;
  refund_account_number: string | null;
  refund_account_holder: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// API 응답 타입
// =============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
