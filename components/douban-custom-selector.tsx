'use client';

import * as React from 'react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
}

interface DoubanCustomSelectorProps {
  customCategories: CustomCategory[];
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}

const DoubanCustomSelector: React.FC<DoubanCustomSelectorProps> = ({
  customCategories,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  // 一级：按 type 分组，movie 优先
  const primaryOptions = React.useMemo(
    () => {
      const types = Array.from(new Set(customCategories.map((cat) => cat.type)));
      const sortedTypes = types.sort((a, b) => {
        if (a === 'movie' && b !== 'movie') return -1;
        if (a !== 'movie' && b === 'movie') return 1;
        return 0;
      });

      return sortedTypes.map((type) => ({
        label: type === 'movie' ? '电影' : '剧集',
        value: type,
      }));
    },
    [customCategories]
  );

  // 二级：按当前 type 过滤
  const secondaryOptions = React.useMemo(
    () =>
      primarySelection
        ? customCategories
            .filter((cat) => cat.type === primarySelection)
            .map((cat) => ({
              label: cat.name || cat.query,
              value: cat.query,
            }))
        : [],
    [customCategories, primarySelection]
  );

  // 默认选中逻辑（只读，不在这里改 state）
  const activePrimary =
    primarySelection ?? primaryOptions[0]?.value ?? '';

  const activeSecondary =
    secondaryOptions.length > 0
      ? secondarySelection ?? secondaryOptions[0]?.value ?? ''
      : '';

  // 空数据直接不渲染
  if (!customCategories || customCategories.length === 0) {
    return null;
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      <div className='space-y-3 sm:space-y-4'>
        {/* 一级：类型 */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
          <span className='text-xs sm:text-sm font-medium text-muted-foreground min-w-[48px]'>
            类型
          </span>
          <div className='overflow-x-auto'>
            <ToggleGroup
              type='single'
              value={activePrimary}
              onValueChange={(val) => {
                if (!val) return;
                onPrimaryChange(val);
              }}
              className='flex flex-row gap-2'
            >
              {primaryOptions.map((opt) => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  className='rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium
                             data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
                             data-[state=on]:shadow-sm'
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {/* 二级：片单 */}
        {secondaryOptions.length > 0 && (
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs sm:text-sm font-medium text-muted-foreground min-w-[48px]'>
              片单
            </span>
            <div className='overflow-x-auto'>
              <ToggleGroup
                type='single'
                value={activeSecondary}
                onValueChange={(val) => {
                  if (!val) return;
                  onSecondaryChange(val);
                }}
                className='flex flex-row gap-2'
              >
                {secondaryOptions.map((opt) => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    className='rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium
                               data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
                               data-[state=on]:shadow-sm'
                  >
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoubanCustomSelector;
