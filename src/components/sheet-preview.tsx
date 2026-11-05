"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";

const SHEET_PX = (595 / 72) * 96; // A4 寬 595pt ≈ 793px

/** 在頁面中預覽 A4 單據：依容器寬度等比縮小（手機也能看到完整版面） */
export function SheetPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, e.contentRect.width / SHEET_PX)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <div className="mx-auto w-fit overflow-hidden rounded-md shadow-md ring-1 ring-line" style={{ zoom }}>{children}</div>
    </div>
  );
}

/** 列印頁上方工具列（列印時隱藏）；?auto=1 時自動開啟列印對話框 */
export function PrintToolbar({ back, auto }: { back: string; auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div className="no-print sticky top-0 z-sticky flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur">
      <Link href={back} className="btn-secondary"><ChevronLeft className="h-4 w-4" aria-hidden />返回</Link>
      <span className="hidden text-sm text-ink-muted sm:block">在列印視窗選擇「另存為 PDF」，紙張 A4、邊界「無」</span>
      <button type="button" className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />列印 / 下載 PDF</button>
    </div>
  );
}
