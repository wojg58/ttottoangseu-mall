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
import type { Category, ProductWithDetails } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Highlight from "@tiptap/extension-highlight";

// 폼 스키마
const productSchema = z.object({
  category_id: z.string().min(1, "카테고리를 선택해주세요."),
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
  const [descriptionHtml, setDescriptionHtml] = useState<string>(
    product?.description || "",
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: product?.category_id || "",
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
      Image.configure({
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
        const result = await createProduct({
          category_id: data.category_id,
          name: data.name,
          slug: data.slug,
          price: data.price,
          discount_price: data.discount_price ?? null,
          description: data.description ?? null,
          status: data.status,
          stock: data.stock,
          is_featured: data.is_featured,
          is_new: data.is_new,
          images: [], // TODO: 이미지 업로드 기능 추가
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
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#4a3f48]">
                    카테고리 <span className="text-[#ff6b9d]">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]">
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
