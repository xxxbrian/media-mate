"use client";

import { useEffect, useState } from "react";

import type { PlayRecord } from "@/lib/db.client";
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from "@/lib/db.client";

import ScrollableRow from "@/components/scrollable-row";
import VideoCard from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));
    const sorted = recordsArray.sort((a, b) => b.save_time - a.save_time);
    setPlayRecords(sorted);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch {
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    const unsubscribe = subscribeToDataUpdates(
      "playRecordsUpdated",
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

  const getProgress = (record: PlayRecord) => {
    if (!record.total_time) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  const parseKey = (key: string) => {
    const [source, id] = key.split("+");
    return { source, id };
  };

  if (!loading && playRecords.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">继续观看</CardTitle>
        {!loading && playRecords.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clearAllPlayRecords();
              setPlayRecords([]);
            }}
          >
            清空
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollableRow>
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="min-w-[120px] sm:min-w-[180px] space-y-2"
                >
                  <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            : playRecords.map((record) => {
                const { source, id } = parseKey(record.key);
                return (
                  <div
                    key={record.key}
                    className="min-w-[120px] sm:min-w-[180px]"
                  >
                    <VideoCard
                      id={id}
                      title={record.title}
                      poster={record.cover}
                      year={record.year}
                      source={source}
                      source_name={record.source_name}
                      progress={getProgress(record)}
                      episodes={record.total_episodes}
                      currentEpisode={record.index}
                      query={record.search_title}
                      from="playrecord"
                      onDelete={() =>
                        setPlayRecords((prev) =>
                          prev.filter((r) => r.key !== record.key)
                        )
                      }
                      type={record.total_episodes > 1 ? "tv" : ""}
                    />
                  </div>
                );
              })}
        </ScrollableRow>
      </CardContent>
    </Card>
  );
}
