import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportDialog } from "@/components/Export/ExportDialog";
import { fetchCurrentViewMemos } from "@/components/Export/fetchCurrentViewMemos";
import { fetchExportMemos } from "@/components/Export/fetchExportMemos";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/Export/fetchExportMemos", () => ({ fetchExportMemos: vi.fn() }));
vi.mock("@/components/Export/fetchCurrentViewMemos", () => ({ fetchCurrentViewMemos: vi.fn() }));
vi.mock("@/components/Export/useCurrentViewExport", () => ({
  useCurrentViewExport: () => ({ filter: 'space == "spaces/current"', state: State.NORMAL, pending: false }),
}));
vi.mock("@/components/Export/DateInputPopover", () => ({
  DateInputPopover: ({ label, date }: { label: string; date: string }) => (
    <div>
      {label}: {date}
    </div>
  ),
}));
vi.mock("@/components/Export/TagAutocompleteField", () => ({
  TagAutocompleteField: ({ label, selected }: { label: string; selected: string[] }) => (
    <div>
      {label}: {selected.join(",")}
    </div>
  ),
}));
vi.mock("@/hooks/useSpaceQueries", () => ({
  useSpaces: () => ({
    data: [
      { name: "spaces/abc", title: "Groceries" },
      { name: "spaces/empty", title: "" },
    ],
  }),
}));
vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: { work: 2, idea: 1 } }),
  useUsersByUsernames: () => ({ data: [] }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
const spaceContextState = vi.hoisted(() => ({ selectedSpaceName: "" }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: spaceContextState.selectedSpaceName }) }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
  findNearestMatchedLanguage: (language: string) => language,
}));

const memo = create(MemoSchema, { content: "hello", createTime: { seconds: BigInt(10) } });

describe("ExportDialog", () => {
  beforeEach(() => {
    vi.mocked(fetchExportMemos).mockReset();
    vi.mocked(fetchCurrentViewMemos).mockReset();
  });

  it("defaults to the Current View tab with Markdown export", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "export.current-view" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText(/export.scope/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export.export-markdown/ })).toBeInTheDocument();
  });

  it("shows the Custom Export filter controls only after switching tabs", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "export.custom" }));
    expect(screen.getByText(/export.start-date/)).toBeInTheDocument();
    expect(screen.getByText(/export.end-date/)).toBeInTheDocument();
    expect(screen.getByText("export.scope")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("exports Markdown from the Current View filter by default", async () => {
    vi.mocked(fetchCurrentViewMemos).mockResolvedValue({ memos: [memo], truncated: false });
    const createObjectURL = vi.fn(() => "blob:export");
    window.URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /export.export-markdown/ }));
    await waitFor(() => expect(fetchCurrentViewMemos).toHaveBeenCalledWith('space == "spaces/current"', State.NORMAL));
    expect(fetchExportMemos).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("exports Markdown from the Custom filter when that tab is active", async () => {
    vi.mocked(fetchExportMemos).mockResolvedValue({ memos: [memo], truncated: false });
    window.URL.createObjectURL = vi.fn(() => "blob:export");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "export.custom" }));
    fireEvent.click(screen.getByRole("button", { name: /export.export-markdown/ }));
    await waitFor(() =>
      expect(fetchExportMemos).toHaveBeenCalledWith(
        expect.objectContaining({ spaceName: undefined, includeTags: [], excludeTags: [], includeArchived: false }),
      ),
    );
    expect(fetchCurrentViewMemos).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("describes the Current View tab scope", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    expect(screen.getByText("export.current-view-description")).toBeInTheDocument();
  });

  it("describes the Custom tab with the scratchpad exclusion", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "export.custom" }));
    expect(screen.getByText("export.custom-description")).toBeInTheDocument();
    expect(screen.queryByText("export.current-view-description")).not.toBeInTheDocument();
  });

  it("shows space titles in the scope selector, never raw resource ids", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "export.custom" }));
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "empty" })).toBeInTheDocument();
    expect(screen.queryByText("spaces/abc")).not.toBeInTheDocument();
    expect(screen.queryByText("spaces/empty")).not.toBeInTheDocument();
  });

  it("shows the selected space title in the trigger, not its resource id", () => {
    spaceContextState.selectedSpaceName = "spaces/abc";
    try {
      render(<ExportDialog open onOpenChange={() => {}} />);
      fireEvent.click(screen.getByRole("tab", { name: "export.custom" }));
      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveTextContent("Groceries");
      expect(trigger.textContent).not.toContain("spaces/");
    } finally {
      spaceContextState.selectedSpaceName = "";
    }
  });

  it("shows the truncation notice instead of downloading when results overflow", async () => {
    vi.mocked(fetchCurrentViewMemos).mockResolvedValue({ memos: [], truncated: true });
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /export.export-markdown/ }));
    await waitFor(() => expect(screen.getByText("export.truncated")).toBeInTheDocument());
  });
});
