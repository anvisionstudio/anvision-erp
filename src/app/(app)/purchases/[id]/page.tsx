import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { setPOStatus, receivePO, deletePO } from "@/app/actions/purchasing";
import { PageHeader, Badge } from "@/components/ui";
import { ConfirmButton, PrintButton } from "@/components/client";
import { DocumentView } from "@/components/document";

export default async function PODetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("purchasing");
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { vendor: true, project: true, items: true } });
  if (!po) notFound();
  const editable = po.status === "DRAFT" || po.status === "ORDERED";
  return (
    <>
      <PageHeader title={`採購單 ${po.number}`} back="/purchases" sub={<Badge status={po.status} />}
        actions={<>
          <PrintButton />
          {editable && <Link href={`/purchases/${po.id}/edit`} className="btn-secondary">編輯</Link>}
          {po.status === "DRAFT" && <ConfirmButton action={setPOStatus.bind(null, po.id, "ORDERED")} message="確認向供應商下單？" className="btn-primary">確認下單</ConfirmButton>}
          {po.status === "ORDERED" && <ConfirmButton action={receivePO.bind(null, po.id)} message="確認驗收到貨？庫存品項將入庫，並產生應付帳款。" className="btn-primary">驗收到貨</ConfirmButton>}
          {editable && <ConfirmButton action={setPOStatus.bind(null, po.id, "CANCELLED")} message="取消此採購單？" className="btn-secondary">取消採購</ConfirmButton>}
          {editable && <ConfirmButton action={deletePO.bind(null, po.id)} message="刪除此採購單？" className="btn-danger">刪除</ConfirmButton>}
          {po.status === "RECEIVED" && <Link href="/expenses?status=UNPAID" className="btn-secondary">查看應付帳款</Link>}
        </>} />
      <DocumentView kind="採購單" number={po.number} party={po.vendor} partyLabel="供應商"
        meta={[["採購日期", date(po.orderDate)], ...(po.project ? [["專案", po.project.name] as [string, string]] : [])]}
        items={po.items} taxRate={po.taxRate} notes={po.notes} />
    </>
  );
}
