import { describe, expect, it, vi } from "vitest";
import { fetchExportMemos } from "@/components/Export/fetchExportMemos";

const listMemos = vi.hoisted(() => vi.fn());
vi.mock("@/connect", () => ({ memoServiceClient: { listMemos } }));

describe("fetchExportMemos", () => {
  it("pages once per state, drops excluded tags, sorts oldest-first, caps at 1000", async () => {
    listMemos
      .mockResolvedValueOnce({
        memos: [{ name: "m2", content: "#keep b", tags: ["keep"], createTime: { seconds: "20" } }],
        nextPageToken: "t",
      })
      .mockResolvedValueOnce({
        memos: [
          { name: "m1", content: "#keep a", tags: ["keep"], createTime: { seconds: "10" } },
          { name: "m3", content: "#drop c", tags: ["drop"], createTime: { seconds: "30" } },
        ],
        nextPageToken: "",
      })
      .mockResolvedValueOnce({ memos: [], nextPageToken: "" });
    const { memos, truncated } = await fetchExportMemos({
      includeTags: ["keep"],
      excludeTags: ["drop"],
      includeArchived: true,
    });
    expect(truncated).toBe(false);
    expect(memos.map((memo) => memo.name)).toEqual(["m1", "m2"]);
    expect(listMemos).toHaveBeenCalledTimes(3);
  });
});
