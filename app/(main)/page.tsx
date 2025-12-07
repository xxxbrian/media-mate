import HomeClient from "./home-client";

import { BangumiCalendarData, normalizeBangumiData } from "@/lib/bangumi.client";
import { DoubanItem } from "@/lib/types";

const HOT_REVALIDATE_SECONDS = 1800;
const BANGUMI_REVALIDATE_SECONDS = 21600;

type DoubanResponse = {
  code?: number;
  list?: DoubanItem[];
};

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) return envUrl;
  // 回退到本地开发地址
  return "http://localhost:3000";
}

async function fetchDoubanCategory(
  baseUrl: string,
  kind: "movie" | "tv",
  category: string,
  type: string
): Promise<DoubanItem[]> {
  try {
    const url = new URL("/api/douban/categories", baseUrl);
    url.searchParams.set("kind", kind);
    url.searchParams.set("category", category);
    url.searchParams.set("type", type);
    url.searchParams.set("limit", "25");
    url.searchParams.set("start", "0");

    const res = await fetch(url.toString(), {
      next: { revalidate: HOT_REVALIDATE_SECONDS, tags: ["douban-hot"] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DoubanResponse;
    return data.list || [];
  } catch (err) {
    console.warn("预取豆瓣分类失败", err);
    return [];
  }
}

async function fetchBangumiCalendar(): Promise<BangumiCalendarData[]> {
  try {
    const res = await fetch("https://api.bgm.tv/calendar", {
      next: { revalidate: BANGUMI_REVALIDATE_SECONDS, tags: ["bangumi-calendar"] },
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeBangumiData(Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn("预取 Bangumi 放送失败", err);
    return [];
  }
}

export default async function Home() {
  const baseUrl = getBaseUrl();

  const [hotMovies, hotTvShows, hotVarietyShows, bangumiCalendarData] =
    await Promise.all([
      fetchDoubanCategory(baseUrl, "movie", "热门", "全部"),
      fetchDoubanCategory(baseUrl, "tv", "tv", "tv"),
      fetchDoubanCategory(baseUrl, "tv", "show", "show"),
      fetchBangumiCalendar(),
    ]);

  return (
    <HomeClient
      initialHotMovies={hotMovies}
      initialHotTvShows={hotTvShows}
      initialHotVarietyShows={hotVarietyShows}
      initialBangumi={bangumiCalendarData}
    />
  );
}
