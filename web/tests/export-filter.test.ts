import { describe, expect, it } from "vitest";
import { buildExportFilter } from "@/components/Export/buildExportFilter";

describe("buildExportFilter", () => {
  it("returns undefined with no scope, range, or tags", () => {
    expect(buildExportFilter({ includeTags: [] })).toBeUndefined();
  });

  it("combines space, created_ts range, and tag OR", () => {
    const filter = buildExportFilter({
      spaceName: "spaces/a",
      range: { startTimestamp: 1000, endTimestamp: 2000 },
      includeTags: ["work", "idea"],
    });
    expect(filter).toContain(`space == "spaces/a"`);
    expect(filter).toContain("created_ts >=");
    expect(filter).toContain(`tag in ["work", "idea"]`);
  });
});
