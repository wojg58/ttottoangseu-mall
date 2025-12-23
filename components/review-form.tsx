/**
 * @file components/review-form.tsx
 * @description 리뷰 작성 폼 컴포넌트
 */

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Star } from "lucide-react";
import { createReview } from "@/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  content: z.string().min(10, "리뷰는 최소 10자 이상 작성해주세요."),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  productId: string;
  onSuccess?: () => void;
}

export default function ReviewForm({ productId, onSuccess }: ReviewFormProps) {
  const [isPending, startTransition] = useTransition();
  const [hoveredRating, setHoveredRating] = useState(0);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      content: "",
    },
  });

  const onSubmit = (data: ReviewFormData) => {
    console.group("[ReviewForm] 리뷰 작성 시도");
    console.log("상품 ID:", productId);
    console.log("평점:", data.rating);
    console.log("내용:", data.content);

    startTransition(async () => {
      const result = await createReview({
        product_id: productId,
        rating: data.rating,
        content: data.content,
      });

      if (result.success) {
        console.log("리뷰 작성 성공");
        form.reset();
        onSuccess?.();
      } else {
        console.error("리뷰 작성 실패:", result.error);
        // TODO: 에러 메시지 표시
      }
      console.groupEnd();
    });
  };

  const currentRating = form.watch("rating");

  return (
    <div className="bg-[#ffeef5] rounded-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-[#4a3f48] mb-4">리뷰 작성</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#4a3f48]">평점</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => field.onChange(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            star <= (hoveredRating || currentRating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
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
                <FormLabel className="text-[#4a3f48]">리뷰 내용</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="상품에 대한 솔직한 리뷰를 작성해주세요."
                    className="min-h-[120px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending || currentRating === 0}
            className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            {isPending ? "작성 중..." : "리뷰 작성"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

