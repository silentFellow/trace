import { useMemo } from "react";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Scratchpad = () => {
  const currentUser = useCurrentUser();
  const t = useTranslate();
  const { isUserSettingsInitialized } = useAuth();
  const { filters } = useMemoFilterContext();
  // The Scratchpad page is the one place allowed to see its own Space; every
  // other consumer of useSpaces() defaults to hiding it (regular Spaces switcher,
  // Settings, move dialog).
  const spacesQuery = useSpaces(currentUser?.name, { includeScratchpad: true });
  const scratchpadSpace = spacesQuery.data?.find((space) => space.isScratchpad);
  const contextFilter = scratchpadSpace ? `space == ${JSON.stringify(scratchpadSpace.name)}` : undefined;
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);
  const editorCacheKey = `scratchpad-memo-editor-${scratchpadSpace?.name ?? ""}`;

  const memoFilter = useMemoFilters({
    creatorName: currentUser?.name,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  if (spacesQuery.isPending) {
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
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView key={getMemoKey(memo)} memo={memo} showVisibility showPinned compact={compact} />
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
                defaultSpace={scratchpadSpace.name}
              />
            );
          }}
        />
      </NewMemoProvider>
    </div>
  );
};

export default Scratchpad;
