import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 强制动态渲染，需要运行时请求头信息

function getBaseUrl(req: NextRequest): string {
  const envBase = (process.env.NEXT_PUBLIC_SITE_BASE || '')
    .trim()
    .replace(/\/$/, '');
  if (envBase) return envBase;
  const proto = (req.headers.get('x-forwarded-proto') || 'https')
    .split(',')[0]
    .trim();
  const host = (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    ''
  )
    .split(',')[0]
    .trim();
  if (!host) return '';
  return `${proto}://${host}`;
}

function isPrivateHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname;
    return (
      h === 'localhost' ||
      h === '0.0.0.0' ||
      h === '127.0.0.1' ||
      h.startsWith('10.') ||
      h.startsWith('172.16.') ||
      h.startsWith('172.17.') ||
      h.startsWith('172.18.') ||
      h.startsWith('172.19.') ||
      h.startsWith('172.2') || // 172.20-172.31 简化判断
      h.startsWith('192.168.')
    );
  } catch {
    return false;
  }
}

function extractSpiderUrl(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const semicolonIndex = trimmed.indexOf(';');
  if (semicolonIndex === -1) return trimmed;
  return trimmed.slice(0, semicolonIndex).trim();
}

async function tryFetchHead(
  url: string,
  timeoutMs = 3500
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    clearTimeout(timer);
    const message = e instanceof Error ? e.message : 'fetch error';
    return { ok: false, error: message };
  }
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = getBaseUrl(req);
    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: 'cannot determine base url' },
        { status: 500 }
      );
    }

    const configUrl = `${baseUrl}/api/tvbox/config?format=json&mode=safe`;
    const cfgRes = await fetch(configUrl, { cache: 'no-store' });
    const contentType = cfgRes.headers.get('content-type') || '';
    const text = await cfgRes.text();
    let parsedConfig: {
      sites?: Array<{ api?: string }>;
      lives?: unknown[];
      spider?: string;
      parses?: unknown[];
    } | null = null;
    let parseError: string | undefined;
    try {
      const parsedJson = JSON.parse(text) as unknown;
      if (parsedJson && typeof parsedJson === 'object') {
        const candidate = parsedJson as Record<string, unknown>;
        parsedConfig = {
          sites: Array.isArray(candidate.sites)
            ? (candidate.sites as Array<{ api?: string }>)
            : [],
          lives: Array.isArray(candidate.lives) ? candidate.lives : [],
          spider: typeof candidate.spider === 'string' ? candidate.spider : '',
          parses: Array.isArray(candidate.parses) ? candidate.parses : [],
        };
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'json parse error';
    }

    const result: {
      ok: boolean;
      status: number;
      contentType: string;
      size: number;
      baseUrl: string;
      configUrl: string;
      hasJson: boolean;
      issues: string[];
      sitesCount?: number;
      livesCount?: number;
      parsesCount?: number;
      privateApis?: number;
      spider?: string;
      spiderUrl?: string;
      spiderPrivate?: boolean;
      spiderReachable?: boolean;
      spiderStatus?: number;
      spiderError?: string;
      pass?: boolean;
    } = {
      ok: cfgRes.ok,
      status: cfgRes.status,
      contentType,
      size: text.length,
      baseUrl,
      configUrl,
      hasJson: !!parsedConfig,
      issues: [],
    };

    if (!cfgRes.ok) {
      result.issues.push(`config request failed: ${cfgRes.status}`);
    }
    if (!contentType.includes('text/plain')) {
      result.issues.push('content-type is not text/plain');
    }
    if (!parsedConfig) {
      result.issues.push(`json parse failed: ${parseError}`);
    }

    if (parsedConfig) {
      const sites = parsedConfig.sites || [];
      const lives = parsedConfig.lives || [];
      const spider = parsedConfig.spider || '';
      result.sitesCount = sites.length;
      result.livesCount = lives.length;
      result.parsesCount = parsedConfig.parses?.length ?? 0;

      // 检查私网地址
      const privateApis = sites.filter(
        (s) => typeof s?.api === 'string' && isPrivateHost(s.api as string)
      ).length;
      result.privateApis = privateApis;
      if (privateApis > 0) {
        result.issues.push(`found ${privateApis} private api urls`);
      }
      if (typeof spider === 'string' && spider) {
        const resolvedSpiderUrl = extractSpiderUrl(spider);
        result.spider = spider;
        result.spiderUrl = resolvedSpiderUrl;

        if (!resolvedSpiderUrl) {
          result.issues.push('spider 字段存在但未解析到有效地址');
        } else {
          result.spiderPrivate = isPrivateHost(resolvedSpiderUrl);
          if (result.spiderPrivate) {
            result.issues.push('spider url is private/not public');
          } else if (
            resolvedSpiderUrl.startsWith('http://') ||
            resolvedSpiderUrl.startsWith('https://')
          ) {
            const spiderCheck = await tryFetchHead(resolvedSpiderUrl, 5000);
            result.spiderReachable = spiderCheck.ok;
            result.spiderStatus = spiderCheck.status;

            if (!spiderCheck.ok) {
              // 优化错误提示，提供更详细的诊断信息
              if (spiderCheck.status === 404) {
                result.issues.push(
                  `spider 源文件不存在 (404) - 该 JAR 源可能已失效，建议使用 JAR 源诊断工具查找可用源`
                );
              } else if (spiderCheck.status === 403) {
                result.issues.push(
                  `spider 访问被拒绝 (403) - 该源可能需要代理访问或已限制访问`
                );
              } else if (spiderCheck.error?.includes('timeout')) {
                result.issues.push(
                  `spider 访问超时 - 网络延迟较高或源不可达，建议检查网络环境或更换源`
                );
              } else {
                result.issues.push(
                  `spider 不可用: ${
                    spiderCheck.status || spiderCheck.error
                  } - 建议使用 JAR 源诊断工具测试可用源`
                );
              }
            }
          }
        }
      }
    }

    // 最终状态
    result.pass =
      result.ok &&
      result.hasJson &&
      (!result.issues || result.issues.length === 0);
    return NextResponse.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e) {
    console.error('Diagnose failed', e);
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
