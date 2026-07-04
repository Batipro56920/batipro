import {
  getTaskTemplateLotProfiles,
  matchTaskTemplateLotProfile,
  TASK_TEMPLATE_LOT_PROFILES_CHANGED,
} from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;
let pending = false;

export function installTaskTemplateLotDropdownBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("input", onTemplateInput, true);
  document.addEventListener("change", onTemplateInput, true);
  window.addEventListener(TASK_TEMPLATE_LOT_PROFILES_CHANGED, scheduleSync);
  observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleSync();
}

function onTemplateInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const drawer = target.closest(".fixed.inset-0") as HTMLElement | null;
  if (!drawer || !isTaskTemplateDrawer(drawer)) return;

  if (target.dataset.batiproLotDropdown === "true") {
    const hiddenLotInput = getLotInput(drawer);
    if (hiddenLotInput) setInputValue(hiddenLotInput, target.value);
    applyLotProfile(drawer, true);
    return;
  }

  if (isLaborCostInput(drawer, target)) {
    applyLotProfile(drawer, false);
  }
}

function scheduleSync() {
  if (pending) return;
  pending = true;
  window.requestAnimationFrame(() => {
    pending = false;
    getTaskTemplateDrawers().forEach(syncDrawer);
  });
}

function syncDrawer(drawer: HTMLElement) {
  const lotInput = getLotInput(drawer);
  if (!lotInput) return;
  const select = ensureLotSelect(lotInput);
  syncLotOptions(select, lotInput.value.trim());
  applyLotProfile(drawer, false);
}

function ensureLotSelect(lotInput: HTMLInputElement) {
  const existing = lotInput.parentElement?.querySelector("select[data-batipro-lot-dropdown='true']");
  if (existing instanceof HTMLSelectElement) return existing;

  const select = document.createElement("select");
  select.dataset.batiproLotDropdown = "true";
  select.className = lotInput.className;
  select.disabled = lotInput.disabled;
  select.addEventListener("change", () => {
    setInputValue(lotInput, select.value);
    const drawer = select.closest(".fixed.inset-0") as HTMLElement | null;
    if (drawer) applyLotProfile(drawer, true);
  });

  lotInput.style.display = "none";
  lotInput.insertAdjacentElement("afterend", select);
  return select;
}

function syncLotOptions(select: HTMLSelectElement, currentValue: string) {
  const profiles = getTaskTemplateLotProfiles();
  const selectedValue = currentValue || select.value;
  const signature = profiles.map((profile) => `${profile.label}:${profile.laborMarginRate}:${profile.defaultUnit}`).join("|");

  if (select.dataset.optionSignature !== signature) {
    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choisir un lot métier";
    select.append(empty);

    profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.label;
      option.textContent = `${profile.label} - MO +${profile.laborMarginRate} %`;
      select.append(option);
    });
    select.dataset.optionSignature = signature;
  }

  if (selectedValue && !profiles.some((profile) => profile.label === selectedValue)) {
    const hasCustomOption = Array.from(select.options).some((option) => option.value === selectedValue);
    if (!hasCustomOption) {
      const custom = document.createElement("option");
      custom.value = selectedValue;
      custom.textContent = `${selectedValue} (non paramétré)`;
      select.append(custom);
    }
  }

  select.value = selectedValue;
}

function applyLotProfile(drawer: HTMLElement, forceLaborSalePrice: boolean) {
  const profile = matchTaskTemplateLotProfile(getSelectedLot(drawer));

  const unitInput = getInputByLabel(drawer, "unite") ?? getInputByLabel(drawer, "unité");
  if (unitInput && profile.defaultUnit && !unitInput.value.trim()) {
    setInputValue(unitInput, profile.defaultUnit);
  }

  setCheckboxByText(drawer, "Visible dans les devis", profile.defaultUsage.quoteVisible);
  setCheckboxByText(drawer, "Visible côté chantier", profile.defaultUsage.chantierVisible);
  applyLaborMargin(drawer, profile.laborMarginRate, forceLaborSalePrice);
}

function applyLaborMargin(drawer: HTMLElement, marginRate: number, forceLaborSalePrice: boolean) {
  getLaborRows(drawer).forEach((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    const costInput = inputs[2];
    const saleInput = inputs[3];
    if (!(costInput instanceof HTMLInputElement) || !(saleInput instanceof HTMLInputElement)) return;

    const cost = parseNumber(costInput.value);
    if (cost === null) return;
    if (!forceLaborSalePrice && saleInput.value.trim()) return;
    setInputValue(saleInput, formatNumber(cost * (1 + marginRate / 100)));
  });
}

function getSelectedLot(drawer: HTMLElement) {
  const select = drawer.querySelector("select[data-batipro-lot-dropdown='true']") as HTMLSelectElement | null;
  return select?.value.trim() || getLotInput(drawer)?.value.trim() || "";
}

function getLotInput(drawer: HTMLElement) {
  return getInputByLabel(drawer, "lot");
}

function getInputByLabel(root: HTMLElement, labelText: string) {
  const expected = normalizeText(labelText);
  const label = Array.from(root.querySelectorAll("label")).find((candidate) =>
    normalizeText(candidate.textContent).includes(expected),
  );
  const input = label?.querySelector("input");
  return input instanceof HTMLInputElement ? input : null;
}

function setCheckboxByText(drawer: HTMLElement, labelText: string, checked: boolean) {
  const expected = normalizeText(labelText);
  const label = Array.from(drawer.querySelectorAll("label")).find((candidate) =>
    normalizeText(candidate.textContent).includes(expected),
  );
  const input = label?.querySelector("input[type='checkbox']");
  if (!(input instanceof HTMLInputElement) || input.checked === checked) return;
  input.checked = checked;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isLaborCostInput(drawer: HTMLElement, target: Element) {
  return getLaborRows(drawer).some((row) => Array.from(row.querySelectorAll("input"))[2] === target);
}

function getLaborRows(drawer: HTMLElement) {
  return Array.from(drawer.querySelectorAll(".grid.rounded-2xl.border.border-slate-200.bg-slate-50"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => {
      const text = element.textContent ?? "";
      return text.includes("Saisie manuelle") || text.includes("Rôle salarié") || text.includes("Sous-traitant");
    });
}

function getTaskTemplateDrawers() {
  return Array.from(document.querySelectorAll(".fixed.inset-0"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter(isTaskTemplateDrawer);
}

function isTaskTemplateDrawer(element: HTMLElement) {
  const text = element.textContent ?? "";
  return text.includes("Nouveau template") || text.includes("Préparation avancée") || text.includes("Usage métier");
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function parseNumber(value: string) {
  const parsed = Number(value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
