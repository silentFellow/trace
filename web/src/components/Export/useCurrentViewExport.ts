import { useLocation } from "react-router-dom";
import { getSidebarRouteKind } from "@/components/AppSidebar/routes";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { usePersonalScratchpad, useSpaceScratchpad, useSpaces } from "@/hooks/useSpaceQueries";
import { combineCELFilters } from "@/lib/cel-filter";
import { resolveSpaceScratchpadRoute } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

export interface CurrentViewExport {
  /** Fully combined CEL filter for whatever's on screen right now. */
  filter: string | undefined;
  state: State;
  /** True while Scratchpad's own Space lookup is still resolving. */
  pending: boolean;
}

/**
 * Mirrors each page's own filter construction (Home/Explore/Archived/Scratchpad) so
 * "export current view" sees exactly what's rendered, without those pages needing to
 * publish their live filter to a shared context. Anything else (Settings, Attachments,
 * Map, Inbox, profile, …) falls back to the Home shape — same reasoning as Home itself:
 * every user's own memos, no Space or state narrowing.
 */
export function useCurrentViewExport(): CurrentViewExport {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const routeKind = getSidebarRouteKind(location.pathname);
  const isExplore = routeKind === "explore";
  const isArchived = routeKind === "archived";
  const isScratchpad = routeKind === "scratchpad";
  const isHome = !isExplore && !isArchived && !isScratchpad;

  const { memoFilter: spaceContextFilter } = useSpaceContext();

  const visibilities = isExplore
    ? currentUser
      ? [Visibility.PUBLIC, Visibility.PROTECTED, Visibility.SPACE]
      : [Visibility.PUBLIC]
    : undefined;

  const memoFilter = useMemoFilters({
    creatorName: isHome || isScratchpad ? currentUser?.name : undefined,
    includeMemoViews: isHome || isExplore,
    includePinned: isHome || isArchived || isScratchpad,
    visibilities,
  });

  const parentSpaceName = isScratchpad ? resolveSpaceScratchpadRoute(location.pathname)?.spaceName : undefined;
  const childQuery = useSpaceScratchpad(currentUser?.name, parentSpaceName, {
    enabled: isScratchpad && Boolean(parentSpaceName),
  });
  const spacesQuery = useSpaces(currentUser?.name, { includeScratchpad: true, enabled: isScratchpad && !parentSpaceName });
  const personalQuery = usePersonalScratchpad(currentUser?.name, { enabled: isScratchpad && !parentSpaceName });

  let scratchpadContextFilter: string | undefined;
  if (isScratchpad) {
    if (parentSpaceName) {
      scratchpadContextFilter = childQuery.data ? `space == ${JSON.stringify(childQuery.data.name)}` : undefined;
    } else {
      const names = new Set<string>();
      for (const space of spacesQuery.data ?? []) if (space.isScratchpad) names.add(space.name);
      if (personalQuery.data) names.add(personalQuery.data.name);
      scratchpadContextFilter = [...names].map((name) => `(space == ${JSON.stringify(name)})`).join(" || ") || undefined;
    }
  }

  // Home and Explore both scope to whatever Space is selected; Scratchpad computes its own.
  let contextFilter: string | undefined;
  if (isScratchpad) contextFilter = scratchpadContextFilter;
  else if (isHome || isExplore) contextFilter = spaceContextFilter;

  return {
    filter: combineCELFilters(contextFilter, memoFilter),
    state: isArchived ? State.ARCHIVED : State.NORMAL,
    pending: isScratchpad && (parentSpaceName ? childQuery.isPending : spacesQuery.isPending || personalQuery.isPending),
  };
}
