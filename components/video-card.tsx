"use client";

import {
  ExternalLink,
  Heart,
  Link as LinkIcon,
  PlayCircleIcon,
  Radio,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from "@/lib/db.client";
import { processImageUrl } from "@/lib/utils";
import { useLongPress } from "@/hooks/use-long-press";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MobileActionSheet from "@/components/mobile-action-sheet";

export interface VideoCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  source_names?: string[];
  progress?: number;
  year?: string;
  from: "playrecord" | "favorite" | "search" | "douban";
  currentEpisode?: number;
  douban_id?: number;
  onDelete?: () => void;
  rate?: string;
  type?: string;
  isBangumi?: boolean;
  isAggregate?: boolean;
  origin?: "vod" | "live";
}

export type VideoCardHandle = {
  setEpisodes: (episodes?: number) => void;
  setSourceNames: (names?: string[]) => void;
  setDoubanId: (id?: number) => void;
};

const VideoCard = forwardRef<VideoCardHandle, VideoCardProps>(function VideoCard(
  props,
  ref
) {
  const {
    id,
    title = "",
    query = "",
    poster = "",
    episodes,
    source,
    source_name,
    source_names,
    progress = 0,
    year,
    from,
    currentEpisode,
    douban_id,
    onDelete,
    rate,
    type = "",
    isBangumi = false,
    isAggregate = false,
    origin = "vod",
  } = props;

  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [searchFavorited, setSearchFavorited] = useState<boolean | null>(null);

  const [dynamicEpisodes, setDynamicEpisodes] = useState<number | undefined>(
    episodes
  );
  const [dynamicSourceNames, setDynamicSourceNames] = useState<
    string[] | undefined
  >(source_names);
  const [dynamicDoubanId, setDynamicDoubanId] = useState<number | undefined>(
    douban_id
  );

  useEffect(() => {
    setDynamicEpisodes(episodes);
  }, [episodes]);

  useEffect(() => {
    setDynamicSourceNames(source_names);
  }, [source_names]);

  useEffect(() => {
    setDynamicDoubanId(douban_id);
  }, [douban_id]);

  useImperativeHandle(ref, () => ({
    setEpisodes: (eps?: number) => setDynamicEpisodes(eps),
    setSourceNames: (names?: string[]) => setDynamicSourceNames(names),
    setDoubanId: (id?: number) => setDynamicDoubanId(id),
  }));

  const actualTitle = title;
  const actualPoster = poster;
  const actualSource = source;
  const actualId = id;
  const actualDoubanId = dynamicDoubanId;
  const actualEpisodes = dynamicEpisodes;
  const actualYear = year;
  const actualQuery = query || "";
  const actualSearchType = isAggregate
    ? actualEpisodes && actualEpisodes === 1
      ? "movie"
      : "tv"
    : type;

  // 初始化收藏状态（非 douban/search）
  useEffect(() => {
    if (from === "douban" || from === "search" || !actualSource || !actualId) return;

    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setFavorited(fav);
      } catch {
        // 静默
      }
    };

    fetchFavoriteStatus();

    const storageKey = generateStorageKey(actualSource, actualId);
    const unsubscribe = subscribeToDataUpdates(
      "favoritesUpdated",
      (newFavorites: Record<string, unknown>) => {
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      }
    );

    return unsubscribe;
  }, [from, actualSource, actualId]);

  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (from === "douban" || !actualSource || !actualId) return;

      try {
        const currentFavorited = from === "search" ? searchFavorited : favorited;

        if (currentFavorited) {
          await deleteFavorite(actualSource, actualId);
          if (from === "search") setSearchFavorited(false);
          else setFavorited(false);
        } else {
          await saveFavorite(actualSource, actualId, {
            title: actualTitle,
            source_name: source_name || "",
            year: actualYear || "",
            cover: actualPoster,
            total_episodes: actualEpisodes ?? 1,
            save_time: Date.now(),
          });
          if (from === "search") setSearchFavorited(true);
          else setFavorited(true);
        }
      } catch {
        // TODO: toast error?
      }
    },
    [
      from,
      actualSource,
      actualId,
      actualTitle,
      source_name,
      actualYear,
      actualPoster,
      actualEpisodes,
      favorited,
      searchFavorited,
    ]
  );

  const handleDeleteRecord = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (from !== "playrecord" || !actualSource || !actualId) return;
      try {
        await deletePlayRecord(actualSource, actualId);
        onDelete?.();
      } catch {
        // TODO: toast error?
      }
    },
    [from, actualSource, actualId, onDelete]
  );

  const buildPlayUrl = useCallback(
    (newTab = false) => {
      let url = "";

      if (origin === "live" && actualSource && actualId) {
        url = `/live?source=${actualSource.replace("live_", "")}&id=${actualId.replace(
          "live_",
          ""
        )}`;
      } else if (from === "douban" || (isAggregate && !actualSource && !actualId)) {
        url = `/play?title=${encodeURIComponent(
          actualTitle.trim()
        )}${actualYear ? `&year=${actualYear}` : ""}${
          actualSearchType ? `&stype=${actualSearchType}` : ""
        }${isAggregate ? "&prefer=true" : ""}${
          actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ""
        }`;
      } else if (actualSource && actualId) {
        url = `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
          actualTitle
        )}${actualYear ? `&year=${actualYear}` : ""}${
          isAggregate ? "&prefer=true" : ""
        }${actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ""}${
          actualSearchType ? `&stype=${actualSearchType}` : ""
        }`;
      }

      if (!url) return;

      if (newTab) {
        window.open(url, "_blank");
      } else {
        router.push(url);
      }
    },
    [
      origin,
      actualSource,
      actualId,
      from,
      isAggregate,
      actualTitle,
      actualYear,
      actualSearchType,
      actualQuery,
      router,
    ]
  );

  const handleClick = useCallback(() => {
    buildPlayUrl(false);
  }, [buildPlayUrl]);

  const handlePlayInNewTab = useCallback(() => {
    buildPlayUrl(true);
  }, [buildPlayUrl]);

  // 搜索结果收藏状态
  const checkSearchFavoriteStatus = useCallback(async () => {
    if (
      from === "search" &&
      !isAggregate &&
      actualSource &&
      actualId &&
      searchFavorited === null
    ) {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setSearchFavorited(fav);
      } catch {
        setSearchFavorited(false);
      }
    }
  }, [from, isAggregate, actualSource, actualId, searchFavorited]);

  const handleLongPress = useCallback(() => {
    if (!showMobileActions) {
      setShowMobileActions(true);
      if (
        from === "search" &&
        !isAggregate &&
        actualSource &&
        actualId &&
        searchFavorited === null
      ) {
        checkSearchFavoriteStatus();
      }
    }
  }, [
    showMobileActions,
    from,
    isAggregate,
    actualSource,
    actualId,
    searchFavorited,
    checkSearchFavoriteStatus,
  ]);

  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    longPressDelay: 500,
  });

  const config = useMemo(() => {
    const configs = {
      playrecord: {
        showSourceName: true,
        showProgress: true,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: true,
        showDoubanLink: false,
        showRating: false,
        showYear: false,
      },
      favorite: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: false,
        showDoubanLink: false,
        showRating: false,
        showYear: false,
      },
      search: {
        showSourceName: true,
        showProgress: false,
        showPlayButton: true,
        showHeart: true,
        showCheckCircle: false,
        showDoubanLink: true,
        showRating: false,
        showYear: true,
      },
      douban: {
        showSourceName: false,
        showProgress: false,
        showPlayButton: true,
        showHeart: false,
        showCheckCircle: false,
        showDoubanLink: true,
        showRating: !!rate,
        showYear: false,
      },
    };
    return configs[from] || configs.search;
  }, [from, rate]);

  const mobileActions = useMemo(() => {
    const actions: unknown[] = [];

    if (config.showPlayButton) {
      actions.push({
        id: "play",
        label: origin === "live" ? "观看直播" : "播放",
        icon: <PlayCircleIcon size={20} />,
        onClick: handleClick,
        color: "primary" as const,
      });
      actions.push({
        id: "play-new-tab",
        label: origin === "live" ? "新标签页观看" : "新标签页播放",
        icon: <ExternalLink size={20} />,
        onClick: handlePlayInNewTab,
        color: "default" as const,
      });
    }

    if (config.showHeart && from !== "douban" && actualSource && actualId) {
      const currentFavorited = from === "search" ? searchFavorited : favorited;

      if (from === "search") {
        if (searchFavorited !== null) {
          actions.push({
            id: "favorite",
            label: currentFavorited ? "取消收藏" : "添加收藏",
            icon: currentFavorited ? (
              <Heart size={20} className="fill-red-600 stroke-red-600" />
            ) : (
              <Heart size={20} className="fill-transparent stroke-red-500" />
            ),
            onClick: () => {
              const mockEvent = {
                preventDefault: () => {},
                stopPropagation: () => {},
              } as React.MouseEvent;
              handleToggleFavorite(mockEvent);
            },
            color: currentFavorited ? ("danger" as const) : ("default" as const),
          });
        } else {
          actions.push({
            id: "favorite-loading",
            label: "收藏加载中...",
            icon: <Heart size={20} />,
            onClick: () => {},
            disabled: true,
          });
        }
      } else {
        actions.push({
          id: "favorite",
          label: currentFavorited ? "取消收藏" : "添加收藏",
          icon: currentFavorited ? (
            <Heart size={20} className="fill-red-600 stroke-red-600" />
          ) : (
            <Heart size={20} className="fill-transparent stroke-red-500" />
          ),
          onClick: () => {
            const mockEvent = {
              preventDefault: () => {},
              stopPropagation: () => {},
            } as React.MouseEvent;
            handleToggleFavorite(mockEvent);
          },
          color: currentFavorited ? ("danger" as const) : ("default" as const),
        });
      }
    }

    if (config.showCheckCircle && from === "playrecord" && actualSource && actualId) {
      actions.push({
        id: "delete",
        label: "删除记录",
        icon: <Trash2 size={20} />,
        onClick: () => {
          const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
          } as React.MouseEvent;
          handleDeleteRecord(mockEvent);
        },
        color: "danger" as const,
      });
    }

    if (config.showDoubanLink && actualDoubanId && actualDoubanId !== 0) {
      actions.push({
        id: "douban",
        label: isBangumi ? "Bangumi 详情" : "豆瓣详情",
        icon: <LinkIcon size={20} />,
        onClick: () => {
          const url = isBangumi
            ? `https://bgm.tv/subject/${actualDoubanId.toString()}`
            : `https://movie.douban.com/subject/${actualDoubanId.toString()}`;
          window.open(url, "_blank", "noopener,noreferrer");
        },
        color: "default" as const,
      });
    }

    return actions;
  }, [
    config,
    from,
    actualSource,
    actualId,
    favorited,
    searchFavorited,
    actualDoubanId,
    isBangumi,
    handleClick,
    handlePlayInNewTab,
    handleToggleFavorite,
    handleDeleteRecord,
    origin,
  ]);

  const uniqueSources =
    isAggregate && dynamicSourceNames
      ? Array.from(new Set(dynamicSourceNames))
      : [];

  return (
    <>
      <Card
        className="group relative w-full cursor-pointer border-0 bg-transparent shadow-none transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
        onClick={handleClick}
        {...longPressProps}
      >
        <CardContent className="p-0">
          {/* 海报区域 */}
          <div
            className={`relative aspect-[2/3] overflow-hidden rounded-xl ${
              origin === "live"
                ? "ring-1 ring-border bg-background"
                : "bg-muted"
            }`}
          >
            {!isLoading && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}

            <Image
              src={processImageUrl(actualPoster)}
              alt={actualTitle}
              fill
              className={origin === "live" ? "object-contain" : "object-cover"}
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoadingComplete={() => setIsLoading(true)}
            />

            {/* 渐变遮罩 */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* 中央播放按钮 */}
            {config.showPlayButton && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                <PlayCircleIcon
                  size={52}
                  strokeWidth={0.9}
                  className="text-white drop-shadow-lg"
                />
              </div>
            )}

            {/* 右下角操作按钮 */}
            {(config.showHeart || config.showCheckCircle) && (
              <div className="pointer-events-auto absolute bottom-3 right-3 hidden gap-3 sm:flex">
                {config.showCheckCircle && (
                  <button
                    type="button"
                    onClick={handleDeleteRecord}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md transition hover:bg-destructive/80"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {config.showHeart && from !== "search" && (
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 shadow-md transition hover:bg-black/80"
                  >
                    <Heart
                      size={16}
                      className={
                        favorited
                          ? "fill-red-500 stroke-red-500"
                          : "fill-transparent stroke-white"
                      }
                    />
                  </button>
                )}
              </div>
            )}

            {/* 年份徽章 */}
            {config.showYear &&
              actualYear &&
              actualYear !== "unknown" &&
              actualYear.trim() !== "" && (
                <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                  {actualYear}
                </div>
              )}

            {/* 豆瓣评分 */}
            {config.showRating && rate && (
              <div className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md">
                {rate}
              </div>
            )}

            {/* 集数徽章 */}
            {actualEpisodes && actualEpisodes > 1 && (
              <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-slate-500 px-2 py-0.5 text-xs font-semibold text-white shadow-md">
                {currentEpisode
                  ? `${currentEpisode}/${actualEpisodes}`
                  : actualEpisodes}
              </div>
            )}

            {/* 豆瓣链接小圆点 */}
            {config.showDoubanLink && actualDoubanId && actualDoubanId !== 0 && (
              <a
                href={
                  isBangumi
                    ? `https://bgm.tv/subject/${actualDoubanId.toString()}`
                    : `https://movie.douban.com/subject/${actualDoubanId.toString()}`
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto absolute left-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full text-white transition hover:scale-110 group-hover:flex"
              >
                <LinkIcon size={14} />
              </a>
            )}

            {/* 聚合播放源小圆点 + 悬浮说明 */}
            {isAggregate && uniqueSources.length > 0 && (
              <div className="pointer-events-none absolute bottom-2 right-2 hidden sm:block">
                <div className="group/sources relative inline-flex">
                  <div className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white shadow-md group-hover/sources:bg-slate-700">
                    {uniqueSources.length}
                  </div>

                  <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden min-w-[120px] max-w-[200px] rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-xl group-hover/sources:block">
                    <div className="space-y-1">
                      {uniqueSources.slice(0, 6).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-primary/70" />
                          <span className="truncate" title={s}>
                            {s}
                          </span>
                        </div>
                      ))}
                    </div>
                    {uniqueSources.length > 6 && (
                      <div className="mt-1 border-t pt-1 text-[10px] text-muted-foreground text-center">
                        +{uniqueSources.length - 6} 更多播放源
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 进度条 */}
          {config.showProgress && typeof progress === "number" && (
            <div className="mt-2">
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* 标题 + 来源 */}
          <div className="mt-2 text-center">
            <div className="relative">
              <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {actualTitle}
              </span>
            </div>
            {config.showSourceName && source_name && (
              <span className="mt-1 inline-flex items-center justify-center text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 border-border/60">
                  {origin === "live" && (
                    <Radio size={12} className="text-muted-foreground" />
                  )}
                  {source_name}
                </span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <MobileActionSheet
        isOpen={showMobileActions}
        onClose={() => setShowMobileActions(false)}
        title={actualTitle}
        poster={processImageUrl(actualPoster)}
        actions={mobileActions}
        sources={isAggregate && dynamicSourceNames ? uniqueSources : undefined}
        isAggregate={isAggregate}
        sourceName={source_name}
        currentEpisode={currentEpisode}
        totalEpisodes={actualEpisodes}
        origin={origin}
      />
    </>
  );
});

export default memo(VideoCard);
