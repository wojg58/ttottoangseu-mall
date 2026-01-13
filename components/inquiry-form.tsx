/**
 * @file components/inquiry-form.tsx
 * @description 문의 작성 폼 컴포넌트
 */

"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createInquiry } from "@/actions/inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import logger from "@/lib/logger-client";

const inquirySchema = z.object({
  title: z.string().min(2, "제목은 최소 2자 이상 작성해주세요."),
  content: z.string().min(10, "문의 내용은 최소 10자 이상 작성해주세요."),
  is_secret: z.boolean().default(false),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

interface InquiryFormProps {
  productId: string;
  onSuccess?: () => void;
}

export default function InquiryForm({
  productId,
  onSuccess,
}: InquiryFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      title: "",
      content: "",
      is_secret: false,
    },
  });

  const onSubmit = (data: InquiryFormData) => {
    startTransition(async () => {
      const result = await createInquiry({
        product_id: productId,
        title: data.title,
        content: data.content,
        is_secret: data.is_secret,
      });

      if (result.success) {
        logger.debug("[InquiryForm] 문의 작성 성공");
        form.reset();
        onSuccess?.();
      } else {
        logger.error("[InquiryForm] 문의 작성 실패", { error: result.error });
        alert(result.error || "문의 작성에 실패했습니다.");
      }
    });
  };

  return (
    <div className="bg-[#ffeef5] rounded-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-[#4a3f48] mb-4">문의 작성</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">제목</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="문의 제목을 입력해주세요."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">문의 내용</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="문의 내용을 자세히 작성해주세요."
                    className="min-h-[120px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_secret"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-[#4a3f48] cursor-pointer">
                    비밀글로 작성
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            {isPending ? "작성 중..." : "문의 작성"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

