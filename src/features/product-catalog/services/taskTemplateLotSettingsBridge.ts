import {
  DEFAULT_TASK_TEMPLATE_LOT_PROFILES,
  getTaskTemplateLotProfiles,
  resetTaskTemplateLotProfiles,
  saveTaskTemplateLotProfiles,
  type TaskTemplateLotProfile,
} from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;

export function installTaskTemplateLotSettingsBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  observer = new MutationObserver(() => installLotSettingsButton());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(installLotSettingsButton, 0);
}

function installLotSettingsButton() {
  const page = findTaskLibraryPage();
  if (!page || page.dataset.batiproLotSettingsInstalled === "true") return;

  const searchInput = Array.from(page.querySelectorAll("input"))
    .find((input) => input.placeholder?.toLowerCase().includes("rechercher"));
  const anchor = searchInput?.closest(".rounded-2xl") ?? searchInput?.parentElement;
  if (!anchor?.parentElement) return;

  page.dataset.batiproLotSettingsInstalled = "true";
  anchor.parentElement.insertBefore(buildSettingsBand(), anchor);
}

function buildSettingsBand() {
  const band = document.createElement("div");
  band.className = "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3";

  const text = document.createElement("div");
  const title = document.createElement("div");
  title.className = "text-sm font-semibold text-slate-950";
  title.textContent = "Lots métier";
  const subtitle = document.createElement("div");
  subtitle.className = "mt-1 text-xs text-slate-600";
  subtitle.textContent = "Paramètre les marges, unités et consignes qui serviront à automatiser les templates de tâches.";
  text.append(title, subtitle);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800";
  button.textContent = "Paramétrer les lots";
  button.addEventListener("click", openLotSettingsDrawer);

  band.append(text, button);
  return band;
}

function openLotSettingsDrawer() {
  closeExistingDrawer();
  const overlay = document.createElement("div");
  overlay.dataset.batiproLotSettingsDrawer = "true";
  overlay.className = "fixed inset-0 z-[70]";

  const backdrop = document.createElement("div");
  backdrop.className = "absolute inset-0 bg-black/40";
  backdrop.addEventListener("click", closeExistingDrawer);

  const drawer = document.createElement("aside");
  drawer.className = "absolute right-0 top-0 flex h-screen w-[48vw] min-w-[380px] max-w-[900px] flex-col border-l bg-white shadow-xl";

  const header = document.createElement("div");
  header.className = "flex items-center justify-between border-b px-5 py-4";
  const title = document.createElement("div");
  title.innerHTML = '<div class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Bibliothèque tâches</div><div class="text-lg font-semibold text-slate-950">Paramétrage des lots</div>';
  const close = document.createElement("button");
  close.type = "button";
  close.className = "rounded-xl border px-3 py-2 text-sm hover:bg-slate-50";
  close.textContent = "Fermer";
  close.addEventListener("click", closeExistingDrawer);
  header.append(title, close);

  const content = document.createElement("div");
  content.className = "flex-1 overflow-auto p-5";
  const rows = document.createElement("div");
  rows.dataset.batiproLotRows = "true";
  rows.className = "space-y-4";
  getTaskTemplateLotProfiles().forEach((profile) => rows.append(buildProfileRow(profile)));
  content.append(rows);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "mt-4 rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50";
  addButton.textContent = "Ajouter un lot";
  addButton.addEventListener("click", () => rows.append(buildProfileRow({
    id: crypto.randomUUID(),
    label: "Nouveau lot",
    keywords: [],
    laborMarginRate: 30,
    defaultUnit: "u",
    defaultUsage: { quoteVisible: true, chantierVisible: true },
    fieldGuidance: "",
  })));
  content.append(addButton);

  const footer = document.createElement("div");
  footer.className = "flex justify-between gap-3 border-t p-4";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "rounded-xl border border-amber-200 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50";
  reset.textContent = "Réinitialiser";
  reset.addEventListener("click", () => {
    resetTaskTemplateLotProfiles();
    closeExistingDrawer();
    openLotSettingsDrawer();
  });

  const actions = document.createElement("div");
  actions.className = "flex gap-2";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "rounded-xl border px-4 py-2 text-sm hover:bg-slate-50";
  cancel.textContent = "Annuler";
  cancel.addEventListener("click", closeExistingDrawer);
  const save = document.createElement("button");
  save.type = "button";
  save.className = "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800";
  save.textContent = "Enregistrer";
  save.addEventListener("click", () => {
    saveTaskTemplateLotProfiles(readProfiles(rows));
    closeExistingDrawer();
  });
  actions.append(cancel, save);
  footer.append(reset, actions);

  drawer.append(header, content, footer);
  overlay.append(backdrop, drawer);
  document.body.append(overlay);
}

function buildProfileRow(profile: TaskTemplateLotProfile) {
  const row = document.createElement("div");
  row.dataset.batiproLotProfile = "true";
  row.dataset.profileId = profile.id;
  row.className = "space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4";

  row.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-sm font-semibold text-slate-900">Lot</div>
        <div class="text-xs text-slate-500">Marge, unité, usage métier et consignes terrain par défaut.</div>
      </div>
      <button type="button" data-remove-lot class="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">Supprimer</button>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <label class="block space-y-1"><span class="text-xs text-slate-600">Nom du lot</span><input data-lot-label class="w-full rounded-xl border bg-white px-3 py-2 text-sm" value="${escapeHtml(profile.label)}" /></label>
      <label class="block space-y-1"><span class="text-xs text-slate-600">Mots-clés</span><input data-lot-keywords class="w-full rounded-xl border bg-white px-3 py-2 text-sm" value="${escapeHtml(profile.keywords.join(", "))}" /></label>
      <label class="block space-y-1"><span class="text-xs text-slate-600">Marge main d'oeuvre %</span><input data-lot-margin inputmode="decimal" class="w-full rounded-xl border bg-white px-3 py-2 text-sm" value="${profile.laborMarginRate}" /></label>
      <label class="block space-y-1"><span class="text-xs text-slate-600">Unité par défaut</span><input data-lot-unit class="w-full rounded-xl border bg-white px-3 py-2 text-sm" value="${escapeHtml(profile.defaultUnit)}" /></label>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <label class="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><input data-lot-quote type="checkbox" ${profile.defaultUsage.quoteVisible ? "checked" : ""}/> Visible devis</label>
      <label class="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><input data-lot-chantier type="checkbox" ${profile.defaultUsage.chantierVisible ? "checked" : ""}/> Visible chantier</label>
    </div>
    <label class="block space-y-1"><span class="text-xs text-slate-600">Consignes / retours terrain attendus</span><textarea data-lot-guidance class="min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm">${escapeHtml(profile.fieldGuidance)}</textarea></label>
  `;

  row.querySelector("[data-remove-lot]")?.addEventListener("click", () => row.remove());
  return row;
}

function readProfiles(rows: HTMLElement): TaskTemplateLotProfile[] {
  return Array.from(rows.querySelectorAll("[data-batipro-lot-profile]")).map((row) => {
    const element = row as HTMLElement;
    const label = getValue(element, "[data-lot-label]") || "Lot";
    return {
      id: element.dataset.profileId || crypto.randomUUID(),
      label,
      keywords: getValue(element, "[data-lot-keywords]").split(",").map((item) => item.trim()).filter(Boolean),
      laborMarginRate: parseNumber(getValue(element, "[data-lot-margin]")) ?? 30,
      defaultUnit: getValue(element, "[data-lot-unit]") || "u",
      defaultUsage: {
        quoteVisible: getChecked(element, "[data-lot-quote]"),
        chantierVisible: getChecked(element, "[data-lot-chantier]"),
      },
      fieldGuidance: getValue(element, "[data-lot-guidance]"),
    };
  });
}

function findTaskLibraryPage() {
  return Array.from(document.querySelectorAll("main, section, div"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .find((element) => element.textContent?.includes("Bibliothèque") && element.textContent?.includes("Templates de tâches")) ?? null;
}

function closeExistingDrawer() {
  document.querySelector("[data-batipro-lot-settings-drawer]")?.remove();
}

function getValue(root: HTMLElement, selector: string) {
  const field = root.querySelector(selector);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.value.trim();
  return "";
}

function getChecked(root: HTMLElement, selector: string) {
  const field = root.querySelector(selector);
  return field instanceof HTMLInputElement ? field.checked : true;
}

function parseNumber(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
