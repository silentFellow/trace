import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { pageMemosForExport } from "./fetchExportMemos";

export async function fetchCurrentViewMemos(filter: string | undefined, state: State): Promise<{ memos: Memo[]; truncated: boolean }> {
  return pageMemosForExport(filter, [state]);
}
