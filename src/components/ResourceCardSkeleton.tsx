import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader matching ResourceCard dimensions (w-36)
 */
export function ResourceCardSkeleton() {
  return (
    <div className="flex w-36 shrink-0 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/80 py-3">
      <Skeleton className="mb-2 h-14 w-14 rounded-lg" />
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="mt-1.5 h-2.5 w-16 rounded" />
      <Skeleton className="mt-1.5 h-4 w-14 rounded-full" />
    </div>
  );
}
