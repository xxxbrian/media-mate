"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";

interface SearchSuggestionsProps {
  query: string;
  isVisible: boolean;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  onEnterKey: () => void;
}

interface SuggestionItem {
  text: string;
  type: "related";
}

export default function SearchSuggestions({
  query,
  isVisible,
  onSelect,
  onClose,
  onEnterKey,
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchSuggestions = useCallback(
    async (keyword: string) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(keyword)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const parsed =
          data?.suggestions?.map((item: { text: string }) => ({
            text: item.text,
            type: "related" as const,
          })) ?? [];
        setSuggestions(parsed);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      }
    },
    []
  );

  const debouncedFetch = useCallback(
    (keyword: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (keyword.trim() && isVisible) {
          fetchSuggestions(keyword);
        } else {
          setSuggestions([]);
        }
      }, 250);
    },
    [fetchSuggestions, isVisible]
  );

  useEffect(() => {
    debouncedFetch(query);
  }, [query, isVisible, debouncedFetch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isVisible, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && isVisible) {
        e.preventDefault();
        onClose();
        onEnterKey();
      }
      if (e.key === "Escape" && isVisible) {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener("keydown", handleKey, true);
    }
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [isVisible, onClose, onEnterKey]);

  useEffect(
    () => () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full z-30 mt-2"
    >
      <Card className="overflow-hidden">
        <Command className="rounded-none border-0">
          <CommandList>
            <CommandEmpty>无相关建议</CommandEmpty>
            <CommandGroup heading="搜索建议">
              {suggestions.map((item) => (
                <CommandItem
                  key={item.text}
                  value={item.text}
                  onSelect={() => onSelect(item.text)}
                  className="cursor-pointer text-sm"
                >
                  {item.text}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </Card>
    </div>
  );
}
