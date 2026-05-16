import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { QuoteLine } from "../types";
import { useQuoteStore } from "../store/quoteStore";
import { applyQuoteNumbering } from "../utils/quoteNumbering";
import { getQuoteLineTotalHt } from "../utils/quoteCalculations";

type Row = QuoteLine & { number: string };

const BILLABLE_KINDS = new Set<QuoteLine["kind"]>(["ouvrage", "fourniture", "main_oeuvre", "sous_traitance", "materiel", "divers"]);

export function QuoteLineTable() {
  const lines = useQuoteStore((state) => state.draft.lines);
  const updateLine = useQuoteStore((state) => state.updateLine);
  const deleteLine = useQuoteStore((state) => state.deleteLine);
  const reorderLines = useQuoteStore((state) => state.reorderLines);
  const numberedLines = applyQuoteNumbering(lines);

  function move(row: Row, direction: -1 | 1) {
    const index = numberedLines.findIndex((line) => line.id === row.id);
    const target = numberedLines[index + direction];
    if (target) reorderLines(row.id, target.id);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="w-16 px-3 py-2 text-left font-medium">N</th>
            <th className="px-3 py-2 text-left font-medium">Designation</th>
            <th className="w-24 px-3 py-2 text-left font-medium">Qte</th>
            <th className="w-20 px-3 py-2 text-left font-medium">Unite</th>
            <th className="w-28 px-3 py-2 text-left font-medium">PU HT</th>
            <th className="w-24 px-3 py-2 text-left font-medium">TVA</th>
            <th className="w-28 px-3 py-2 text-right font-medium">Total HT</th>
            <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {numberedLines.map((row, index) => {
            if (row.kind === "section") return <SectionRow key={row.id} row={row} onMove={move} onDelete={deleteLine} onChange={(designation) => updateLine(row.id, { designation })} />;
            if (row.kind === "sous_section") return <SubSectionRow key={row.id} row={row} onMove={move} onDelete={deleteLine} onChange={(designation) => updateLine(row.id, { designation })} />;
            if (row.kind === "texte") return <TextRow key={row.id} row={row} onMove={move} onDelete={deleteLine} onChange={(designation) => updateLine(row.id, { designation })} />;
            if (row.kind === "saut_page") return <PageBreakRow key={row.id} row={row} onMove={move} onDelete={deleteLine} />;
            return (
              <tr key={row.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60">
                <td className="px-3 py-2 text-slate-500">{row.number}</td>
                <td className="px-3 py-2">
                  <input className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={row.designation} onChange={(event) => updateLine(row.id, { designation: event.target.value })} />
                  <div className="px-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">{lineKindLabel(row.kind)}</div>
                </td>
                <td className="px-3 py-2"><NumberInput value={row.quantity} onChange={(quantity) => updateLine(row.id, { quantity })} /></td>
                <td className="px-3 py-2">
                  <input className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={row.unit} onChange={(event) => updateLine(row.id, { unit: event.target.value })} />
                </td>
                <td className="px-3 py-2"><NumberInput value={row.unitPriceHt} onChange={(unitPriceHt) => updateLine(row.id, { unitPriceHt })} /></td>
                <td className="px-3 py-2"><VatInput value={row.vatRate} onChange={(vatRate) => updateLine(row.id, { vatRate })} /></td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{money(getQuoteLineTotalHt(row))}</td>
                <td className="px-3 py-2">
                  <RowActions row={row} first={index === 0} last={index === numberedLines.length - 1} onMove={move} onDelete={deleteLine} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!numberedLines.length ? <div className="p-6 text-center text-sm text-slate-500">Ajoutez une section, une ligne ou un ouvrage depuis les boutons ou la bibliotheque.</div> : null}
    </div>
  );
}

function SectionRow({ row, onChange, onDelete, onMove }: { row: Row; onChange: (value: string) => void; onDelete: (id: string) => void; onMove: (row: Row, direction: -1 | 1) => void }) {
  return (
    <tr className="border-t border-slate-100 bg-slate-900 text-white">
      <td className="px-3 py-3 font-semibold">{row.number}</td>
      <td className="px-3 py-3" colSpan={6}>
        <input className="w-full bg-transparent text-base font-semibold outline-none" value={row.designation} onChange={(event) => onChange(event.target.value)} />
      </td>
      <td className="px-3 py-3"><RowActions row={row} onMove={onMove} onDelete={onDelete} /></td>
    </tr>
  );
}

function SubSectionRow({ row, onChange, onDelete, onMove }: { row: Row; onChange: (value: string) => void; onDelete: (id: string) => void; onMove: (row: Row, direction: -1 | 1) => void }) {
  return (
    <tr className="border-t border-slate-100 bg-slate-100">
      <td className="px-3 py-3 font-medium text-slate-500">{row.number}</td>
      <td className="px-3 py-3" colSpan={6}>
        <input className="w-full bg-transparent font-semibold text-slate-900 outline-none" value={row.designation} onChange={(event) => onChange(event.target.value)} />
      </td>
      <td className="px-3 py-3"><RowActions row={row} onMove={onMove} onDelete={onDelete} /></td>
    </tr>
  );
}

function TextRow({ row, onChange, onDelete, onMove }: { row: Row; onChange: (value: string) => void; onDelete: (id: string) => void; onMove: (row: Row, direction: -1 | 1) => void }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 text-slate-500">{row.number}</td>
      <td className="px-3 py-2" colSpan={6}>
        <textarea className="min-h-14 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 outline-none focus:border-blue-300" value={row.designation} onChange={(event) => onChange(event.target.value)} />
      </td>
      <td className="px-3 py-2"><RowActions row={row} onMove={onMove} onDelete={onDelete} /></td>
    </tr>
  );
}

function PageBreakRow({ row, onDelete, onMove }: { row: Row; onDelete: (id: string) => void; onMove: (row: Row, direction: -1 | 1) => void }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-3 text-slate-500">{row.number}</td>
      <td className="px-3 py-3" colSpan={6}>
        <div className="rounded-xl border border-dashed border-slate-300 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Saut de page</div>
      </td>
      <td className="px-3 py-3"><RowActions row={row} onMove={onMove} onDelete={onDelete} /></td>
    </tr>
  );
}

function RowActions({ row, first = false, last = false, onMove, onDelete }: { row: Row; first?: boolean; last?: boolean; onMove: (row: Row, direction: -1 | 1) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={first} onClick={() => onMove(row, -1)} title="Monter"><ArrowUp className="h-4 w-4" /></button>
      <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={last} onClick={() => onMove(row, 1)} title="Descendre"><ArrowDown className="h-4 w-4" /></button>
      <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(row.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />;
}

function VatInput({ value, onChange }: { value: QuoteLine["vatRate"]; onChange: (value: QuoteLine["vatRate"]) => void }) {
  return (
    <select className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none hover:border-slate-200 focus:border-blue-300" value={value} onChange={(event) => onChange(Number(event.target.value) as QuoteLine["vatRate"])}>
      {[0, 5.5, 10, 20].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
    </select>
  );
}

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function lineKindLabel(kind: QuoteLine["kind"]) {
  if (!BILLABLE_KINDS.has(kind)) return "";
  const labels: Partial<Record<QuoteLine["kind"], string>> = {
    ouvrage: "Ouvrage",
    fourniture: "Fourniture",
    main_oeuvre: "Main-d'oeuvre",
    sous_traitance: "Sous-traitance",
    materiel: "Materiel",
    divers: "Divers",
  };
  return labels[kind] ?? "";
}
