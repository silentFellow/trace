import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { useTagCounts } from "@/hooks/useUserQueries";
import type { LocalTimestampRange } from "@/lib/calendar-utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { buildExportMarkdown } from "./buildExportMarkdown";
import { ExportPrintView } from "./ExportPrintView";
import { fetchExportMemos } from "./fetchExportMemos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVERYTHING = "everything";

const toLocalISODate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const toMonth = (date: Date): string => toLocalISODate(date).slice(0, 7);

const shiftMonth = (month: string, delta: number): string => {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + delta);
  return toMonth(date);
};

const rangeFromDays = (startISO: string, endISO: string): LocalTimestampRange => {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { startTimestamp: Math.floor(start.getTime() / 1000), endTimestamp: Math.floor(end.getTime() / 1000) };
};

export function ExportDialog({ open, onOpenChange }: Props) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { selectedSpaceName } = useSpaceContext();
  const { data: spaces = [] } = useSpaces(currentUser?.name);
  const { data: tagCounts = {} } = useTagCounts(true);
  const [scope, setScope] = useState<string>(selectedSpaceName || EVERYTHING);
  const [preset, setPreset] = useState<string>("all-time");
  const [range, setRange] = useState<LocalTimestampRange | undefined>(undefined);
  const [rangeStart, setRangeStart] = useState<string | undefined>(undefined);
  const [month, setMonth] = useState<string>(() => toMonth(new Date()));
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [truncated, setTruncated] = useState(false);
  const [printMemos, setPrintMemos] = useState<Memo[] | undefined>(undefined);

  const tags = useMemo(() => Object.keys(tagCounts).sort(), [tagCounts]);

  const applyPreset = (name: string) => {
    setPreset(name);
    setRangeStart(undefined);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const toRange = (start: Date): LocalTimestampRange => ({
      startTimestamp: Math.floor(start.getTime() / 1000),
      endTimestamp: Math.floor(tomorrow.getTime() / 1000),
    });
    if (name === "all-time") {
      setRange(undefined);
    } else if (name === "today") {
      setRange(toRange(today));
    } else if (name === "last-7-days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setRange(toRange(start));
    } else if (name === "last-30-days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setRange(toRange(start));
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setRange(toRange(start));
    }
  };

  const handleDayClick = (day: string) => {
    setPreset("custom");
    if (!rangeStart || (rangeStart && rangeEnd(selectedRange))) {
      setRangeStart(day);
      setRange(undefined);
    } else if (day >= rangeStart) {
      setRange(rangeFromDays(rangeStart, day));
    } else {
      setRangeStart(day);
      setRange(undefined);
    }
  };

  const selectedRange = range && rangeStart ? { rangeStart, range } : undefined;
  const rangeEnd = (selected: { rangeStart: string; range: LocalTimestampRange } | undefined): string | undefined => {
    if (!selected) return undefined;
    const end = new Date(selected.range.endTimestamp * 1000);
    end.setDate(end.getDate() - 1);
    return toLocalISODate(end);
  };

  const toggleTag = (tag: string, list: "include" | "exclude") => {
    if (list === "include") {
      setIncludeTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
    } else {
      setExcludeTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
    }
  };

  const collectMemos = async (): Promise<Memo[] | undefined> => {
    setBusy(true);
    setError(undefined);
    setTruncated(false);
    try {
      const { memos, truncated } = await fetchExportMemos({
        spaceName: scope === EVERYTHING ? undefined : scope,
        range,
        includeTags,
        excludeTags,
        includeArchived,
      });
      if (truncated) {
        setTruncated(true);
        return undefined;
      }
      return memos;
    } catch {
      setError(t("export.failed"));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleExportMarkdown = async () => {
    setBusy(true);
    setError(undefined);
    setTruncated(false);
    try {
      const { memos, truncated } = await fetchExportMemos({
        spaceName: scope === EVERYTHING ? undefined : scope,
        range,
        includeTags,
        excludeTags,
        includeArchived,
      });
      if (truncated) {
        setTruncated(true);
        return;
      }
      const markdown = buildExportMarkdown(memos, window.location.origin);
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trace-export-${toLocalISODate(new Date())}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch {
      setError(t("export.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.date-range")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            {t("export.scope")}
            <select aria-label={t("export.scope")} value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value={EVERYTHING}>{t("export.everything")}</option>
              {spaces.map((space) => (
                <option key={space.name} value={space.name}>
                  {space.title || space.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", t("export.preset-today")],
                ["last-7-days", t("export.preset-last-7-days")],
                ["last-30-days", t("export.preset-last-30-days")],
                ["this-month", t("export.preset-this-month")],
                ["all-time", t("export.preset-all-time")],
              ] as const
            ).map(([name, label]) => (
              <Button key={name} type="button" variant={preset === name ? "default" : "outline"} onClick={() => applyPreset(name)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setMonth((prev) => shiftMonth(prev, -1))}>
              {"<"}
            </Button>
            <MonthCalendar month={month} data={{}} selectedDate={rangeStart} onClick={handleDayClick} />
            <Button type="button" variant="outline" onClick={() => setMonth((prev) => shiftMonth(prev, 1))}>
              {">"}
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("export.include-tags")}</span>
            {tags.map((tag) => (
              <label key={`include-${tag}`}>
                <input
                  type="checkbox"
                  aria-label={`Include tag ${tag}`}
                  checked={includeTags.includes(tag)}
                  disabled={excludeTags.includes(tag)}
                  onChange={() => toggleTag(tag, "include")}
                />
                {tag}
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("export.exclude-tags")}</span>
            {tags.map((tag) => (
              <label key={`exclude-${tag}`}>
                <input
                  type="checkbox"
                  aria-label={`Exclude tag ${tag}`}
                  checked={excludeTags.includes(tag)}
                  disabled={includeTags.includes(tag)}
                  onChange={() => toggleTag(tag, "exclude")}
                />
                {tag}
              </label>
            ))}
          </div>
          <label>
            <input
              type="checkbox"
              aria-label={t("export.include-archived")}
              checked={includeArchived}
              onChange={() => setIncludeArchived((prev) => !prev)}
            />
            {t("export.include-archived")}
          </label>
          {error && <p role="alert">{error}</p>}
          {truncated && <p role="alert">{t("export.truncated")}</p>}
        </div>
        <DialogFooter>
          <Button type="button" disabled={busy} onClick={handleExportMarkdown}>
            {t("export.export-markdown")}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              const memos = await collectMemos();
              if (!memos) return;
              setPrintMemos(memos);
              // jsdom has no print; browsers always have both.
              if (typeof window.print !== "function") return;
              if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => window.print());
              else window.print();
            }}
          >
            {t("export.export-pdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {printMemos && <ExportPrintView memos={printMemos} />}
    </Dialog>
  );
}
