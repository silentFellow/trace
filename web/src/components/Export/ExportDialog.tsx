import { FileTextIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpaceContext } from "@/contexts/SpaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { useTagCounts } from "@/hooks/useUserQueries";
import type { LocalTimestampRange } from "@/lib/calendar-utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { buildExportMarkdown } from "./buildExportMarkdown";
import { DateInputPopover } from "./DateInputPopover";
import { fetchCurrentViewMemos } from "./fetchCurrentViewMemos";
import { fetchExportMemos } from "./fetchExportMemos";
import { TagAutocompleteField } from "./TagAutocompleteField";
import { useCurrentViewExport } from "./useCurrentViewExport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_SPACES = "all";
type ExportTab = "current" | "custom";

const toLocalISODate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const today = () => toLocalISODate(new Date());

const rangeFromDays = (startISO: string, endISO: string): LocalTimestampRange => {
  const [lo, hi] = startISO <= endISO ? [startISO, endISO] : [endISO, startISO];
  const start = new Date(`${lo}T00:00:00`);
  const end = new Date(`${hi}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { startTimestamp: Math.floor(start.getTime() / 1000), endTimestamp: Math.floor(end.getTime() / 1000) };
};

export function ExportDialog({ open, onOpenChange }: Props) {
  const t = useTranslate();
  const exportText = (key: string) => t(key as never);
  const currentUser = useCurrentUser();
  const { selectedSpaceName } = useSpaceContext();
  const { data: spaces = [] } = useSpaces(currentUser?.name);
  const { data: tagCounts = {} } = useTagCounts(true);
  const currentView = useCurrentViewExport();

  const [tab, setTab] = useState<ExportTab>("current");
  const [scope, setScope] = useState<string>(selectedSpaceName || ALL_SPACES);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [truncated, setTruncated] = useState(false);

  const tags = useMemo(() => Object.keys(tagCounts).sort(), [tagCounts]);

  const toggleTag = (tag: string, list: "include" | "exclude") => {
    const setList = list === "include" ? setIncludeTags : setExcludeTags;
    setList((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };
  const removeTag = (tag: string, list: "include" | "exclude") => {
    const setList = list === "include" ? setIncludeTags : setExcludeTags;
    setList((prev) => prev.filter((item) => item !== tag));
  };

  const collectMemos = async (): Promise<Memo[] | undefined> => {
    setBusy(true);
    setError(undefined);
    setTruncated(false);
    try {
      const result =
        tab === "current"
          ? await fetchCurrentViewMemos(currentView.filter, currentView.state)
          : await fetchExportMemos({
              spaceName: scope === ALL_SPACES ? undefined : scope,
              range: rangeFromDays(startDate, endDate),
              includeTags,
              excludeTags,
              includeArchived,
            });
      if (result.truncated) {
        setTruncated(true);
        return undefined;
      }
      return result.memos;
    } catch {
      setError(exportText("export.failed"));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const handleExportMarkdown = async () => {
    const memos = await collectMemos();
    if (!memos) return;
    const markdown = buildExportMarkdown(memos, window.location.origin);
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trace-export-${today()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  const isCustomReady = tab === "custom" || (tab === "current" && !currentView.pending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{exportText("export.title")}</DialogTitle>
          <DialogDescription>{exportText("export.current-view-description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as ExportTab)}>
          <TabsList className="mb-2">
            <TabsTrigger value="current">{exportText("export.current-view")}</TabsTrigger>
            <TabsTrigger value="custom">{exportText("export.custom")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "custom" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <DateInputPopover label={exportText("export.start-date")} date={startDate} onChange={setStartDate} />
              <DateInputPopover label={exportText("export.end-date")} date={endDate} onChange={setEndDate} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{exportText("export.scope")}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SPACES}>{exportText("export.all-spaces")}</SelectItem>
                  {spaces.map((space) => (
                    <SelectItem key={space.name} value={space.name}>
                      {space.title || space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Label className="flex items-center gap-2">
              <Checkbox checked={includeArchived} onCheckedChange={(checked) => setIncludeArchived(checked === true)} />
              {exportText("export.include-archived")}
            </Label>

            <TagAutocompleteField
              label={exportText("export.include-tags-placeholder")}
              placeholder={exportText("export.include-tags-placeholder")}
              availableTags={tags}
              selected={includeTags}
              reservedTags={excludeTags}
              onAdd={(tag) => toggleTag(tag, "include")}
              onRemove={(tag) => removeTag(tag, "include")}
            />
            <TagAutocompleteField
              label={exportText("export.exclude-tags-placeholder")}
              placeholder={exportText("export.exclude-tags-placeholder")}
              availableTags={tags}
              selected={excludeTags}
              reservedTags={includeTags}
              onAdd={(tag) => toggleTag(tag, "exclude")}
              onRemove={(tag) => removeTag(tag, "exclude")}
            />
          </div>
        )}

        {(error || truncated) && <p className="text-sm text-destructive">{error ?? exportText("export.truncated")}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="default" disabled={busy || !isCustomReady} onClick={handleExportMarkdown} className="flex-1">
            <FileTextIcon className="size-4" strokeWidth={1.8} />
            {exportText("export.export-markdown")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
