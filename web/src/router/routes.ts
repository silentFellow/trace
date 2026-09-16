import { matchPath } from "react-router-dom";
import { extractSpaceUidFromName } from "@/lib/space-display";

export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  CALENDAR: "/calendar",
  MAP: "/map",
  VIEWS: "/views",
  SCRATCHPAD: "/scratchpad",
  SETTING: "/setting",
  EXPLORE: "/explore",
  USER_PROFILE: "/u/:username",
  AUTH: "/auth",
  AUTH_SIGNUP: "/auth/signup",
  AUTH_ADMIN: "/auth/admin",
  AUTH_CALLBACK: "/auth/callback",
  SHARED_MEMO: "/memos/shares",
} as const;

/** Router pattern for the calendar: month and day are optional so `/calendar` can redirect. */
export const CALENDAR_ROUTE_PATTERN = `${ROUTES.CALENDAR}/:year?/:month?/:day?`;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

export const SPACE_ROUTE_PATTERN = "/spaces/:spaceUid";
export const SPACE_SCRATCHPAD_ROUTE_PATTERN = `${SPACE_ROUTE_PATTERN}/scratchpad`;

/** Builds the Scratchpad URL for a selected parent Space. */
export const buildSpaceScratchpadPath = (spaceName: string): string =>
  `/spaces/${encodeURIComponent(extractSpaceUidFromName(spaceName))}${ROUTES.SCRATCHPAD}`;

/** Parent Space of a nested Scratchpad URL, if the path is one. Scratchpad is
 * deliberately not a collection route, so this stays separate from
 * resolveCollectionRoute: the Space stays in the URL either way. */
export const resolveSpaceScratchpadRoute = (path: string): { spaceName: string } | undefined => {
  const pathname = (path.split(/[?#]/, 1)[0] || "").replace(/\/+$/, "");
  const match = matchPath({ path: SPACE_SCRATCHPAD_ROUTE_PATTERN, caseSensitive: false }, pathname);
  const uid = match?.params.spaceUid ?? "";
  // An encoded slash decodes into a UID that cannot round-trip through buildSpaceScratchpadPath.
  if (!uid || uid.includes("/")) return undefined;
  return { spaceName: `spaces/${uid}` };
};

/** Collection pages that exist both globally and beneath a Space. */
const COLLECTION_ROUTE_PATTERNS = [ROUTES.HOME, ROUTES.EXPLORE, ROUTES.ATTACHMENTS, CALENDAR_ROUTE_PATTERN, ROUTES.MAP];

const isCollectionPathname = (pathname: string): boolean =>
  COLLECTION_ROUTE_PATTERNS.some((path) => matchPath({ path, caseSensitive: false }, pathname) !== null);

export interface CollectionRoute {
  spaceName?: string;
  /** The global twin of a collection page; otherwise the normalized pathname. */
  pathname: string;
  isCollection: boolean;
}

/** The URL owns collection scope; unknown Space subroutes are not collection pages. */
export const resolveCollectionRoute = (path: string): CollectionRoute => {
  const pathname = (path.split(/[?#]/, 1)[0] || ROUTES.HOME).replace(/\/+$/, "") || ROUTES.HOME;
  const spaceMatch = matchPath({ path: `${SPACE_ROUTE_PATTERN}/*`, caseSensitive: false }, pathname);
  if (!spaceMatch) return { pathname, isCollection: isCollectionPathname(pathname) };
  const uid = spaceMatch.params.spaceUid ?? "";
  const collectionPath = `/${spaceMatch.params["*"] ?? ""}`;
  // An encoded slash decodes into a UID that cannot round-trip through buildCollectionPath.
  if (!uid || uid.includes("/") || !isCollectionPathname(collectionPath)) return { pathname, isCollection: false };
  return { spaceName: `spaces/${uid}`, pathname: collectionPath, isCollection: true };
};

/** Builds a collection URL from a global collection pathname and an optional Space. */
export const buildCollectionPath = (pathname: string, spaceName?: string): string => {
  const route = resolveCollectionRoute(pathname);
  if (!route.isCollection) return pathname;
  if (!spaceName) return route.pathname;
  const base = `/spaces/${encodeURIComponent(extractSpaceUidFromName(spaceName))}`;
  return route.pathname === ROUTES.HOME ? base : `${base}${route.pathname}`;
};

/** Space owning a URL: collection scope first, then the Scratchpad parent (which is deliberately not a collection route). */
export const resolveSpaceNameFromPath = (path: string): string | undefined =>
  resolveCollectionRoute(path).spaceName ?? resolveSpaceScratchpadRoute(path)?.spaceName;

/** Carries the current Space into another collection view. */
export const collectionPathForLocation = (pathname: string, currentPath: string): string =>
  buildCollectionPath(pathname, resolveSpaceNameFromPath(currentPath));

/** Switching preserves collection views and their query; other pages start at Home. */
export const getSpaceSwitchPath = (location: { pathname: string; search: string; hash?: string }, spaceName?: string): string => {
  // Stay in the scratchpad view across a switch; every other non-collection page starts at Home.
  // The global view counts too: it has no parent Space, but switching into one should land in its scratchpad.
  if (resolveSpaceScratchpadRoute(location.pathname) || matchPath(ROUTES.SCRATCHPAD, location.pathname)) {
    return spaceName ? buildSpaceScratchpadPath(spaceName) : ROUTES.SCRATCHPAD;
  }
  const route = resolveCollectionRoute(location.pathname);
  return route.isCollection
    ? `${buildCollectionPath(route.pathname, spaceName)}${location.search}${location.hash || ""}`
    : buildCollectionPath(ROUTES.HOME, spaceName);
};
