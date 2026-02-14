import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

type PlanMarker = {
  id: string;
  reserve_id: string;
  x: number;
  y: number;
  page: number | null;
  label: string | null;
  status: string | null;
};

type PlaceMarkerInput = {
  x: number;
  y: number;
  page: number | null;
};

type Props = {
  url: string;
  mimeType: string | null;
  markers: PlanMarker[];
  selectedMarkerId: string | null;
  selectedReserveId: string | null;
  placementEnabled: boolean;
  onPlaceMarker: (input: PlaceMarkerInput) => void;
  onSelectMarker: (marker: { id: string; reserve_id: string }) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function markerColorClasses(marker: PlanMarker, selectedMarkerId: string | null, selectedReserveId: string | null) {
  const isSelected = marker.id === selectedMarkerId || marker.reserve_id === selectedReserveId;
  if (isSelected) return "bg-amber-500 border-amber-600";
  if ((marker.status ?? "").toUpperCase() === "LEVEE") return "bg-emerald-500 border-emerald-600";
  return "bg-red-500 border-red-600";
}

export default function ReservePlanViewer({
  url,
  mimeType,
  markers,
  selectedMarkerId,
  selectedReserveId,
  placementEnabled,
  onPlaceMarker,
  onSelectMarker,
}: Props) {
  const isPdf = mimeType === "application/pdf";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 });
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const onResize = () => {
      const width = frameRef.current?.clientWidth ?? 0;
      setContainerWidth(width);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      setRenderSize({ width: 0, height: 0 });
      return;
    }
    let alive = true;
    setRendering(true);

    (async () => {
      try {
        const pdfPage = await pdfDoc.getPage(page);
        if (!alive) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const fitScale =
          fitWidth && containerWidth > 0
            ? clamp(containerWidth / baseViewport.width, 0.2, 5)
            : 1;
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
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!alive) return;
        setRenderSize({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });
      } finally {
        if (alive) setRendering(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isPdf, pdfDoc, page, zoom, fitWidth, containerWidth]);

  const visibleMarkers = useMemo(() => {
    if (!isPdf) return markers;
    return markers.filter((m) => (m.page ?? 1) === page);
  }, [markers, isPdf, page]);

  function onOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (!placementEnabled) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    onPlaceMarker({ x, y, page: isPdf ? page : null });
  }

  return (
    <div className="space-y-3">
      {isPdf && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || !pdfDoc}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
          >
            Page -
          </button>
          <div className="text-xs text-slate-600">
            Page {page} / {pageCount}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount || !pdfDoc}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
          >
            Page +
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z - 0.1, 0.4, 3))}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
          >
            Zoom -
          </button>
          <div className="text-xs text-slate-600">{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            onClick={() => setZoom((z) => clamp(z + 0.1, 0.4, 3))}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={() => setFitWidth((v) => !v)}
            className={[
              "rounded-lg border px-2 py-1 text-xs",
              fitWidth ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50",
            ].join(" ")}
          >
            Fit width
          </button>
        </div>
      )}

      <div ref={frameRef} className="w-full h-[60vh] rounded-xl border overflow-auto bg-slate-50 p-2">
        {isPdf ? (
          <div
            className="relative mx-auto"
            style={{ width: renderSize.width || undefined, height: renderSize.height || undefined }}
          >
            <canvas ref={canvasRef} className="block max-w-none" />
            <div
              className={[
                "absolute inset-0",
                placementEnabled ? "cursor-crosshair" : "cursor-default",
              ].join(" ")}
              onClick={onOverlayClick}
            >
              {visibleMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="absolute"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMarker(marker);
                    }}
                    className={[
                      "w-3 h-3 rounded-full border",
                      markerColorClasses(marker, selectedMarkerId, selectedReserveId),
                    ].join(" ")}
                    style={{ transform: "translate(-50%, -50%)" }}
                  />
                </div>
              ))}
            </div>
            {rendering && (
              <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600">
                Rendu PDF...
              </div>
            )}
          </div>
        ) : (
          <div className="relative mx-auto inline-block max-w-full">
            <img src={url} alt="Plan" className="max-h-[56vh] max-w-full object-contain block" />
            <div
              className={[
                "absolute inset-0",
                placementEnabled ? "cursor-crosshair" : "cursor-default",
              ].join(" ")}
              onClick={onOverlayClick}
            >
              {visibleMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="absolute"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMarker(marker);
                    }}
                    className={[
                      "w-3 h-3 rounded-full border",
                      markerColorClasses(marker, selectedMarkerId, selectedReserveId),
                    ].join(" ")}
                    style={{ transform: "translate(-50%, -50%)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
