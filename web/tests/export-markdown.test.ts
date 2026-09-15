import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { buildExportMarkdown } from "@/components/Export/buildExportMarkdown";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

describe("buildExportMarkdown", () => {
  it("headers by date, separates with ---, keeps attachment links", () => {
    const output = buildExportMarkdown(
      [
        create(MemoSchema, { content: "hello", createTime: { seconds: BigInt(Date.UTC(2026, 8, 1) / 1000) } }),
        create(MemoSchema, {
          content: "![a](/file/x/a.png)",
          createTime: { seconds: BigInt(Date.UTC(2026, 8, 2) / 1000) },
        }),
      ],
      "https://notes.example",
    );
    expect(output).toContain("## 2026-09-01");
    expect(output).toContain("## 2026-09-02");
    expect(output).toContain("---");
    expect(output).toContain("https://notes.example/file/x/a.png");
  });
});
