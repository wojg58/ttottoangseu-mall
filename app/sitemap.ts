/**
 * @file app/sitemap.ts
 * @description 동적 사이트맵 생성
 * 
 * Next.js 15의 sitemap.ts를 사용하여 동적 사이트맵을 생성합니다.
 * 상품 페이지와 카테고리 페이지를 자동으로 포함합니다.
 */

import { MetadataRoute } from "next";
import { getProducts } from "@/actions/products";
import { getCategories } from "@/actions/products";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ttottoangseu.co.kr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/company`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    // 카테고리 페이지 추가
    const categories = await getCategories();
    categories.forEach((category) => {
      routes.push({
        url: `${siteUrl}/products/category/${category.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    });

    // 상품 페이지 추가 (최대 1000개로 제한)
    const { data: products } = await getProducts({}, 1, 1000);
    products.forEach((product) => {
      routes.push({
        url: `${siteUrl}/products/${product.slug}`,
        lastModified: product.updated_at
          ? new Date(product.updated_at)
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    });
  } catch (error) {
    console.error("[sitemap] 사이트맵 생성 중 오류:", error);
    // 에러가 발생해도 기본 라우트는 반환
  }

  return routes;
}
