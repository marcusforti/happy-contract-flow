import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatsCardSkeleton() {
  return (
    <Card className="card-premium">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-muted" />
            <Skeleton className="h-8 w-16 bg-muted" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContractCardSkeleton() {
  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4 bg-muted" />
            <Skeleton className="h-4 w-1/2 bg-muted" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 bg-muted" />
            <Skeleton className="h-3 w-32 bg-muted" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 bg-muted" />
              <Skeleton className="h-3 w-24 bg-muted" />
            </div>
            <Skeleton className="h-1.5 w-full bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 bg-muted rounded-lg" />
        ))}
      </div>

      {/* Search and Filter Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1 bg-muted" />
        <Skeleton className="h-10 w-32 bg-muted" />
        <Skeleton className="h-10 w-32 bg-muted" />
      </div>

      {/* Contract Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ContractCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
