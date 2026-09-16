import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateInputPopover } from "@/components/Export/DateInputPopover";

vi.mock("@/components/StatisticsView/MonthNavigator", () => ({
  MonthNavigator: () => <div>month-navigator-stub</div>,
}));
vi.mock("@/components/ActivityCalendar", () => ({
  MonthCalendar: ({ onClick }: { onClick?: (date: string) => void }) => (
    <button type="button" onClick={() => onClick?.("2026-09-10")}>
      calendar-stub
    </button>
  ),
}));

describe("DateInputPopover", () => {
  it("shows the current date and updates it once a day is picked", () => {
    const onChange = vi.fn();
    render(<DateInputPopover label="Start date" date="2026-09-01" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /Start date/ })).toHaveTextContent("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: /Start date/ }));
    fireEvent.click(screen.getByText("calendar-stub"));

    expect(onChange).toHaveBeenCalledWith("2026-09-10");
  });
});
