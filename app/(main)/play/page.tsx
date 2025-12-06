/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, @next/next/no-img-element */

'use client';

import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { AlertCircle, Clock3, Heart, PlayCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';
import { toast } from 'sonner';

import EpisodeSelector from '@/components/play-episode-selector';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

// Wake Lock API 类型声明
interface WakeLockSentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

type LoadingStage = 'searching' | 'preferring' | 'fetching' | 'ready';

interface SkipConfig {
  enable: boolean;
  intro_time: number;
  outro_time: number;
}

/**
 * 通用时间格式化
 */
const formatTime = (seconds: number): string => {
  if (seconds === 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  } else {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

/**
 * 过滤 m3u8 中的广告（目前只去掉 DISCONTINUITY 标记）
 */
function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';

  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 仅过滤 #EXT-X-DISCONTINUITY
    if (!line.includes('#EXT-X-DISCONTINUITY')) {
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

/**
 * Loading 视图组件（用 shadcn Card 包一层）
 */
function LoadingScreen({
  stage,
  message,
}: {
  stage: LoadingStage;
  message: string;
}) {
  const progress =
    stage === 'searching' || stage === 'fetching'
      ? 33
      : stage === 'preferring'
      ? 66
      : 100;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex items-center gap-3 rounded-full bg-primary/10 px-4 py-2 text-primary">
            <Spinner className="h-5 w-5" />
            <span className="text-sm font-medium">
              {stage === 'searching'
                ? '正在搜索播放源'
                : stage === 'preferring'
                ? '正在优选播放源'
                : stage === 'fetching'
                ? '正在获取详情'
                : '准备就绪'}
            </span>
          </div>
          <div className="w-full space-y-3">
            <p className="text-lg font-semibold leading-tight">{message}</p>
            <Progress value={progress} />
          </div>
          <p className="text-sm text-muted-foreground">
            请保持页面打开，我们很快就会开始播放。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error 视图组件
 */
function ErrorScreen({
  error,
  videoTitle,
  onBack,
  onRetry,
}: {
  error: string;
  videoTitle?: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col gap-6 p-8">
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              播放出现问题
            </AlertTitle>
            <AlertDescription className="mt-2 text-sm leading-relaxed">
              {error}
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground">
            请检查网络连接或稍后再试。
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={onBack}>
              {videoTitle ? '返回搜索' : '返回上一页'}
            </Button>
            <Button onClick={onRetry}>重新尝试</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * ArtPlayer 自定义 Loader：去广告
 */
class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  constructor(config: any) {
    super(config);
    const load = this.load.bind(this);
    this.load = function (context: any, config: any, callbacks: any) {
      if ((context as any).type === 'manifest' || (context as any).type === 'level') {
        const onSuccess = callbacks.onSuccess;
        callbacks.onSuccess = function (response: any, stats: any, ctx: any) {
          if (response.data && typeof response.data === 'string') {
            response.data = filterAdsFromM3U8(response.data);
          }
          return onSuccess(response, stats, ctx, null);
        };
      }
      load(context, config, callbacks);
    };
  }
}

// FavoriteIcon 组件
const FavoriteIcon = ({ filled }: { filled: boolean }) => (
  <Heart
    className="h-5 w-5"
    strokeWidth={filled ? 2.5 : 1.5}
    fill={filled ? 'currentColor' : 'none'}
  />
);

function SkipConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SkipConfig;
  onSave: (cfg: SkipConfig) => Promise<void> | void;
  onClear: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<SkipConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handleIntroChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setDraft((prev) => ({ ...prev, intro_time: Math.max(0, parsed) }));
  };

  const handleOutroChange = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setDraft((prev) => ({
      ...prev,
      outro_time: parsed > 0 ? -parsed : 0,
    }));
  };

  const handleSubmit = async () => {
    await onSave(draft);
    onOpenChange(false);
  };

  const handleReset = async () => {
    await onClear();
    onOpenChange(false);
  };

  const outroDisplay = draft.outro_time < 0 ? -draft.outro_time : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>跳过片头片尾</DialogTitle>
          <DialogDescription>
            设置播放时自动跳过的时间点。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">启用自动跳过</p>
              <p className="text-xs text-muted-foreground">
                播放时自动跳过设定的片头与片尾。
              </p>
            </div>
            <Switch
              checked={draft.enable}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, enable: checked }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intro-time">片头秒数</Label>
              <Input
                id="intro-time"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.intro_time}
                onChange={(e) => handleIntroChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                从开头起需要跳过的秒数。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outro-time">片尾提前秒数</Label>
              <Input
                id="outro-time"
                type="number"
                min={0}
                inputMode="numeric"
                value={outroDisplay}
                onChange={(e) => handleOutroChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                距离结束前自动跳过的秒数。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:space-x-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            清除
          </Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('searching');
  const [loadingMessage, setLoadingMessage] =
    useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // 收藏
  const [favorited, setFavorited] = useState(false);

  // 跳过片头片尾
  const [skipConfig, setSkipConfig] = useState<SkipConfig>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [skipConfig, skipConfig.enable, skipConfig.intro_time, skipConfig.outro_time]);

  const lastSkipCheckRef = useRef(0);

  // 去广告开关
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [videoDoubanId, setVideoDoubanId] = useState(0);

  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || ''
  );
  const [currentId, setCurrentId] = useState(
    searchParams.get('id') || ''
  );

  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [currentSource, currentId, detail, currentEpisodeIndex, videoTitle, videoYear]);

  const [videoUrl, setVideoUrl] = useState('');

  const totalEpisodes = detail?.episodes?.length || 0;

  const resumeTimeRef = useRef<number | null>(null);
  const lastVolumeRef = useRef<number>(0.7);
  const lastPlaybackRateRef = useRef<number>(1.0);

  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(null);

  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  const [isSkipConfigPanelOpen, setIsSkipConfigPanelOpen] = useState(false);

  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（评分 / 优选 / 播放源等）
  // -----------------------------------------------------------------------------
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number
  ): number => {
    let score = 0;

    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.4;

    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.4;

    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0;

      if (maxPing === minPing) return 100;

      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.2;

    return Math.round(score * 100) / 100;
  };

  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    const batchSize = Math.ceil(sources.length / 2);
    const allResults: Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    } | null> = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          try {
            if (!source.episodes || source.episodes.length === 0) {
              console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
              return null;
            }

            const episodeUrl =
              source.episodes.length > 1
                ? source.episodes[1]
                : source.episodes[0];

            const testResult = await getVideoResolutionFromM3u8(episodeUrl);
            return { source, testResult };
          } catch {
            return null;
          }
        })
      );
      allResults.push(...batchResults);
    }

    const newVideoInfoMap = new Map<
      string,
      { quality: string; loadSpeed: string; pingTime: number; hasError?: boolean }
    >();

    allResults.forEach((result, index) => {
      const source = sources[index];
      const sourceKey = `${source.source}-${source.id}`;
      if (result) {
        newVideoInfoMap.set(sourceKey, result.testResult);
      }
    });

    const successfulResults = allResults.filter(Boolean) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      console.warn('所有播放源测速都失败，使用第一个播放源');
      return sources[0];
    }

    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value;
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing
      ),
    }));

    resultsWithScore.sort((a, b) => b.score - a.score);

    console.log('播放源评分排序结果:');
    resultsWithScore.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.source.source_name} - 评分: ${result.score.toFixed(
          2
        )} (${result.testResult.quality}, ${result.testResult.loadSpeed}, ${
          result.testResult.pingTime
        }ms)`
      );
    });

    return resultsWithScore[0].source;
  };

  const updateVideoUrl = (detailData: SearchResult | null, episodeIndex: number) => {
    if (!detailData || !detailData.episodes || episodeIndex >= detailData.episodes.length) {
      setVideoUrl('');
      return;
    }
    const newUrl = detailData.episodes[episodeIndex] || '';
    if (newUrl !== videoUrl) {
      setVideoUrl(newUrl);
    }
  };

  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    video.disableRemotePlayback = false;
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock 已启用');
      }
    } catch (err) {
      console.warn('Wake Lock 请求失败:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock 已释放');
      }
    } catch (err) {
      console.warn('Wake Lock 释放失败:', err);
    }
  };

  const cleanupPlayer = () => {
    if (artPlayerRef.current) {
      try {
        if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
          artPlayerRef.current.video.hls.destroy();
        }
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
        console.log('播放器资源已清理');
      } catch (err) {
        console.warn('清理播放器资源时出错:', err);
        artPlayerRef.current = null;
      }
    }
  };

  // 跳过片头片尾配置
  const handleSkipConfigChange = async (newConfig: SkipConfig) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;

    try {
      setSkipConfig(newConfig);

      const storageKey = `skip_config_${currentSourceRef.current}_${currentIdRef.current}`;
      localStorage.setItem(storageKey, JSON.stringify(newConfig));

      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);
        localStorage.removeItem(storageKey);
        toast.info('已清除跳过设置');

        // 更新 ArtPlayer 设置面板展示
        if (artPlayerRef.current) {
          artPlayerRef.current.setting.update({
            name: '跳过片头片尾',
            html: '跳过片头片尾',
            switch: skipConfigRef.current.enable,
            onSwitch: function (item: any) {
              const updated = { ...skipConfigRef.current, enable: !item.switch };
              handleSkipConfigChange(updated);
              return !item.switch;
            },
          });
        }
      } else {
        await saveSkipConfig(
          currentSourceRef.current,
          currentIdRef.current,
          newConfig
        );

        const introText =
          newConfig.intro_time > 0 ? `片头: ${formatTime(newConfig.intro_time)}` : '';
        const outroText =
          newConfig.outro_time < 0
            ? `片尾: 提前 ${formatTime(Math.abs(newConfig.outro_time))}`
            : '';
        const separator = introText && outroText ? '\n' : '';
        const message = newConfig.enable
          ? `跳过设置已保存\n${introText}${separator}${outroText}`
          : '跳过功能已关闭';

        toast.success(message);
      }

      console.log('跳过片头片尾配置已保存:', newConfig);
    } catch (err) {
      console.error('保存跳过片头片尾配置失败:', err);
      toast.error('保存失败，请重试');
    }
  };

  // ---------------------------------------------------------------------------
  // 监听集数变更：更新播放地址
  // ---------------------------------------------------------------------------
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // ---------------------------------------------------------------------------
  // 初始化：搜索 / 获取详情 / 优选源
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(`/api/detail?source=${source}&id=${id}`);
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();
        const results = data.results.filter(
          (result: SearchResult) =>
            result.title.replaceAll(' ', '').toLowerCase() ===
              videoTitleRef.current.replaceAll(' ', '').toLowerCase() &&
            (videoYearRef.current
              ? result.year.toLowerCase() === videoYearRef.current.toLowerCase()
              : true) &&
            (searchType
              ? (searchType === 'tv' && result.episodes.length > 1) ||
                (searchType === 'movie' && result.episodes.length === 1)
              : true)
        );
        setAvailableSources(results);
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (source) => source.source === currentSource && source.id === currentId
        )
      ) {
        sourcesInfo = await fetchSourceDetail(currentSource, currentId);
      }

      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];

      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');
        detailData = await preferBestSource(sourcesInfo);
      }

      console.log(detailData.source, detailData.id);

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setVideoDoubanId(detailData.douban_id || 0);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  }, []);

  // ---------------------------------------------------------------------------
  // 播放记录：初始化
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;
      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // ---------------------------------------------------------------------------
  // 跳过配置：初始化
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;

      try {
        const storageKey = `skip_config_${currentSource}_${currentId}`;
        const localConfig = localStorage.getItem(storageKey);

        if (localConfig) {
          const config = JSON.parse(localConfig);
          setSkipConfig(config);
          console.log('从 localStorage 恢复跳过配置:', config);
        } else {
          const config = await getSkipConfig(currentSource, currentId);
          if (config) {
            setSkipConfig(config);
            localStorage.setItem(storageKey, JSON.stringify(config));
          }
        }
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, [currentSource, currentId]);

  // ---------------------------------------------------------------------------
  // 换源
  // ---------------------------------------------------------------------------
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(currentSourceRef.current, currentIdRef.current);
          console.log('已清除前一个播放记录');
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      const newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      let targetIndex = currentEpisodeIndex;
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setVideoDoubanId(newDetail.douban_id || 0);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      if (artPlayerRef.current && artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(episodeNumber);
    }
  };

  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    if (!e.altKey && e.key === 'ArrowLeft') {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    if (!e.altKey && e.key === 'ArrowRight') {
      if (
        artPlayerRef.current &&
        artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
      ) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    if (e.key === 'ArrowUp') {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100
        )}`;
        e.preventDefault();
      }
    }

    if (e.key === 'ArrowDown') {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100
        )}`;
        e.preventDefault();
      }
    }

    if (e.key === ' ') {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    if (e.key === 'f' || e.key === 'F') {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 播放记录保存
  // ---------------------------------------------------------------------------
  const saveCurrentPlayProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1,
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });

      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
      releaseWakeLock();
      cleanupPlayer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
        releaseWakeLock();
      } else if (document.visibilityState === 'visible') {
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, artPlayerRef.current]);

  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      }
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // ArtPlayer 初始化
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      !Artplayer ||
      !Hls ||
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current
    ) {
      return;
    }

    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }

    const isWebkit =
      typeof window !== 'undefined' &&
      typeof (window as any).webkitConvertPointFromNodeToPage === 'function';

    if (!isWebkit && artPlayerRef.current) {
      artPlayerRef.current.switch = videoUrl;
      artPlayerRef.current.title = `${videoTitle} - 第${currentEpisodeIndex + 1}集`;
      artPlayerRef.current.poster = videoCover;
      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl
        );
      }
      return;
    }

    if (artPlayerRef.current) {
      cleanupPlayer();
    }

    try {
      Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
      Artplayer.USE_RAF = true;

      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: videoUrl,
        poster: videoCover,
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: false,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: false,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: '#22c55e',
        lang: 'zh-cn',
        hotkey: false,
        fastForward: true,
        autoOrientation: true,
        lock: true,
        moreVideoAttr: {
          crossOrigin: 'anonymous',
        },
        customType: {
          m3u8: (video: HTMLVideoElement, url: string) => {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

            if (video.hls) {
              video.hls.destroy();
            }
            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
              loader: blockAdEnabledRef.current
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            ensureVideoSource(video, url);

            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
              console.error('HLS Error:', event, data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误，尝试恢复...');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('无法恢复的错误');
                    hls.destroy();
                    break;
                }
              }
            });
          },
        },
        icons: {
          loading:
            '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
        },
        settings: [
          {
            html: '去广告',
            icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
            tooltip: blockAdEnabled ? '已开启' : '已关闭',
            onClick: () => {
              const newVal = !blockAdEnabled;
              try {
                localStorage.setItem('enable_blockad', String(newVal));
                if (artPlayerRef.current) {
                  resumeTimeRef.current = artPlayerRef.current.currentTime;
                  if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
                    artPlayerRef.current.video.hls.destroy();
                  }
                  artPlayerRef.current.destroy();
                  artPlayerRef.current = null;
                }
                setBlockAdEnabled(newVal);
              } catch {
                // ignore
              }
              return newVal ? '当前开启' : '当前关闭';
            },
          },
          {
            name: '跳过片头片尾',
            html: '跳过片头片尾',
            switch: skipConfigRef.current.enable,
            onSwitch(item: any) {
              const newConfig = {
                ...skipConfigRef.current,
                enable: !item.switch,
              };
              handleSkipConfigChange(newConfig);
              return !item.switch;
            },
          },
          {
            html: '删除跳过配置',
            onClick() {
              handleSkipConfigChange({
                enable: false,
                intro_time: 0,
                outro_time: 0,
              });
              return '';
            },
          },
          {
            name: '设置片头',
            html: '设置片头',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
            tooltip:
              skipConfigRef.current.intro_time === 0
                ? '设置片头时间'
                : `${formatTime(skipConfigRef.current.intro_time)}`,
            onClick() {
              const currentTime = artPlayerRef.current?.currentTime || 0;
              if (currentTime > 0) {
                const newConfig = {
                  ...skipConfigRef.current,
                  intro_time: currentTime,
                };
                handleSkipConfigChange(newConfig);
                return `${formatTime(currentTime)}`;
              }
            },
          },
          {
            name: '设置片尾',
            html: '设置片尾',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
            tooltip:
              skipConfigRef.current.outro_time >= 0
                ? '设置片尾时间'
                : `-${formatTime(-skipConfigRef.current.outro_time)}`,
            onClick() {
              const outroTime =
                -(
                  artPlayerRef.current?.duration -
                  artPlayerRef.current?.currentTime
                ) || 0;
              if (outroTime < 0) {
                const newConfig = {
                  ...skipConfigRef.current,
                  outro_time: outroTime,
                };
                handleSkipConfigChange(newConfig);
                return `-${formatTime(-outroTime)}`;
              }
            },
          },
        ],
        controls: [
          {
            position: 'left',
            index: 13,
            html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
            tooltip: '播放下一集',
            click: () => {
              handleNextEpisode();
            },
          },
        ],
      });

      artPlayerRef.current.on('ready', () => {
        setError(null);
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }
      });

      artPlayerRef.current.on('play', () => {
        requestWakeLock();
      });

      artPlayerRef.current.on('pause', () => {
        releaseWakeLock();
        saveCurrentPlayProgress();
      });

      artPlayerRef.current.on('video:ended', () => {
        releaseWakeLock();
      });

      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        requestWakeLock();
      }

      artPlayerRef.current.on('video:volumechange', () => {
        lastVolumeRef.current = artPlayerRef.current.volume;
      });
      artPlayerRef.current.on('video:ratechange', () => {
        lastPlaybackRateRef.current = artPlayerRef.current.playbackRate;
      });

      artPlayerRef.current.on('video:canplay', () => {
        if (resumeTimeRef.current && resumeTimeRef.current > 0) {
          try {
            const duration = artPlayerRef.current.duration || 0;
            let target = resumeTimeRef.current;
            if (duration && target >= duration - 2) {
              target = Math.max(0, duration - 5);
            }
            artPlayerRef.current.currentTime = target;
            console.log('成功恢复播放进度到:', resumeTimeRef.current);
          } catch (err) {
            console.warn('恢复播放进度失败:', err);
          }
        }
        resumeTimeRef.current = null;

        setTimeout(() => {
          if (
            Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01
          ) {
            artPlayerRef.current.volume = lastVolumeRef.current;
          }
          if (
            Math.abs(
              artPlayerRef.current.playbackRate - lastPlaybackRateRef.current
            ) > 0.01 &&
            isWebkit
          ) {
            artPlayerRef.current.playbackRate = lastPlaybackRateRef.current;
          }
          artPlayerRef.current.notice.show = '';
        }, 0);

        setIsVideoLoading(false);
      });

      artPlayerRef.current.on('video:timeupdate', () => {
        if (!skipConfigRef.current.enable) return;

        const currentTime = artPlayerRef.current.currentTime || 0;
        const duration = artPlayerRef.current.duration || 0;
        const now = Date.now();

        if (now - lastSkipCheckRef.current < 1500) return;
        lastSkipCheckRef.current = now;

        if (
          skipConfigRef.current.intro_time > 0 &&
          currentTime < skipConfigRef.current.intro_time &&
          currentTime > 0.5
        ) {
          console.log(
            '跳过片头: 从',
            currentTime,
            '跳到',
            skipConfigRef.current.intro_time
          );
          artPlayerRef.current.currentTime = skipConfigRef.current.intro_time;
          artPlayerRef.current.notice.show = `✨ 已跳过片头，跳到 ${formatTime(
            skipConfigRef.current.intro_time
          )}`;
        }

        if (
          skipConfigRef.current.outro_time < 0 &&
          duration > 0 &&
          currentTime >= duration + skipConfigRef.current.outro_time &&
          currentTime < duration - 1
        ) {
          console.log('跳过片尾: 在', currentTime, '触发跳转');
          if (
            currentEpisodeIndexRef.current <
            (detailRef.current?.episodes?.length || 1) - 1
          ) {
            artPlayerRef.current.notice.show = `⏭️ 已跳过片尾，自动播放下一集`;
            setTimeout(() => {
              handleNextEpisode();
            }, 500);
          } else {
            artPlayerRef.current.notice.show = `✅ 已跳过片尾（已是最后一集）`;
            artPlayerRef.current.pause();
          }
        }
      });

      artPlayerRef.current.on('error', (err: any) => {
        console.error('播放器错误:', err);
        if (artPlayerRef.current.currentTime > 0) {
          return;
        }
      });

      artPlayerRef.current.on('video:ended', () => {
        const d = detailRef.current;
        const idx = currentEpisodeIndexRef.current;
        if (d && d.episodes && idx < d.episodes.length - 1) {
          setTimeout(() => {
            setCurrentEpisodeIndex(idx + 1);
          }, 1000);
        }
      });

      artPlayerRef.current.on('video:timeupdate', () => {
        const now = Date.now();
        let interval = 5000;
        if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
          interval = 20000;
        }
        if (now - lastSaveTimeRef.current > interval) {
          saveCurrentPlayProgress();
          lastSaveTimeRef.current = now;
        }
      });

      artPlayerRef.current.on('pause', () => {
        saveCurrentPlayProgress();
      });

      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl
        );
      }
    } catch (err) {
      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');
    }
  }, [Artplayer, Hls, videoUrl, loading, blockAdEnabled]);

  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      releaseWakeLock();
      cleanupPlayer();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 分支渲染：Loading / Error / 正常页面
  // ---------------------------------------------------------------------------
  const currentEpisodeTitle =
    totalEpisodes > 1
      ? detail?.episodes_titles?.[currentEpisodeIndex] ||
        `第 ${currentEpisodeIndex + 1} 集`
      : '';

  if (loading) {
    return (
      <LoadingScreen stage={loadingStage} message={loadingMessage} />
    );
  }

  if (error) {
    return (
      <ErrorScreen
        error={error}
        videoTitle={videoTitle}
        onBack={() =>
          videoTitle
            ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
            : router.back()
        }
        onRetry={() => window.location.reload()}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // 主体页面
  // ---------------------------------------------------------------------------
  return (
    <>
      <div className="flex flex-col gap-5 px-4 py-6 mb-15">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {detail?.class && <Badge variant="secondary">{detail.class}</Badge>}
              {(detail?.year || videoYear) && (
                <Badge variant="outline">{detail?.year || videoYear}</Badge>
              )}
              {detail?.source_name && (
                <Badge variant="outline">{detail.source_name}</Badge>
              )}
              {detail?.type_name && (
                <span className="text-sm text-muted-foreground">
                  {detail.type_name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold leading-tight">
                {videoTitle || '影片标题'}
              </h1>
              {currentEpisodeTitle && (
                <span className="text-sm text-muted-foreground">
                  {currentEpisodeTitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSkipConfigPanelOpen(true)}
            >
              <Clock3 className="h-4 w-4" />
              <span>跳过设置</span>
            </Button>
            <Button
              variant={favorited ? 'default' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite();
              }}
              aria-label={favorited ? '取消收藏' : '收藏'}
            >
              <FavoriteIcon filled={favorited} />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden p-0">
            <CardContent className="p-0 h-full ">
              <div className="relative aspect-video h-full w-full bg-black">
                <div ref={artRef} className="h-full w-full" />
                {isVideoLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                    <Spinner className="h-6 w-6 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {videoLoadingStage === 'sourceChanging'
                        ? '正在切换播放源'
                        : '视频加载中'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardContent className="flex h-full flex-col px-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">选集与换源</p>
                  <p className="text-xs text-muted-foreground">
                    {totalEpisodes ? `共 ${totalEpisodes} 集` : '单集'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setIsEpisodeSelectorCollapsed((prev) => !prev)
                  }
                >
                  {isEpisodeSelectorCollapsed ? '展开' : '收起'}
                </Button>
              </div>

              {!isEpisodeSelectorCollapsed ? (
                <div className="flex-1">
                  <EpisodeSelector
                    totalEpisodes={totalEpisodes}
                    episodes_titles={detail?.episodes_titles || []}
                    value={currentEpisodeIndex + 1}
                    onChange={handleEpisodeChange}
                    onSourceChange={handleSourceChange}
                    currentSource={currentSource}
                    currentId={currentId}
                    videoTitle={searchTitle || videoTitle}
                    availableSources={availableSources}
                    sourceSearchLoading={sourceSearchLoading}
                    sourceSearchError={sourceSearchError}
                    precomputedVideoInfo={precomputedVideoInfo}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  选集面板已收起
                </div>
              )}
            </CardContent>
          </Card>
        </div>


        <Card className="h-full">
          <CardContent className="flex flex-col gap-4 px-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_4fr]">
            <Card className="overflow-hidden p-0 hidden lg:block">
              <CardContent className="px-0">
                <div className="relative aspect-[2/3] overflow-hidden rounded-md border bg-muted">
                  {videoCover ? (
                    <>
                      <img
                        src={processImageUrl(videoCover)}
                        alt={videoTitle}
                        className="h-full w-full object-cover"
                      />
                      {videoDoubanId !== 0 && (
                        <Button
                          asChild
                          size="icon-sm"
                          variant="secondary"
                          className="absolute left-3 top-3 rounded-full"
                        >
                          <a
                            href={`https://movie.douban.com/subject/${videoDoubanId.toString()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      无封面
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-base font-semibold">详情</p>
                {videoYear && (
                  <p className="text-sm text-muted-foreground">{videoYear}</p>
                )}
              </div>
              {detail?.source_name && (
                <Badge variant="outline">{detail.source_name}</Badge>
              )}
            </div>

            {detail?.desc ? (
              <ScrollArea className="max-h-64">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {detail.desc}
                </p>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">暂无简介</p>
            )}
            </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SkipConfigDialog
        open={isSkipConfigPanelOpen}
        onOpenChange={setIsSkipConfigPanelOpen}
        config={skipConfig}
        onSave={handleSkipConfigChange}
        onClear={() =>
          handleSkipConfigChange({
            enable: false,
            intro_time: 0,
            outro_time: 0,
          })
        }
      />
    </>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
