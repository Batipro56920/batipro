import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Megaphone,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { CampaignItem } from "./types";
import { channelDefinition, channelLabel } from "./networks";

type CalendarItem = CampaignItem & { campaign_title?: string };

type Props = {
  items: CalendarItem[];
  onOpenCampaign: (campaignId: string) => void;
};

const ALL_CHANNELS = "";
const DAY_MS = 86_400_000;
const HOURS = Array.from({ length: 12 }, (_, index) => index + 8);


function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function firstChannel(item: CalendarItem) {
  return item.channels[0] ?? "";
}

function PlannerCard({ item, selected, onClick }: { item: CalendarItem; selected: boolean; onClick: () => void }) {
  const channel = firstChannel(item);
  const definition = channelDefinition(channel);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-lg border-l-[3px] p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        definition?.calendar ?? "border-primary bg-primary-soft text-ink",
        selected ? "ring-2 ring-primary ring-offset-1" : "",
      ].join(" ")}
    >
      <p className="truncate text-[10px] font-semibold uppercase opacity-70">{channel ? channelLabel(channel) : "Sans réseau"}</p>
      <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight">{item.title}</p>
      <p className="mt-1 text-[10px] opacity-70">
        {new Date(item.scheduled_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </button>
  );
}

export function CommunicationCalendar({ items, onOpenCampaign }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [channel, setChannel] = useState(ALL_CHANNELS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => new Date(weekStart.getTime() + index * DAY_MS)),
    [weekStart],
  );
  const channels = useMemo(
    () => Array.from(new Set(items.flatMap((item) => item.channels))),
    [items],
  );
  const visibleItems = useMemo(
    () => items.filter((item) => channel === ALL_CHANNELS || item.channels.includes(channel)),
    [channel, items],
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const today = new Date();
  const weekEnd = days[6];

  function shiftWeek(delta: number) {
    setWeekStart((current) => new Date(current.getTime() + delta * 7 * DAY_MS));
    setSelectedId(null);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm">
      <header className="flex flex-col gap-3 border-b border-subtle p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-subtle">
            <button type="button" onClick={() => shiftWeek(-1)} className="p-2.5 text-muted hover:bg-interactive" aria-label="Semaine précédente"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => shiftWeek(1)} className="border-l border-subtle p-2.5 text-muted hover:bg-interactive" aria-label="Semaine suivante"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>Aujourd’hui</Button>
          <div>
            <h2 className="font-semibold capitalize text-ink">
              {weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              {" — "}
              {weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <p className="text-xs text-muted">Planning hebdomadaire des publications</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <Filter className="h-4 w-4" />
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-xl border border-subtle bg-surface px-3 py-2 text-ink">
            <option value={ALL_CHANNELS}>Tous les réseaux</option>
            {channels.map((entry) => <option key={entry} value={entry}>{channelLabel(entry)}</option>)}
          </select>
        </label>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[62px_repeat(7,minmax(126px,1fr))] border-b border-subtle bg-interactive/50">
              <div className="border-r border-subtle p-3 text-center text-xs font-semibold text-muted">Heure</div>
              {days.map((day) => (
                <div key={day.toISOString()} className={`border-r border-subtle p-3 text-center last:border-r-0 ${sameDay(day, today) ? "bg-primary-soft" : ""}`}>
                  <p className="text-[10px] font-semibold uppercase text-muted">{day.toLocaleDateString("fr-FR", { weekday: "short" })}</p>
                  <p className={`mt-1 text-xl font-semibold ${sameDay(day, today) ? "text-primary" : "text-ink"}`}>{day.getDate()}</p>
                </div>
              ))}
            </div>
            {HOURS.map((hour) => (
              <div key={hour} className="grid min-h-[82px] grid-cols-[62px_repeat(7,minmax(126px,1fr))] border-b border-subtle last:border-b-0">
                <div className="border-r border-subtle px-2 py-3 text-right text-[11px] text-muted">{String(hour).padStart(2, "0")}:00</div>
                {days.map((day) => {
                  const cellItems = visibleItems.filter((item) => {
                    if (!item.scheduled_at) return false;
                    const scheduled = new Date(item.scheduled_at);
                    return sameDay(scheduled, day) && scheduled.getHours() === hour;
                  });
                  return (
                    <div key={`${day.toISOString()}-${hour}`} className={`space-y-1 border-r border-subtle p-1.5 last:border-r-0 ${sameDay(day, today) ? "bg-primary-soft/20" : ""}`}>
                      {cellItems.map((item) => <PlannerCard key={item.id} item={item} selected={selectedId === item.id} onClick={() => setSelectedId(item.id)} />)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-subtle bg-interactive/40 p-5 lg:border-l lg:border-t-0">
          {selected ? (
            <div className="sticky top-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Megaphone className="h-4 w-4" />Publication planifiée</div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{selected.title}</h3>
              <p className="mt-1 text-sm font-medium text-primary">{selected.campaign_title}</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface p-3 text-sm text-ink"><Clock3 className="h-4 w-4 text-muted" />{new Date(selected.scheduled_at!).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
              {selected.content ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">{selected.content}</p> : <p className="mt-4 text-sm italic text-muted">Aucun texte rédigé.</p>}
              <div className="mt-4 flex flex-wrap gap-2">{selected.channels.map((entry) => <span key={entry} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink">{entry}</span>)}</div>
              <Button variant="primary" className="mt-6 w-full" onClick={() => onOpenCampaign(selected.campaign_id)}>Ouvrir la campagne <ExternalLink className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <CalendarDays className="h-9 w-9 text-primary" />
              <h3 className="mt-3 font-semibold text-ink">Détail de la publication</h3>
              <p className="mt-1 max-w-56 text-sm text-muted">Clique sur une carte du planning pour afficher son texte, sa campagne et ses réseaux.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
