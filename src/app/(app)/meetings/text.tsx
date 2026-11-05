import { CheckSquare, Square } from "lucide-react";

/** 把純文字（含 Notion 轉出的標題、清單、待辦）排版成易讀的段落 */
export function RichText({ text, clamp }: { text: string; clamp?: boolean }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className={`space-y-1 text-sm leading-relaxed ${clamp ? "line-clamp-4" : ""}`}>
      {lines.map((raw, i) => {
        const indent = raw.match(/^\s*/)![0].length >= 2;
        const l = raw.trim();
        if (!l) return clamp ? null : <div key={i} className="h-2" />;
        const cls = indent ? "pl-5" : "";
        const todo = l.match(/^(?:[•\-*]\s*)?(\[( |x|X)?\]|☐|☑)\s*(.*)$/);
        if (todo) {
          const done = todo[1] === "☑" || /x/i.test(todo[2] ?? "");
          const Icon = done ? CheckSquare : Square;
          return <div key={i} className={`flex gap-2 ${cls}`}><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${done ? "text-success" : "text-ink-subtle"}`} aria-label={done ? "已完成" : "未完成"} /><span className={done ? "text-ink-muted line-through" : ""}>{todo[3]}</span></div>;
        }
        const h = l.match(/^(#{1,3})\s+(.*)$/);
        if (h) return <div key={i} className={`pt-2 font-heading font-semibold ${h[1].length === 1 ? "text-base" : "text-sm"}`}>{h[2]}</div>;
        const li = l.match(/^(?:[•\-*]|\d+[.)])\s+(.*)$/);
        if (li) return <div key={i} className={`flex gap-2 ${cls}`}><span className="text-ink-subtle" aria-hidden>•</span><span>{li[1]}</span></div>;
        return <p key={i} className={cls}>{l}</p>;
      })}
    </div>
  );
}
