import React from "react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  pullProgress,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="absolute top-2 inset-x-0 z-30 flex justify-center pointer-events-none transition-transform duration-100 ease-out"
      style={{
        transform: `translateY(${Math.min(pullDistance * 0.7, 50)}px)`,
        opacity: Math.min(pullProgress * 1.2 + (isRefreshing ? 1 : 0), 1),
      }}
    >
      <div className="w-8 h-8 flex items-center justify-center bg-white/95 dark:bg-[#161616]/95 backdrop-blur-md rounded-full border border-[#8f6d3d]/30 dark:border-[#c4a06d]/40 shadow-md shadow-[#8f6d3d]/15 text-[#8f6d3d] dark:text-[#c4a06d]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${pullProgress * 360}deg)`,
            transition: isRefreshing ? undefined : "transform 0.1s linear",
          }}
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
      </div>
    </div>
  );
}
