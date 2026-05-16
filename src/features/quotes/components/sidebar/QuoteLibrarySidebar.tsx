import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import type { TaskTemplateRow } from "../../../../services/taskLibrary.service";

type Props = {
  templates: TaskTemplateRow[];
};

export function QuoteLibrarySidebar({ templates }: Props) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [page, setPage] = useState(1);
  const { addTemplate } = useQuoteActions();
  const pageSize = 30;

  const families = useMemo(() => ["all", ...Array.from(new Set(templates.map((item) => item.lot || "Sans famille")))], [templates]);
  const rows = useMemo(
    () =>
      templates.filter((item) => {
        const matchesFamily = family === "all" || (item.lot || "Sans famille") === family;
        const haystack = [item.titre, item.lot, item.description_technique, item.remarques].join(" ").toLowerCase();
        return matchesFamily && haystack.includes(query.toLowerCase());
      }),
    [family, query, templates],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <aside className="h-full bg-white p-4">
      <h2 className="font-semibold text-slate-950">Bibliotheque</h2>
      <Input
        className="mt-3"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(1);
        }}
        placeholder="Rechercher ouvrage..."
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {families.map((item) => (
          <Button
            key={item}
            variant={item === family ? "default" : "secondary"}
            className="shrink-0 rounded-full px-3 py-1 text-xs"
            onClick={() => {
              setFamily(item);
              setPage(1);
            }}
          >
            {item}
          </Button>
        ))}
      </div>
      <div className="mt-4 max-h-[calc(100vh-17rem)] space-y-2 overflow-y-auto pr-1">
        {visibleRows.map((item) => (
          <button key={item.id} className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => addTemplate(item)}>
            <span>
              <span className="font-medium text-slate-950">{item.titre}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {item.lot || "Sans famille"} - {item.unite || "u"} - {Number(item.cout_reference_unitaire_ht ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
            </span>
            <Plus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          </button>
        ))}
        {!rows.length ? <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">Aucun element trouve.</div> : null}
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-slate-500">
        <span>{rows.length} elements</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="px-2 py-1 text-xs" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prec.</Button>
          <span>{currentPage} / {pageCount}</span>
          <Button variant="secondary" className="px-2 py-1 text-xs" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Suiv.</Button>
        </div>
      </div>
    </aside>
  );
}
