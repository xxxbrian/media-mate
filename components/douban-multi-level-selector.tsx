'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MultiLevelOption {
  label: string;
  value: string;
}

interface MultiLevelCategory {
  key: string;
  label: string;
  options: MultiLevelOption[];
  multiSelect?: boolean;
}

interface MultiLevelSelectorProps {
  onChange: (values: Record<string, string>) => void;
  contentType?: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie';
}

const MultiLevelSelector: React.FC<MultiLevelSelectorProps> = ({
  onChange,
  contentType = 'movie',
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  // ---------- 原有选项构造逻辑（基本不动，只是函数挪到 useMemo 里） ----------

  const getTypeOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
        return [
          ...baseOptions,
          { label: '喜剧', value: 'comedy' },
          { label: '爱情', value: 'romance' },
          { label: '动作', value: 'action' },
          { label: '科幻', value: 'sci-fi' },
          { label: '悬疑', value: 'suspense' },
          { label: '犯罪', value: 'crime' },
          { label: '惊悚', value: 'thriller' },
          { label: '冒险', value: 'adventure' },
          { label: '音乐', value: 'music' },
          { label: '历史', value: 'history' },
          { label: '奇幻', value: 'fantasy' },
          { label: '恐怖', value: 'horror' },
          { label: '战争', value: 'war' },
          { label: '传记', value: 'biography' },
          { label: '歌舞', value: 'musical' },
          { label: '武侠', value: 'wuxia' },
          { label: '情色', value: 'erotic' },
          { label: '灾难', value: 'disaster' },
          { label: '西部', value: 'western' },
          { label: '纪录片', value: 'documentary' },
          { label: '短片', value: 'short' },
        ];
      case 'tv':
        return [
          ...baseOptions,
          { label: '喜剧', value: 'comedy' },
          { label: '爱情', value: 'romance' },
          { label: '悬疑', value: 'suspense' },
          { label: '武侠', value: 'wuxia' },
          { label: '古装', value: 'costume' },
          { label: '家庭', value: 'family' },
          { label: '犯罪', value: 'crime' },
          { label: '科幻', value: 'sci-fi' },
          { label: '恐怖', value: 'horror' },
          { label: '历史', value: 'history' },
          { label: '战争', value: 'war' },
          { label: '动作', value: 'action' },
          { label: '冒险', value: 'adventure' },
          { label: '传记', value: 'biography' },
          { label: '剧情', value: 'drama' },
          { label: '奇幻', value: 'fantasy' },
          { label: '惊悚', value: 'thriller' },
          { label: '灾难', value: 'disaster' },
          { label: '歌舞', value: 'musical' },
          { label: '音乐', value: 'music' },
        ];
      case 'show':
        return [
          ...baseOptions,
          { label: '真人秀', value: 'reality' },
          { label: '脱口秀', value: 'talkshow' },
          { label: '音乐', value: 'music' },
          { label: '歌舞', value: 'musical' },
        ];
      case 'anime-tv':
      case 'anime-movie':
      default:
        return baseOptions;
    }
  };

  const getRegionOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
      case 'anime-movie':
        return [
          ...baseOptions,
          { label: '华语', value: 'chinese' },
          { label: '欧美', value: 'western' },
          { label: '韩国', value: 'korean' },
          { label: '日本', value: 'japanese' },
          { label: '中国大陆', value: 'mainland_china' },
          { label: '美国', value: 'usa' },
          { label: '中国香港', value: 'hong_kong' },
          { label: '中国台湾', value: 'taiwan' },
          { label: '英国', value: 'uk' },
          { label: '法国', value: 'france' },
          { label: '德国', value: 'germany' },
          { label: '意大利', value: 'italy' },
          { label: '西班牙', value: 'spain' },
          { label: '印度', value: 'india' },
          { label: '泰国', value: 'thailand' },
          { label: '俄罗斯', value: 'russia' },
          { label: '加拿大', value: 'canada' },
          { label: '澳大利亚', value: 'australia' },
          { label: '爱尔兰', value: 'ireland' },
          { label: '瑞典', value: 'sweden' },
          { label: '巴西', value: 'brazil' },
          { label: '丹麦', value: 'denmark' },
        ];
      case 'tv':
      case 'anime-tv':
      case 'show':
        return [
          ...baseOptions,
          { label: '华语', value: 'chinese' },
          { label: '欧美', value: 'western' },
          { label: '国外', value: 'foreign' },
          { label: '韩国', value: 'korean' },
          { label: '日本', value: 'japanese' },
          { label: '中国大陆', value: 'mainland_china' },
          { label: '中国香港', value: 'hong_kong' },
          { label: '美国', value: 'usa' },
          { label: '英国', value: 'uk' },
          { label: '泰国', value: 'thailand' },
          { label: '中国台湾', value: 'taiwan' },
          { label: '意大利', value: 'italy' },
          { label: '法国', value: 'france' },
          { label: '德国', value: 'germany' },
          { label: '西班牙', value: 'spain' },
          { label: '俄罗斯', value: 'russia' },
          { label: '瑞典', value: 'sweden' },
          { label: '巴西', value: 'brazil' },
          { label: '丹麦', value: 'denmark' },
          { label: '印度', value: 'india' },
          { label: '加拿大', value: 'canada' },
          { label: '爱尔兰', value: 'ireland' },
          { label: '澳大利亚', value: 'australia' },
        ];
      default:
        return baseOptions;
    }
  };

  const getLabelOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];
    switch (contentType) {
      case 'anime-movie':
        return [
          ...baseOptions,
          { label: '定格动画', value: 'stop_motion' },
          { label: '传记', value: 'biography' },
          { label: '美国动画', value: 'us_animation' },
          { label: '爱情', value: 'romance' },
          { label: '黑色幽默', value: 'dark_humor' },
          { label: '歌舞', value: 'musical' },
          { label: '儿童', value: 'children' },
          { label: '二次元', value: 'anime' },
          { label: '动物', value: 'animal' },
          { label: '青春', value: 'youth' },
          { label: '历史', value: 'history' },
          { label: '励志', value: 'inspirational' },
          { label: '恶搞', value: 'parody' },
          { label: '治愈', value: 'healing' },
          { label: '运动', value: 'sports' },
          { label: '后宫', value: 'harem' },
          { label: '情色', value: 'erotic' },
          { label: '人性', value: 'human_nature' },
          { label: '悬疑', value: 'suspense' },
          { label: '恋爱', value: 'love' },
          { label: '魔幻', value: 'fantasy' },
          { label: '科幻', value: 'sci_fi' },
        ];
      case 'anime-tv':
        return [
          ...baseOptions,
          { label: '黑色幽默', value: 'dark_humor' },
          { label: '历史', value: 'history' },
          { label: '歌舞', value: 'musical' },
          { label: '励志', value: 'inspirational' },
          { label: '恶搞', value: 'parody' },
          { label: '治愈', value: 'healing' },
          { label: '运动', value: 'sports' },
          { label: '后宫', value: 'harem' },
          { label: '情色', value: 'erotic' },
          { label: '国漫', value: 'chinese_anime' },
          { label: '人性', value: 'human_nature' },
          { label: '悬疑', value: 'suspense' },
          { label: '恋爱', value: 'love' },
          { label: '魔幻', value: 'fantasy' },
          { label: '科幻', value: 'sci_fi' },
        ];
      default:
        return baseOptions;
    }
  };

  const getPlatformOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
        return baseOptions; // 电影不需要平台
      case 'tv':
      case 'anime-tv':
      case 'show':
        return [
          ...baseOptions,
          { label: '腾讯视频', value: 'tencent' },
          { label: '爱奇艺', value: 'iqiyi' },
          { label: '优酷', value: 'youku' },
          { label: '湖南卫视', value: 'hunan_tv' },
          { label: 'Netflix', value: 'netflix' },
          { label: 'HBO', value: 'hbo' },
          { label: 'BBC', value: 'bbc' },
          { label: 'NHK', value: 'nhk' },
          { label: 'CBS', value: 'cbs' },
          { label: 'NBC', value: 'nbc' },
          { label: 'tvN', value: 'tvn' },
        ];
      default:
        return baseOptions;
    }
  };

  const categories: MultiLevelCategory[] = useMemo(
    () => [
      ...(contentType !== 'anime-tv' && contentType !== 'anime-movie'
        ? [
            {
              key: 'type',
              label: '类型',
              options: getTypeOptions(contentType),
            },
          ]
        : [
            {
              key: 'label',
              label: '类型',
              options: getLabelOptions(contentType),
            },
          ]),
      {
        key: 'region',
        label: '地区',
        options: getRegionOptions(contentType),
      },
      {
        key: 'year',
        label: '年代',
        options: [
          { label: '全部', value: 'all' },
          { label: '2020年代', value: '2020s' },
          { label: '2025', value: '2025' },
          { label: '2024', value: '2024' },
          { label: '2023', value: '2023' },
          { label: '2022', value: '2022' },
          { label: '2021', value: '2021' },
          { label: '2020', value: '2020' },
          { label: '2019', value: '2019' },
          { label: '2010年代', value: '2010s' },
          { label: '2000年代', value: '2000s' },
          { label: '90年代', value: '1990s' },
          { label: '80年代', value: '1980s' },
          { label: '70年代', value: '1970s' },
          { label: '60年代', value: '1960s' },
          { label: '更早', value: 'earlier' },
        ],
      },
      ...(contentType === 'tv' ||
      contentType === 'show' ||
      contentType === 'anime-tv'
        ? [
            {
              key: 'platform',
              label: '平台',
              options: getPlatformOptions(contentType),
            },
          ]
        : []),
      {
        key: 'sort',
        label: '排序',
        options: [
          { label: '综合排序', value: 'T' },
          { label: '近期热度', value: 'U' },
          {
            label:
              contentType === 'tv' || contentType === 'show'
                ? '首播时间'
                : '首映时间',
            value: 'R',
          },
          { label: '高分优先', value: 'S' },
        ],
      },
    ],
    [contentType]
  );

  // ---------- 工具函数：显示文案 / 默认状态 / 选中状态 ----------

  const isDefaultValue = (key: string) => {
    const value = values[key];
    return !value || value === 'all' || (key === 'sort' && value === 'T');
  };

  const getDisplayText = (key: string) => {
    const category = categories.find((c) => c.key === key);
    if (!category) return '';

    const value = values[key];
    if (!value || value === 'all' || (key === 'sort' && value === 'T')) {
      return category.label;
    }

    const opt = category.options.find((o) => o.value === value);
    return opt?.label ?? category.label;
  };

  const isOptionSelected = (key: string, optionValue: string) => {
    let value = values[key];
    if (value === undefined) {
      value = key === 'sort' ? 'T' : 'all';
    }
    return value === optionValue;
  };

  // ---------- 核心：选项选择 + 向父组件回调 ----------

  const handleOptionSelect = (categoryKey: string, optionValue: string) => {
    const newValues = {
      ...values,
      [categoryKey]: optionValue,
    };
    setValues(newValues);

    // 组装给父组件的值：非 sort 用 label，sort 用 value
    const selectionsForParent: Record<string, string> = {
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    };

    Object.entries(newValues).forEach(([key, value]) => {
      if (value && value !== 'all' && (key !== 'sort' || value !== 'T')) {
        const category = categories.find((cat) => cat.key === key);
        if (!category) return;
        const option = category.options.find((opt) => opt.value === value);
        if (!option) return;

        selectionsForParent[key] = key === 'sort' ? option.value : option.label;
      }
    });

    onChange(selectionsForParent);
    setOpenKey(null);
  };

  // 点击外部关闭的逻辑 Radix 已经帮你做了，不需要自己监听 mousedown 了

  // 内容类型变化时重置状态
  // useEffect(() => {
  //   setValues({});
  //   setOpenKey(null);
  // }, [contentType]);

  return (
    <div className="inline-flex flex-wrap gap-1 sm:gap-2 rounded-full bg-transparent p-0.5 sm:p-1">
      {categories.map((category) => {
        const isActive = openKey === category.key;
        const isDefault = isDefaultValue(category.key);

        return (
          <Popover
            key={category.key}
            open={openKey === category.key}
            onOpenChange={(open) =>
              setOpenKey(open ? category.key : null)
            }
          >
            <PopoverTrigger asChild>
              <Button
                variant={isDefault ? 'ghost' : 'outline'}
                size="sm"
                className={`
                  rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium
                  h-8 sm:h-9
                  ${
                    !isDefault
                      ? 'border-green-500/60 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40'
                      : 'text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                <span className="truncate max-w-[5rem] sm:max-w-[8rem]">
                  {getDisplayText(category.key)}
                </span>
                <ChevronDown
                  className={`ml-1 h-3 w-3 shrink-0 transition-transform ${
                    isActive ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              align="start"
              sideOffset={8}
              className="w-[260px] sm:w-[320px] md:w-[360px] p-2 sm:p-3 rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-xl"
            >
              <ScrollArea className="max-h-[260px] sm:max-h-[320px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {category.options.map((option) => {
                    const selected = isOptionSelected(
                      category.key,
                      option.value
                    );
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant={selected ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() =>
                          handleOptionSelect(category.key, option.value)
                        }
                        className={`
                          justify-start px-2 py-1.5 sm:px-3 sm:py-2 h-auto
                          text-xs sm:text-sm rounded-lg
                          ${
                            selected
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200/80 dark:border-green-700/80'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                          }
                        `}
                      >
                        <span className="truncate">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
};

export default MultiLevelSelector;
