import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const formatExportDate = (seconds: bigint | string | undefined): string => {
  // Local date, so headings match the date-range picker instead of shifting late-night notes to UTC's next day.
  const date = new Date(Number(seconds ?? 0) * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const attachmentUrl = (origin: string, attachment: Memo["attachments"][number]): string =>
  attachment.externalLink || `${origin}/file/${attachment.name}/${attachment.filename}`;

const buildMemoBody = (memo: Memo, origin: string): string => {
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
  return content;
};

/** Memos arrive oldest-first; grouping emits a date heading only when the day changes. */
export function buildExportMarkdown(memos: Memo[], origin: string, { groupByDate = true }: { groupByDate?: boolean } = {}): string {
  let previousDate: string | undefined;
  return memos
    .map((memo) => {
      const date = formatExportDate(memo.createTime?.seconds);
      const body = buildMemoBody(memo, origin);
      const sameDay = groupByDate && date === previousDate;
      previousDate = date;
      return sameDay ? body : `## ${date}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}
