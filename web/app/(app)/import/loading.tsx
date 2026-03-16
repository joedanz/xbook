import { Skeleton } from "@/components/ui/skeleton";

export default function ImportLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="rounded-lg border border-dashed p-8 space-y-4">
        <Skeleton className="h-12 w-12 mx-auto rounded-full" />
        <Skeleton className="h-4 w-48 mx-auto" />
        <Skeleton className="h-9 w-32 mx-auto" />
      </div>
    </div>
  );
}
