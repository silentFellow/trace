import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import { MonthNavigator } from "@/components/StatisticsView/MonthNavigator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  label: string;
  /** `YYYY-MM-DD` */
  date: string;
  onChange: (date: string) => void;
}

/** Same click-a-day picker as the sidebar heatmap (`MonthCalendar` + `MonthNavigator`), scoped to one date field. */
export function DateInputPopover({ label, date, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => date.slice(0, 7));

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setMonth(date.slice(0, 7));
        }}
      >
        <PopoverTrigger
          render={<Button type="button" variant="outline" aria-label={label} className="w-full justify-start gap-2 font-normal" />}
        >
          <CalendarIcon className="size-4 text-muted-foreground" strokeWidth={1.8} />
          {date}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <MonthNavigator visibleMonth={month} onMonthChange={setMonth} />
          <MonthCalendar
            month={month}
            data={{}}
            selectedDate={date}
            onClick={(day) => {
              onChange(day);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
