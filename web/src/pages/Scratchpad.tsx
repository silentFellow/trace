import { useMemo } from "react";
import MemoView from "@/components/MemoView";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemos } from "@/hooks/useMemoQueries";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

// A personal Scratchpad stays small by nature (tag-organized notes, not a
// timeline), so one page covers it without pagination.
const SCRATCHPAD_MEMO_PAGE_SIZE = 1000;
const UNTAGGED_COLUMN_KEY = "__untagged__";

/** Newest first, pinned pushed to the top of its own column. */
const compareMemosForColumn = (a: Memo, b: Memo): number => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const aTime = a.createTime ? Number(a.createTime.seconds) : 0;
  const bTime = b.createTime ? Number(b.createTime.seconds) : 0;
  return bTime - aTime;
};

/** Groups memos by tag; a multi-tagged memo appears in every matching column. Column order follows first appearance, Untagged last. */
const groupMemosByTag = (memos: Memo[]): Array<{ key: string; label: string; memos: Memo[] }> => {
  const columns = new Map<string, Memo[]>();
  const untagged: Memo[] = [];

  for (const memo of memos) {
    if (memo.tags.length === 0) {
      untagged.push(memo);
      continue;
    }
    for (const tag of memo.tags) {
      const existing = columns.get(tag);
      if (existing) {
        existing.push(memo);
      } else {
        columns.set(tag, [memo]);
      }
    }
  }

  const result = Array.from(columns.entries()).map(([tag, tagMemos]) => ({
    key: tag,
    label: tag,
    memos: [...tagMemos].sort(compareMemosForColumn),
  }));
  if (untagged.length > 0) {
    result.push({ key: UNTAGGED_COLUMN_KEY, label: "Untagged", memos: [...untagged].sort(compareMemosForColumn) });
  }
  return result;
};

const Scratchpad = () => {
  const currentUser = useCurrentUser();
  const spacesQuery = useSpaces(currentUser?.name);
  const scratchpadSpace = spacesQuery.data?.find((space) => space.isScratchpad);

  const memosQuery = useMemos({
    filter: scratchpadSpace ? `space == "${scratchpadSpace.name}"` : undefined,
    state: State.NORMAL,
    pageSize: SCRATCHPAD_MEMO_PAGE_SIZE,
    orderBy: "create_time desc",
  } as never);

  const columns = useMemo(() => groupMemosByTag(memosQuery.data?.memos ?? []), [memosQuery.data]);

  if (spacesQuery.isPending || (scratchpadSpace && memosQuery.isPending)) {
    return <div className="w-full min-h-full flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!scratchpadSpace) {
    // Provisioning happens synchronously on account creation; a missing Scratchpad
    // means it failed (logged server-side) rather than a normal loading state.
    return <div className="w-full min-h-full flex items-center justify-center text-muted-foreground">Scratchpad is not available.</div>;
  }

  if (columns.length === 0) {
    return (
      <div className="w-full min-h-full flex items-center justify-center text-muted-foreground">
        No notes yet. Add a #tag to a memo placed in Scratchpad to start a column.
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-background text-foreground overflow-x-auto">
      <div className="flex h-full gap-4 p-4">
        {columns.map((column) => (
          <div key={column.key} className="flex w-72 shrink-0 flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-sm font-semibold text-foreground truncate">
                {column.key === UNTAGGED_COLUMN_KEY ? column.label : `#${column.label}`}
              </span>
              <span className="text-xs text-muted-foreground">{column.memos.length}</span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {column.memos.map((memo) => (
                <MemoView key={`${column.key}-${memo.name}`} memo={memo} showPinned compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Scratchpad;
