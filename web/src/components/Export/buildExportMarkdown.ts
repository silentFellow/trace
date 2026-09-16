import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const formatExportDate = (seconds: bigint | string | undefined): string => {
  const date = new Date(Number(seconds ?? 0) * 1000);
  return date.toISOString().slice(0, 10);
};

const attachmentUrl = (origin: string, attachment: Memo["attachments"][number]): string =>
  attachment.externalLink || `${origin}/file/${attachment.name}/${attachment.filename}`;

const buildMemoMarkdown = (memo: Memo, origin: string): string => {
  let content = memo.content ?? "";
  const linkedAttachments = new Set<string>();

  for (const attachment of memo.attachments) {
    const url = attachmentUrl(origin, attachment);
    const imagePattern = new RegExp(
      `!\\[([^\\]]*)\\]\\(([^)]*${attachment.name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^)]*)\\)`,
      "g",
    );
    content = content.replace(imagePattern, (_match, alt: string) => {
      linkedAttachments.add(attachment.name);
      return `![${alt}](${url})`;
    });
    if (content.includes(url) || content.includes(`/file/${attachment.name}`)) linkedAttachments.add(attachment.name);
  }

  content = content.replaceAll("](/", `](${origin}/`);
  const missingLinks = memo.attachments
    .filter((attachment) => !linkedAttachments.has(attachment.name))
    .map((attachment) => `- ![${attachment.filename}](${attachmentUrl(origin, attachment)})`);
  if (missingLinks.length > 0) content = `${content}\n\nAttachments:\n${missingLinks.join("\n")}`;
  return `## ${formatExportDate(memo.createTime?.seconds)}\n\n${content}`;
};

export function buildExportMarkdown(memos: Memo[], origin: string): string {
  return memos.map((memo) => buildMemoMarkdown(memo, origin)).join("\n\n---\n\n");
}
