const REPLACEMENTS: Array<[string, string]> = [
  ["Envoyer invitation compte", "Créer l'accès"],
  ["Regenerer invitation", "Réinitialiser le mot de passe"],
  ["Generation...", "Création..."],
  ["Derniere invitation :", "Accès mis à jour :"],
  ["Invitation envoyee", "Compte à activer"],
  ["Non invité", "Aucun compte"],
  ["Comptes ou invitations", "Comptes Batipro"],
  ["Portail terrain invité", "Compte Batipro créé"],
  ["Base technique des futurs portails", "Connexion par e-mail et mot de passe"],
];

function replaceText(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    let next = node.nodeValue ?? "";
    for (const [from, to] of REPLACEMENTS) next = next.replaceAll(from, to);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

function enhanceCredentials(root: ParentNode) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("div"));
  for (const element of elements) {
    const text = element.innerText?.trim() ?? "";
    if (!text.includes("Mot de passe temporaire :") || !text.includes("Connexion :")) continue;
    element.style.whiteSpace = "pre-line";
    element.style.lineHeight = "1.5";
    element.style.fontWeight = "600";
    if (element.dataset.directAccessEnhanced === "true") continue;
    element.dataset.directAccessEnhanced = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Copier les identifiants";
    button.className = "mt-3 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50";
    button.addEventListener("click", async () => {
      const credentialText = Array.from(element.childNodes).filter((node) => node !== button).map((node) => node.textContent ?? "").join("").trim();
      try {
        await navigator.clipboard.writeText(credentialText);
        button.textContent = "Identifiants copiés";
        window.setTimeout(() => { button.textContent = "Copier les identifiants"; }, 1600);
      } catch { button.textContent = "Copie impossible"; }
    });
    element.appendChild(document.createElement("br"));
    element.appendChild(button);
  }
}

function enhanceAccountRows(root: ParentNode) {
  const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  for (const row of rows) {
    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 9) continue;
    const contactCell = cells[6];
    const actionsCell = cells[8];
    const email = (contactCell.querySelector("div")?.textContent ?? "").trim();
    if (email && email !== "-" && !contactCell.querySelector("[data-login-id]")) {
      const login = document.createElement("div");
      login.dataset.loginId = "true";
      login.className = "mt-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-900";
      login.innerHTML = `<span style="font-weight:600">Identifiant Batipro</span><br>${email}`;
      contactCell.appendChild(login);
    }
    const buttons = Array.from(actionsCell.querySelectorAll<HTMLButtonElement>("button"));
    for (const button of buttons) {
      const label = (button.textContent ?? "").trim();
      if (label === "Accès actif") {
        button.disabled = false;
        button.textContent = "Réinitialiser le mot de passe";
        button.title = "Générer un nouveau mot de passe temporaire";
        button.className = "rounded-xl border px-3 py-2 text-sm hover:bg-slate-50";
      }
    }
  }
}

function patchDirectAccessUx() {
  if (!window.location.pathname.startsWith("/intervenants")) return;
  replaceText(document.body);
  enhanceCredentials(document.body);
  enhanceAccountRows(document.body);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let scheduled = false;
  const schedulePatch = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => { scheduled = false; patchDirectAccessUx(); });
  };
  const observer = new MutationObserver(schedulePatch);
  const start = () => {
    patchDirectAccessUx();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("popstate", schedulePatch);
}
