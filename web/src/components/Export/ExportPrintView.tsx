import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import MemoContent from "../MemoContent";
import "./export-print.css";

const formatPrintDate = (seconds: bigint | string | undefined): string => {
  const date = new Date(Number(seconds ?? 0) * 1000);
  return date.toISOString().slice(0, 10);
};

export function ExportPrintView({ memos }: { memos: Memo[] }) {
  return (
    <div data-testid="export-print-root" className="export-print-root light">
      {memos.map((memo) => (
        <article key={memo.name} className="export-print-memo">
          <h2>{formatPrintDate(memo.createTime?.seconds)}</h2>
          <MemoContent content={memo.content} attachments={memo.attachments} />
        </article>
      ))}
    </div>
  );
}
