import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  placeholder: string;
  availableTags: string[];
  selected: string[];
  /** Tags picked in the opposite (include/exclude) list — excluded from suggestions. */
  reservedTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

const SUGGESTION_LIMIT = 8;

/** Type-to-filter tag search; picks become removable chips below the input. */
export function TagAutocompleteField({ label, placeholder, availableTags, selected, reservedTags, onAdd, onRemove }: Props) {
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return [];
    return availableTags
      .filter((tag) => tag.toLowerCase().includes(lower) && !selected.includes(tag) && !reservedTags.includes(tag))
      .slice(0, SUGGESTION_LIMIT);
  }, [query, availableTags, selected, reservedTags]);

  const pick = (tag: string) => {
    onAdd(tag);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Popover open={suggestions.length > 0}>
        <PopoverTrigger render={<div className="w-full" />}>
          <Input
            value={query}
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && suggestions[0]) {
                event.preventDefault();
                pick(suggestions[0]);
              }
            }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) p-1" initialFocus={false}>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-start text-sm text-foreground hover:bg-accent"
              onClick={() => pick(tag)}
            >
              #{tag}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selected.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border/50 bg-accent/50 py-1 ps-2.5 pe-1 text-xs text-foreground/80",
              )}
            >
              #{tag}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${tag}`} onClick={() => onRemove(tag)}>
                <XIcon className="size-3" />
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
