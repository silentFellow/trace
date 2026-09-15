import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spaceKeys, useSpaceScratchpad } from "@/hooks/useSpaceQueries";
import { buildSpaceScratchpadPath, resolveSpaceScratchpadRoute } from "@/router/routes";
import { SpaceSchema } from "@/types/proto/api/v1/space_service_pb";

const clients = vi.hoisted(() => ({
  getOrCreateSpaceScratchpad: vi.fn(),
}));

vi.mock("@/connect", () => ({
  spaceServiceClient: clients,
}));

const VIEWER = "users/test";
const OTHER_VIEWER = "users/other";
const PARENT = "spaces/product";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

describe("space scratchpad route", () => {
  it("resolves the parent Space from a nested scratchpad URL", () => {
    expect(resolveSpaceScratchpadRoute("/spaces/product/scratchpad")).toEqual({ spaceName: "spaces/product" });
    expect(buildSpaceScratchpadPath("spaces/product")).toBe("/spaces/product/scratchpad");
  });

  it("rejects non-scratchpad, encoded, and query-bearing paths", () => {
    expect(resolveSpaceScratchpadRoute("/spaces/product")).toBeUndefined();
    expect(resolveSpaceScratchpadRoute("/spaces/product/explore")).toBeUndefined();
    expect(resolveSpaceScratchpadRoute("/scratchpad")).toBeUndefined();
    expect(resolveSpaceScratchpadRoute("/spaces/a%2Fb/scratchpad")).toBeUndefined();
    expect(resolveSpaceScratchpadRoute("/spaces/product/scratchpad?filter=tagSearch%3Ax")).toEqual({
      spaceName: "spaces/product",
    });
  });
});

describe("useSpaceScratchpad", () => {
  beforeEach(() => {
    clients.getOrCreateSpaceScratchpad.mockReset();
  });

  it("requests the child scratchpad for the parent space with viewer-scoped keys", async () => {
    const scratchpad = create(SpaceSchema, { name: "spaces/child", title: "Scratchpad", isScratchpad: true });
    clients.getOrCreateSpaceScratchpad.mockResolvedValue(scratchpad);
    const client = createQueryClient();
    const view = renderHook(({ user }) => useSpaceScratchpad(user, PARENT), {
      initialProps: { user: VIEWER },
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(clients.getOrCreateSpaceScratchpad).toHaveBeenCalledWith({ parent: PARENT });
    expect(view.result.current.data?.name).toBe("spaces/child");
    expect(spaceKeys.scratchpad(VIEWER, PARENT)).not.toEqual(spaceKeys.scratchpad(OTHER_VIEWER, PARENT));
  });

  it("stays idle without a viewer or parent space", async () => {
    const client = createQueryClient();
    const { result } = renderHook(() => useSpaceScratchpad(undefined, undefined), { wrapper: createWrapper(client) });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(clients.getOrCreateSpaceScratchpad).not.toHaveBeenCalled();
  });
});
