import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      className={`animate-pulse bg-stone-200 dark:bg-stone-800 rounded-xl ${className}`}
    />
  );
};

export const MenuCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 flex gap-4">
      <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
      <div className="flex-1 flex flex-col justify-between py-1">
        <div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex justify-between items-center mt-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
