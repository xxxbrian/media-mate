"use client";

import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import MultiLevelSelector from "./douban-multi-level-selector";
import WeekdaySelector from "./douban-weekday-selector";

interface SelectorOption {
  label: string;
  value: string;
}

interface DoubanSelectorProps {
  type: "movie" | "tv" | "show" | "anime";
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onMultiLevelChange?: (values: Record<string, string>) => void;
  onWeekdayChange: (weekday: string) => void;
}

const moviePrimaryOptions: SelectorOption[] = [
  { label: "全部", value: "全部" },
  { label: "热门电影", value: "热门" },
  { label: "最新电影", value: "最新" },
  { label: "豆瓣高分", value: "豆瓣高分" },
  { label: "冷门佳片", value: "冷门佳片" },
];

const movieSecondaryOptions: SelectorOption[] = [
  { label: "全部", value: "全部" },
  { label: "华语", value: "华语" },
  { label: "欧美", value: "欧美" },
  { label: "韩国", value: "韩国" },
  { label: "日本", value: "日本" },
];

const tvPrimaryOptions: SelectorOption[] = [
  { label: "全部", value: "全部" },
  { label: "最近热门", value: "最近热门" },
];

const tvSecondaryOptions: SelectorOption[] = [
  { label: "全部", value: "tv" },
  { label: "国产", value: "tv_domestic" },
  { label: "欧美", value: "tv_american" },
  { label: "日本", value: "tv_japanese" },
  { label: "韩国", value: "tv_korean" },
  { label: "动漫", value: "tv_animation" },
  { label: "纪录片", value: "tv_documentary" },
];

const showPrimaryOptions: SelectorOption[] = [
  { label: "全部", value: "全部" },
  { label: "最近热门", value: "最近热门" },
];

const showSecondaryOptions: SelectorOption[] = [
  { label: "全部", value: "show" },
  { label: "国内", value: "show_domestic" },
  { label: "国外", value: "show_foreign" },
];

const animePrimaryOptions: SelectorOption[] = [
  { label: "每日放送", value: "每日放送" },
  { label: "番剧", value: "番剧" },
  { label: "剧场版", value: "剧场版" },
];

const ToggleRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <span className="min-w-[48px] text-xs font-medium text-muted-foreground sm:text-sm">
      {label}
    </span>
    <div className="overflow-x-auto">
      <div className="inline-flex">{children}</div>
    </div>
  </div>
);

const ToggleGroupPills = ({
  options,
  value,
  onChange,
}: {
  options: SelectorOption[];
  value: string;
  onChange: (val: string) => void;
}) => (
  <ToggleGroup
    type="single"
    value={value}
    onValueChange={(val) => val && onChange(val)}
    className="flex flex-row gap-2"
    spacing={2}
  >
    {options.map((opt) => (
      <ToggleGroupItem
        key={opt.value}
        value={opt.value}
        className="rounded-full border border-transparent bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:bg-accent/60 hover:text-foreground sm:text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        {opt.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);

const DoubanSelector: React.FC<DoubanSelectorProps> = ({
  type,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
  onMultiLevelChange,
  onWeekdayChange,
}) => {
  const handleMultiLevelChange = (values: Record<string, string>) => {
    onMultiLevelChange?.(values);
  };

  const renderMovie = () => {
    const primaryValue = primarySelection || moviePrimaryOptions[0].value;
    const secondaryValue = secondarySelection || movieSecondaryOptions[0].value;
    return (
      <div className="space-y-3 sm:space-y-4">
        <ToggleRow label="分类">
          <ToggleGroupPills
            options={moviePrimaryOptions}
            value={primaryValue}
            onChange={onPrimaryChange}
          />
        </ToggleRow>

        {primaryValue !== "全部" ? (
          <ToggleRow label="地区">
            <ToggleGroupPills
              options={movieSecondaryOptions}
              value={secondaryValue}
              onChange={onSecondaryChange}
            />
          </ToggleRow>
        ) : (
          <ToggleRow label="筛选">
            <MultiLevelSelector
              key={`${type}-${primaryValue}`}
              onChange={handleMultiLevelChange}
              contentType={type}
            />
          </ToggleRow>
        )}
      </div>
    );
  };

  const renderTv = () => {
    const primaryValue = primarySelection || tvPrimaryOptions[1].value;
    const secondaryValue = secondarySelection || tvSecondaryOptions[0].value;
    return (
      <div className="space-y-3 sm:space-y-4">
        <ToggleRow label="分类">
          <ToggleGroupPills
            options={tvPrimaryOptions}
            value={primaryValue}
            onChange={onPrimaryChange}
          />
        </ToggleRow>
        {primaryValue === "最近热门" ? (
          <ToggleRow label="类型">
            <ToggleGroupPills
              options={tvSecondaryOptions}
              value={secondaryValue}
              onChange={onSecondaryChange}
            />
          </ToggleRow>
        ) : primaryValue === "全部" ? (
          <ToggleRow label="筛选">
            <MultiLevelSelector
              key={`${type}-${primaryValue}`}
              onChange={handleMultiLevelChange}
              contentType={type}
            />
          </ToggleRow>
        ) : null}
      </div>
    );
  };

  const renderAnime = () => {
    const primaryValue = primarySelection || animePrimaryOptions[0].value;
    return (
      <div className="space-y-3 sm:space-y-4">
        <ToggleRow label="分类">
          <ToggleGroupPills
            options={animePrimaryOptions}
            value={primaryValue}
            onChange={onPrimaryChange}
          />
        </ToggleRow>
        {primaryValue === "每日放送" ? (
          <ToggleRow label="星期">
            <WeekdaySelector onWeekdayChange={onWeekdayChange} />
          </ToggleRow>
        ) : (
          <ToggleRow label="筛选">
            {primaryValue === "番剧" ? (
              <MultiLevelSelector
                key={`anime-tv-${primaryValue}`}
                onChange={handleMultiLevelChange}
                contentType="anime-tv"
              />
            ) : (
              <MultiLevelSelector
                key={`anime-movie-${primaryValue}`}
                onChange={handleMultiLevelChange}
                contentType="anime-movie"
              />
            )}
          </ToggleRow>
        )}
      </div>
    );
  };

  const renderShow = () => {
    const primaryValue = primarySelection || showPrimaryOptions[1].value;
    const secondaryValue = secondarySelection || showSecondaryOptions[0].value;
    return (
      <div className="space-y-3 sm:space-y-4">
        <ToggleRow label="分类">
          <ToggleGroupPills
            options={showPrimaryOptions}
            value={primaryValue}
            onChange={onPrimaryChange}
          />
        </ToggleRow>
        {primaryValue === "最近热门" ? (
          <ToggleRow label="类型">
            <ToggleGroupPills
              options={showSecondaryOptions}
              value={secondaryValue}
              onChange={onSecondaryChange}
            />
          </ToggleRow>
        ) : primaryValue === "全部" ? (
          <ToggleRow label="筛选">
            <MultiLevelSelector
              key={`${type}-${primaryValue}`}
              onChange={handleMultiLevelChange}
              contentType={type}
            />
          </ToggleRow>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {type === "movie" && renderMovie()}
      {type === "tv" && renderTv()}
      {type === "anime" && renderAnime()}
      {type === "show" && renderShow()}
    </div>
  );
};

export default DoubanSelector;
