/**
 * @file app/admin/products/[id]/page.tsx
 * @description 상품 수정 페이지
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin, getProductById } from "@/actions/admin";
import { getCategories } from "@/actions/products";
import ProductForm from "@/components/product-form";

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const { id } = await params;
  const search = await searchParams;

  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const categories = await getCategories();

  // 현재 페이지 정보를 ProductForm에 전달
  const currentPage = search.page || "1";
  const currentSearch = search.search || "";

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/admin/products${currentPage !== "1" ? `?page=${currentPage}` : ""}${currentSearch ? `${currentPage !== "1" ? "&" : "?"}search=${encodeURIComponent(currentSearch)}` : ""}`}
            className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#4a3f48]">상품 수정</h1>
        </div>

        <ProductForm 
          categories={categories} 
          product={product}
          returnPage={currentPage}
          returnSearch={currentSearch}
        />
      </div>
    </main>
  );
}
