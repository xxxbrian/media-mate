import { Radio } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: (e?: React.MouseEvent) => void | Promise<void>;
  color?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actions: ActionItem[];
  poster?: string;
  sources?: string[]; // 播放源信息
  isAggregate?: boolean; // 是否为聚合内容
  sourceName?: string; // 播放源名称
  currentEpisode?: number; // 当前集数
  totalEpisodes?: number; // 总集数
  origin?: 'vod' | 'live';
}

const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  actions,
  poster,
  sources,
  isAggregate,
  sourceName,
  currentEpisode,
  totalEpisodes,
  origin = 'vod',
}) => {
  const getActionColor = (color: ActionItem['color']) => {
    switch (color) {
      case 'danger':
        return 'text-destructive';
      case 'primary':
        return 'text-primary';
      default:
        return 'text-foreground';
    }
  };

  const getActionHoverColor = (color: ActionItem['color']) => {
    switch (color) {
      case 'danger':
        return 'hover:bg-destructive/10';
      case 'primary':
        return 'hover:bg-primary/10';
      default:
        return 'hover:bg-muted';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side='bottom'
        className='w-full pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6'
      >
        <SheetHeader className='flex flex-row items-center gap-3 text-left'>
          {poster && (
            <div className='relative h-16 w-12 overflow-hidden rounded-md bg-muted flex-shrink-0'>
              <Image
                src={poster}
                alt={title}
                fill
                className={origin === 'live' ? 'object-contain' : 'object-cover'}
                sizes='48px'
              />
            </div>
          )}
          <div className='flex-1 min-w-0'>
            <SheetTitle className='truncate text-lg'>{title}</SheetTitle>
            {sourceName && (
              <div className='mt-1 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs text-muted-foreground'>
                {origin === 'live' && <Radio size={12} className='text-muted-foreground' />}
                {sourceName}
              </div>
            )}
            <p className='text-sm text-muted-foreground'>选择操作</p>
          </div>
        </SheetHeader>

        <div className='mt-4 space-y-2'>
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              <Button
                variant='ghost'
                className={`w-full justify-start gap-3 py-4 text-base ${getActionHoverColor(action.color)}`}
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
              >
                <span className={`h-6 w-6 ${getActionColor(action.color)}`}>
                  {action.icon}
                </span>
                <span className='flex-1 text-left'>{action.label}</span>
                {action.id === 'play' &&
                  currentEpisode &&
                  totalEpisodes &&
                  !Number.isNaN(currentEpisode) &&
                  !Number.isNaN(totalEpisodes) && (
                    <span className='text-sm text-muted-foreground'>
                      {currentEpisode}/{totalEpisodes}
                    </span>
                  )}
              </Button>
              {index < actions.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </div>

        {isAggregate && sources && sources.length > 0 && (
          <div className='mt-4 rounded-lg border bg-muted/40'>
            <div className='px-4 py-3'>
              <h4 className='text-sm font-medium text-foreground'>可用播放源</h4>
              <p className='text-xs text-muted-foreground'>共 {sources.length} 个播放源</p>
            </div>
            <ScrollArea className='max-h-32 px-4 pb-4'>
              <div className='grid grid-cols-2 gap-2'>
                {sources.map((source, idx) => (
                  <div
                    key={`${source}-${idx}`}
                    className='flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground'
                  >
                    <span className='h-1 w-1 rounded-full bg-muted-foreground' />
                    <span className='truncate'>{source}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileActionSheet;
