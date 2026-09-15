import { buildTimestampRangeFilter, type LocalTimestampRange } from "@/lib/calendar-utils";
import { combineCELFilters } from "@/lib/cel-filter";

export interface ExportFilterInput {
  spaceName?: string;
  range?: LocalTimestampRange;
  includeTags: string[];
}

export function buildExportFilter({ spaceName, range, includeTags }: ExportFilterInput): string | undefined {
  const conditions: string[] = [];
  if (spaceName) conditions.push(`space == ${JSON.stringify(spaceName)}`);
  if (range) conditions.push(buildTimestampRangeFilter("created_ts", range));
  if (includeTags.length > 0) conditions.push(`tag in [${includeTags.map((tag) => JSON.stringify(tag)).join(", ")}]`);
  return combineCELFilters(...conditions);
}
