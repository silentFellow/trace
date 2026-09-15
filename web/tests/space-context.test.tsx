import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SpaceProvider, useSpaceContext } from "@/contexts/SpaceContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { name: "users/test" } }),
}));

const queries = vi.hoisted(() => ({
  useSpaces: vi.fn(),
  useSpace: vi.fn(),
}));

vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: queries.useSpaces,
  useSpace: queries.useSpace,
}));

const Probe = () => {
  const { selectedSpaceName } = useSpaceContext();
  return <p data-testid="selected-space">{selectedSpaceName ?? ""}</p>;
};

const setup = (path: string) => {
  queries.useSpaces.mockReturnValue({ data: [], isPending: false, isError: false });
  queries.useSpace.mockReturnValue({ data: undefined, isSuccess: false, error: null, refetch: vi.fn() });
  render(
    <MemoryRouter initialEntries={[path]}>
      <SpaceProvider>
        <Probe />
      </SpaceProvider>
    </MemoryRouter>,
  );
};

describe("SpaceProvider route scope", () => {
  it("keeps the collection Space on collection URLs", () => {
    setup("/spaces/a/explore");
    expect(screen.getByTestId("selected-space")).toHaveTextContent("spaces/a");
  });

  it("exposes the parent Space on the nested scratchpad URL", () => {
    setup("/spaces/a/scratchpad");
    expect(screen.getByTestId("selected-space")).toHaveTextContent("spaces/a");
  });

  it("selects no Space on the global home", () => {
    setup("/");
    expect(screen.getByTestId("selected-space").textContent).toBe("");
  });
});
