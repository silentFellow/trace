import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagAutocompleteField } from "@/components/Export/TagAutocompleteField";

describe("TagAutocompleteField", () => {
  const availableTags = ["work", "worklog", "idea"];

  it("suggests matching tags as you type and adds a chip on pick", () => {
    const onAdd = vi.fn();
    render(
      <TagAutocompleteField
        label="Include tags"
        placeholder="Search…"
        availableTags={availableTags}
        selected={[]}
        reservedTags={[]}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Include tags" }), { target: { value: "wor" } });
    expect(screen.getByText("#work")).toBeInTheDocument();
    expect(screen.getByText("#worklog")).toBeInTheDocument();
    expect(screen.queryByText("#idea")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("#work"));
    expect(onAdd).toHaveBeenCalledWith("work");
  });

  it("hides tags already picked in this or the opposite list", () => {
    render(
      <TagAutocompleteField
        label="Include tags"
        placeholder="Search…"
        availableTags={availableTags}
        selected={["work"]}
        reservedTags={["worklog"]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Include tags" }), { target: { value: "wor" } });
    expect(screen.queryByRole("button", { name: "#work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "#worklog" })).not.toBeInTheDocument();
  });

  it("renders selected tags as removable chips", () => {
    const onRemove = vi.fn();
    render(
      <TagAutocompleteField
        label="Include tags"
        placeholder="Search…"
        availableTags={availableTags}
        selected={["work"]}
        reservedTags={[]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("#work")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove work" }));
    expect(onRemove).toHaveBeenCalledWith("work");
  });
});
