import { useEffect } from "react";
import { X, ZoomIn } from "lucide-react";

type Props = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export default function RaulImageLightbox({ src, alt = "Image générée par Raul", onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agrandissement de la fiche technique"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-slate-950 shadow-lg"
        aria-label="Fermer l'image"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute left-3 top-[max(0.9rem,env(safe-area-inset-top))] z-10 flex items-center gap-1 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white">
        <ZoomIn className="h-4 w-4" />
        Pince pour zoomer
      </div>

      <div
        className="flex h-full w-full items-center justify-center overflow-auto overscroll-contain"
        style={{ touchAction: "pinch-zoom pan-x pan-y" }}
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-none max-w-none object-contain"
          style={{ width: "auto", minWidth: "100%", height: "auto" }}
        />
      </div>
    </div>
  );
}
