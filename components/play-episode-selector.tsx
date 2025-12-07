/* eslint-disable @next/next/no-img-element */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';

import { SearchResult } from '@/lib/types';
import { cn, getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VideoInfo {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  hasError?: boolean;
}

interface EpisodeSelectorProps {
  totalEpisodes: number;
  episodes_titles: string[];
  episodesPerPage?: number;
  value?: number; // 1-based
  onChange?: (episodeIndex: number) => void; // 0-based
  onSourceChange?: (source: string, id: string, title: string) => void;
  currentSource?: string;
  currentId?: string;
  videoTitle?: string;
  videoYear?: string;
  availableSources?: SearchResult[];
  sourceSearchLoading?: boolean;
  sourceSearchError?: string | null;
  precomputedVideoInfo?: Map<string, VideoInfo>;
}

/* -------------------------------------------------------------------------- */
/*                                内部小工具函数                               */
/* -------------------------------------------------------------------------- */

const buildSourceKey = (s: SearchResult) => `${s.source}-${s.id}`;

const getEpisodeDisplayTitle = (
  episodeNumber: number,
  titles: string[]
): string | number => {
  const title = titles?.[episodeNumber - 1];
  if (!title) return episodeNumber;

  const match = title.match(/(?:第)?(\d+)(?:集|话)/);
  if (match) return match[1];
  return title;
};

/* -------------------------------------------------------------------------- */
/*                               视频测速逻辑 Hook                             */
/* -------------------------------------------------------------------------- */

function useVideoInfo(
  activeTab: 'episodes' | 'sources',
  availableSources: SearchResult[],
  precomputedVideoInfo?: Map<string, VideoInfo>
) {
  const [videoInfoMap, setVideoInfoMap] = useState<Map<string, VideoInfo>>(
    () => new Map()
  );
  const attemptedSourcesRef = useRef<Set<string>>(new Set());

  const optimizationEnabled = useMemo(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('enableOptimization');
    if (saved === null) return true;
    try {
      return JSON.parse(saved);
    } catch {
      return true;
    }
  }, []);

  // 合并预计算测速结果
  useEffect(() => {
    if (!precomputedVideoInfo || precomputedVideoInfo.size === 0) return;

    setVideoInfoMap((prev) => {
      const merged = new Map(prev);
      precomputedVideoInfo.forEach((value, key) => {
        merged.set(key, value);
        if (!value.hasError) {
          attemptedSourcesRef.current.add(key);
        }
      });
      return merged;
    });
  }, [precomputedVideoInfo]);

  // 真正测速函数
  const fetchVideoInfo = useCallback(async (source: SearchResult) => {
    const sourceKey = buildSourceKey(source);
    if (attemptedSourcesRef.current.has(sourceKey)) return;

    if (!source.episodes || source.episodes.length === 0) return;
    const episodeUrl =
      source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

    attemptedSourcesRef.current.add(sourceKey);

    try {
      const info = await getVideoResolutionFromM3u8(episodeUrl);
      setVideoInfoMap((prev) => {
        const map = new Map(prev);
        map.set(sourceKey, info);
        return map;
      });
    } catch {
      setVideoInfoMap((prev) => {
        const map = new Map(prev);
        map.set(sourceKey, {
          quality: '错误',
          loadSpeed: '未知',
          pingTime: 0,
          hasError: true,
        });
        return map;
      });
    }
  }, []);

  // 在换源 Tab 下批量测速
  useEffect(() => {
    if (!optimizationEnabled) return;
    if (activeTab !== 'sources') return;
    if (!availableSources.length) return;

    const pending = availableSources.filter((s) => {
      const key = buildSourceKey(s);
      return !attemptedSourcesRef.current.has(key);
    });

    if (!pending.length) return;

    const run = async () => {
      const batchSize = Math.ceil(pending.length / 2);
      for (let start = 0; start < pending.length; start += batchSize) {
        const batch = pending.slice(start, start + batchSize);
        // 并发测速
        await Promise.all(batch.map(fetchVideoInfo));
      }
    };

    run();
  }, [activeTab, availableSources, optimizationEnabled, fetchVideoInfo]);

  return videoInfoMap;
}

/* -------------------------------------------------------------------------- */
/*                                  主组件                                    */
/* -------------------------------------------------------------------------- */

const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({
  totalEpisodes,
  episodes_titles,
  episodesPerPage = 50,
  value = 1,
  onChange,
  onSourceChange,
  currentSource,
  currentId,
  videoTitle,
  availableSources = [],
  sourceSearchLoading = false,
  sourceSearchError = null,
  precomputedVideoInfo,
}) => {
  const router = useRouter();

  const pageCount = Math.ceil(totalEpisodes / episodesPerPage);
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>(
    totalEpisodes > 1 ? 'episodes' : 'sources'
  );

  const initialPage = Math.floor((value - 1) / episodesPerPage);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [descending, setDescending] = useState(false);

  // 计算当前展示分页索引
  const displayPage = useMemo(
    () => (descending ? pageCount - 1 - currentPage : currentPage),
    [currentPage, descending, pageCount]
  );

  /* --------------------------- 分页标签计算 --------------------------- */

  const categoriesAsc = useMemo(
    () =>
      Array.from({ length: pageCount }, (_, i) => {
        const start = i * episodesPerPage + 1;
        const end = Math.min(start + episodesPerPage - 1, totalEpisodes);
        return { start, end };
      }),
    [pageCount, episodesPerPage, totalEpisodes]
  );

  const categories = useMemo(
    () =>
      (descending ? [...categoriesAsc].reverse() : categoriesAsc).map(
        ({ start, end }) =>
          descending ? `${end}-${start}` : `${start}-${end}`
      ),
    [categoriesAsc, descending]
  );

  /* --------------------------- 分页标签滚动逻辑 --------------------------- */

  const categoryContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isCategoryHovered, setIsCategoryHovered] = useState(false);

  const preventPageScroll = useCallback(
    (e: WheelEvent) => {
      if (isCategoryHovered) e.preventDefault();
    },
    [isCategoryHovered]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!isCategoryHovered || !categoryContainerRef.current) return;
      e.preventDefault();
      categoryContainerRef.current.scrollBy({
        left: e.deltaY * 2,
        behavior: 'smooth',
      });
    },
    [isCategoryHovered]
  );

  useEffect(() => {
    if (isCategoryHovered) {
      document.addEventListener('wheel', preventPageScroll, {
        passive: false,
      });
      document.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    }

    return () => {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel, isCategoryHovered, preventPageScroll]);

  // 当前分页标签滚动居中
  useEffect(() => {
    const btn = buttonRefs.current[displayPage];
    const container = categoryContainerRef.current;
    if (!btn || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;

    const btnLeft = btnRect.left - containerRect.left + scrollLeft;
    const target =
      btnLeft - (containerRect.width - btnRect.width) / 2;

    container.scrollTo({ left: target, behavior: 'smooth' });
  }, [displayPage]);

  const handleCategoryClick = useCallback(
    (index: number) => {
      setCurrentPage(descending ? pageCount - 1 - index : index);
    },
    [descending, pageCount]
  );

  /* --------------------------- 选集 & 换源点击 --------------------------- */

  const handleEpisodeClick = useCallback(
    (episodeNumber: number) => {
      // 父组件期望 0-based index
      onChange?.(episodeNumber - 1);
    },
    [onChange]
  );

  const handleSourceClick = useCallback(
    (source: SearchResult) => {
      onSourceChange?.(source.source, source.id, source.title);
    },
    [onSourceChange]
  );

  /* --------------------------- 当前分页内的剧集 --------------------------- */

  const currentStart = currentPage * episodesPerPage + 1;
  const currentEnd = Math.min(
    currentStart + episodesPerPage - 1,
    totalEpisodes
  );

  const pageEpisodes = useMemo(() => {
    const len = currentEnd - currentStart + 1;
    if (len <= 0) return [];
    const list = Array.from({ length: len }, (_, i) =>
      descending ? currentEnd - i : currentStart + i
    );
    return list;
  }, [currentStart, currentEnd, descending]);

  /* --------------------------- 视频信息（测速） --------------------------- */

  const videoInfoMap = useVideoInfo(
    activeTab,
    availableSources,
    precomputedVideoInfo
  );

  /* --------------------------- 渲染辅助 --------------------------- */

  const renderQualityBadge = (info?: VideoInfo) => {
    if (!info || info.quality === '未知') return null;

    if (info.hasError) {
      return (
        <div className="bg-muted text-destructive px-1.5 py-0 rounded text-xs flex-shrink-0 min-w-[50px] text-center">
          检测失败
        </div>
      );
    }

    const isUltraHigh = ['4K', '2K'].includes(info.quality);
    const isHigh = ['1080p', '720p'].includes(info.quality);

    const textColorClasses = isUltraHigh
      ? 'text-primary'
      : isHigh
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400';

    return (
      <div
        className={cn(
          'bg-muted px-1.5 py-0 rounded text-xs flex-shrink-0 min-w-[50px] text-center',
          textColorClasses
        )}
      >
        {info.quality}
      </div>
    );
  };

  const renderSpeedInfo = (info?: VideoInfo) => {
    if (!info) return null;
    if (info.hasError) {
      return (
        <div className="text-destructive font-medium text-xs">
          无测速数据
        </div>
      );
    }

    return (
      <div className="flex items-end gap-3 text-xs">
        <div className="text-primary font-medium text-xs">
          {info.loadSpeed}
        </div>
        <div className="text-orange-600 dark:text-orange-400 font-medium text-xs">
          {info.pingTime}ms
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------------- */

  return (
    <div className="px-4 py-0 h-full rounded-xl bg-black/10 dark:bg-white/5 flex flex-col border border-white/0 dark:border-white/30 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'episodes' | 'sources')}
        className="flex flex-col h-full"
      >
        <TabsList className="flex w-full my-2">
          {totalEpisodes > 1 && (
            <TabsTrigger value="episodes" className="flex-1">
              选集
            </TabsTrigger>
          )}
          <TabsTrigger value="sources" className="flex-1">
            换源
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ 选集 Tab ------------------------------ */}
        <TabsContent
          value="episodes"
          className="flex flex-col flex-1 focus-visible:outline-none overflow-y-auto overflow-x-hidden"
        >
          <div className="flex items-center gap-4 mb-4 border-b border-border -mx-6 px-6 flex-shrink-0">
            <div
              ref={categoryContainerRef}
              onMouseEnter={() => setIsCategoryHovered(true)}
              onMouseLeave={() => setIsCategoryHovered(false)}
              className="flex-1 overflow-x-auto"
            >
              <div className="flex gap-2 min-w-max">
                {categories.map((label, idx) => {
                  const isActive = idx === displayPage;
                  return (
                    <button
                      key={label}
                      ref={(el) => {
                        buttonRefs.current[idx] = el;
                      }}
                      onClick={() => handleCategoryClick(idx)}
                      className={cn(
                        'w-20 relative py-2 text-sm font-medium whitespace-nowrap flex-shrink-0 text-center transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-primary'
                      )}
                    >
                      {label}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="-translate-y-[4px]"
              onClick={() => setDescending((prev) => !prev)}
              aria-label="切换集数排序"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 flex-1 content-start pb-4">
            {pageEpisodes.map((episodeNumber) => {
              const isActive = episodeNumber === value;
              return (
                <button
                  key={episodeNumber}
                  onClick={() => handleEpisodeClick(episodeNumber)}
                  className={cn(
                    'h-10 min-w-10 px-3 py-2 flex items-center justify-center text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap font-mono',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-muted text-foreground hover:bg-muted/80 hover:scale-105'
                  )}
                >
                  {getEpisodeDisplayTitle(episodeNumber, episodes_titles)}
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* ------------------------------ 换源 Tab ------------------------------ */}
        <TabsContent
          value="sources"
          className="flex flex-col h-full mt-4 focus-visible:outline-none"
        >
          {sourceSearchLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                搜索中...
              </span>
            </div>
          )}

          {sourceSearchError && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-destructive text-2xl mb-2">⚠️</div>
                <p className="text-sm text-destructive">{sourceSearchError}</p>
              </div>
            </div>
          )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="text-muted-foreground text-2xl mb-2">
                    📺
                  </div>
                  <p className="text-sm text-muted-foreground">暂无可用的换源</p>
                </div>
              </div>
            )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length > 0 && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 pb-15 px-4">
                {[...availableSources]
                  .sort((a, b) => {
                    const aIsCurrent =
                      a.source === currentSource && a.id === currentId;
                    const bIsCurrent =
                      b.source === currentSource && b.id === currentId;
                    if (aIsCurrent && !bIsCurrent) return -1;
                    if (!aIsCurrent && bIsCurrent) return 1;
                    return 0;
                  })
                  .map((source, index) => {
                    const isCurrentSource =
                      source.source === currentSource &&
                      source.id === currentId;
                    const key = buildSourceKey(source);
                    const info = videoInfoMap.get(key);

                    return (
                      <div
                        key={key}
                        onClick={() =>
                          !isCurrentSource && handleSourceClick(source)
                        }
                        className={cn(
                          'flex items-start gap-3 px-2 py-3 rounded-lg transition-all select-none duration-200 relative',
                          isCurrentSource
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/60 hover:scale-[1.02] cursor-pointer'
                        )}
                      >
                        <div className="flex-shrink-0 w-12 h-20 bg-muted rounded overflow-hidden">
                          {source.episodes?.length ? (
                            <img
                              src={processImageUrl(source.poster)}
                              alt={source.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  'none';
                              }}
                            />
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between h-20">
                          <div className="flex items-start justify-between gap-3 h-6">
                            <div className="flex-1 min-w-0 relative group/title">
                              <h3 className="font-medium text-base truncate leading-none">
                                {source.title}
                              </h3>
                              {index !== 0 && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-foreground text-background text-xs rounded-md shadow-lg opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 ease-out delay-100 whitespace-nowrap z-[500] pointer-events-none">
                                  {source.title}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
                                </div>
                              )}
                            </div>
                            {renderQualityBadge(info)}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-1 border border-border rounded text-foreground">
                              {source.source_name}
                            </span>
                            {source.episodes.length > 1 && (
                              <span className="text-xs text-muted-foreground font-medium">
                                {source.episodes.length} 集
                              </span>
                            )}
                          </div>

                          <div className="flex items-end h-6">
                            {renderSpeedInfo(info)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                <div className="flex-shrink-0 mt-auto pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      if (videoTitle) {
                        router.push(
                          `/search?q=${encodeURIComponent(videoTitle)}`
                        );
                      }
                    }}
                    className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-2"
                  >
                    影片匹配有误？点击去搜索
                  </button>
                </div>
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EpisodeSelector;
