/**
 * @file app/admin/products/page.tsx
 * @description 관리자 상품 관리 페이지
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronLeft, Edit, Trash2 } from "lucide-react";
import { isAdmin, getAdminProducts } from "@/actions/admin";
import { deleteProduct } from "@/actions/admin-products";
import DeleteProductButton from "@/components/delete-product-button";

interface AdminProductsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const { products, total, totalPages } = await getAdminProducts(page);

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-[#4a3f48]">상품 관리</h1>
            <span className="text-sm text-[#8b7d84]">총 {total}개</span>
          </div>
          <Link href="/admin/products/new">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5088] transition-colors">
              <Plus className="w-4 h-4" />
              상품 등록
            </button>
          </Link>
        </div>

        {/* 상품 목록 */}
        {products.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      이미지
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      상품명
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      카테고리
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      가격
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      재고
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      상태
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        {product.primary_image ? (
                          <img
                            src={product.primary_image.image_url}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-[#4a3f48]">
                            {product.name}
                          </p>
                          <p className="text-xs text-[#8b7d84]">
                            {product.slug}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-[#4a3f48]">
                        {product.category.name}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          {product.discount_price ? (
                            <>
                              <p className="text-[#ff6b9d] font-medium">
                                {product.discount_price.toLocaleString()}원
                              </p>
                              <p className="text-xs text-gray-400 line-through">
                                {product.price.toLocaleString()}원
                              </p>
                            </>
                          ) : (
                            <p className="text-[#4a3f48] font-medium">
                              {product.price.toLocaleString()}원
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-[#4a3f48]">
                        {product.stock}개
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            product.status === "active"
                              ? "bg-green-100 text-green-600"
                              : product.status === "sold_out"
                              ? "bg-red-100 text-red-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {product.status === "active" && "판매중"}
                          {product.status === "hidden" && "숨김"}
                          {product.status === "sold_out" && "품절"}
                        </span>
                        <div className="flex gap-1 mt-1">
                          {product.is_featured && (
                            <span className="text-xs px-1.5 py-0.5 bg-[#ffeef5] text-[#ff6b9d] rounded">
                              BEST
                            </span>
                          )}
                          {product.is_new && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                              NEW
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <DeleteProductButton productId={product.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <p className="text-[#8b7d84] mb-4">등록된 상품이 없습니다.</p>
            <Link href="/admin/products/new">
              <button className="px-4 py-2 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5088] transition-colors">
                첫 상품 등록하기
              </button>
            </Link>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <Link
                  key={pageNum}
                  href={`/admin/products?page=${pageNum}`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                    pageNum === page
                      ? "bg-[#ff6b9d] text-white"
                      : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                  }`}
                >
                  {pageNum}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
