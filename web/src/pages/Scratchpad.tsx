import { useMemo } from "react";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
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
  // The Scratchpad page is the one place allowed to see its own Space; every
  // other consumer of useSpaces() defaults to hiding it (regular Spaces switcher,
  // Settings, move dialog).
  const spacesQuery = useSpaces(currentUser?.name, { includeScratchpad: true });
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

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <NewMemoProvider>
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">
          <MemoEditor
            cacheKey={`scratchpad-memo-editor-${scratchpadSpace.name}`}
            placeholder="Jot something down… add a #tag to sort it into a column"
            defaultSpace={scratchpadSpace.name}
          />
        </div>
      </NewMemoProvider>

      {columns.length === 0 ? (
        <div className="w-full flex items-center justify-center py-12 text-muted-foreground">
          No notes yet. Add a #tag to start a column.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="flex gap-4 p-4">
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
      )}
    </div>
  );
};

export default Scratchpad;
