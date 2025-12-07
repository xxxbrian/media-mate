/**
 * 通用的豆瓣数据获取函数
 * @param url 请求的URL
 * @returns Promise<T> 返回指定类型的数据
 */
export async function fetchDoubanData<T>(url: string): Promise<T> {
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  // 设置请求选项，包括信号和头部
  const fetchOptions = {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://movie.douban.com/',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://movie.douban.com',
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export type DoubanProxyType =
  | 'direct'
  | 'cors-proxy-zwei'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'cors-anywhere'
  | 'custom';

function normalizeCustomBase(custom?: string): string | null {
  if (!custom) return null;
  const trimmed = custom.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//.test(trimmed)) {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

function getBaseHost(
  proxyType: DoubanProxyType,
  useMovieHost: boolean,
  customBase?: string
): string | null {
  switch (proxyType) {
    case 'cmliussss-cdn-tencent':
      return useMovieHost
        ? 'https://movie.douban.cmliussss.net'
        : 'https://m.douban.cmliussss.net';
    case 'cmliussss-cdn-ali':
      return useMovieHost
        ? 'https://movie.douban.cmliussss.com'
        : 'https://m.douban.cmliussss.com';
    case 'custom':
      return normalizeCustomBase(customBase);
    case 'direct':
    case 'cors-proxy-zwei':
    case 'cors-anywhere':
    default:
      return useMovieHost
        ? 'https://movie.douban.com'
        : 'https://m.douban.com';
  }
}

export function buildDoubanUrlVariants(options: {
  path: string;
  useMovieHost?: boolean;
  proxyType?: DoubanProxyType;
  customProxy?: string;
}): string[] {
  const { path, useMovieHost = false, proxyType = 'direct', customProxy } =
    options;
  const priority: DoubanProxyType[] = [
    proxyType,
    'cmliussss-cdn-tencent',
    'cmliussss-cdn-ali',
    'direct',
  ];

  const seen = new Set<string>();
  const urls: string[] = [];

  priority.forEach((type) => {
    const base = getBaseHost(type, useMovieHost, customProxy);
    if (!base) return;
    const full = `${base}${path}`;
    if (!seen.has(full)) {
      seen.add(full);
      urls.push(full);
    }
  });

  return urls;
}

export async function fetchDoubanDataWithFallback<T>(
  urls: string[]
): Promise<T> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await fetchDoubanData<T>(url);
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error('All douban requests failed');
}
