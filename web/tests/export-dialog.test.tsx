import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportDialog } from "@/components/Export/ExportDialog";
import { fetchExportMemos } from "@/components/Export/fetchExportMemos";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/Export/fetchExportMemos", () => ({ fetchExportMemos: vi.fn() }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => ({ data: [] }) }));
vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: { work: 2, idea: 1 } }),
  useUsersByUsernames: () => ({ data: [] }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: "" }) }));
vi.mock("@/components/ActivityCalendar", () => ({
  MonthCalendar: ({ onClick }: { onClick?: (date: string) => void }) => (
    <button type="button" onClick={() => onClick?.("2026-09-10")}>
      calendar-stub
    </button>
  ),
}));
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

describe("ExportDialog", () => {
  beforeEach(() => {
    vi.mocked(fetchExportMemos).mockReset();
  });

  it("disables a tag in the opposite list once picked", () => {
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Include tag work" }));
    expect(screen.getByRole("checkbox", { name: "Exclude tag work" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Exclude tag idea" })).not.toBeDisabled();
  });

  it("downloads one Markdown file for the default scope", async () => {
    vi.mocked(fetchExportMemos).mockResolvedValue({
      memos: [create(MemoSchema, { content: "hello", createTime: { seconds: BigInt(10) } })],
      truncated: false,
    });
    const createObjectURL = vi.fn(() => "blob:export");
    window.URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "export.export-markdown" }));
    await waitFor(() =>
      expect(fetchExportMemos).toHaveBeenCalledWith(
        expect.objectContaining({ spaceName: undefined, includeTags: [], excludeTags: [], includeArchived: false }),
      ),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("renders fetched memos into the print view on PDF export", async () => {
    vi.mocked(fetchExportMemos).mockResolvedValue({
      memos: [create(MemoSchema, { content: "printable note" })],
      truncated: false,
    });
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "export.export-pdf" }));
    await waitFor(() => expect(screen.getByTestId("export-print-root")).toHaveTextContent("printable note"));
  });

  it("passes the picked range and archived flag through", async () => {
    vi.mocked(fetchExportMemos).mockResolvedValue({ memos: [], truncated: false });
    render(<ExportDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText("calendar-stub"));
    fireEvent.click(screen.getByText("calendar-stub"));
    fireEvent.click(screen.getByRole("checkbox", { name: "export.include-archived" }));
    fireEvent.click(screen.getByRole("button", { name: "export.export-markdown" }));
    await waitFor(() =>
      expect(fetchExportMemos).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true, range: expect.objectContaining({}) })),
    );
  });
});
