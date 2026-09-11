import { FileText, Video } from "lucide-react";
import type { CampaignAsset } from "./types";

/** Vignette d'un média de campagne, partagée par la médiathèque et l'atelier. */
export function AssetTile({ asset }: { asset: CampaignAsset }) {
  const isImage = asset.mime_type?.startsWith("image/");
  const isVideo = asset.mime_type?.startsWith("video/");
  return (
    <a href={asset.signed_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm">
      {isImage && asset.signed_url
        ? <img src={asset.signed_url} alt={asset.file_name} className="aspect-video w-full object-cover" />
        : <div className="flex aspect-video items-center justify-center bg-interactive">
            {isVideo ? <Video className="h-9 w-9 text-primary" /> : <FileText className="h-9 w-9 text-primary" />}
          </div>}
      <div className="truncate p-3 text-sm font-medium text-ink">{asset.file_name}</div>
    </a>
  );
}
