"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface ScrollableRowProps {
  children: React.ReactNode;
  scrollDistance?: number;
  className?: string;
}

export default function ScrollableRow({
  children,
  scrollDistance = 600,
  className,
}: ScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 1;
    setCanScrollLeft(el.scrollLeft > threshold);
    setCanScrollRight(el.scrollWidth - (el.scrollLeft + el.clientWidth) > threshold);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateScrollState();
    const handleResize = () => updateScrollState();
    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(el);
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [children]);

  const scrollBy = (delta: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto overflow-y-hidden pr-1 scrollbar-hide"
          onScroll={updateScrollState}
        >
          {children}
        </div>
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 flex h-full items-center pl-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="pointer-events-auto shadow-sm"
              onClick={() => scrollBy(-scrollDistance)}
              aria-label="向左滚动"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 flex h-full items-center pr-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="pointer-events-auto shadow-sm"
              onClick={() => scrollBy(scrollDistance)}
              aria-label="向右滚动"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
