/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
"use client";

import { ChevronUp, Search as SearchIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  Suspense,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from "@/lib/db.client";
import { SearchResult } from "@/lib/types";

import SearchResultFilter, {
  FilterValueMap,
  SearchFilterCategory,
} from "@/components/search-result-filter";
import SearchSuggestions from "@/components/search-suggestions";
import VideoCard, { VideoCardHandle } from "@/components/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";

function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [normalizedQuery, setNormalizedQuery] = useState("");
  const currentQueryRef = useRef<string>("");

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const [totalSources, setTotalSources] = useState(0);
  const [completedSources, setCompletedSources] = useState(0);
  const [useFluidSearch, setUseFluidSearch] = useState(true);

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [filterAll, setFilterAll] = useState<FilterValueMap>({
    source: "all",
    title: "all",
    year: "all",
    yearOrder: "none",
  });

  const [filterAgg, setFilterAgg] = useState<FilterValueMap>({
    source: "all",
    title: "all",
    year: "all",
    yearOrder: "none",
  });

  const getDefaultAggregate = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("defaultAggregateSearch");
      if (saved !== null) return JSON.parse(saved);
    }
    return true;
  };

  const [viewMode, setViewMode] = useState<"agg" | "all">(
    getDefaultAggregate() ? "agg" : "all"
  );

  type VideoCardRef = React.RefObject<VideoCardHandle>;

  const groupRefs = useRef<Map<string, VideoCardRef>>(new Map());
  const groupStatsRef = useRef<
    Map<
      string,
      { douban_id?: number; episodes?: number; source_names: string[] }
    >
  >(new Map());

  const getGroupRef = (key: string): VideoCardRef => {
    const existing = groupRefs.current.get(key);
    if (existing) return existing;

    const created = React.createRef<VideoCardHandle>() as VideoCardRef;
    groupRefs.current.set(key, created);
    return created;
  };

  const computeGroupStats = (group: SearchResult[]) => {
    const episodes = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        const len = g.episodes?.length || 0;
        if (len > 0) countMap.set(len, (countMap.get(len) || 0) + 1);
      });
      let max = 0;
      let res = 0;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();

    const source_names = Array.from(
      new Set(group.map((g) => g.source_name).filter(Boolean))
    ) as string[];

    const douban_id = (() => {
      const countMap = new Map<number, number>();
      group.forEach((g) => {
        if (g.douban_id && g.douban_id > 0) {
          countMap.set(g.douban_id, (countMap.get(g.douban_id) || 0) + 1);
        }
      });
      let max = 0;
      let res: number | undefined;
      countMap.forEach((v, k) => {
        if (v > max) {
          max = v;
          res = k;
        }
      });
      return res;
    })();

    return { episodes, source_names, douban_id };
  };

  const compareYear = (
    aYear: string,
    bYear: string,
    order: "none" | "asc" | "desc"
  ) => {
    if (order === "none") return 0;

    const aEmpty = !aYear || aYear === "unknown";
    const bEmpty = !bYear || bYear === "unknown";

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const aNum = parseInt(aYear, 10);
    const bNum = parseInt(bYear, 10);

    return order === "asc" ? aNum - bNum : bNum - aNum;
  };

  const aggregatedResults = useMemo(() => {
    const query = currentQueryRef.current.trim().toLowerCase();
    const queryNoSpace = query.replace(/\s+/g, "");
    const normQuery = normalizedQuery
      ? normalizedQuery.trim().toLowerCase()
      : query;
    const normQueryNoSpace = normQuery.replace(/\s+/g, "");

    const relevantResults = searchResults.filter((item) => {
      const title = item.title.toLowerCase();
      const titleNoSpace = title.replace(/\s+/g, "");

      if (
        title.includes(query) ||
        titleNoSpace.includes(queryNoSpace) ||
        title.includes(normQuery) ||
        titleNoSpace.includes(normQueryNoSpace)
      ) {
        return true;
      }

      let queryIndex = 0;
      for (let i = 0; i < titleNoSpace.length && queryIndex < queryNoSpace.length; i++) {
        if (titleNoSpace[i] === queryNoSpace[queryIndex]) queryIndex++;
      }
      if (queryIndex === queryNoSpace.length) return true;

      if (normQuery !== query) {
        let normIndex = 0;
        for (
          let i = 0;
          i < titleNoSpace.length && normIndex < normQueryNoSpace.length;
          i++
        ) {
          if (titleNoSpace[i] === normQueryNoSpace[normIndex]) normIndex++;
        }
        if (normIndex === normQueryNoSpace.length) return true;
      }
      return false;
    });

    const map = new Map<string, SearchResult[]>();
    const keyOrder: string[] = [];

    relevantResults.forEach((item) => {
      const key = `${item.title.replaceAll(" ", "")}-${item.year || "unknown"}-${
        item.episodes.length === 1 ? "movie" : "tv"
      }`;
      const arr = map.get(key) || [];
      if (arr.length === 0) keyOrder.push(key);
      arr.push(item);
      map.set(key, arr);
    });

    return keyOrder.map((key) => [key, map.get(key)!] as [string, SearchResult[]]);
  }, [searchResults, normalizedQuery]);

  useEffect(() => {
    aggregatedResults.forEach(([mapKey, group]) => {
      const stats = computeGroupStats(group);
      const prev = groupStatsRef.current.get(mapKey);
      if (!prev) {
        groupStatsRef.current.set(mapKey, stats);
        return;
      }
      const ref = groupRefs.current.get(mapKey);
      if (ref && ref.current) {
        if (prev.episodes !== stats.episodes) {
          ref.current.setEpisodes(stats.episodes);
        }
        if ((prev.source_names || []).join("|") !== (stats.source_names || []).join("|")) {
          ref.current.setSourceNames(stats.source_names);
        }
        if (prev.douban_id !== stats.douban_id) {
          ref.current.setDoubanId(stats.douban_id);
        }
        groupStatsRef.current.set(mapKey, stats);
      }
    });
  }, [aggregatedResults]);

  const filterOptions = useMemo(() => {
    const sourcesSet = new Map<string, string>();
    const titlesSet = new Set<string>();
    const yearsSet = new Set<string>();

    searchResults.forEach((item) => {
      if (item.source && item.source_name) {
        sourcesSet.set(item.source, item.source_name);
      }
      if (item.title) titlesSet.add(item.title);
      if (item.year) yearsSet.add(item.year);
    });

    const sourceOptions = [
      { label: "全部来源", value: "all" },
      ...Array.from(sourcesSet.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ label, value })),
    ];

    const titleOptions = [
      { label: "全部标题", value: "all" },
      ...Array.from(titlesSet.values())
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({ label: t, value: t })),
    ];

    const years = Array.from(yearsSet.values());
    const knownYears = years
      .filter((y) => y !== "unknown")
      .sort((a, b) => parseInt(b) - parseInt(a));
    const hasUnknown = years.includes("unknown");
    const yearOptions = [
      { label: "全部年份", value: "all" },
      ...knownYears.map((y) => ({ label: y, value: y })),
      ...(hasUnknown ? [{ label: "未知", value: "unknown" }] : []),
    ];

    const categoriesAll: SearchFilterCategory[] = [
      { key: "source", label: "来源", options: sourceOptions },
      { key: "title", label: "标题", options: titleOptions },
      { key: "year", label: "年份", options: yearOptions },
    ];

    const categoriesAgg: SearchFilterCategory[] = [
      { key: "source", label: "来源", options: sourceOptions },
      { key: "title", label: "标题", options: titleOptions },
      { key: "year", label: "年份", options: yearOptions },
    ];

    return { categoriesAll, categoriesAgg };
  }, [searchResults]);

  const filteredAllResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAll;
    const filtered = searchResults.filter((item) => {
      if (source !== "all" && item.source !== source) return false;
      if (title !== "all" && item.title !== title) return false;
      if (year !== "all" && item.year !== year) return false;
      return true;
    });

    if (yearOrder === "none") return filtered;

    return filtered.sort((a, b) => {
      const yearComp = compareYear(a.year, b.year, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExact = a.title === searchQuery.trim();
      const bExact = b.title === searchQuery.trim();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      return yearOrder === "asc"
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });
  }, [searchResults, filterAll, searchQuery]);

  const filteredAggResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAgg;
    const filtered = aggregatedResults.filter(([, group]) => {
      const gTitle = group[0]?.title ?? "";
      const gYear = group[0]?.year ?? "unknown";
      const hasSource =
        source === "all" ? true : group.some((item) => item.source === source);
      if (!hasSource) return false;
      if (title !== "all" && gTitle !== title) return false;
      if (year !== "all" && gYear !== year) return false;
      return true;
    });

    if (yearOrder === "none") return filtered;

    return filtered.sort((a, b) => {
      const aYear = a[1][0].year;
      const bYear = b[1][0].year;
      const yearComp = compareYear(aYear, bYear, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExact = a[1][0].title === searchQuery.trim();
      const bExact = b[1][0].title === searchQuery.trim();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aTitle = a[1][0].title;
      const bTitle = b[1][0].title;
      return yearOrder === "asc"
        ? aTitle.localeCompare(bTitle)
        : bTitle.localeCompare(aTitle);
    });
  }, [aggregatedResults, filterAgg, searchQuery]);

  useEffect(() => {
    if (!searchParams.get("q")) inputRef.current?.focus();
    getSearchHistory().then(setSearchHistory);

    if (typeof window !== "undefined") {
      const savedFluid = localStorage.getItem("fluidSearch");
      const defaultFluid =
        (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
      if (savedFluid !== null) {
        setUseFluidSearch(JSON.parse(savedFluid));
      } else if (defaultFluid !== undefined) {
        setUseFluidSearch(defaultFluid);
      }
    }

    const unsubscribe = subscribeToDataUpdates(
      "searchHistoryUpdated",
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      unsubscribe();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    currentQueryRef.current = query.trim();

    if (!query) {
      setShowResults(false);
      setShowSuggestions(false);
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    setSearchQuery(query);
    setNormalizedQuery("");

    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }
    setSearchResults([]);
    setTotalSources(0);
    setCompletedSources(0);
    pendingResultsRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setIsLoading(true);
    setShowResults(true);

    const trimmed = query.trim();

    let currentFluid = useFluidSearch;
    if (typeof window !== "undefined") {
      const savedFluidSearch = localStorage.getItem("fluidSearch");
      if (savedFluidSearch !== null) {
        currentFluid = JSON.parse(savedFluidSearch);
      } else {
        const defaultFluid =
          (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
        currentFluid = defaultFluid;
      }
    }
    if (currentFluid !== useFluidSearch) {
      setUseFluidSearch(currentFluid);
    }

    if (currentFluid) {
      const es = new EventSource(`/api/search/ws?q=${encodeURIComponent(trimmed)}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (currentQueryRef.current !== trimmed) return;
          switch (payload.type) {
            case "start":
              setTotalSources(payload.totalSources || 0);
              if (payload.normalizedQuery) setNormalizedQuery(payload.normalizedQuery);
              setCompletedSources(0);
              break;
            case "source_result": {
              setCompletedSources((prev) => prev + 1);
              if (Array.isArray(payload.results) && payload.results.length > 0) {
                const incoming: SearchResult[] = payload.results as SearchResult[];
                pendingResultsRef.current.push(...incoming);
                if (!flushTimerRef.current) {
                  flushTimerRef.current = window.setTimeout(() => {
                    const toAppend = pendingResultsRef.current;
                    pendingResultsRef.current = [];
                    startTransition(() => {
                      setSearchResults((prev) => prev.concat(toAppend));
                    });
                    flushTimerRef.current = null;
                  }, 80);
                }
              }
              break;
            }
            case "source_error":
              setCompletedSources((prev) => prev + 1);
              break;
            case "complete":
              setCompletedSources(payload.completedSources || totalSources);
              if (pendingResultsRef.current.length > 0) {
                const toAppend = pendingResultsRef.current;
                pendingResultsRef.current = [];
                if (flushTimerRef.current) {
                  clearTimeout(flushTimerRef.current);
                  flushTimerRef.current = null;
                }
                startTransition(() => {
                  setSearchResults((prev) => prev.concat(toAppend));
                });
              }
              setIsLoading(false);
              try {
                es.close();
              } catch {}
              if (eventSourceRef.current === es) {
                eventSourceRef.current = null;
              }
              break;
          }
        } catch {}
      };

      es.onerror = () => {
        setIsLoading(false);
        if (pendingResultsRef.current.length > 0) {
          const toAppend = pendingResultsRef.current;
          pendingResultsRef.current = [];
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          startTransition(() => {
            setSearchResults((prev) => prev.concat(toAppend));
          });
        }
        try {
          es.close();
        } catch {}
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
      };
    } else {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json())
        .then((data) => {
          if (currentQueryRef.current !== trimmed) return;
          if (data.normalizedQuery) setNormalizedQuery(data.normalizedQuery);
          if (data.results && Array.isArray(data.results)) {
            const results: SearchResult[] = data.results as SearchResult[];
            setSearchResults(results);
            setTotalSources(1);
            setCompletedSources(1);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }

    setShowSuggestions(false);
    addSearchHistory(query);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingResultsRef.current = [];
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(Boolean(value.trim()));
  };

  const handleInputFocus = () => {
    if (searchQuery.trim()) setShowSuggestions(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setIsLoading(true);
    setShowResults(true);
    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              <span>正在搜索...</span>
            </div>
          ) : (
            "未找到相关结果"
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {viewMode === "agg"
          ? filteredAggResults.map(([mapKey, group]) => {
              const title = group[0]?.title || "";
              const poster = group[0]?.poster || "";
              const year = group[0]?.year || "unknown";
              const { episodes, source_names, douban_id } = computeGroupStats(group);
              const type = episodes === 1 ? "movie" : "tv";

              if (!groupStatsRef.current.has(mapKey)) {
                groupStatsRef.current.set(mapKey, {
                  episodes,
                  source_names,
                  douban_id,
                });
              }

              return (
                <VideoCard
                  key={`agg-${mapKey}`}
                  ref={getGroupRef(mapKey)}
                  from="search"
                  isAggregate
                  title={title}
                  poster={poster}
                  year={year}
                  episodes={episodes}
                  source_names={source_names}
                  douban_id={douban_id}
                  query={searchQuery.trim() !== title ? searchQuery.trim() : ""}
                  type={type}
                />
              );
            })
          : filteredAllResults.map((item) => (
              <VideoCard
                key={`all-${item.source}-${item.id}`}
                id={item.id}
                title={item.title}
                poster={item.poster}
                episodes={item.episodes.length}
                source={item.source}
                source_name={item.source_name}
                douban_id={item.douban_id}
                query={
                  searchQuery.trim() !== item.title ? searchQuery.trim() : ""
                }
                year={item.year}
                from="search"
                type={item.episodes.length > 1 ? "tv" : "movie"}
              />
            ))}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Card className="gap-3">
          <CardHeader className="">
            <CardTitle className="text-lg font-semibold">搜索</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearch} className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="searchInput"
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder="搜索电影、电视剧..."
                autoComplete="off"
                className="h-12 pl-10 pr-12"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => {
                    setSearchQuery("");
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  aria-label="清除搜索内容"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
                onEnterKey={() => {
                  const trimmed = searchQuery.trim().replace(/\s+/g, " ");
                  if (!trimmed) return;
                  setSearchQuery(trimmed);
                  setIsLoading(true);
                  setShowResults(true);
                  setShowSuggestions(false);
                  router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                }}
              />
            </form>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {normalizedQuery && (
                  <Badge variant="secondary">
                    已为你使用“{normalizedQuery}”
                  </Badge>
                )}
                {useFluidSearch && totalSources > 0 && (
                  <span>
                    {completedSources}/{totalSources} 源完成
                  </span>
                )}
              </div>
              {isLoading && (
                <div className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>搜索中</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {showResults ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  搜索结果
                </CardTitle>
                {useFluidSearch && totalSources > 0 && (
                  <p className="text-xs text-muted-foreground">
                    已完成 {completedSources}/{totalSources}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>聚合</span>
                <Switch
                  checked={viewMode === "agg"}
                  onCheckedChange={(checked) => setViewMode(checked ? "agg" : "all")}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchResultFilter
                categories={
                  viewMode === "agg"
                    ? filterOptions.categoriesAgg
                    : filterOptions.categoriesAll
                }
                values={viewMode === "agg" ? filterAgg : filterAll}
                onChange={(v) =>
                  viewMode === "agg"
                    ? setFilterAgg(v)
                    : setFilterAll(v)
                }
              />
              {renderResults()}
            </CardContent>
          </Card>
        ) : searchHistory.length > 0 ? (
          <Card className="gap-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                搜索历史
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                disabled={searchHistory.length === 0}
                onClick={() => clearSearchHistory()}
              >
                清空
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((item) => (
                  <div key={item} className="relative">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="pr-8"
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(`/search?q=${encodeURIComponent(item.trim())}`);
                      }}
                    >
                      {item}
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="absolute -right-1.5 -top-1.5 "
                      aria-label="删除搜索历史"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSearchHistory(item);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Button
        onClick={scrollToTop}
        size="icon"
        className={`fixed bottom-24 right-5 z-50 rounded-full shadow-lg transition-all duration-200 md:bottom-8 ${
          showBackToTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        }`}
        aria-label="返回顶部"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中...</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
