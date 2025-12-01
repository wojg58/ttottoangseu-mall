/**
 * @file app/admin/products/new/page.tsx
 * @description 상품 등록 페이지
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/actions/admin";
import { getCategories } from "@/actions/products";
import ProductForm from "@/components/product-form";

export default async function NewProductPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const categories = await getCategories();

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/products"
            className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#4a3f48]">상품 등록</h1>
        </div>

        <ProductForm categories={categories} />
      </div>
    </main>
  );
}
