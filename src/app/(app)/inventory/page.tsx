import { db } from "@/lib/db";
import { requireUser, can } from "@/lib/auth";
import { twd, num, date } from "@/lib/format";
import { saveItem, adjustStock } from "@/app/actions/purchasing";
import { PageHeader, Card, Empty, Field, Select, Stat, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import Link from "next/link";

export default async function Inventory({ searchParams }: { searchParams: Promise<{ edit?: string; item?: string }> }) {
  const user = await requireUser("inventory");
  const sp = await searchParams;
  const manage = can(user, "purchasing");
  const items = await db.inventoryItem.findMany({ orderBy: [{ category: "asc" }, { sku: "asc" }] });
  const e = sp.edit ? items.find((i) => i.id === sp.edit) : undefined;
  const moves = await db.stockMovement.findMany({ where: sp.item ? { itemId: sp.item } : undefined, include: { item: true }, orderBy: { date: "desc" }, take: 30 });
  const value = items.reduce((s, i) => s + i.quantity * i.cost, 0);
  const low = items.filter((i) => i.reorderLevel > 0 && i.quantity <= i.reorderLevel);
  return (
    <>
      <PageHeader title="庫存" sub="耗材、器材、印刷品、樣品" />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="品項數" value={items.length} />
        {manage && <Stat label="庫存總值" value={twd(value)} />}
        <Stat label="低於安全存量" value={low.length} tone={low.length ? "bad" : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="品項" pad={false} className="lg:col-span-2">
          {items.length === 0 ? <Empty /> : (
            <table className="tbl">
              <thead><tr><th>SKU</th><th>品名</th><th>分類</th><th>位置</th><th className="text-right">數量</th>{manage && <th className="text-right">單位成本</th>}<th /></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.sku}</td>
                  <td><Link className="link" href={`/inventory?item=${i.id}`}>{i.name}</Link></td>
                  <td>{i.category}</td><td className="text-xs">{i.location}</td>
                  <td className="num">{num(i.quantity)} {i.unit} {i.reorderLevel > 0 && i.quantity <= i.reorderLevel && <Badge label="補貨" tone="red" />}</td>
                  {manage && <td className="num">{twd(i.cost)}</td>}
                  <td className="text-right">{manage && <Link className="btn-secondary btn-sm" href={`/inventory?edit=${i.id}`}>編輯</Link>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="領用 / 盤點">
            <form action={adjustStock} className="space-y-3">
              <Field label="品項"><Select name="itemId" required placeholder="選擇品項" defaultValue={sp.item} options={items.map((i) => ({ value: i.id, label: `${i.name}（剩 ${num(i.quantity)}${i.unit}）` }))} /></Field>
              <Field label="動作"><Select name="mode" options={[{ value: "OUT", label: "領用（扣除數量）" }, ...(manage ? [{ value: "ADJ", label: "盤點（設定實際數量）" }] : [])]} /></Field>
              <Field label="數量"><input name="quantity" type="number" step="any" required className="input" /></Field>
              <Field label="備註 / 用途"><input name="note" className="input" placeholder="例如：XX 專案拍攝" /></Field>
              <SubmitButton>送出</SubmitButton>
            </form>
          </Card>
          {manage && (
            <Card title={e ? `編輯 ${e.name}` : "新增品項"}>
              <form action={saveItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {e && <input type="hidden" name="id" value={e.id} />}
                <Field label="SKU *"><input name="sku" required defaultValue={e?.sku} className="input" /></Field>
                <Field label="品名 *"><input name="name" required defaultValue={e?.name} className="input" /></Field>
                <Field label="分類"><input name="category" defaultValue={e?.category ?? ""} className="input" list="cats" /></Field>
                <Field label="單位"><input name="unit" defaultValue={e?.unit ?? "個"} className="input" /></Field>
                <Field label="單位成本"><input name="cost" type="number" step="any" defaultValue={e?.cost ?? 0} className="input" /></Field>
                <Field label="安全存量"><input name="reorderLevel" type="number" step="any" defaultValue={e?.reorderLevel ?? 0} className="input" /></Field>
                {!e && <Field label="期初數量"><input name="quantity" type="number" step="any" defaultValue={0} className="input" /></Field>}
                <Field label="存放位置"><input name="location" defaultValue={e?.location ?? ""} className="input" /></Field>
                <datalist id="cats">{[...new Set(items.map((i) => i.category).filter(Boolean))].map((c) => <option key={c} value={c!} />)}</datalist>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2"><SubmitButton>儲存</SubmitButton>{e && <Link href="/inventory" className="btn-secondary">取消</Link>}</div>
              </form>
            </Card>
          )}
        </div>
        <Card title={sp.item ? `異動紀錄：${items.find((i) => i.id === sp.item)?.name ?? ""}` : "最近異動"} pad={false} className="lg:col-span-3">
          {moves.length === 0 ? <Empty /> : (
            <table className="tbl"><tbody>{moves.map((m) => (
              <tr key={m.id}><td>{date(m.date)}</td><td>{m.item.name}</td><td>{m.reason}</td><td className={`num ${m.change < 0 ? "text-danger" : "text-success"}`}>{m.change > 0 ? "+" : ""}{num(m.change)} {m.item.unit}</td></tr>
            ))}</tbody></table>
          )}
        </Card>
      </div>
    </>
  );
}
