import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { buildExportMarkdown } from "@/components/Export/buildExportMarkdown";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
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
