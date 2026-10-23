import { CardListSkeleton, Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <CardListSkeleton rows={5} />
    </div>
  );
}
