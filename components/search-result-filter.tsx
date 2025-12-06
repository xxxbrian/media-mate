"use client";

import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
} from "lucide-react";
import React, { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SearchFilterKey = "source" | "title" | "year" | "yearOrder";

export type FilterValueMap = {
  source: string;
  title: string;
  year: string;
  yearOrder: "none" | "asc" | "desc";
};

export interface SearchFilterOption {
  label: string;
  value: string;
}

export interface SearchFilterCategory {
  key: SearchFilterKey;
  label: string;
  options: SearchFilterOption[];
}

interface SearchResultFilterProps {
  categories: SearchFilterCategory[];
  values: Partial<FilterValueMap>;
  onChange: (values: FilterValueMap) => void;
}

const DEFAULTS: FilterValueMap = {
  source: "all",
  title: "all",
  year: "all",
  yearOrder: "none",
};

const SearchResultFilter: React.FC<SearchResultFilterProps> = ({
  categories,
  values,
  onChange,
}) => {
  const mergedValues = useMemo(
    () => ({
      ...DEFAULTS,
      ...values,
    }),
    [values]
  );

  const handleSelectChange = (key: SearchFilterKey, val: string) => {
    onChange({
      ...mergedValues,
      [key]:
        key === "yearOrder"
          ? (val as FilterValueMap["yearOrder"])
          : (val as FilterValueMap[SearchFilterKey]),
    });
  };

  const toggleYearOrder = () => {
    const next =
      mergedValues.yearOrder === "none"
        ? "desc"
        : mergedValues.yearOrder === "desc"
        ? "asc"
        : "none";
    onChange({ ...mergedValues, yearOrder: next });
  };

  const YearIcon =
    mergedValues.yearOrder === "none"
      ? ArrowUpDown
      : mergedValues.yearOrder === "desc"
      ? ArrowDownWideNarrow
      : ArrowUpNarrowWide;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {categories.map((category) => (
        <Select
          key={category.key}
          value={mergedValues[category.key]}
          onValueChange={(val) => handleSelectChange(category.key, val)}
        >
          <SelectTrigger className="w-[150px] text-sm sm:w-[200px]">
            <SelectValue placeholder={category.label} />
          </SelectTrigger>
          <SelectContent>
            {category.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="inline-flex items-center gap-2"
        onClick={toggleYearOrder}
        aria-label="按年份排序"
      >
        <YearIcon className="h-4 w-4" />
        <span>年份</span>
      </Button>
    </div>
  );
};

export default SearchResultFilter;
