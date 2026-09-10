import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { ProductCatalogItem } from "../domain/types";

const MAX_SUGGESTIONS = 40;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function productHaystack(product: ProductCatalogItem): string {
  return normalize(
    [product.designation, product.internalReference, product.manufacturerReference, product.brand, product.category]
      .filter(Boolean)
      .join(" "),
  );
}

function productHint(product: ProductCatalogItem): string {
  return [product.brand, product.internalReference ?? product.manufacturerReference, product.mainSupplierName]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Choix d'un produit du catalogue par saisie : on tape quelques lettres, la liste
 * se reduit. Remplace un <select> devenu inutilisable des que le catalogue depasse
 * quelques dizaines de references. La valeur vide correspond a une ligne libre.
 */
export function ProductPicker({
  products,
  value,
  onChange,
  disabled = false,
  placeholder = "Rechercher un produit du catalogue...",
  freeLineLabel = "Ligne libre (saisir la désignation à la main)",
}: {
  products: ProductCatalogItem[];
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  freeLineLabel?: string;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const selected = useMemo(
    () => (value ? products.find((product) => product.id === value) ?? null : null),
    [products, value],
  );

  const haystacks = useMemo(
    () => new Map(products.map((product) => [product.id, productHaystack(product)] as const)),
    [products],
  );

  const suggestions = useMemo(() => {
    const terms = normalize(search).split(" ").filter(Boolean);
    if (!terms.length) return products.slice(0, MAX_SUGGESTIONS);
    return products
      .filter((product) => {
        const haystack = haystacks.get(product.id) ?? "";
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [haystacks, products, search]);

  // La liste retrecit au fil de la frappe : on borne l'index au lieu de le
  // remettre a zero dans un effet, ce qui provoquerait un rendu en cascade.
  const activeIndex = Math.min(highlighted, Math.max(suggestions.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setSearch("");
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    setHighlighted(0);
  }

  function select(productId: string) {
    onChange(productId);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      openList();
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted(Math.min(activeIndex + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const product = suggestions[activeIndex];
      if (product) select(product.id);
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 focus-within:border-blue-400">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          value={open ? search : selected?.designation ?? ""}
          placeholder={selected ? selected.designation : placeholder}
          disabled={disabled}
          onFocus={openList}
          onChange={(event) => {
            if (!open) setOpen(true);
            setSearch(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={onKeyDown}
        />
        {selected && !open ? (
          <button
            type="button"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => onChange("")}
            disabled={disabled}
            title="Revenir a une ligne libre"
            aria-label="Retirer le produit du catalogue"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <li
            role="option"
            aria-selected={!value}
            className="cursor-pointer px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select("")}
          >
            {freeLineLabel}
          </li>

          {suggestions.length ? (
            suggestions.map((product, index) => {
              const hint = productHint(product);
              return (
                <li
                  key={product.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  role="option"
                  aria-selected={product.id === value}
                  className={[
                    "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                    index === activeIndex ? "bg-blue-50" : "hover:bg-slate-50",
                  ].join(" ")}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => select(product.id)}
                >
                  <Check
                    className={["mt-0.5 h-4 w-4 shrink-0", product.id === value ? "text-blue-600" : "text-transparent"].join(" ")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{product.designation}</span>
                    {hint ? <span className="block truncate text-xs text-slate-500">{hint}</span> : null}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-3 text-sm text-slate-500">Aucun produit ne correspond a cette recherche.</li>
          )}

          {suggestions.length === MAX_SUGGESTIONS ? (
            <li className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
              Affinez la recherche pour voir les autres produits.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
