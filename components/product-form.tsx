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
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { X, Upload, Star, ChevronUp, ChevronDown, Plus } from "lucide-react";
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
  returnPage?: string; // 목록으로 돌아갈 때 페이지 번호
  returnSearch?: string; // 목록으로 돌아갈 때 검색어
}

export default function ProductForm({ 
  categories, 
  product,
  returnPage,
  returnSearch,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!product;
  
  // 목록으로 돌아갈 URL 생성
  const getReturnUrl = () => {
    const params = new URLSearchParams();
    if (returnPage && returnPage !== "1") {
      params.set("page", returnPage);
    }
    if (returnSearch) {
      params.set("search", returnSearch);
    }
    const queryString = params.toString();
    return `/admin/products${queryString ? `?${queryString}` : ""}`;
  };

  console.log("[ProductForm] 카테고리 개수:", categories.length);
  console.log("[ProductForm] 카테고리 목록:", categories.map((c) => c.name));
  const [descriptionHtml, setDescriptionHtml] = useState<string>(
    product?.description || "",
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);

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
  
  // 삭제된 이미지 추적 (대표 이미지 제외하고 모두 삭제 시 사용)
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  // 상품 옵션 상태
  const [productVariants, setProductVariants] = useState<
    Array<{
      id?: string; // 기존 옵션의 경우 id가 있음
      variant_name: string;
      variant_value: string;
      stock: number;
      price_adjustment: number;
      sku?: string | null;
    }>
  >(
    product?.variants
      ? product.variants
          .filter((v) => !v.deleted_at)
          .map((v) => ({
            id: v.id,
            variant_name: v.variant_name,
            variant_value: v.variant_value,
            stock: v.stock,
            price_adjustment: v.price_adjustment,
            sku: v.sku,
          }))
      : [],
  );

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: product?.category_id || "",
      category_ids: product?.product_categories
        ? product.product_categories
            .map((pc: { category_id: string }) => pc.category_id)
            .sort((a: string, b: string) => {
              // is_primary가 true인 것을 먼저, 그 다음 sort_order 순서로 정렬
              const pcA = product.product_categories.find(
                (pc: { category_id: string }) => pc.category_id === a,
              );
              const pcB = product.product_categories.find(
                (pc: { category_id: string }) => pc.category_id === b,
              );
              if (pcA?.is_primary && !pcB?.is_primary) return -1;
              if (!pcA?.is_primary && pcB?.is_primary) return 1;
              return (pcA?.sort_order || 0) - (pcB?.sort_order || 0);
            })
        : product?.category_id
          ? [product.category_id]
          : [], // 수정 시에는 product_categories에서 가져온 다중 카테고리 사용
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
          "prose prose-pink max-w-none min-h-[300px] p-4 focus:outline-none [&_p]:text-[#4a3f48] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:mt-0 [&_p]:first:mt-0 [&_p]:last:mb-0 [&_p:empty]:mb-4 [&_p:empty]:min-h-[1rem] [&_br]:block [&_br]:my-2 [&_br+br]:my-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#4a3f48] [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#4a3f48] [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#4a3f48] [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:text-[#4a3f48] [&_li]:mb-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4 [&_img]:relative [&_img]:inline-block [&_div]:mb-4 [&_div]:last:mb-0",
        spellcheck: "false",
      },
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target as HTMLElement;
          // 삭제 버튼 클릭 처리
          if (target.classList.contains("tiptap-image-delete-btn")) {
            event.preventDefault();
            const imgElement = target.closest("img");
            if (imgElement && editor) {
              const pos = view.posAtDOM(imgElement, 0);
              if (pos !== null) {
                editor.chain().focus().setTextSelection(pos).deleteSelection().run();
              }
            }
            return true;
          }
          return false;
        },
      },
    },
  });

  // 클라이언트 마운트 확인
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // product prop이 변경될 때 이미지 상태 업데이트
  useEffect(() => {
    if (product?.images) {
      const updatedImages = product.images.map((img) => ({
        id: img.id,
        image_url: img.image_url,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
        alt_text: img.alt_text,
      }));
      console.log("[ProductForm] product prop 변경으로 이미지 상태 업데이트:", updatedImages.length, "개");
      console.log("[ProductForm] 업데이트된 이미지 ID 목록:", updatedImages.map(img => img.id).filter(Boolean));
      setProductImages(updatedImages);
      // 삭제된 이미지 ID 목록도 초기화 (새로운 상품 로드 시)
      setDeletedImageIds([]);
    } else if (product && !product.images) {
      console.log("[ProductForm] product prop 변경으로 이미지 상태 초기화");
      setProductImages([]);
      setDeletedImageIds([]);
    }
  }, [product?.id, product?.images?.length, product?.images]); // product.images도 의존성에 추가하여 변경 감지

  // 옵션별 재고 합산하여 총 재고 자동 계산
  useEffect(() => {
    if (productVariants.length > 0) {
      const totalStock = productVariants.reduce((sum, variant) => {
        return sum + (variant.stock || 0);
      }, 0);
      console.log("[ProductForm] 옵션 재고 합산:", {
        variantsCount: productVariants.length,
        totalStock,
        variantStocks: productVariants.map((v) => ({
          value: v.variant_value,
          stock: v.stock,
        })),
      });
      form.setValue("stock", totalStock);
    }
  }, [productVariants, form]);

  // 이미지 삭제 기능을 위한 이벤트 리스너
  useEffect(() => {
    if (!editor || !isMounted) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && target.closest(".ProseMirror")) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 우측 상단 삭제 버튼 영역 클릭 확인 (40x40px 영역)
        if (x > rect.width - 40 && y < 40) {
          e.preventDefault();
          e.stopPropagation();

          // TipTap 에디터에서 이미지 찾기 및 삭제
          const view = editor.view;
          const pos = view.posAtDOM(target, 0);
          
          if (pos !== null && pos >= 0) {
            // 이미지 노드 찾기
            const $pos = view.state.doc.resolve(pos);
            const node = $pos.node();
            
            if (node && node.type.name === "image") {
              editor
                .chain()
                .focus()
                .setTextSelection(pos)
                .deleteSelection()
                .run();
              console.log("[ProductForm] 에디터 이미지 삭제 완료");
            } else {
              // 이미지가 paragraph 안에 있는 경우
              const imagePos = $pos.before();
              editor
                .chain()
                .focus()
                .setTextSelection(imagePos)
                .deleteSelection()
                .run();
              console.log("[ProductForm] 에디터 이미지 삭제 완료 (paragraph 내)");
            }
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("click", handleImageClick);

    return () => {
      editorElement.removeEventListener("click", handleImageClick);
    };
  }, [editor, isMounted]);

  // 에디터에 초기 내용 설정
  useEffect(() => {
    if (editor && product?.description) {
      editor.commands.setContent(product.description);
      setDescriptionHtml(product.description);
    }
  }, [editor, product?.description]);

  // 기호 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSymbolMenu && !target.closest(".symbol-menu-container")) {
        setShowSymbolMenu(false);
      }
    };

    if (showSymbolMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSymbolMenu]);

  const onSubmit = (data: ProductFormData) => {
    console.log("[ProductForm] 제출:", data);

    startTransition(async () => {
      if (isEdit && product) {
        // 수정
        // 상품 이미지 갤러리 데이터 준비
        // sort_order를 현재 인덱스로 설정하여 순서 보장
        // deletedImageIds에 포함된 이미지는 제외 (이미 UI에서 제거됨)
        const imagesData = productImages
          .filter((img) => !deletedImageIds.includes(img.id || "")) // 삭제 대상 이미지 제외
          .map((img, index) => ({
            id: img.id, // 기존 이미지의 경우 id가 있음
            image_url: img.image_url,
            is_primary: img.is_primary,
            sort_order: index, // 현재 순서를 sort_order로 설정
            alt_text: img.alt_text || data.name,
          }));

        console.group("[ProductForm] 수정 시 이미지 처리");
        console.log("[ProductForm] 수정 시 이미지 데이터:", imagesData);
        console.log("[ProductForm] 이미지 ID 목록:", imagesData.map(img => img.id).filter(Boolean));
        console.log("[ProductForm] 현재 productImages 상태:", productImages.map(img => ({ id: img.id, is_primary: img.is_primary })));
        console.log("[ProductForm] 삭제된 이미지 ID 목록:", deletedImageIds);
        console.log("[ProductForm] 수정 시 옵션 데이터:", productVariants);
        console.groupEnd();

        // 옵션 데이터 준비 (빈 값 필터링)
        const variantsData = productVariants
          .filter((v) => v.variant_value.trim() !== "") // 옵션값이 있는 것만
          .map((v) => ({
            id: v.id, // 기존 옵션의 경우 id가 있음
            variant_name: v.variant_name || "옵션",
            variant_value: v.variant_value,
            stock: v.stock,
            price_adjustment: v.price_adjustment,
            sku: v.sku ?? null,
          }));

        const result = await updateProduct({
          id: product.id,
          category_id: data.category_id,
          category_ids: data.category_ids, // 다중 카테고리
          ...data,
          images: imagesData, // 이미지 데이터 추가
          deletedImageIds: deletedImageIds.length > 0 ? deletedImageIds : undefined, // 명시적으로 삭제할 이미지 ID 목록
          variants: variantsData.length > 0 ? variantsData : undefined, // 옵션 데이터 추가
        });
        
        if (result.success) {
          // 성공 시 삭제된 이미지 ID 목록 초기화
          setDeletedImageIds([]);
          alert(result.message);
          // 삭제된 이미지가 UI에서 즉시 제거되도록 강제 새로고침
          // router.refresh()만으로는 부족할 수 있으므로 window.location.href 사용
          // 이미지 삭제 후 캐시를 무효화하기 위해 타임스탬프 추가
          const timestamp = new Date().getTime();
          window.location.href = `/admin/products/${product.id}${returnPage || returnSearch ? `?${new URLSearchParams({ ...(returnPage && { page: returnPage }), ...(returnSearch && { search: returnSearch }), _t: timestamp.toString() }).toString()}` : `?_t=${timestamp}`}`;
        } else {
          alert(result.message);
        }
      } else {
        // 생성
        // 폼 검증을 통과했으므로 모든 필수 필드가 존재함
        // 상품 이미지 갤러리 데이터 준비
        // sort_order를 현재 인덱스로 설정하여 순서 보장
        const imagesData = productImages.map((img, index) => ({
          image_url: img.image_url,
          is_primary: img.is_primary,
          sort_order: index, // 현재 순서를 sort_order로 설정
          alt_text: img.alt_text || data.name,
        }));

        // 옵션 데이터 준비 (빈 값 필터링)
        const variantsData = productVariants
          .filter((v) => v.variant_value.trim() !== "") // 옵션값이 있는 것만
          .map((v) => ({
            variant_name: v.variant_name || "옵션",
            variant_value: v.variant_value,
            stock: v.stock,
            price_adjustment: v.price_adjustment,
            sku: v.sku ?? null,
          }));

        console.log("[ProductForm] 생성 시 옵션 데이터:", variantsData);

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
          variants: variantsData.length > 0 ? variantsData : undefined, // 옵션 데이터 추가
        });

        if (result.success) {
          alert(result.message);
          router.push(getReturnUrl());
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
              render={({ field }) => {
                const hasVariants = productVariants.length > 0;
                const totalStock = hasVariants
                  ? productVariants.reduce((sum, variant) => sum + (variant.stock || 0), 0)
                  : field.value;

                return (
                  <FormItem>
                    <FormLabel className="text-[#4a3f48]">
                      재고 <span className="text-[#ff6b9d]">*</span>
                      {hasVariants && (
                        <span className="text-xs text-[#8b7d84] ml-2 font-normal">
                          (옵션 재고 합계 자동 계산)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        {...field}
                        value={hasVariants ? totalStock : field.value}
                        disabled={hasVariants}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
                        aria-label="굵게"
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
                        aria-label="기울임"
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
                        aria-label="제목 1"
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
                        aria-label="제목 2"
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
                        aria-label="글머리 기호 목록"
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
                        aria-label="번호 목록"
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
                        aria-label="제목 3"
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
                          aria-label="텍스트 색상"
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
                          aria-label="배경 색상"
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
                        aria-label="왼쪽 정렬"
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
                        aria-label="가운데 정렬"
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
                        aria-label="오른쪽 정렬"
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
                        aria-label="인용구"
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
                        aria-label="구분선"
                      >
                        ─
                      </button>
                      {/* 기호 삽입 */}
                      <div className="relative symbol-menu-container">
                        <button
                          type="button"
                          onClick={() => setShowSymbolMenu(!showSymbolMenu)}
                          className={`px-3 py-1 rounded text-sm ${
                            showSymbolMenu
                              ? "bg-[#ff6b9d] text-white"
                              : "bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                          }`}
                          aria-label="기호 삽입"
                          aria-expanded={showSymbolMenu}
                        >
                          기호
                        </button>
                        {showSymbolMenu && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-[#f5d5e3] rounded-lg shadow-lg p-3 z-50 w-64 max-h-80 overflow-y-auto">
                            <div className="grid grid-cols-6 gap-2">
                              {/* 저작권 관련 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("©").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="저작권"
                              >
                                ©
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("®").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="등록상표"
                              >
                                ®
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("™").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="상표"
                              >
                                ™
                              </button>
                              {/* 온도 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("℃").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="섭씨"
                              >
                                ℃
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("℉").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="화씨"
                              >
                                ℉
                              </button>
                              {/* 수학 기호 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("×").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="곱하기"
                              >
                                ×
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("÷").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="나누기"
                              >
                                ÷
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("±").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="플러스마이너스"
                              >
                                ±
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("≈").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="거의 같음"
                              >
                                ≈
                              </button>
                              {/* 화살표 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("→").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="오른쪽 화살표"
                              >
                                →
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("←").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="왼쪽 화살표"
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("↑").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="위 화살표"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("↓").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="아래 화살표"
                              >
                                ↓
                              </button>
                              {/* 체크마크 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("✓").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="체크"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("✗").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="엑스"
                              >
                                ✗
                              </button>
                              {/* 하트, 별 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("♥").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="하트"
                              >
                                ♥
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("★").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="별"
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("☆").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="빈 별"
                              >
                                ☆
                              </button>
                              {/* 통화 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("€").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="유로"
                              >
                                €
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("$").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="달러"
                              >
                                $
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("¥").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="엔"
                              >
                                ¥
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("£").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="파운드"
                              >
                                £
                              </button>
                              {/* 원문자 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("①").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="원문자 1"
                              >
                                ①
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("②").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="원문자 2"
                              >
                                ②
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("③").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="원문자 3"
                              >
                                ③
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("④").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="원문자 4"
                              >
                                ④
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("⑤").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="원문자 5"
                              >
                                ⑤
                              </button>
                              {/* 기타 */}
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("…").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="말줄임표"
                              >
                                …
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("—").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="대시"
                              >
                                —
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  editor?.chain().focus().insertContent("•").run();
                                  setShowSymbolMenu(false);
                                }}
                                className="px-2 py-2 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] border border-[#f5d5e3]"
                                aria-label="불릿"
                              >
                                •
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* 들여쓰기/내어쓰기 */}
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().liftListItem("listItem").run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        aria-label="내어쓰기"
                      >
                        ⬅
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          editor?.chain().focus().sinkListItem("listItem").run()
                        }
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        aria-label="들여쓰기"
                      >
                        ➡
                      </button>
                      {/* 이미지 업로드 */}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0 || !editor) return;

                          console.log(
                            `[ProductForm] 상품 설명 에디터 이미지 업로드 시작: ${files.length}개`,
                          );

                          setIsUploadingImage(true);
                          try {
                            // 여러 이미지를 순차적으로 업로드
                            for (let i = 0; i < files.length; i++) {
                              const file = files[i];
                              console.log(
                                `[ProductForm] 이미지 ${i + 1}/${files.length} 업로드 중:`,
                                file.name,
                                `(${(file.size / 1024).toFixed(2)} KB)`,
                              );

                              const formData = new FormData();
                              formData.append("file", file);

                              // 특정 상품 ID에 대해서는 사이즈 제한 없이 압축
                              const isSpecialProduct = product?.id === 'ttotto_pr_255';
                              const uploadOptions = isSpecialProduct
                                ? { maxWidth: undefined } // 사이즈 제한 없음
                                : {
                                    width: 800,
                                    height: 800,
                                    fit: "cover" as const, // 정사각형으로 자르기
                                  };
                              
                              console.log(
                                `[ProductForm] 이미지 ${i + 1} 압축 및 업로드 중... ${
                                  isSpecialProduct 
                                    ? '(사이즈 제한 없음)' 
                                    : '(800x800으로 통일)'
                                }`,
                              );
                              
                              const result = await uploadImageFile(formData, uploadOptions);

                              if (result.success && result.url) {
                                console.log(
                                  `[ProductForm] 이미지 ${i + 1} 업로드 및 압축 완료:`,
                                  result.url,
                                );
                                // 에디터에 이미지 삽입
                                editor
                                  .chain()
                                  .focus()
                                  .setImage({ src: result.url })
                                  .run();
                                
                                // 마지막 이미지가 아니면 줄바꿈 추가
                                if (i < files.length - 1) {
                                  editor.chain().focus().insertContent("<br>").run();
                                }
                              } else {
                                console.error(
                                  `[ProductForm] 이미지 ${i + 1} 업로드 실패:`,
                                  result.error,
                                );
                                alert(
                                  `이미지 ${i + 1} 업로드 실패: ${result.error || "이미지 업로드에 실패했습니다."}`,
                                );
                              }
                            }

                            console.log(
                              `[ProductForm] 모든 이미지 업로드 완료: ${files.length}개`,
                            );
                          } catch (error) {
                            console.error(
                              "[ProductForm] 이미지 업로드 에러:",
                              error,
                            );
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
                        aria-label="이미지 업로드"
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
                        aria-label="링크 삽입"
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
                        aria-label="서식 지우기"
                      >
                        ✕
                      </button>
                      {/* 맞춤법 (브라우저 기본 기능 사용) */}
                      <button
                        type="button"
                        className="px-3 py-1 rounded text-sm bg-white text-[#4a3f48] hover:bg-[#fad2e6]"
                        aria-label="맞춤법 검사 (브라우저 기본 기능 - 자동 활성화)"
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
                        aria-label="초기화"
                      >
                        초기화
                      </button>
                    </div>
                    {/* 에디터 영역 - 스크롤 가능 */}
                    <div className="bg-white min-h-[300px] overflow-y-auto flex-1 relative">
                      {isMounted && editor ? (
                        <>
                          <EditorContent
                            editor={editor}
                            suppressHydrationWarning
                          />
                          {/* 이미지 삭제 버튼을 위한 스타일 */}
                          <style jsx global>{`
                            .ProseMirror img {
                              position: relative;
                              display: inline-block;
                              cursor: pointer;
                            }
                            .ProseMirror img:hover::after {
                              content: '';
                              position: absolute;
                              top: 8px;
                              right: 8px;
                              width: 24px;
                              height: 24px;
                              background-color: #ef4444;
                              border-radius: 50%;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              cursor: pointer;
                              z-index: 10;
                              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                            }
                            .ProseMirror img:hover::before {
                              content: '×';
                              position: absolute;
                              top: 8px;
                              right: 8px;
                              width: 24px;
                              height: 24px;
                              color: white;
                              font-size: 18px;
                              font-weight: bold;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              cursor: pointer;
                              z-index: 11;
                              pointer-events: none;
                            }
                          `}</style>
                        </>
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
                    const currentImageCount = productImages.length;
                    let uploadedCount = 0;

                    // 순차적으로 업로드하여 sort_order를 정확하게 설정
                    const uploadedImages = [];
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const formData = new FormData();
                      formData.append("file", file);

                      console.log(
                        `[ProductForm] 이미지 ${i + 1}/${files.length} 업로드 중...`,
                      );

                      // 특정 상품 ID에 대해서는 사이즈 제한 없이 압축
                      const uploadOptions = product?.id === 'ttotto_pr_255'
                        ? { maxWidth: undefined } // 사이즈 제한 없음
                        : undefined; // 기본 옵션 사용
                      
                      const result = await uploadImageFile(formData, uploadOptions);
                      if (result.success && result.url) {
                        uploadedImages.push({
                          image_url: result.url,
                          is_primary:
                            currentImageCount === 0 && uploadedCount === 0, // 첫 번째 이미지가 대표 이미지
                          sort_order: currentImageCount + uploadedCount,
                          alt_text: file.name,
                        });
                        uploadedCount++;
                        console.log(
                          `[ProductForm] 이미지 ${i + 1} 업로드 완료 (sort_order: ${currentImageCount + uploadedCount - 1})`,
                        );
                      } else {
                        console.error(
                          `[ProductForm] 이미지 ${i + 1} 업로드 실패:`,
                          result.error,
                        );
                      }
                    }

                    if (uploadedImages.length > 0) {
                      setProductImages((prev) => [...prev, ...uploadedImages]);
                      console.log(
                        `[ProductForm] 이미지 갤러리 업로드 성공: ${uploadedImages.length}개`,
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
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#8b7d84]">
                    💡 이미지에 마우스를 올리면 순서 변경 버튼이 나타납니다.
                  </p>
                  {productImages.filter((img) => !img.is_primary).length > 0 && (
                    <Button
                      type="button"
                      onClick={() => {
                        const primaryImage = productImages.find((img) => img.is_primary);
                        if (primaryImage) {
                          console.group("[ProductForm] 대표 이미지 제외하고 모두 삭제");
                          console.log("[ProductForm] 대표 이미지 정보:", {
                            id: primaryImage.id,
                            image_url: primaryImage.image_url,
                            is_primary: primaryImage.is_primary
                          });
                          console.log("[ProductForm] 삭제 전 이미지 수:", productImages.length);
                          
                          // 삭제할 이미지 ID 수집 (대표 이미지가 아닌 것들 중 id가 있는 것들)
                          const imagesToDelete = productImages.filter(
                            (img) => !img.is_primary && img.id
                          );
                          const deletedIds = imagesToDelete.map((img) => img.id!);
                          
                          console.log("[ProductForm] 삭제 대상 이미지 수:", imagesToDelete.length);
                          console.log("[ProductForm] 삭제 대상 이미지 ID 목록:", deletedIds);
                          console.log("[ProductForm] 삭제 대상 이미지 URL 목록:", imagesToDelete.map(img => img.image_url));
                          
                          // 삭제된 이미지 ID 저장 (폼 제출 시 사용) - 중복 방지
                          setDeletedImageIds((prev) => {
                            const newIds = [...prev];
                            deletedIds.forEach(id => {
                              if (!newIds.includes(id)) {
                                newIds.push(id);
                              }
                            });
                            return newIds;
                          });
                          
                          // 상태 업데이트 (대표 이미지만 남김)
                          setProductImages([primaryImage]);
                          console.log("[ProductForm] 삭제 후 이미지 수: 1 (대표 이미지만)");
                          console.groupEnd();
                        } else {
                          console.warn("[ProductForm] 대표 이미지를 찾을 수 없습니다!");
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                    >
                      <X className="w-3 h-3 mr-1" />
                      대표 이미지 제외하고 모두 삭제
                    </Button>
                  )}
                </div>
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
                        // 삭제할 이미지가 기존 이미지인 경우 (id가 있는 경우) 삭제 목록에 추가
                        if (img.id) {
                          console.log("[ProductForm] 기존 이미지 삭제:", { id: img.id, image_url: img.image_url });
                          setDeletedImageIds((prev) => {
                            // 중복 방지
                            if (prev.includes(img.id!)) {
                              return prev;
                            }
                            return [...prev, img.id!];
                          });
                        }
                        
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

                    {/* 순서 표시 및 순서 변경 버튼 */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      {/* 위로 이동 버튼 */}
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductImages((prev) => {
                              const newImages = [...prev];
                              // 현재 이미지와 이전 이미지 위치 교환
                              [newImages[index - 1], newImages[index]] = [
                                newImages[index],
                                newImages[index - 1],
                              ];
                              // sort_order 업데이트
                              newImages.forEach((img, i) => {
                                img.sort_order = i;
                              });
                              console.log(
                                `[ProductForm] 이미지 ${index + 1}을 위로 이동`,
                              );
                              return newImages;
                            });
                          }}
                          className="bg-[#ff6b9d] text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ff5088]"
                          aria-label="위로 이동"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                      )}

                      {/* 순서 표시 */}
                      <div className="bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>

                      {/* 아래로 이동 버튼 */}
                      {index < productImages.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductImages((prev) => {
                              const newImages = [...prev];
                              // 현재 이미지와 다음 이미지 위치 교환
                              [newImages[index], newImages[index + 1]] = [
                                newImages[index + 1],
                                newImages[index],
                              ];
                              // sort_order 업데이트
                              newImages.forEach((img, i) => {
                                img.sort_order = i;
                              });
                              console.log(
                                `[ProductForm] 이미지 ${index + 1}을 아래로 이동`,
                              );
                              return newImages;
                            });
                          }}
                          className="bg-[#ff6b9d] text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#ff5088]"
                          aria-label="아래로 이동"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                </div>
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

          {/* 상품 옵션 관리 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#4a3f48] block mb-2">
                상품 옵션{" "}
                <span className="text-[#8b7d84] text-xs font-normal">
                  (옵션이 있는 상품만 추가하세요. 예: 사이즈, 색상 등)
                </span>
              </label>

              <Button
                type="button"
                onClick={() => {
                  setProductVariants((prev) => [
                    ...prev,
                    {
                      variant_name: "옵션",
                      variant_value: "",
                      stock: 0,
                      price_adjustment: 0,
                      sku: null,
                    },
                  ]);
                  console.log("[ProductForm] 옵션 추가");
                }}
                variant="outline"
                className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
              >
                <Plus className="w-4 h-4 mr-2" />
                옵션 추가
              </Button>
            </div>

            {/* 옵션 목록 */}
            {productVariants.length > 0 && (
              <div className="space-y-3">
                {productVariants.map((variant, index) => (
                  <div
                    key={variant.id || `new-${index}`}
                    className="border border-[#f5d5e3] rounded-lg p-4 bg-white"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {/* 옵션명 (예: 사이즈, 색상) */}
                      <div>
                        <label className="text-xs text-[#8b7d84] block mb-1">
                          옵션명
                        </label>
                        <Input
                          placeholder="예: 사이즈"
                          value={variant.variant_name}
                          onChange={(e) => {
                            setProductVariants((prev) =>
                              prev.map((v, i) =>
                                i === index
                                  ? { ...v, variant_name: e.target.value }
                                  : v,
                              ),
                            );
                          }}
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        />
                      </div>

                      {/* 옵션값 (예: 핫핑크, 살구핑크) */}
                      <div>
                        <label className="text-xs text-[#8b7d84] block mb-1">
                          옵션값 <span className="text-[#ff6b9d]">*</span>
                        </label>
                        <Input
                          placeholder="예: 핫핑크"
                          value={variant.variant_value}
                          onChange={(e) => {
                            setProductVariants((prev) =>
                              prev.map((v, i) =>
                                i === index
                                  ? { ...v, variant_value: e.target.value }
                                  : v,
                              ),
                            );
                          }}
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        />
                      </div>

                      {/* 재고 */}
                      <div>
                        <label className="text-xs text-[#8b7d84] block mb-1">
                          재고 <span className="text-[#ff6b9d]">*</span>
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={variant.stock}
                          onChange={(e) => {
                            setProductVariants((prev) =>
                              prev.map((v, i) =>
                                i === index
                                  ? { ...v, stock: parseInt(e.target.value) || 0 }
                                  : v,
                              ),
                            );
                          }}
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        />
                      </div>

                      {/* 가격 조정 */}
                      <div>
                        <label className="text-xs text-[#8b7d84] block mb-1">
                          가격 조정
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={variant.price_adjustment}
                          onChange={(e) => {
                            setProductVariants((prev) =>
                              prev.map((v, i) =>
                                i === index
                                  ? {
                                      ...v,
                                      price_adjustment:
                                        parseInt(e.target.value) || 0,
                                    }
                                  : v,
                              ),
                            );
                          }}
                          className="border-[#f5d5e3] focus:border-[#fad2e6] focus:ring-[#fad2e6]"
                        />
                        <p className="text-xs text-[#8b7d84] mt-1">
                          기본가격 기준 추가/할인 금액
                        </p>
                      </div>

                      {/* 삭제 버튼 */}
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            setProductVariants((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                            console.log("[ProductForm] 옵션 삭제:", index);
                          }}
                          className="w-full h-9 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {productVariants.length === 0 && (
              <div className="border-2 border-dashed border-[#f5d5e3] rounded-lg p-8 text-center">
                <p className="text-[#8b7d84]">옵션이 없는 상품입니다.</p>
                <p className="text-xs text-[#8b7d84] mt-2">
                  옵션이 있는 상품만 &quot;옵션 추가&quot; 버튼을 클릭하여 추가하세요.
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
