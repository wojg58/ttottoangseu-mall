"use client";

/**
 * @file components/product-form.tsx
 * @description 상품 등록/수정 폼 컴포넌트
 */

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createProduct, updateProduct } from "@/actions/admin-products";
import { uploadImageFile } from "@/actions/upload-image";
import type {
  Category,
  ProductWithDetails,
  ProductImage,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { X, Upload, Star } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Highlight from "@tiptap/extension-highlight";

// 폼 스키마
const productSchema = z.object({
  category_id: z.string().min(1, "기본 카테고리를 선택해주세요."), // 기본 카테고리 (하위 호환성)
  category_ids: z.array(z.string()).min(1, "최소 1개 이상의 카테고리를 선택해주세요."), // 다중 카테고리
  name: z.string().min(2, "상품명을 입력해주세요."),
  slug: z.string().min(2, "slug를 입력해주세요."),
  price: z.number().min(0, "가격은 0원 이상이어야 합니다."),
  discount_price: z.number().min(0).nullable().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "hidden", "sold_out"]),
  stock: z.number().min(0, "재고는 0개 이상이어야 합니다."),
  is_featured: z.boolean(),
  is_new: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  categories: Category[];
  product?: ProductWithDetails;
}

export default function ProductForm({ categories, product }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!product;

  console.log("[ProductForm] 카테고리 개수:", categories.length);
  console.log("[ProductForm] 카테고리 목록:", categories.map((c) => c.name));
  const [descriptionHtml, setDescriptionHtml] = useState<string>(
    product?.description || "",
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 상품 이미지 갤러리 상태
  const [productImages, setProductImages] = useState<
    Array<{
      id?: string; // 기존 이미지의 경우 id가 있음
      image_url: string;
      is_primary: boolean;
      sort_order: number;
      alt_text?: string | null;
    }>
  >(
    product?.images
      ? product.images.map((img) => ({
          id: img.id,
          image_url: img.image_url,
          is_primary: img.is_primary,
          sort_order: img.sort_order,
          alt_text: img.alt_text,
        }))
      : [],
  );
  const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: product?.category_id || "",
      category_ids: product?.category_id ? [product.category_id] : [], // 수정 시에는 기존 카테고리만 표시 (나중에 product_categories에서 가져오도록 개선 필요)
      name: product?.name || "",
      slug: product?.slug || "",
      price: product?.price || 0,
      discount_price: product?.discount_price || null,
      description: product?.description || "",
      status: product?.status || "active",
      stock: product?.stock || 0,
      is_featured: product?.is_featured || false,
      is_new: product?.is_new || false,
    },
  });

  // TipTap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Blockquote는 별도 extension 사용
        blockquote: false,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Blockquote,
      HorizontalRule,
      TiptapImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[#ff6b9d] underline hover:text-[#ff5088]",
        },
      }),
    ],
    content: descriptionHtml,
    immediatelyRender: false, // SSR 호환성
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setDescriptionHtml(html);
      form.setValue("description", html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-pink max-w-none min-h-[300px] p-4 focus:outline-none [&_p]:text-[#4a3f48] [&_p]:leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#4a3f48] [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#4a3f48] [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#4a3f48] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4",
        spellcheck: "false",
      },
    },
  });

  // 클라이언트 마운트 확인
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 에디터에 초기 내용 설정
  useEffect(() => {
    if (editor && product?.description) {
      editor.commands.setContent(product.description);
      setDescriptionHtml(product.description);
    }
  }, [editor, product?.description]);

  const onSubmit = (data: ProductFormData) => {
    console.log("[ProductForm] 제출:", data);

    startTransition(async () => {
      if (isEdit && product) {
        // 수정
        const result = await updateProduct({
          id: product.id,
          category_id: data.category_id,
          category_ids: data.category_ids, // 다중 카테고리
          ...data,
        });

        if (result.success) {
          alert(result.message);
          router.push("/admin/products");
        } else {
          alert(result.message);
        }
      } else {
        // 생성
        // 폼 검증을 통과했으므로 모든 필수 필드가 존재함
        // 상품 이미지 갤러리 데이터 준비
        const imagesData = productImages.map((img, index) => ({
          image_url: img.image_url,
          is_primary: img.is_primary,
          sort_order: img.sort_order,
          alt_text: img.alt_text || data.name,
        }));

        const result = await createProduct({
          category_id: data.category_id, // 기본 카테고리 (하위 호환성)
          category_ids: data.category_ids, // 다중 카테고리
          name: data.name,
          slug: data.slug,
          price: data.price,
          discount_price: data.discount_price ?? null,
          description: data.description ?? null,
          status: data.status,
          stock: data.stock,
          is_featured: data.is_featured,
          is_new: data.is_new,
          images: imagesData,
        });

        if (result.success) {
          alert(result.message);
          router.push("/admin/products");
        } else {
          alert(result.message);
        }
      }
    });
  };

  // slug 자동 생성 (상품명 기반)
  const handleNameChange = (name: string) => {
    if (!isEdit) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[가-힣]/g, "");
      form.setValue("slug", slug);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="category_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">
                    카테고리 <span className="text-[#ff6b9d]">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="border border-[#f5d5e3] rounded-lg p-4 max-h-48 overflow-y-auto bg-white">
                      {categories.length === 0 ? (
                        <p className="text-sm text-[#8b7d84] text-center py-4">
                          카테고리가 없습니다.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {categories.map((category) => {
                            const currentValue = Array.isArray(field.value) ? field.value : [];
                            const isChecked = currentValue.includes(category.id);
                            
                            // 클라이언트 마운트 전에는 플레이스홀더만 렌더링
                            if (!isMounted) {
                              return (
                                <div
                                  key={category.id}
                                  className="flex items-center gap-2 p-2"
                                >
                                  <div className="w-4 h-4 border border-[#f5d5e3] rounded bg-white" />
                                  <span className="text-sm text-[#4a3f48]">
                                    {category.name}
                                  </span>
                                </div>
                              );
                            }
                            
                            return (
                              <div
                                key={category.id}
                                className="flex items-center gap-2 p-2 hover:bg-[#ffeef5] rounded transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  id={`category-${category.id}`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentValue = Array.isArray(field.value) ? field.value : [];
                                    if (e.target.checked) {
                                      // 체크박스 선택 시 배열에 추가
                                      const newValue = [...currentValue, category.id];
                                      field.onChange(newValue);
                                      // 기본 카테고리도 동기화 (첫 번째 선택된 카테고리)
                                      if (currentValue.length === 0) {
                                        form.setValue("category_id", category.id);
                                      }
                                    } else {
                                      // 체크박스 해제 시 배열에서 제거
                                      const newValue = currentValue.filter(
                                        (id) => id !== category.id,
                                      );
                                      field.onChange(newValue);
                                      // 기본 카테고리도 동기화
                                      if (newValue.length > 0) {
                                        form.setValue("category_id", newValue[0]);
                                      } else {
                                        form.setValue("category_id", "");
                                      }
                                    }
                                  }}
                                  className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-2 focus:ring-[#fad2e6] cursor-pointer"
                                />
                                <label
                                  htmlFor={`category-${category.id}`}
                                  className="text-sm text-[#4a3f48] cursor-pointer flex-1 select-none"
                                >
                                  {category.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <p className="text-xs text-[#8b7d84] mt-1">
                    여러 카테고리를 선택할 수 있습니다. 첫 번째 선택된 카테고리가 기본 카테고리로 설정됩니다.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">
                    상태 <span className="text-[#ff6b9d]">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]">
                        <SelectValue placeholder="상태 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">판매중</SelectItem>
                      <SelectItem value="hidden">숨김</SelectItem>
                      <SelectItem value="sold_out">품절</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">
                  상품명 <span className="text-[#ff6b9d]">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="상품명을 입력하세요"
                    className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      handleNameChange(e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">
                  URL Slug <span className="text-[#ff6b9d]">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="product-slug"
                    className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-[#8b7d84]">
                  URL에 사용될 고유한 식별자 (URL 링크 모두 허용 가능)
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">
                    정가 <span className="text-[#ff6b9d]">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discount_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">할인가</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="할인 없음"
                      className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value) : null,
                        )
                      }
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">
                    재고 <span className="text-[#ff6b9d]">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={() => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">
                  상품 설명 (HTML 지원)
                </FormLabel>
                <FormControl>
                  <div className="border border-[#f5d5e3] rounded-lg overflow-hidden flex flex-col max-h-[600px]">
                    {/* 툴바 - 스크롤 시 상단 고정 */}
                    <div className="sticky top-0 z-20 border-b border-[#f5d5e3] bg-[#ffeef5] p-2 flex flex-wrap gap-2 shadow-sm shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().toggleBold().run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("bold")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        <strong>B</strong>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().toggleItalic().run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("italic")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        <em>I</em>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("heading", { level: 1 })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("heading", { level: 2 })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().toggleBulletList().run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("bulletList")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        • 목록
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().toggleOrderedList().run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("orderedList")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                      >
                        1. 목록
                      </button>
                      {/* 글씨 크기 (H3 추가) */}
                      <button
                        type="button"
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 3 })
                            .run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("heading", { level: 3 })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="제목 3"
                      >
                        H3
                      </button>
                      {/* 텍스트 색상 */}
                      <div className="relative">
                        <input
                          type="color"
                          onChange={(e) => {
                            editor
                              ?.chain()
                              .focus()
                              .setColor(e.target.value)
                              .run();
                          }}
                          className="w-10 h-8 rounded cursor-pointer border border-[#f5d5e3]"
                          title="텍스트 색상"
                          defaultValue="#4a3f48"
                        />
                      </div>
                      {/* 배경 색상 */}
                      <div className="relative">
                        <input
                          type="color"
                          onChange={(e) => {
                            editor
                              ?.chain()
                              .focus()
                              .toggleHighlight({ color: e.target.value })
                              .run();
                          }}
                          className="w-10 h-8 rounded cursor-pointer border border-[#f5d5e3]"
                          title="배경 색상"
                          defaultValue="#ffffff"
                        />
                      </div>
                      {/* 정렬 - 왼쪽 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().setTextAlign("left").run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive({ textAlign: "left" })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="왼쪽 정렬"
                      >
                        ⬅
                      </button>
                      {/* 정렬 - 가운데 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().setTextAlign("center").run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive({ textAlign: "center" })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="가운데 정렬"
                      >
                        ⬌
                      </button>
                      {/* 정렬 - 오른쪽 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().setTextAlign("right").run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive({ textAlign: "right" })
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="오른쪽 정렬"
                      >
                        ➡
                      </button>
                      {/* 인용구 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().toggleBlockquote().run()
                        }
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("blockquote")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="인용구"
                      >
                        &quot;
                      </button>
                      {/* 구분선 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().setHorizontalRule().run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="구분선"
                      >
                        ─
                      </button>
                      {/* 들여쓰기/내어쓰기 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().liftListItem("listItem").run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="내어쓰기"
                      >
                        ⬅
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().sinkListItem("listItem").run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="들여쓰기"
                      >
                        ➡
                      </button>
                      {/* 이미지 업로드 */}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !editor) return;

                          setIsUploadingImage(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);

                            const result = await uploadImageFile(formData);

                            if (result.success && result.url) {
                              editor
                                .chain()
                                .focus()
                                .setImage({ src: result.url })
                                .run();
                            } else {
                              alert(
                                result.error || "이미지 업로드에 실패했습니다.",
                              );
                            }
                          } catch (error) {
                            console.error("이미지 업로드 에러:", error);
                            alert("이미지 업로드 중 오류가 발생했습니다.");
                          } finally {
                            setIsUploadingImage(false);
                            // input 초기화
                            if (imageInputRef.current) {
                              imageInputRef.current.value = "";
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          imageInputRef.current?.click();
                        }}
                        disabled={isUploadingImage}
                        className={`px-3 py-1 rounded text-sm ${
                          isUploadingImage
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="이미지 업로드"
                      >
                        {isUploadingImage ? "업로드 중..." : "이미지"}
                      </button>
                      {/* 링크 */}
                      <button
                        type="button"
                        onClick={() => {
                          const url = window.prompt("링크 URL을 입력하세요:");
                          if (url) {
                            editor
                              ?.chain()
                              .focus()
                              .extendMarkRange("link")
                              .setLink({ href: url })
                              .run();
                          }
                        }}
                        className={`px-3 py-1 rounded text-sm ${
                          editor?.isActive("link")
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        }`}
                        title="링크 삽입"
                      >
                        링크
                      </button>
                      {/* 서식 지우기 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().unsetAllMarks().run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="서식 지우기"
                      >
                        ✕
                      </button>
                      {/* 맞춤법 (브라우저 기본 기능 사용) */}
                      <button
                        type="button"
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="맞춤법 검사 (브라우저 기본 기능 - 자동 활성화)"
                      >
                        맞춤법
                      </button>
                      {/* 초기화 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().clearNodes().run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        title="초기화"
                      >
                        초기화
                      </button>
                    </div>
                    {/* 에디터 영역 - 스크롤 가능 */}
                    <div className="bg-white min-h-[300px] overflow-y-auto flex-1">
                      {isMounted && editor ? (
                        <EditorContent
                          editor={editor}
                          suppressHydrationWarning
                        />
                      ) : (
                        <div className="p-4 text-[#8b7d84]">
                          에디터를 불러오는 중...
                        </div>
                      )}
                    </div>
                  </div>
                </FormControl>
                <p className="text-xs text-[#8b7d84]">
                  스마트스토어에서 복사한 HTML을 그대로 붙여넣을 수 있습니다.
                  (Ctrl+V 또는 Cmd+V)
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 상품 이미지 갤러리 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#4a3f48] block mb-2">
                상품 이미지 갤러리{" "}
                <span className="text-[#8b7d84] text-xs font-normal">
                  (상품 상세 페이지에 표시되는 이미지들)
                </span>
              </label>

              {/* 이미지 업로드 버튼 */}
              <input
                ref={galleryImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;

                  setIsUploadingGalleryImage(true);
                  try {
                    const uploadPromises = Array.from(files).map(
                      async (file) => {
                        const formData = new FormData();
                        formData.append("file", file);

                        const result = await uploadImageFile(formData);
                        if (result.success && result.url) {
                          return {
                            image_url: result.url,
                            is_primary: productImages.length === 0, // 첫 번째 이미지가 대표 이미지
                            sort_order: productImages.length,
                            alt_text: file.name,
                          };
                        }
                        return null;
                      },
                    );

                    const uploadedImages = (
                      await Promise.all(uploadPromises)
                    ).filter(
                      (img): img is NonNullable<typeof img> => img !== null,
                    );

                    if (uploadedImages.length > 0) {
                      setProductImages((prev) => [...prev, ...uploadedImages]);
                      console.log(
                        "[ProductForm] 이미지 갤러리 업로드 성공:",
                        uploadedImages.length,
                      );
                    } else {
                      alert("이미지 업로드에 실패했습니다.");
                    }
                  } catch (error) {
                    console.error("이미지 갤러리 업로드 에러:", error);
                    alert("이미지 업로드 중 오류가 발생했습니다.");
                  } finally {
                    setIsUploadingGalleryImage(false);
                    if (galleryImageInputRef.current) {
                      galleryImageInputRef.current.value = "";
                    }
                  }
                }}
              />

              <Button
                type="button"
                onClick={() => galleryImageInputRef.current?.click()}
                disabled={isUploadingGalleryImage}
                variant="outline"
                className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploadingGalleryImage ? "업로드 중..." : "이미지 추가"}
              </Button>
            </div>

            {/* 이미지 목록 */}
            {productImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {productImages.map((img, index) => (
                  <div
                    key={img.id || `new-${index}`}
                    className="relative group border border-[#f5d5e3] rounded-lg overflow-hidden aspect-square"
                  >
                    <Image
                      src={img.image_url}
                      alt={img.alt_text || `상품 이미지 ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />

                    {/* 대표 이미지 표시 */}
                    {img.is_primary && (
                      <div className="absolute top-2 left-2 bg-[#ff6b9d] text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        대표
                      </div>
                    )}

                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        setProductImages((prev) => {
                          const newImages = prev.filter((_, i) => i !== index);
                          // 첫 번째 이미지가 삭제되면 다음 이미지를 대표 이미지로 설정
                          if (newImages.length > 0 && img.is_primary) {
                            newImages[0].is_primary = true;
                          }
                          return newImages;
                        });
                        console.log("[ProductForm] 이미지 삭제:", index);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* 대표 이미지 설정 버튼 */}
                    {!img.is_primary && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductImages((prev) =>
                            prev.map((item, i) => ({
                              ...item,
                              is_primary: i === index,
                            })),
                          );
                          console.log("[ProductForm] 대표 이미지 설정:", index);
                        }}
                        className="absolute bottom-2 left-2 right-2 bg-white/90 text-[#4a3f48] px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity text-center"
                      >
                        대표 이미지로 설정
                      </button>
                    )}

                    {/* 순서 표시 */}
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {productImages.length === 0 && (
              <div className="border-2 border-dashed border-[#f5d5e3] rounded-lg p-8 text-center">
                <p className="text-[#8b7d84]">상품 이미지를 추가해주세요.</p>
                <p className="text-xs text-[#8b7d84] mt-2">
                  첫 번째로 추가한 이미지가 대표 이미지로 설정됩니다.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="is_featured"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-[#fad2e6]"
                    />
                  </FormControl>
                  <FormLabel className="text-[#4a3f48] cursor-pointer">
                    베스트 상품
                  </FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_new"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-[#fad2e6]"
                    />
                  </FormControl>
                  <FormLabel className="text-[#4a3f48] cursor-pointer">
                    신상품
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-12 bg-[#ff6b9d] hover:bg-[#ff5088] text-white disabled:opacity-50"
            >
              {isPending ? "처리 중..." : isEdit ? "상품 수정" : "상품 등록"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-12 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
            >
              취소
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
