import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const formatExportDate = (seconds: bigint | string | undefined): string => {
  const date = new Date(Number(seconds ?? 0) * 1000);
  return date.toISOString().slice(0, 10);
};

export function buildExportMarkdown(memos: Memo[], origin: string): string {
  return memos
    .map((memo) => {
      const content = (memo.content ?? "").replaceAll("](/", `](${origin}/`);
      return `## ${formatExportDate(memo.createTime?.seconds)}\n\n${content}`;
    })
    .join("\n\n---\n\n");
}
