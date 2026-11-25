import { useMemo } from "react";
import {
  buildChantierZoneTree,
  collectDescendantPieceIds,
  type ChantierZoneRow,
  type ChantierZoneTreeNode,
} from "../../../services/chantierZones.service";

type Props = {
  zones: ChantierZoneRow[];
  selectedPieceIds: string[];
  disabled?: boolean;
  onChange: (pieceIds: string[]) => void;
};

function ZoneTreeItem({
  node, zones, selected, disabled, onChange,
}: {
  node: ChantierZoneTreeNode;
  zones: ChantierZoneRow[];
  selected: Set<string>;
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const descendantPieces = collectDescendantPieceIds(zones, node.id);
  const selectableIds = node.kind === "piece" ? [node.id] : descendantPieces;
  const chosenCount = selectableIds.filter((id) => selected.has(id)).length;
  const checked = selectableIds.length > 0 && chosenCount === selectableIds.length;
  const partiallyChecked = chosenCount > 0 && !checked;
  const kind = node.kind === "batiment" ? "Bâtiment" : node.kind === "niveau" ? "Étage / niveau" : "Pièce";
  return (
    <li className="space-y-1">
      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
        <input type="checkbox" checked={checked}
          disabled={disabled || selectableIds.length === 0}
          onChange={(event) => {
            const next = new Set(selected);
            selectableIds.forEach((id) => event.target.checked ? next.add(id) : next.delete(id));
            onChange([...next]);
          }}/>
        <span className={node.kind === "piece" ? "text-slate-700" : "font-semibold text-slate-900"}>{node.nom}</span>
        <span className="text-xs text-slate-400">{kind}</span>
        {partiallyChecked && <span className="text-xs text-blue-600">{chosenCount}/{selectableIds.length} pièces</span>}
      </label>
      {node.children.length > 0 && (
        <ul className="ml-5 space-y-1 border-l border-slate-200 pl-3">
          {node.children.map((child) => (
            <ZoneTreeItem key={child.id} node={child} zones={zones} selected={selected}
              disabled={disabled} onChange={onChange}/>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ChantierLocationTree({ zones, selectedPieceIds, disabled = false, onChange }: Props) {
  const tree = useMemo(() => buildChantierZoneTree(zones), [zones]);
  const selected = useMemo(() => new Set(selectedPieceIds), [selectedPieceIds]);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Choisissez un bâtiment, un étage ou des pièces.
        Sélectionner un parent sélectionne toutes les pièces qu'il contient.</p>
      {tree.length ? (
        <ul className="space-y-2">
          {tree.map((node) => (
            <ZoneTreeItem key={node.id} node={node} zones={zones} selected={selected}
              disabled={disabled} onChange={onChange}/>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">Aucune architecture définie pour ce chantier.</p>}
    </div>
  );
}
