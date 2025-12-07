import { DoubanResult } from './types';

interface DoubanCategoriesParams {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanRecommendsParams {
  kind: 'tv' | 'movie';
  pageLimit?: number;
  pageStart?: number;
  category?: string;
  format?: string;
  label?: string;
  region?: string;
  year?: string;
  platform?: string;
  sort?: string;
}

async function fetchDoubanResult(url: string): Promise<DoubanResult> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `豆瓣数据获取失败: ${response.status} ${response.statusText} ${text}`
    );
  }
  return (await response.json()) as DoubanResult;
}

export async function getDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
  const search = new URLSearchParams({
    kind,
    category,
    type,
    limit: pageLimit.toString(),
    start: pageStart.toString(),
  });
  return fetchDoubanResult(`/api/douban/categories?${search.toString()}`);
}

export async function getDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  const search = new URLSearchParams({
    tag,
    type,
    pageSize: pageLimit.toString(),
    pageStart: pageStart.toString(),
  });
  return fetchDoubanResult(`/api/douban?${search.toString()}`);
}

export async function getDoubanRecommends(
  params: DoubanRecommendsParams
): Promise<DoubanResult> {
  const {
    kind,
    pageLimit = 20,
    pageStart = 0,
    category,
    format,
    label,
    region,
    year,
    platform,
    sort,
  } = params;
  const search = new URLSearchParams({
    kind,
    limit: pageLimit.toString(),
    start: pageStart.toString(),
  });
  if (category) search.set('category', category);
  if (format) search.set('format', format);
  if (label) search.set('label', label);
  if (region) search.set('region', region);
  if (year) search.set('year', year);
  if (platform) search.set('platform', platform);
  if (sort) search.set('sort', sort);

  return fetchDoubanResult(`/api/douban/recommends?${search.toString()}`);
}
