import { MoreHorizontal, Plus, Star, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteLibrary } from "../../hooks/useQuoteLibrary";
import type { QuoteLibraryItem, QuoteLibraryItemType, QuoteLibraryTab } from "../../domain/QuoteLibrary";
import type { CrmQuoteRow } from "../../../../services/crm.service";

type Props = {
  oldQuotes: CrmQuoteRow[];
};

const tabs: Array<{ id: QuoteLibraryTab; label: string }> = [
  { id: "library", label: "Ma bibliotheque" },
  { id: "old_quotes", label: "Anciens devis" },
  { id: "imports", label: "Imports" },
  { id: "works", label: "Ouvrages" },
  { id: "supplies", label: "Fournitures" },
  { id: "labor", label: "MO" },
  { id: "templates", label: "Modeles" },
];

export function QuoteLibrarySidebar({ oldQuotes }: Props) {
  const library = useQuoteLibrary();
  const { addLibraryItem } = useQuoteActions();
  const [menuId, setMenuId] = useState<string | null>(null);
  const visibleTotal = library.filters.tab === "old_quotes" ? oldQuotes.length : library.data.total;
  const pageCount = Math.max(1, Math.ceil(visibleTotal / library.filters.pageSize));

  async function createQuickItem(type: QuoteLibraryItemType) {
    const title = window.prompt("Nom de l'element bibliotheque");
    if (!title) return;
    await library.createItem({ title, type, saleUnitPriceHt: 0, purchaseUnitPriceHt: 0, vatRate: 20, marginRate: 0 });
  }

  async function convertQuoteToTemplate(quote: CrmQuoteRow) {
    await library.createItem({
      title: quote.quote_number,
      type: "section_modele",
      description: quote.description,
      saleUnitPriceHt: quote.montant_ht,
      purchaseUnitPriceHt: 0,
      vatRate: 20,
      payload: { source_quote_id: quote.id },
    });
  }

  function insert(item: QuoteLibraryItem) {
    addLibraryItem(item);
  }

  return (
    <aside className="h-full bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-950">Bibliotheque devis</h2>
        <Button variant="secondary" className="px-2" onClick={() => createQuickItem("fourniture")} title="Creer">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={library.filters.tab === tab.id ? "default" : "secondary"} className="justify-start px-2 py-1 text-xs" onClick={() => library.setTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <Input className="mt-3" value={library.filters.query} onChange={(event) => library.setQuery(event.target.value)} placeholder="Recherche instantanee..." />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs" value={library.filters.family} onChange={(event) => library.setFamily(event.target.value)}>
          {library.families.map((family) => <option key={family} value={family}>{family === "all" ? "Toutes familles" : family}</option>)}
        </select>
        <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs" value={library.filters.type} onChange={(event) => library.setType(event.target.value)}>
          <option value="all">Tous types</option>
          <option value="ouvrage">Ouvrage</option>
          <option value="fourniture">Fourniture</option>
          <option value="main_oeuvre">Main d'oeuvre</option>
          <option value="texte">Texte</option>
          <option value="section_modele">Section</option>
        </select>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={library.filters.favoritesOnly} onChange={(event) => library.setFavoritesOnly(event.target.checked)} />
        Favoris uniquement
      </label>

      {library.filters.tab === "imports" ? (
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:bg-slate-50">
          <Upload className="h-4 w-4" />
          Import CSV/XLSX
          <input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => event.target.files?.[0] && void library.importFile(event.target.files[0])} />
        </label>
      ) : null}

      <div className="mt-4 max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto pr-1">
        {library.filters.tab === "old_quotes"
          ? oldQuotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-950">{quote.quote_number}</div>
                <div className="mt-1 text-xs text-slate-500">{money(quote.montant_ht)} HT - {quote.statut}</div>
                <Button className="mt-2 w-full" variant="secondary" onClick={() => convertQuoteToTemplate(quote)}>Transformer en modele</Button>
              </div>
            ))
          : null}

        {library.filters.tab === "imports"
          ? library.data.imports.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-950">{row.filename}</div>
                <div className="mt-1 text-xs text-slate-500">{row.rowCount} lignes - {row.status}</div>
              </div>
            ))
          : null}

        {library.filters.tab !== "old_quotes" && library.filters.tab !== "imports"
          ? library.data.items.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("application/x-batipro-quote-library-item", JSON.stringify(item))}
                onDoubleClick={() => insert(item)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuId(item.id);
                }}
                className="relative rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
              >
                <button className="block w-full text-left" onClick={() => insert(item)}>
                  <span className="font-medium text-slate-950">{item.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {item.family || "Sans famille"} - {item.type} - {money(item.saleUnitPriceHt)}
                  </span>
                </button>
                <button className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 hover:bg-white" onClick={() => setMenuId(menuId === item.id ? null : item.id)}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {item.isFavorite ? <Star className="absolute right-9 top-3 h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                {menuId === item.id ? (
                  <div className="absolute right-2 top-9 z-20 w-44 rounded-xl border bg-white p-1 shadow-lg">
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => insert(item)}>Inserer</button>
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => library.toggleFavorite(item)}>{item.isFavorite ? "Retirer favori" : "Ajouter favori"}</button>
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => editTitle(item, library.updateItem)}>Renommer</button>
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => library.deleteItem(item.id)}>Archiver</button>
                  </div>
                ) : null}
              </div>
            ))
          : null}

        {!library.loading && library.data.total === 0 && library.filters.tab !== "old_quotes" ? <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">Aucun element.</div> : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-slate-500">
        <span>{visibleTotal} elements</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="px-2 py-1 text-xs" disabled={library.filters.page <= 1} onClick={() => library.setPage(Math.max(1, library.filters.page - 1))}>Prec.</Button>
          <span>{library.filters.page} / {pageCount}</span>
          <Button variant="secondary" className="px-2 py-1 text-xs" disabled={library.filters.page >= pageCount} onClick={() => library.setPage(Math.min(pageCount, library.filters.page + 1))}>Suiv.</Button>
        </div>
      </div>
    </aside>
  );
}

async function editTitle(item: QuoteLibraryItem, updateItem: (input: { id: string; patch: Partial<QuoteLibraryItem> }) => Promise<QuoteLibraryItem>) {
  const title = window.prompt("Nouveau nom", item.title);
  if (!title) return;
  await updateItem({ id: item.id, patch: { title } });
}

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
