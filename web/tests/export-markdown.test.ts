import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { buildExportMarkdown } from "@/components/Export/buildExportMarkdown";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

describe("buildExportMarkdown", () => {
  it("headers by date, separates with ---, keeps attachment links", () => {
    const output = buildExportMarkdown(
      [
        create(MemoSchema, { content: "hello", createTime: { seconds: BigInt(new Date(2026, 8, 1, 12).getTime() / 1000) } }),
        create(MemoSchema, {
          content: "![a](/file/x/a.png)",
          createTime: { seconds: BigInt(new Date(2026, 8, 2, 12).getTime() / 1000) },
        }),
      ],
      "https://notes.example",
    );
    expect(output).toContain("## 2026-09-01");
    expect(output).toContain("## 2026-09-02");
    expect(output).toContain("---");
    expect(output).toContain("https://notes.example/file/x/a.png");
  });

  const at = (year: number, month: number, day: number, hour: number) =>
    create(MemoSchema, {
      content: `note ${day}-${hour}`,
      createTime: { seconds: BigInt(new Date(year, month, day, hour).getTime() / 1000) },
    });

  it("groups same-day memos under one local-date heading by default", () => {
    const output = buildExportMarkdown([at(2026, 8, 16, 9), at(2026, 8, 16, 23), at(2026, 8, 17, 8)], "https://notes.example");
    expect(output).toBe("## 2026-09-16\n\nnote 16-9\n\n---\n\nnote 16-23\n\n---\n\n## 2026-09-17\n\nnote 17-8");
  });

  it("keeps one heading per memo when grouping is off", () => {
    const output = buildExportMarkdown([at(2026, 8, 16, 9), at(2026, 8, 16, 23)], "https://notes.example", { groupByDate: false });
    expect(output).toBe("## 2026-09-16\n\nnote 16-9\n\n---\n\n## 2026-09-16\n\nnote 16-23");
  });

  it("adds attachments missing from memo content as Markdown images", () => {
    const output = buildExportMarkdown(
      [
        create(MemoSchema, {
          content: "A note without an inline image",
          attachments: [create(AttachmentSchema, { name: "attachments/photo", filename: "photo.png", type: "image/png" })],
        }),
      ],
      "https://notes.example",
    );

    expect(output).toContain("- ![photo.png](https://notes.example/file/attachments/photo/photo.png)");
  });

  it("converts managed image embeds to absolute Markdown image URLs", () => {
    const output = buildExportMarkdown(
      [
        create(MemoSchema, {
          content: "![photo](/file/attachments/photo)",
          attachments: [create(AttachmentSchema, { name: "attachments/photo", filename: "photo.png", type: "image/png" })],
        }),
      ],
      "https://notes.example",
    );

    expect(output).toContain("![photo](https://notes.example/file/attachments/photo/photo.png)");
  });
});
