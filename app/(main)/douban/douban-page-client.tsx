"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { GetBangumiCalendarData } from "@/lib/bangumi.client";
import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from "@/lib/douban.client";
import { DoubanItem, DoubanResult } from "@/lib/types";

import DoubanCardSkeleton from "@/components/douban-card-skeleton";
import DoubanCustomSelector from "@/components/douban-custom-selector";
import DoubanSelector from "@/components/douban-selector";
import VideoCard from "@/components/video-card";
import { Card, CardContent } from "@/components/ui/card";

export default function DoubanPageClient() {
  const searchParams = useSearchParams();
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentParamsRef = useRef({
    type: "",
    primarySelection: "",
    secondarySelection: "",
    multiLevelSelection: {} as Record<string, string>,
    selectedWeekday: "",
    currentPage: 0,
  });

  const type = searchParams.get("type") || "movie";

  const [customCategories, setCustomCategories] = useState<
    Array<{ name: string; type: "movie" | "tv"; query: string }>
  >([]);

  const [primarySelection, setPrimarySelection] = useState<string>(() => {
    if (type === "movie") return "热门";
    if (type === "tv" || type === "show") return "最近热门";
    if (type === "anime") return "每日放送";
    return "";
  });
  const [secondarySelection, setSecondarySelection] = useState<string>(() => {
    if (type === "movie") return "全部";
    if (type === "tv") return "tv";
    if (type === "show") return "show";
    return "全部";
  });

  const [multiLevelValues, setMultiLevelValues] = useState<Record<string, string>>({
    type: "all",
    region: "all",
    year: "all",
    platform: "all",
    label: "all",
    sort: "T",
  });

  const [selectedWeekday, setSelectedWeekday] = useState<string>("");

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setCustomCategories(runtimeConfig.CUSTOM_CATEGORIES);
    }
  }, []);

  useEffect(() => {
    currentParamsRef.current = {
      type,
      primarySelection,
      secondarySelection,
      multiLevelSelection: multiLevelValues,
      selectedWeekday,
      currentPage,
    };
  }, [type, primarySelection, secondarySelection, multiLevelValues, selectedWeekday, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true);
  }, [type]);

  useEffect(() => {
    if (type === "custom" && customCategories.length > 0) {
      const types = Array.from(new Set(customCategories.map((cat) => cat.type)));
      if (types.length > 0) {
        let selectedType: "movie" | "tv" = types[0];
        if (types.includes("movie")) selectedType = "movie";
        else selectedType = "tv";

        setPrimarySelection(selectedType);

        const firstCategory = customCategories.find((cat) => cat.type === selectedType);
        if (firstCategory) setSecondarySelection(firstCategory.query);
      }
    } else {
      if (type === "movie") {
        setPrimarySelection("热门");
        setSecondarySelection("全部");
      } else if (type === "tv") {
        setPrimarySelection("最近热门");
        setSecondarySelection("tv");
      } else if (type === "show") {
        setPrimarySelection("最近热门");
        setSecondarySelection("show");
      } else if (type === "anime") {
        setPrimarySelection("每日放送");
        setSecondarySelection("全部");
      } else {
        setPrimarySelection("");
        setSecondarySelection("全部");
      }
    }

    setMultiLevelValues({
      type: "all",
      region: "all",
      year: "all",
      platform: "all",
      label: "all",
      sort: "T",
    });

    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [type, customCategories]);

  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  const isSnapshotEqual = useCallback((s1: any, s2: any) => {
    return (
      s1.type === s2.type &&
      s1.primarySelection === s2.primarySelection &&
      s1.secondarySelection === s2.secondarySelection &&
      s1.selectedWeekday === s2.selectedWeekday &&
      s1.currentPage === s2.currentPage &&
      JSON.stringify(s1.multiLevelSelection) === JSON.stringify(s2.multiLevelSelection)
    );
  }, []);

  const getRequestParams = useCallback(
    (pageStart: number) => {
      if (type === "tv" || type === "show") {
        return {
          kind: "tv" as const,
          category: type,
          type: secondarySelection,
          pageLimit: 25,
          pageStart,
        };
      }
      return {
        kind: type as "tv" | "movie",
        category: primarySelection,
        type: secondarySelection,
        pageLimit: 25,
        pageStart,
      };
    },
    [type, primarySelection, secondarySelection]
  );

  const loadInitialData = useCallback(async () => {
    const requestSnapshot = {
      type,
      primarySelection,
      secondarySelection,
      multiLevelSelection: multiLevelValues,
      selectedWeekday,
      currentPage: 0,
    };

    try {
      setLoading(true);
      setDoubanData([]);
      setCurrentPage(0);
      setHasMore(true);
      setIsLoadingMore(false);

      let data: DoubanResult;

      if (type === "custom") {
        const selectedCategory = customCategories.find(
          (cat) => cat.type === primarySelection && cat.query === secondarySelection
        );
        if (selectedCategory) {
          data = await getDoubanList({
            tag: selectedCategory.query,
            type: selectedCategory.type,
            pageLimit: 25,
            pageStart: 0,
          });
        } else {
          throw new Error("没有找到对应的分类");
        }
      } else if (type === "anime" && primarySelection === "每日放送") {
        const calendarData = await GetBangumiCalendarData();
        const weekdayData = calendarData.find(
          (item) => item.weekday.en === selectedWeekday
        );
        if (weekdayData) {
          data = {
            code: 200,
            message: "success",
            list: weekdayData.items
              .filter((item) => item && item.id)
              .map((item) => ({
                id: item.id?.toString() || "",
                title: item.name_cn || item.name,
                poster:
                  item.images?.large ||
                  item.images?.common ||
                  item.images?.medium ||
                  item.images?.small ||
                  item.images?.grid ||
                  "/logo.png",
                rate: item.rating?.score?.toFixed(1) || "",
                year: item.air_date?.split("-")?.[0] || "",
              })),
          };
        } else {
          throw new Error("没有找到对应的日期");
        }
      } else if (type === "anime") {
        data = await getDoubanRecommends({
          kind: primarySelection === "番剧" ? "tv" : "movie",
          pageLimit: 25,
          pageStart: 0,
          category: "动画",
          format: primarySelection === "番剧" ? "电视剧" : "",
          region: multiLevelValues.region || "",
          year: multiLevelValues.year || "",
          platform: multiLevelValues.platform || "",
          sort: multiLevelValues.sort || "",
          label: multiLevelValues.label || "",
        });
      } else if (primarySelection === "全部") {
        data = await getDoubanRecommends({
          kind: type === "show" ? "tv" : (type as "tv" | "movie"),
          pageLimit: 25,
          pageStart: 0,
          category: multiLevelValues.type || "",
          format: type === "show" ? "综艺" : type === "tv" ? "电视剧" : "",
          region: multiLevelValues.region || "",
          year: multiLevelValues.year || "",
          platform: multiLevelValues.platform || "",
          sort: multiLevelValues.sort || "",
          label: multiLevelValues.label || "",
        });
      } else {
        data = await getDoubanCategories(getRequestParams(0));
      }

      if (data.code === 200) {
        const currentSnapshot = { ...currentParamsRef.current };
        if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
          setDoubanData(data.list);
          setHasMore(data.list.length !== 0);
          setLoading(false);
        }
      } else {
        throw new Error(data.message || "获取数据失败");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    getRequestParams,
    customCategories,
    isSnapshotEqual,
  ]);

  useEffect(() => {
    if (!selectorsReady) return;

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [
    selectorsReady,
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    loadInitialData,
  ]);

  useEffect(() => {
    if (currentPage > 0) {
      const fetchMoreData = async () => {
        const requestSnapshot = {
          type,
          primarySelection,
          secondarySelection,
          multiLevelSelection: multiLevelValues,
          selectedWeekday,
          currentPage,
        };

        try {
          setIsLoadingMore(true);

          let data: DoubanResult;

          if (type === "custom") {
            const selectedCategory = customCategories.find(
              (cat) =>
                cat.type === primarySelection && cat.query === secondarySelection
            );
            if (selectedCategory) {
              data = await getDoubanList({
                tag: selectedCategory.query,
                type: selectedCategory.type,
                pageLimit: 25,
                pageStart: currentPage * 25,
              });
            } else {
              throw new Error("没有找到对应的分类");
            }
          } else if (type === "anime" && primarySelection === "每日放送") {
            data = {
              code: 200,
              message: "success",
              list: [],
            };
          } else if (type === "anime") {
            data = await getDoubanRecommends({
              kind: primarySelection === "番剧" ? "tv" : "movie",
              pageLimit: 25,
              pageStart: currentPage * 25,
              category: "动画",
              format: primarySelection === "番剧" ? "电视剧" : "",
              region: multiLevelValues.region || "",
              year: multiLevelValues.year || "",
              platform: multiLevelValues.platform || "",
              sort: multiLevelValues.sort || "",
              label: multiLevelValues.label || "",
            });
          } else if (primarySelection === "全部") {
            data = await getDoubanRecommends({
              kind: type === "show" ? "tv" : (type as "tv" | "movie"),
              pageLimit: 25,
              pageStart: currentPage * 25,
              category: multiLevelValues.type || "",
              format: type === "show" ? "综艺" : type === "tv" ? "电视剧" : "",
              region: multiLevelValues.region || "",
              year: multiLevelValues.year || "",
              platform: multiLevelValues.platform || "",
              sort: multiLevelValues.sort || "",
              label: multiLevelValues.label || "",
            });
          } else {
            data = await getDoubanCategories(getRequestParams(currentPage * 25));
          }

          if (data.code === 200) {
            const currentSnapshot = { ...currentParamsRef.current };
            if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
              setDoubanData((prev) => [...prev, ...data.list]);
              setHasMore(data.list.length !== 0);
            }
          } else {
            throw new Error(data.message || "获取数据失败");
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [
    currentPage,
    type,
    primarySelection,
    secondarySelection,
    customCategories,
    multiLevelValues,
    selectedWeekday,
    getRequestParams,
    isSnapshotEqual,
  ]);

  useEffect(() => {
    if (!hasMore || isLoadingMore || loading) return;
    if (!loadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoadingMore, loading]);

  const handlePrimaryChange = useCallback(
    (value: string) => {
      if (value !== primarySelection) {
        setLoading(true);
        setCurrentPage(0);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);

        setMultiLevelValues({
          type: "all",
          region: "all",
          year: "all",
          platform: "all",
          label: "all",
          sort: "T",
        });

        if (type === "custom" && customCategories.length > 0) {
          const firstCategory = customCategories.find((cat) => cat.type === value);
          setPrimarySelection(value);
          if (firstCategory) setSecondarySelection(firstCategory.query);
        } else {
          if ((type === "tv" || type === "show") && value === "最近热门") {
            setPrimarySelection(value);
            if (type === "tv") setSecondarySelection("tv");
            else if (type === "show") setSecondarySelection("show");
          } else {
            setPrimarySelection(value);
          }
        }
      }
    },
    [primarySelection, type, customCategories]
  );

  const handleSecondaryChange = useCallback(
    (value: string) => {
      if (value !== secondarySelection) {
        setLoading(true);
        setCurrentPage(0);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setSecondarySelection(value);
      }
    },
    [secondarySelection]
  );

  const handleMultiLevelChange = useCallback(
    (values: Record<string, string>) => {
      const isEqual = (obj1: Record<string, string>, obj2: Record<string, string>) => {
        const keys1 = Object.keys(obj1).sort();
        const keys2 = Object.keys(obj2).sort();
        if (keys1.length !== keys2.length) return false;
        return keys1.every((key) => obj1[key] === obj2[key]);
      };

      if (isEqual(values, multiLevelValues)) return;

      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);
      setMultiLevelValues(values);
    },
    [multiLevelValues]
  );

  const handleWeekdayChange = useCallback((weekday: string) => {
    setSelectedWeekday(weekday);
  }, []);

  const getPageTitle = () => {
    return type === "movie"
      ? "电影"
      : type === "tv"
      ? "电视剧"
      : type === "anime"
      ? "动漫"
      : type === "show"
      ? "综艺"
      : "自定义";
  };

  const getPageDescription = () => {
    if (type === "anime" && primarySelection === "每日放送") {
      return "来自 Bangumi 番组计划的每日放送内容";
    }
    return "来自豆瓣的精选内容";
  };

  return (
    <div className="px-4 py-4 sm:px-10 sm:py-8">
      <div className="mb-6 space-y-4 sm:mb-8 sm:space-y-6">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-foreground sm:text-3xl">
            {getPageTitle()}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {getPageDescription()}
          </p>
        </div>

        <Card className="border bg-card/80 backdrop-blur">
          <CardContent>
            {type !== "custom" ? (
              <DoubanSelector
                type={type as "movie" | "tv" | "show" | "anime"}
                primarySelection={primarySelection}
                secondarySelection={secondarySelection}
                onPrimaryChange={handlePrimaryChange}
                onSecondaryChange={handleSecondaryChange}
                onMultiLevelChange={handleMultiLevelChange}
                onWeekdayChange={handleWeekdayChange}
              />
            ) : (
              <DoubanCustomSelector
                customCategories={customCategories}
                primarySelection={primarySelection}
                secondarySelection={secondarySelection}
                onPrimaryChange={handlePrimaryChange}
                onSecondaryChange={handleSecondaryChange}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto mt-8 max-w-[95%]">
        <div className="grid grid-cols-3 justify-start gap-x-2 gap-y-2 px-0 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-2 sm:px-2">
          {loading || !selectorsReady
            ? skeletonData.map((i) => <DoubanCardSkeleton key={i} />)
            : doubanData.map((item, index) => (
                <div key={`${item.title}-${index}`} className="w-full">
                  <VideoCard
                    from="douban"
                    title={item.title}
                    poster={item.poster}
                    douban_id={Number(item.id)}
                    rate={item.rate}
                    year={item.year}
                    type={type === "movie" ? "movie" : ""}
                    isBangumi={type === "anime" && primarySelection === "每日放送"}
                  />
                </div>
              ))}
        </div>

        {hasMore && !loading && (
          <div
            ref={(el) => {
              if (el && el.offsetParent !== null) {
                (loadingRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }
            }}
            className="mt-12 flex justify-center py-8"
          >
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                <span>加载中...</span>
              </div>
            )}
          </div>
        )}

        {!hasMore && doubanData.length > 0 && (
          <div className="py-8 text-center text-muted-foreground">已加载全部内容</div>
        )}

        {!loading && doubanData.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">暂无相关内容</div>
        )}
      </div>
    </div>
  );
}
