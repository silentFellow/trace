import { useMemo } from "react";
import { useParams } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { usePersonalScratchpad, useSpaceScratchpad, useSpaces } from "@/hooks/useSpaceQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Scratchpad = () => {
  const currentUser = useCurrentUser();
  const t = useTranslate();
  const { spaceUid } = useParams<{ spaceUid: string }>();
  const { isUserSettingsInitialized } = useAuth();
  const { filters } = useMemoFilterContext();
  const parentSpaceName = spaceUid ? `spaces/${spaceUid}` : undefined;
  const childQuery = useSpaceScratchpad(currentUser?.name, parentSpaceName);
  const spacesQuery = useSpaces(currentUser?.name, { includeScratchpad: true });
  const personalQuery = usePersonalScratchpad(currentUser?.name, { enabled: parentSpaceName === undefined });
  const scratchpadSpace = childQuery.data;
  const personalSpace = personalQuery.data;
  // Global mode aggregates every Scratchpad the caller owns; the personal one
  // is unioned in directly so first-open creation never lags the member list.
  const aggregateSpaces = useMemo(() => {
    const byName = new Map((spacesQuery.data ?? []).filter((space) => space.isScratchpad).map((space) => [space.name, space] as const));
    if (personalSpace) byName.set(personalSpace.name, personalSpace);
    return [...byName.values()];
  }, [spacesQuery.data, personalSpace]);
  const contextFilter = parentSpaceName
    ? scratchpadSpace
      ? `space == ${JSON.stringify(scratchpadSpace.name)}`
      : undefined
    : aggregateSpaces.map((space) => `(space == ${JSON.stringify(space.name)})`).join(" || ") || undefined;
  const targetSpace = parentSpaceName ? scratchpadSpace : personalSpace;
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);
  const editorCacheKey = `scratchpad-memo-editor-${targetSpace?.name ?? ""}`;

  const memoFilter = useMemoFilters({
    creatorName: currentUser?.name,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  const pending = parentSpaceName ? childQuery.isPending : personalQuery.isPending || spacesQuery.isPending;
  if (pending) {
    return <div className="w-full min-h-full flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!targetSpace) {
    // Scratchpads are created on first open; reaching here without one means
    // provisioning failed (logged server-side) or the caller is not a member
    // of the parent Space, not a normal loading state.
    return <div className="w-full min-h-full flex items-center justify-center text-muted-foreground">Scratchpad is not available.</div>;
  }

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView
              key={getMemoKey(memo)}
              memo={memo}
              showVisibility
              showPinned
              showSpace={parentSpaceName === undefined}
              compact={compact}
            />
          )}
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          contextFilter={contextFilter}
          renderLeading={({ useGrid }) => {
            if (!isUserSettingsInitialized) return null;

            return (
              <MemoEditor
                key={editorCacheKey}
                className={useGrid ? undefined : "mb-2"}
                cacheKey={editorCacheKey}
                placeholder={t("editor.any-thoughts")}
                defaultCreateTime={defaultCreateTime}
                defaultSpace={targetSpace.name}
              />
            );
          }}
        />
      </NewMemoProvider>
    </div>
  );
};

export default Scratchpad;
