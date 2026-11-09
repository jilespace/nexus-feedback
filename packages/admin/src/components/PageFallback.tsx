import { Skeleton } from '@/components/ui';

/** Generic skeleton shown while a route chunk is loading. */
export function PageFallback() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
