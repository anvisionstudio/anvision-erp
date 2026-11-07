"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-danger">操作未完成</h2>
      <p className="mt-2 text-sm text-ink-muted">{error.digest ? "系統發生錯誤，已自動記錄並通知管理員。請稍後再試。" : error.message || "發生錯誤，請稍後再試"}</p>
      {error.digest && <p className="mt-2 text-xs text-ink-muted">錯誤代碼：<span className="select-all font-mono">{error.digest}</span>（回報問題時請提供）</p>}
      <div className="mt-4 flex justify-center gap-2">
        <button className="btn-secondary" onClick={() => history.back()}>返回上一頁</button>
        <button className="btn-primary" onClick={reset}>重試</button>
      </div>
    </div>
  );
}
