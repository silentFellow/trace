import { create } from "@bufbuild/protobuf";
import { memoServiceClient } from "@/connect";
import { State } from "@/types/proto/api/v1/common_pb";
import { ListMemosRequestSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { buildExportFilter, type ExportFilterInput } from "./buildExportFilter";

export const EXPORT_PAGE_SIZE = 1000;
export const EXPORT_MEMO_LIMIT = 1000;

export interface FetchExportMemosInput extends ExportFilterInput {
  excludeTags: string[];
  includeArchived: boolean;
}

const memoTime = (memo: Memo): number => Number(memo.createTime?.seconds ?? 0);

/** Pages every state, oldest-first, capped at `EXPORT_MEMO_LIMIT`. Shared by the Custom and Current-View export tabs. */
export async function pageMemosForExport(filter: string | undefined, states: State[]): Promise<{ memos: Memo[]; truncated: boolean }> {
  const collected: Memo[] = [];
  for (const state of states) {
    let pageToken = "";
    do {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, {
          pageSize: EXPORT_PAGE_SIZE,
          pageToken,
          state,
          orderBy: "create_time asc",
          filter,
        }),
      );
      collected.push(...response.memos);
      if (collected.length > EXPORT_MEMO_LIMIT) return { memos: [], truncated: true };
      pageToken = response.nextPageToken;
    } while (pageToken);
  }
  return { memos: collected.sort((a, b) => memoTime(a) - memoTime(b)), truncated: false };
}

export async function fetchExportMemos(input: FetchExportMemosInput): Promise<{ memos: Memo[]; truncated: boolean }> {
  const filter = buildExportFilter(input);
  const states = input.includeArchived ? [State.NORMAL, State.ARCHIVED] : [State.NORMAL];
  const { memos, truncated } = await pageMemosForExport(filter, states);
  if (truncated) return { memos: [], truncated: true };
  const excluded = new Set(input.excludeTags);
  return { memos: memos.filter((memo) => (memo.tags ?? []).every((tag) => !excluded.has(tag))), truncated: false };
}
