'use client';

import React, { useEffect, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface WeekdaySelectorProps {
  onWeekdayChange: (weekday: string) => void;
  className?: string;
}

const weekdays = [
  { value: 'Mon', label: '周一', shortLabel: '周一' },
  { value: 'Tue', label: '周二', shortLabel: '周二' },
  { value: 'Wed', label: '周三', shortLabel: '周三' },
  { value: 'Thu', label: '周四', shortLabel: '周四' },
  { value: 'Fri', label: '周五', shortLabel: '周五' },
  { value: 'Sat', label: '周六', shortLabel: '周六' },
  { value: 'Sun', label: '周日', shortLabel: '周日' },
];

const getTodayWeekday = (): string => {
  const today = new Date().getDay();
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdayMap[today];
};

const WeekdaySelector: React.FC<WeekdaySelectorProps> = ({
  onWeekdayChange,
  className = '',
}) => {
  const [selectedWeekday, setSelectedWeekday] = useState<string>(
    getTodayWeekday()
  );

  // 初次挂载时通知父组件默认选中的 weekday
  useEffect(() => {
    onWeekdayChange(getTodayWeekday());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (val: string) => {
    if (!val) return;
    setSelectedWeekday(val);
    onWeekdayChange(val);
  };

  return (
    <div className={className}>
      <ToggleGroup
        type="single"
        value={selectedWeekday}
        onValueChange={handleChange}
        className="inline-flex rounded-full bg-muted/60 dark:bg-muted/40 p-1 gap-1"
        spacing={2}
      >
        {weekdays.map((weekday) => (
          <ToggleGroupItem
            key={weekday.value}
            value={weekday.value}
            title={weekday.label}
            className={`
              rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium
              data-[state=on]:bg-primary data-[state=on]:text-primary-foreground
              data-[state=on]:shadow-sm
              data-[state=off]:text-muted-foreground
              data-[state=off]:hover:bg-muted
            `}
          >
            {weekday.shortLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default WeekdaySelector;
