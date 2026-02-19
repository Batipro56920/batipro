import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

type MarkerTool = "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";

type PlanMarker = {
  id: string;
  reserve_id: string;
  type: MarkerTool;
  color: string | null;
  stroke_width: number | null;
  page_number: number | null;
  x1: number | null;
  y1: number | null;
  x2: number | null;
  y2: number | null;
  text: string | null;
  label?: string | null;
  legend_label?: string | null;
  legend_key?: string | null;
  status: string | null;
};

type CreateMarkerInput = {
  type: MarkerTool;
  color: string;
  stroke_width: number;
  page_number: number | null;
  x1: number;
  y1: number;
  x2?: number | null;
  y2?: number | null;
  text?: string | null;
};

type Props = {
  url: string;
  mimeType: string | null;
  markers: PlanMarker[];
  selectedMarkerId: string | null;
  selectedReserveId: string | null;
  drawingMode: boolean;
  onDrawingModeChange: (value: boolean) => void;
  onCreateMarker: (input: CreateMarkerInput) => Promise<void> | void;
  onSelectMarker: (marker: { id: string; reserve_id: string }, openReserve: boolean) => void;
  onDeleteSelected: () => void;
  onDeleteMarker: (markerId: string) => Promise<void> | void;
  onRemoveLegendGroup: (input: {
    page_number: number | null;
    type: MarkerTool;
    color: string;
  }) => Promise<void> | void;
  onRenameLegendGroup: (input: {
    page_number: number | null;
    type: MarkerTool;
    color: string;
    label: string | null;
  }) => Promise<void> | void;
  markerSaving?: boolean;
  showAllReserves?: boolean;
};

const TOOL_OPTIONS: Array<{ key: MarkerTool; label: string; compact: string }> = [
  { key: "POINT", label: "Point", compact: "Pt" },
  { key: "LINE", label: "Ligne", compact: "Ln" },
  { key: "CROSS", label: "Croix", compact: "X" },
  { key: "CHECK", label: "Check", compact: "V" },
  { key: "TEXT", label: "Texte", compact: "T" },
];

const STROKE_OPTIONS = [1, 2, 3] as const;
const COLOR_PALETTE = ["#ef4444", "#22c55e", "#f97316", "#3b82f6", "#111827"] as const;
const SELECT_COLOR = "#2563EB";
const LEGEND_LABEL_PREFIX = "__LEGEND__:";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isHexColor(value: string): boolean {
  return /^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value.trim());
}

function markerTypeLabel(type: MarkerTool): string {
  if (type === "LINE") return "Ligne";
  if (type === "CROSS") return "Croix";
  if (type === "CHECK") return "Check";
  if (type === "TEXT") return "Texte";
  return "Point";
}

function ensureMarkerColor(marker: PlanMarker): string {
  return marker.color && isHexColor(marker.color) ? marker.color : "#ef4444";
}

function ensureStroke(marker: PlanMarker): number {
  const value = Number(marker.stroke_width ?? 2);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

function markerPage(marker: PlanMarker): number {
  return Number(marker.page_number ?? 1) || 1;
}

function markerLegendKey(marker: PlanMarker): string {
  const color = ensureMarkerColor(marker).toLowerCase();
  return `${marker.type}|${color}`;
}

function markerLegendLabel(marker: PlanMarker): string {
  const direct = marker.legend_label?.trim();
  if (direct) return direct;
  const legacy = marker.label?.trim() ?? "";
  if (legacy.startsWith(LEGEND_LABEL_PREFIX)) {
    return legacy.slice(LEGEND_LABEL_PREFIX.length).trim() || markerTypeLabel(marker.type);
  }
  return markerTypeLabel(marker.type);
}

type LegendEntry = {
  key: string;
  page_number: number | null;
  type: MarkerTool;
  color: string;
  label: string;
  count: number;
};

type DeleteConfirmState = {
  markerId: string;
  x: number;
  y: number;
};

type PendingDeleteState = {
  marker: PlanMarker;
  timeoutAt: number;
};

type TextDraftState = {
  x: number;
  y: number;
  value: string;
};

function LegendBar({
  entries,
  hiddenKeys,
  onToggle,
  deletingKey,
  onDeleteGroup,
  renamingKey,
  onRenameGroup,
}: {
  entries: LegendEntry[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
  deletingKey: string | null;
  onDeleteGroup: (entry: LegendEntry) => void;
  renamingKey: string | null;
  onRenameGroup: (entry: LegendEntry) => void;
}) {
  return (
    <div className="rounded-lg border bg-white px-2 py-1">
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-slate-700 whitespace-nowrap">Légende</div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {entries.length === 0 ? (
              <span className="text-xs text-slate-500 px-1">Aucun élément sur cette page</span>
            ) : (
              entries.map((entry) => {
                const off = hiddenKeys.has(entry.key);
                const deleting = deletingKey === entry.key;
                const renaming = renamingKey === entry.key;
                return (
                  <div key={entry.key} className="relative flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteGroup(entry);
                      }}
                      disabled={deleting}
                      aria-label={`Supprimer le groupe ${entry.label}`}
                      className={[
                        "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[12px]",
                        deleting
                          ? "cursor-not-allowed border-slate-200 text-slate-400"
                          : "border-slate-300 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
                      ].join(" ")}
                      title="Supprimer le groupe"
                    >
                      {deleting ? "..." : "x"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(entry.key)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRenameGroup(entry);
                      }}
                      disabled={renaming}
                      className={[
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap",
                        off
                          ? "bg-slate-100 text-slate-400 border-slate-200"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400",
                      ].join(" ")}
                      title={
                        renaming
                          ? "Renommage en cours..."
                          : `${off ? "Afficher le groupe" : "Masquer le groupe"} (double-clic pour renommer)`
                      }
                    >
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{renaming ? "..." : entry.label}</span>
                      <span className="rounded-full bg-slate-100 px-1">{entry.count}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReservePlanViewer({
  url,
  mimeType,
  markers,
  selectedMarkerId,
  selectedReserveId,
  drawingMode,
  onDrawingModeChange,
  onCreateMarker,
  onSelectMarker,
  onDeleteSelected,
  onDeleteMarker,
  onRemoveLegendGroup,
  onRenameLegendGroup,
  markerSaving = false,
  showAllReserves = false,
}: Props) {
  const isPdf = mimeType === "application/pdf";

  const frameRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [containerWidth, setContainerWidth] = useState(0);

  const [tool, setTool] = useState<MarkerTool>("POINT");
  const [color, setColor] = useState("#ef4444");
  const [colorInput, setColorInput] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [hiddenLegendKeys, setHiddenLegendKeys] = useState<Set<string>>(new Set());
  const [deletingLegendKey, setDeletingLegendKey] = useState<string | null>(null);
  const [renamingLegendKey, setRenamingLegendKey] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [deletingMarkerId, setDeletingMarkerId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);

  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [lineCursor, setLineCursor] = useState<{ x: number; y: number } | null>(null);
  const [cursorRatio, setCursorRatio] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraftState | null>(null);

  const currentPageNumber = isPdf ? page : 1;

  useEffect(() => {
    const onResize = () => {
      setContainerWidth(frameRef.current?.clientWidth ?? 0);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isPdf) return;
    const surface = surfaceRef.current;
    if (!surface) return;

    const observer = new ResizeObserver(() => {
      const img = imageRef.current;
      if (!img) return;
      setRenderSize({
        width: Math.floor(img.clientWidth),
        height: Math.floor(img.clientHeight),
      });
    });

    observer.observe(surface);
    return () => observer.disconnect();
  }, [isPdf, url]);

  useEffect(() => {
    if (!isPdf || !url) {
      setPdfDoc(null);
      setPage(1);
      setPageCount(1);
      return;
    }

    let alive = true;
    const loadingTask = pdfjsLib.getDocument(url);

    loadingTask.promise
      .then((doc: any) => {
        if (!alive) return;
        setPdfDoc(doc);
        setPageCount(Math.max(1, Number(doc?.numPages ?? 1)));
        setPage(1);
        setZoom(1);
      })
      .catch(() => {
        if (!alive) return;
        setPdfDoc(null);
        setPageCount(1);
      });

    return () => {
      alive = false;
      void loadingTask.destroy();
    };
  }, [isPdf, url]);

  useEffect(() => {
    if (!isPdf || !pdfDoc || !canvasRef.current) {
      return;
    }

    let alive = true;
    setRendering(true);

    (async () => {
      try {
        const pdfPage = await pdfDoc.getPage(page);
        if (!alive) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const fitScale = fitWidth && containerWidth > 0 ? clamp(containerWidth / baseViewport.width, 0.2, 5) : 1;
        const scale = clamp(fitScale * zoom, 0.25, 6);
        const viewport = pdfPage.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;

        if (!alive) return;
        setRenderSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) });
      } finally {
        if (alive) setRendering(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isPdf, pdfDoc, page, zoom, fitWidth, containerWidth]);

  useEffect(() => {
    if (!drawingMode) {
      setLineStart(null);
      setLineCursor(null);
      setCursorRatio(null);
      setTextDraft(null);
    }
  }, [drawingMode]);

  useEffect(() => {
    if (!pendingDelete) return;
    const delay = Math.max(0, pendingDelete.timeoutAt - Date.now());
    const timer = window.setTimeout(async () => {
      setDeletingMarkerId(pendingDelete.marker.id);
      try {
        await onDeleteMarker(pendingDelete.marker.id);
      } catch {
        // no-op
      } finally {
        setDeletingMarkerId(null);
        setPendingDelete((current) => (current?.marker.id === pendingDelete.marker.id ? null : current));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [pendingDelete, onDeleteMarker]);

  const markersByPage = useMemo(() => {
    if (!isPdf) return markers;
    return markers.filter((marker) => markerPage(marker) === currentPageNumber);
  }, [markers, isPdf, currentPageNumber]);

  const legendEntries = useMemo(() => {
    const counts = new Map<string, LegendEntry>();

    for (const marker of markersByPage) {
      const key = markerLegendKey(marker);
      const current = counts.get(key);
      if (current) {
        current.count += 1;
        if (current.label === markerTypeLabel(marker.type)) {
          const candidateLabel = markerLegendLabel(marker);
          if (candidateLabel !== markerTypeLabel(marker.type)) current.label = candidateLabel;
        }
      } else {
        counts.set(key, {
          key,
          page_number: marker.page_number ?? currentPageNumber,
          type: marker.type,
          color: ensureMarkerColor(marker).toLowerCase(),
          label: markerLegendLabel(marker),
          count: 1,
        });
      }
    }

    return Array.from(counts.values());
  }, [markersByPage]);

  const visibleMarkers = useMemo(() => {
    if (!hiddenLegendKeys.size) return markersByPage;
    return markersByPage.filter((marker) => !hiddenLegendKeys.has(markerLegendKey(marker)));
  }, [markersByPage, hiddenLegendKeys]);

  const selectedMarker = useMemo(() => {
    if (!selectedMarkerId) return null;
    return markersByPage.find((marker) => marker.id === selectedMarkerId) ?? null;
  }, [markersByPage, selectedMarkerId]);

  function resetDrawState() {
    setLineStart(null);
    setLineCursor(null);
  }

  function applyHexColor() {
    const next = colorInput.trim();
    if (!isHexColor(next)) return;
    setColor(next);
  }

  function toggleLegendChip(key: string) {
    setHiddenLegendKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function debugLog(message: string, payload?: unknown) {
    if (!import.meta.env.DEV) return;
    if (payload === undefined) {
      console.debug(message);
      return;
    }
    console.debug(message, payload);
  }

  function toRatioFromClient(clientX: number, clientY: number) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    debugLog("[markers] rect", rect);
    debugLog("[markers] ratio", { x, y });
    return { x, y };
  }

  async function handleDeleteLegendEntry(entry: LegendEntry) {
    const confirmed = window.confirm(`Supprimer tout le groupe "${entry.label}" (${entry.count}) ?`);
    if (!confirmed) return;
    setDeletingLegendKey(entry.key);
    try {
      await onRemoveLegendGroup({
        page_number: entry.page_number ?? currentPageNumber,
        type: entry.type,
        color: entry.color,
      });
      setHiddenLegendKeys((previous) => {
        if (!previous.has(entry.key)) return previous;
        const next = new Set(previous);
        next.delete(entry.key);
        return next;
      });
      setPendingDelete(null);
    } catch {
      // no-op
    } finally {
      setDeletingLegendKey((current) => (current === entry.key ? null : current));
    }
  }

  async function handleRenameLegendEntry(entry: LegendEntry) {
    const next = window.prompt(`Nouveau nom pour \"${entry.label}\"`, entry.label);
    if (next === null) return;
    setRenamingLegendKey(entry.key);
    try {
      await onRenameLegendGroup({
        page_number: entry.page_number ?? currentPageNumber,
        type: entry.type,
        color: entry.color,
        label: next.trim() || null,
      });
    } catch {
      // no-op
    } finally {
      setRenamingLegendKey((current) => (current === entry.key ? null : current));
    }
  }

  function markerRatioCenter(marker: PlanMarker): { x: number; y: number } {
    const x1 = clamp(Number(marker.x1 ?? 0), 0, 1);
    const y1 = clamp(Number(marker.y1 ?? 0), 0, 1);
    if (marker.type !== "LINE") return { x: x1, y: y1 };

    const x2 = clamp(Number(marker.x2 ?? x1), 0, 1);
    const y2 = clamp(Number(marker.y2 ?? y1), 0, 1);
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  function centerSelectedMarker() {
    if (!selectedMarker) return;

    const frame = frameRef.current;
    const surface = surfaceRef.current;
    if (!frame || !surface) return;

    const center = markerRatioCenter(selectedMarker);
    const targetX = center.x * surface.clientWidth + surface.offsetLeft;
    const targetY = center.y * surface.clientHeight + surface.offsetTop;

    frame.scrollTo({
      left: Math.max(0, targetX - frame.clientWidth / 2),
      top: Math.max(0, targetY - frame.clientHeight / 2),
      behavior: "smooth",
    });
  }

  function markerOpacity(marker: PlanMarker): number {
    if (!showAllReserves) return 1;
    return marker.id === selectedMarkerId ? 1 : 0.65;
  }

  function queueDeleteMarker(marker: PlanMarker) {
    setDeleteConfirm(null);
    setPendingDelete({
      marker,
      timeoutAt: Date.now() + 5000,
    });
  }

  function submitTextDraft() {
    if (!textDraft) return;
    const raw = textDraft.value.trim();
    if (!raw) {
      setTextDraft(null);
      return;
    }
    void onCreateMarker({
      type: "TEXT",
      color,
      stroke_width: strokeWidth,
      page_number: currentPageNumber,
      x1: textDraft.x,
      y1: textDraft.y,
      text: raw,
    });
    setTextDraft(null);
  }

  function toggleDrawingMode() {
    const next = !drawingMode;
    if (next) {
      setDeleteMode(false);
      setDeleteConfirm(null);
      setPendingDelete(null);
    }
    if (!next) {
      setTextDraft(null);
    }
    onDrawingModeChange(next);
  }

  function toggleDeleteMode() {
    setDeleteConfirm(null);
    setLineStart(null);
    setLineCursor(null);
    setTextDraft(null);
    setPendingDelete(null);
    const next = !deleteMode;
    if (next && drawingMode) onDrawingModeChange(false);
    setDeleteMode(next);
  }

  function prepareDelete(marker: PlanMarker) {
    const center = markerRatioCenter(marker);
    setDeleteConfirm({
      markerId: marker.id,
      x: center.x,
      y: center.y,
    });
  }

  async function confirmDeleteMarker() {
    if (!deleteConfirm?.markerId) return;
    setDeletingMarkerId(deleteConfirm.markerId);
    try {
      await onDeleteMarker(deleteConfirm.markerId);
      setDeleteConfirm(null);
    } catch {
      // no-op
    } finally {
      setDeletingMarkerId(null);
    }
  }

  function onOverlayPointerDown(event: PointerEvent<SVGSVGElement>) {
    debugLog("[markers] click", {
      tool,
      drawing: drawingMode,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    setDeleteConfirm(null);
    if (!drawingMode || deleteMode) return;

    const ratio = toRatioFromClient(event.clientX, event.clientY);
    if (!ratio) return;
    setCursorRatio(ratio);

    if (tool === "LINE") {
      setLineStart(ratio);
      setLineCursor(ratio);
      return;
    }

    if (tool === "TEXT") {
      setTextDraft({ x: ratio.x, y: ratio.y, value: "" });
      return;
    }

    void onCreateMarker({
      type: tool,
      color,
      stroke_width: strokeWidth,
      page_number: currentPageNumber,
      x1: ratio.x,
      y1: ratio.y,
    });
  }

  function onOverlayPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!drawingMode || deleteMode || tool !== "LINE" || !lineStart) return;
    const ratio = toRatioFromClient(event.clientX, event.clientY);
    if (!ratio) {
      resetDrawState();
      return;
    }
    const dx = Math.abs(ratio.x - lineStart.x);
    const dy = Math.abs(ratio.y - lineStart.y);
    if (dx < 0.0005 && dy < 0.0005) {
      resetDrawState();
      return;
    }
    void onCreateMarker({
      type: "LINE",
      color,
      stroke_width: strokeWidth,
      page_number: currentPageNumber,
      x1: lineStart.x,
      y1: lineStart.y,
      x2: ratio.x,
      y2: ratio.y,
    });
    resetDrawState();
  }

  function onOverlayPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drawingMode) return;
    const ratio = toRatioFromClient(event.clientX, event.clientY);
    if (!ratio) return;
    setCursorRatio(ratio);
    if (tool === "LINE" && lineStart) {
      setLineCursor(ratio);
    }
  }

  function renderMarkerGlyph(marker: PlanMarker, x1: number, y1: number, x2: number, y2: number, selected: boolean) {
    const markerColor = ensureMarkerColor(marker);
    const markerStroke = ensureStroke(marker);

    if (marker.type === "LINE") {
      return (
        <>
          {selected && (
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={SELECT_COLOR}
              strokeWidth={markerStroke + 6}
              strokeLinecap="round"
              opacity={0.24}
            />
          )}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={markerColor}
            strokeWidth={selected ? markerStroke + 1 : markerStroke}
            strokeLinecap="round"
          />
        </>
      );
    }

    if (marker.type === "POINT") {
      return (
        <>
          {selected && <circle cx={x1} cy={y1} r={12} fill="none" stroke={SELECT_COLOR} strokeWidth={3} opacity={0.9} />}
          <circle cx={x1} cy={y1} r={5.5} fill={markerColor} stroke="#0f172a" strokeWidth={0.9} />
        </>
      );
    }

    if (marker.type === "CROSS") {
      return (
        <>
          {selected && <circle cx={x1} cy={y1} r={12} fill="none" stroke={SELECT_COLOR} strokeWidth={3} opacity={0.9} />}
          <line
            x1={x1 - 7}
            y1={y1 - 7}
            x2={x1 + 7}
            y2={y1 + 7}
            stroke={markerColor}
            strokeWidth={selected ? markerStroke + 0.5 : markerStroke}
            strokeLinecap="round"
          />
          <line
            x1={x1 + 7}
            y1={y1 - 7}
            x2={x1 - 7}
            y2={y1 + 7}
            stroke={markerColor}
            strokeWidth={selected ? markerStroke + 0.5 : markerStroke}
            strokeLinecap="round"
          />
        </>
      );
    }

    if (marker.type === "CHECK") {
      return (
        <>
          {selected && <circle cx={x1} cy={y1} r={12} fill="none" stroke={SELECT_COLOR} strokeWidth={3} opacity={0.9} />}
          <polyline
            points={`${x1 - 8},${y1} ${x1 - 2},${y1 + 7} ${x1 + 8},${y1 - 8}`}
            fill="none"
            stroke={markerColor}
            strokeWidth={selected ? markerStroke + 0.5 : markerStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }

    const rawText = marker.text?.trim() || "Texte";
    const textWidth = Math.max(48, rawText.length * 7 + 12);

    return (
      <>
        {selected && <circle cx={x1} cy={y1} r={12} fill="none" stroke={SELECT_COLOR} strokeWidth={3} opacity={0.9} />}
        <circle cx={x1} cy={y1} r={4.2} fill={markerColor} stroke="#0f172a" strokeWidth={0.8} />
        <rect x={x1 + 7} y={y1 - 19} width={textWidth} height={20} rx={5} fill="rgba(15,23,42,0.72)" />
        <text x={x1 + 12} y={y1 - 6} fill="#ffffff" fontSize={12} fontWeight={600}>
          {rawText}
        </text>
      </>
    );
  }

  function renderMarkers(width: number, height: number) {
    if (width <= 0 || height <= 0) return null;

    const toX = (value: number | null | undefined) => clamp(Number(value ?? 0), 0, 1) * width;
    const toY = (value: number | null | undefined) => clamp(Number(value ?? 0), 0, 1) * height;

    return (
      <svg
        ref={overlayRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={[
          "absolute inset-0 pointer-events-auto",
          drawingMode ? "cursor-crosshair" : "cursor-default",
        ].join(" ")}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUp}
        onPointerLeave={() => {
          setCursorRatio(null);
          if (!drawingMode || tool !== "LINE") return;
          setLineCursor(null);
        }}
      >
        {visibleMarkers.map((marker) => {
          const x1 = toX(marker.x1);
          const y1 = toY(marker.y1);
          const x2 = toX(marker.x2 ?? marker.x1);
          const y2 = toY(marker.y2 ?? marker.y1);
          const center = markerRatioCenter(marker);
          const cx = toX(center.x);
          const cy = toY(center.y);
          const selected = marker.id === selectedMarkerId;

          return (
            <g
              key={marker.id}
              opacity={markerOpacity(marker)}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (deleteMode) {
                  onSelectMarker({ id: marker.id, reserve_id: marker.reserve_id }, false);
                  queueDeleteMarker(marker);
                  return;
                }
                onSelectMarker({ id: marker.id, reserve_id: marker.reserve_id }, false);
              }}
            >
              {renderMarkerGlyph(marker, x1, y1, x2, y2, selected)}

              {selected && !drawingMode && !deleteMode && (
                <g
                  onClick={(event) => {
                    event.stopPropagation();
                    prepareDelete(marker);
                  }}
                >
                  <rect x={cx + 8} y={cy - 18} width={36} height={16} rx={8} fill="#ffffff" stroke="#dc2626" />
                  <text x={cx + 26} y={cy - 7} textAnchor="middle" fill="#dc2626" fontSize={10} fontWeight={700}>
                    Suppr
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {drawingMode && tool === "LINE" && lineStart && lineCursor && (
          <line
            x1={lineStart.x * width}
            y1={lineStart.y * height}
            x2={lineCursor.x * width}
            y2={lineCursor.y * height}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {drawingMode && tool !== "LINE" && cursorRatio && (
          <circle
            cx={cursorRatio.x * width}
            cy={cursorRatio.y * height}
            r={4}
            fill={color}
            stroke="#0f172a"
            strokeWidth={0.8}
            opacity={0.75}
          />
        )}
      </svg>
    );
  }

  function renderTextInputOverlay(width: number, height: number) {
    if (!textDraft || width <= 0 || height <= 0) return null;
    const left = textDraft.x * width;
    const top = textDraft.y * height;
    return (
      <div
        className="absolute z-30"
        style={{
          left,
          top,
          transform: "translate(8px, -18px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-lg border bg-white p-1.5 shadow">
          <input
            autoFocus
            className="h-7 w-44 rounded-md border px-2 text-xs"
            value={textDraft.value}
            onChange={(event) =>
              setTextDraft((current) => (current ? { ...current, value: event.target.value } : current))
            }
            placeholder="Texte..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitTextDraft();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setTextDraft(null);
              }
            }}
          />
          <div className="mt-1 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setTextDraft(null)}
              className="h-6 rounded border px-1.5 text-[11px] hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submitTextDraft}
              className="h-6 rounded border border-[#2563EB] bg-[#2563EB] px-1.5 text-[11px] text-white"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-250px)] min-h-[430px] flex-col gap-2">
      <div className="rounded-xl border bg-white px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {isPdf && (
            <>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || !pdfDoc}
                className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                P-
              </button>
              <div className="min-w-[68px] text-center text-xs text-slate-600">
                {page}/{pageCount}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount || !pdfDoc}
                className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                P+
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setZoom((value) => clamp(value - 0.1, 0.4, 3))}
            className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50"
          >
            -
          </button>
          <div className="min-w-[46px] text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            onClick={() => setZoom((value) => clamp(value + 0.1, 0.4, 3))}
            className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setFitWidth((value) => !value)}
            className={[
              "h-8 rounded-md border px-2 text-sm",
              fitWidth ? "bg-[#2563EB] text-white border-[#2563EB]" : "hover:bg-slate-50",
            ].join(" ")}
          >
            Fit
          </button>

          <button
            type="button"
            onClick={toggleDrawingMode}
            className={[
              "h-8 rounded-md border px-2 text-sm",
              drawingMode ? "bg-[#2563EB] text-white border-[#2563EB]" : "hover:bg-slate-50",
            ].join(" ")}
          >
            Dessin {drawingMode ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={toggleDeleteMode}
            className={[
              "h-8 rounded-md border px-2 text-sm",
              deleteMode ? "border-red-300 bg-red-50 text-red-700" : "hover:bg-slate-50",
            ].join(" ")}
            title="Mode suppression"
          >
            Corbeille {deleteMode ? "ON" : "OFF"}
          </button>

          {drawingMode && (
            <>
              <div className="ml-1 flex items-center gap-1 rounded-lg border bg-slate-50 px-1 py-1">
                {TOOL_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTool(option.key)}
                    className={[
                      "h-7 min-w-[28px] rounded-md border px-1.5 text-xs",
                      tool === option.key ? "bg-[#2563EB] text-white border-[#2563EB]" : "hover:bg-slate-50",
                    ].join(" ")}
                    title={option.label}
                  >
                    {option.compact}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg border bg-slate-50 px-1 py-1">
                {COLOR_PALETTE.map((paletteColor) => (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => {
                      setColor(paletteColor);
                      setColorInput(paletteColor);
                    }}
                    className={[
                      "h-5 w-5 rounded border",
                      color.toLowerCase() === paletteColor.toLowerCase() ? "ring-2 ring-[#2563EB]" : "",
                    ].join(" ")}
                    style={{ backgroundColor: paletteColor }}
                    title={paletteColor}
                  />
                ))}

                <input
                  className="h-7 w-20 rounded-md border px-1.5 text-xs"
                  value={colorInput}
                  onChange={(event) => setColorInput(event.target.value)}
                  onBlur={applyHexColor}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyHexColor();
                    }
                  }}
                  placeholder="#ef4444"
                />

                {STROKE_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStrokeWidth(value)}
                    className={[
                      "h-7 rounded-md border px-2 text-xs",
                      strokeWidth === value ? "bg-[#2563EB] text-white border-[#2563EB]" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {value}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={onDeleteSelected}
                  disabled={!selectedMarkerId}
                  className="h-7 rounded-md border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                  title="Supprimer selection"
                >
                  Suppr
                </button>

                <button
                  type="button"
                  onClick={resetDrawState}
                  className="h-7 rounded-md border px-2 text-xs hover:bg-slate-50"
                >
                  Annul
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            className="ml-auto text-xs text-slate-500"
            title={deleteMode ? "Mode corbeille: clic = suppression avec annulation 5s" : drawingMode ? "Mode dessin actif" : "Mode consultation"}
          >
            i
          </button>
          {markerSaving && <span className="text-xs text-slate-500">Enregistrement...</span>}
        </div>
      </div>

      <LegendBar
        entries={legendEntries}
        hiddenKeys={hiddenLegendKeys}
        onToggle={toggleLegendChip}
        deletingKey={deletingLegendKey}
        onDeleteGroup={handleDeleteLegendEntry}
        renamingKey={renamingLegendKey}
        onRenameGroup={handleRenameLegendEntry}
      />

      <div className={["min-h-0 flex-1 grid gap-2", selectedMarker ? "lg:grid-cols-[minmax(0,1fr)_220px]" : ""].join(" ")}>
        <div ref={frameRef} className="relative min-h-0 h-full w-full overflow-auto rounded-xl border bg-slate-50 p-1">
          {isPdf ? (
            <div
              ref={surfaceRef}
              className="relative mx-auto"
              style={{ width: renderSize.width || undefined, height: renderSize.height || undefined }}
            >
              <canvas
                ref={canvasRef}
                className={["block max-w-none", drawingMode ? "pointer-events-none" : ""].join(" ")}
              />
              {renderSize.width > 0 && renderSize.height > 0 && renderMarkers(renderSize.width, renderSize.height)}
              {renderSize.width > 0 && renderSize.height > 0 && renderTextInputOverlay(renderSize.width, renderSize.height)}

              {deleteConfirm && (
                <div
                  className="absolute z-20"
                  style={{
                    left: `${deleteConfirm.x * 100}%`,
                    top: `${deleteConfirm.y * 100}%`,
                    transform: "translate(-50%, -120%)",
                  }}
                >
                  <div className="rounded-lg border bg-white px-2 py-1 text-[11px] shadow">
                    <div>Supprimer ?</div>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="h-6 rounded border px-1.5 text-[11px] hover:bg-slate-50"
                      >
                        Non
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteMarker}
                        disabled={deletingMarkerId === deleteConfirm.markerId}
                        className="h-6 rounded border border-red-200 px-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Oui
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rendering && (
                <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600">
                  Rendu PDF...
                </div>
              )}
            </div>
          ) : (
            <div ref={surfaceRef} className="relative mx-auto inline-block max-w-full">
              <img
                ref={imageRef}
                src={url}
                alt="Plan"
                className={["block max-h-[70vh] max-w-full object-contain", drawingMode ? "pointer-events-none" : ""].join(" ")}
                onLoad={() => {
                  const image = imageRef.current;
                  if (!image) return;
                  setRenderSize({ width: Math.floor(image.clientWidth), height: Math.floor(image.clientHeight) });
                }}
              />
              {renderSize.width > 0 && renderSize.height > 0 && renderMarkers(renderSize.width, renderSize.height)}
              {renderSize.width > 0 && renderSize.height > 0 && renderTextInputOverlay(renderSize.width, renderSize.height)}

              {deleteConfirm && (
                <div
                  className="absolute z-20"
                  style={{
                    left: `${deleteConfirm.x * 100}%`,
                    top: `${deleteConfirm.y * 100}%`,
                    transform: "translate(-50%, -120%)",
                  }}
                >
                  <div className="rounded-lg border bg-white px-2 py-1 text-[11px] shadow">
                    <div>Supprimer ?</div>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="h-6 rounded border px-1.5 text-[11px] hover:bg-slate-50"
                      >
                        Non
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteMarker}
                        disabled={deletingMarkerId === deleteConfirm.markerId}
                        className="h-6 rounded border border-red-200 px-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Oui
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedMarker && (
          <div className="h-fit min-w-[180px] rounded-xl border bg-white p-2.5">
            <div className="text-xs font-semibold text-slate-700">Sélection</div>
            <div className="mt-1 text-xs text-slate-500">
              {markerTypeLabel(selectedMarker.type)} - {ensureMarkerColor(selectedMarker)}
            </div>
            {selectedReserveId && selectedMarker.reserve_id !== selectedReserveId && (
              <div className="mt-1 text-xs text-slate-500">Réserve associée : autre fiche</div>
            )}

            <div className="mt-2 grid gap-1">
              <button
                type="button"
                onClick={() => onSelectMarker({ id: selectedMarker.id, reserve_id: selectedMarker.reserve_id }, true)}
                className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50"
              >
                Ouvrir reserve
              </button>
              <button
                type="button"
                onClick={onDeleteSelected}
                className="h-8 rounded-md border border-red-200 px-2 text-sm text-red-700 hover:bg-red-50"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={centerSelectedMarker}
                className="h-8 rounded-md border px-2 text-sm hover:bg-slate-50"
              >
                Centrer
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50">
          <div className="pointer-events-auto rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs shadow-lg">
            <div className="text-slate-700">Suppression en attente (5s)</div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-7 rounded-md border px-2 text-xs hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeletingMarkerId(pendingDelete.marker.id);
                  try {
                    await onDeleteMarker(pendingDelete.marker.id);
                    setPendingDelete(null);
                  } catch {
                    // no-op
                  } finally {
                    setDeletingMarkerId(null);
                  }
                }}
                disabled={deletingMarkerId === pendingDelete.marker.id}
                className="h-7 rounded-md border border-red-200 px-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Supprimer maintenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
