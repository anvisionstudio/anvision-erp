import styles from "./sheet.module.css";
import type { Company } from "@/lib/settings";
import { totals } from "@/lib/format";

type Party = { name: string; contact?: string | null; phone?: string | null; email?: string | null; address?: string | null; taxId?: string | null; website?: string | null };
type Line = { description: string; quantity: number; unitPrice: number; unit?: string | null; isGroup?: boolean };

const money = (n: number) => (Math.round(n) === 0 ? "-" : Math.round(n).toLocaleString("en-US"));
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
const d = (x: Date) => `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;

/**
 * 報價單 / 請款單 A4 版面（依景安設計的報價單範本）。
 * 螢幕預覽與列印 / 存成 PDF 使用同一份版面。
 */
export function DocSheet({
  co, kind, number, title, party, date, validUntil, items, taxRate, notes, showValidity = true,
}: {
  co: Company; kind: string; number: string; title: string; party: Party; date: Date; validUntil?: Date | null;
  items: Line[]; taxRate: number; notes?: string | null; showValidity?: boolean;
}) {
  const t = totals(items, taxRate);
  const validDays = validUntil ? Math.max(1, Math.round((validUntil.getTime() - date.getTime()) / 864e5)) : null;
  const terms = (notes ?? "").split("\n").map((l) => l.trim()).filter(Boolean).filter((l) => !/^有效時限/.test(l));
  return (
    <article className={styles.sheet} aria-label={`${kind} ${number}`}>
      <header className={styles.head}>
        {co.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className={styles.logo} src={co.logo} alt={co.name} />
          : <div className={styles.logoText}>{co.name}</div>}
        <div className={`${styles.addr} ${styles.addr1}`}>
          <div>{co.city || " "}</div>
          <div>{co.address || " "}</div>
          <div>{co.email ? `Mail : ${co.email}` : " "}</div>
          <div>{co.web ? `Web : ${co.web}` : " "}</div>
        </div>
        <div className={`${styles.addr} ${styles.addr2}`}>
          <div>&nbsp;</div>
          <div>{co.phone ? `TEL : ${co.phone}` : " "}</div>
          <div>{co.mobile ? `Mobile : ${co.mobile}` : " "}</div>
          <div>Invoice : {number}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {co.mark && <img className={styles.mark} src={co.mark} alt="" aria-hidden />}
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.kind}>{kind}</div>
        <div className={styles.party}>
          <div>專案聯絡人: {party.contact ?? ""}{party.contact ? `（${party.name}）` : party.name}</div>
          <div>TEL: {party.phone ?? ""}</div>
          <div>E-mail: {party.email ?? ""}</div>
          <div>Address: {party.address ?? ""}</div>
        </div>
        <div className={styles.partyR}>
          <div><span className={styles.k}>統一編號：</span><span className={styles.v}>{party.taxId ?? ""}</span></div>
          <div><span className={styles.k}>網站：</span><span className={styles.v}>{party.website ?? ""}</span></div>
          <div><span className={styles.k}>日期：</span><span className={styles.v}>{d(date)}</span></div>
        </div>
      </header>

      <section className={styles.items}>
        <div className={`${styles.row} ${styles.thead}`}>
          <div>設計服務項目/規格</div><div>數量/單位</div><div>單價</div><div>複價</div>
        </div>
        {items.map((i, idx) =>
          i.isGroup ? (
            <div key={idx} className={styles.group}>{i.description}</div>
          ) : (
            <div key={idx} className={`${styles.row} ${styles.item}`}>
              <div className={styles.desc}>{i.description}</div>
              <div className={styles.qty}>{qty(i.quantity)}{i.unit ?? ""}</div>
              <div className={`${styles.money} ${styles.up}`}><span>NT$</span><span>{money(i.unitPrice)}</span></div>
              <div className={`${styles.money} ${styles.tot}`}><span>NT$</span><span>{money(i.quantity * i.unitPrice)}</span></div>
            </div>
          ),
        )}
      </section>

      <footer className={styles.foot}>
        <div className={styles.terms}>
          <div className={styles.termsTitle}>備註 TERMS</div>
          {showValidity && validDays && <div className={styles.valid}>有效時限：本報價單{validDays}日內有效</div>}
          <div style={showValidity && validDays ? undefined : { marginTop: "2.9pt" }}>
            {terms.map((l, i) => <div key={i} className={styles.term}>{l}</div>)}
          </div>
        </div>
        <div className={styles.totals}>
          <div className={styles.tr}><div className={styles.lab}>小計</div><div /><div className={`${styles.money} ${styles.tot}`}><span>NT$</span><span>{money(t.subtotal)}</span></div></div>
          <div className={styles.tr}><div className={styles.lab}>應稅/營業稅</div><div className={styles.pct}>{Math.round(taxRate * 100)}%</div><div className={`${styles.money} ${styles.tot}`}><span>NT$</span><span>{money(t.tax)}</span></div></div>
          <div className={`${styles.tr} ${styles.grand}`}><div className={styles.lab}>總計/新台幣</div><div /><div className={`${styles.money} ${styles.tot}`}><span>NT$</span><span>{money(t.total)}</span></div></div>
        </div>
        <div className={styles.pay}>
          <div>付款方式：</div>
          {co.payee && <div>收款人 : {co.payee}</div>}
          {co.bankName && <div>銀行 : {co.bankName}</div>}
          {co.bankAccount && <div>銀行帳號 : {co.bankAccount}</div>}
          {co.taxId && <div>統一編號 : {co.taxId}</div>}
          {co.bank && co.bank.split("\n").map((l, i) => <div key={i}>{l}</div>)}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {co.stamp && <img className={styles.stamp} src={co.stamp} alt="公司印章" />}
        <div className={styles.sign}>
          <div>{co.signLeft}<div className={styles.signLine} /></div>
          <div>{co.signRight}<div className={styles.signLine} /></div>
        </div>
      </footer>
    </article>
  );
}
