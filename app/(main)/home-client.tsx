"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ChevronRight, Heart, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BangumiCalendarData, normalizeBangumiData } from "@/lib/bangumi.client";
import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from "@/lib/db.client";
import { getDoubanCategories } from "@/lib/douban.client";
import { DoubanItem } from "@/lib/types";

import ContinueWatching from "@/components/continue-watching";
import ScrollableRow from "@/components/scrollable-row";
import VideoCard from "@/components/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type FavoriteItem = {
  id: string;
  source: string;
  title: string;
  poster: string;
  episodes: number;
  source_name: string;
  currentEpisode?: number;
  search_title?: string;
  origin?: "vod" | "live";
  year?: string;
};

type HomeClientProps = {
  initialHotMovies: DoubanItem[];
  initialHotTvShows: DoubanItem[];
  initialHotVarietyShows: DoubanItem[];
  initialBangumi: BangumiCalendarData[];
};

export default function HomeClient({
  initialHotMovies,
  initialHotTvShows,
  initialHotVarietyShows,
  initialBangumi,
}: HomeClientProps) {
  const [activeTab, setActiveTab] = useState<"home" | "favorites">("home");
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>(initialHotMovies);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>(initialHotTvShows);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>(initialHotVarietyShows);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<BangumiCalendarData[]>(initialBangumi);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const prefetchedReady = useMemo(
    () =>
      initialHotMovies.length > 0 &&
      initialHotTvShows.length > 0 &&
      initialHotVarietyShows.length > 0 &&
      initialBangumi.length > 0,
    [initialHotMovies.length, initialHotTvShows.length, initialHotVarietyShows.length, initialBangumi.length]
  );
  const [loading, setLoading] = useState(!prefetchedReady);

  useEffect(() => {
    if (prefetchedReady) {
      setLoading(false);
      return;
    }

    const fetchRecommendData = async () => {
      try {
        setLoading(true);
        const [moviesData, tvShowsData, varietyShowsData, bangumiData] =
          await Promise.all([
            getDoubanCategories({
              kind: "movie",
              category: "热门",
              type: "全部",
            }),
            getDoubanCategories({ kind: "tv", category: "tv", type: "tv" }),
            getDoubanCategories({ kind: "tv", category: "show", type: "show" }),
            // 客户端作为兜底补齐
            (async () => {
              const res = await fetch("https://api.bgm.tv/calendar");
              if (!res.ok) return [];
              return (await res.json()) as BangumiCalendarData[];
            })(),
          ]);

        if (moviesData.code === 200) setHotMovies(moviesData.list);
        if (tvShowsData.code === 200) setHotTvShows(tvShowsData.list);
        if (varietyShowsData.code === 200) setHotVarietyShows(varietyShowsData.list);
        setBangumiCalendarData(
          Array.isArray(bangumiData) ? normalizeBangumiData(bangumiData) : []
        );
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendData();
  }, [prefetchedReady]);

  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf("+");
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;
        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
          origin: fav?.origin,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  useEffect(() => {
    if (activeTab !== "favorites") return;
    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };
    loadFavorites();

    const unsubscribe = subscribeToDataUpdates(
      "favoritesUpdated",
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      }
    );
    return unsubscribe;
  }, [activeTab]);

  const renderSkeletonRow = (count = 8) => (
    <ScrollableRow>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="min-w-[120px] sm:min-w-[180px] space-y-2"
        >
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </ScrollableRow>
  );

  const renderBangumiToday = () => {
    const today = new Date();
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentWeekday = weekdays[today.getDay()];
    const todayAnimes =
      bangumiCalendarData.find((item) => item.weekday.en === currentWeekday)
        ?.items || [];
    const validAnimes = todayAnimes.filter((anime) => anime && anime.id);
    return (
      <ScrollableRow>
        {validAnimes.map((anime, index) => (
          <div key={`${anime.id}-${index}`} className="min-w-[120px] sm:min-w-[180px]">
            <VideoCard
              from="douban"
              title={anime.name_cn || anime.name}
              poster={
                anime.images?.large ||
                anime.images?.common ||
                anime.images?.medium ||
                anime.images?.small ||
                anime.images?.grid ||
                "/logo.png"
              }
              douban_id={anime.id}
              rate={anime.rating?.score?.toFixed(1) || ""}
              year={anime.air_date?.split("-")?.[0] || ""}
              isBangumi
            />
          </div>
        ))}
      </ScrollableRow>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 mb-4 pt-8 sm:px-6 lg:px-8 space-y-8">
      <Card className="gap-2">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Home</CardTitle>
            <p className="text-sm text-muted-foreground">
              发现、收藏、继续观看你喜欢的内容。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              推荐
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Play className="h-4 w-4" />
              播放记录
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              收藏夹
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "home" | "favorites")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="home">首页</TabsTrigger>
          <TabsTrigger value="favorites">收藏夹</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites" className="space-y-6">
          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">我的收藏</CardTitle>
              {favoriteItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await clearAllFavorites();
                    setFavoriteItems([]);
                  }}
                >
                  清空
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {favoriteItems.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">暂无收藏内容</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {favoriteItems.map((item) => (
                    <VideoCard
                      key={item.id + item.source}
                      query={item.search_title}
                      {...item}
                      from="favorite"
                      type={item.episodes > 1 ? "tv" : ""}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="home" className="space-y-6">
          <ContinueWatching className="gap-2"/>

          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">热门电影</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/douban?type=movie">
                  查看更多
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading
                ? renderSkeletonRow()
                : (
                  <ScrollableRow>
                    {hotMovies.map((movie) => (
                      <div key={movie.id} className="min-w-[120px] sm:min-w-[180px]">
                        <VideoCard
                          from="douban"
                          title={movie.title}
                          poster={movie.poster}
                          douban_id={Number(movie.id)}
                          rate={movie.rate}
                          year={movie.year}
                          type="movie"
                        />
                      </div>
                    ))}
                  </ScrollableRow>
                )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">热门剧集</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/douban?type=tv">
                  查看更多
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading
                ? renderSkeletonRow()
                : (
                  <ScrollableRow>
                    {hotTvShows.map((show) => (
                      <div key={show.id} className="min-w-[120px] sm:min-w-[180px]">
                        <VideoCard
                          from="douban"
                          title={show.title}
                          poster={show.poster}
                          douban_id={Number(show.id)}
                          rate={show.rate}
                          year={show.year}
                        />
                      </div>
                    ))}
                  </ScrollableRow>
                )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">新番放送</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/douban?type=anime">
                  查看更多
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? renderSkeletonRow() : renderBangumiToday()}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">热门综艺</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/douban?type=show">
                  查看更多
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading
                ? renderSkeletonRow()
                : (
                  <ScrollableRow>
                    {hotVarietyShows.map((show) => (
                      <div key={show.id} className="min-w-[120px] sm:min-w-[180px]">
                        <VideoCard
                          from="douban"
                          title={show.title}
                          poster={show.poster}
                          douban_id={Number(show.id)}
                          rate={show.rate}
                          year={show.year}
                        />
                      </div>
                    ))}
                  </ScrollableRow>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
