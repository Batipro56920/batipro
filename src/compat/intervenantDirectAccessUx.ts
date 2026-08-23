import { supabase } from "../lib/supabaseClient";

const REPLACEMENTS: Array<[string, string]> = [
  ["Envoyer invitation compte", "Créer l'accès"],
  ["Regenerer invitation", "Réinitialiser le mot de passe"],
  ["Generation...", "Création..."],
  ["Derniere invitation :", "Accès mis à jour :"],
  ["Invitation envoyee", "Compte à activer"],
  ["Non invité", "Aucun compte"],
  ["Comptes ou invitations", "Comptes Batipro"],
  ["Portail terrain invité", "Compte Batipro créé"],
  ["Base technique des futurs portails", "Connexion par identifiant et mot de passe"],
];

const revealedPasswords = new Map<string, { loginId: string; password: string; loginUrl: string }>();

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

function getIntervenantId(row: HTMLTableRowElement) {
  const link = row.querySelector<HTMLAnchorElement>('a[href^="/intervenants/"]');
  if (!link) return "";
  return link.getAttribute("href")?.split("/").filter(Boolean).pop() ?? "";
}

function getEmail(row: HTMLTableRowElement) {
  const cells = row.querySelectorAll<HTMLTableCellElement>("td");
  if (cells.length < 7) return "";
  return (cells[6].querySelector("div")?.textContent ?? "").trim();
}

async function generateCredentials(intervenantId: string) {
  const { data, error } = await supabase.functions.invoke("generate-intervenant-link", {
    body: { intervenantId },
  });
  if (error) {
    let message = error.message || "Erreur lors de la génération du mot de passe.";
    try {
      const context = (error as any)?.context;
      if (context && typeof context.json === "function") {
        const payload = await context.json();
        if (payload?.error) message = String(payload.error);
      }
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  const loginId = String((data as any)?.email ?? "").trim();
  const password = String((data as any)?.temporaryPassword ?? "").trim();
  const loginUrl = String((data as any)?.loginUrl ?? `${window.location.origin}/login`).trim();
  if (!loginId || !password) throw new Error("Identifiants incomplets retournés par le serveur.");
  return { loginId, password, loginUrl };
}

function buildCredentialsPanel(row: HTMLTableRowElement, intervenantId: string, email: string) {
  const cells = row.querySelectorAll<HTMLTableCellElement>("td");
  if (cells.length < 9) return;
  const contactCell = cells[6];
  let panel = contactCell.querySelector<HTMLElement>("[data-batipro-credentials]");
  const revealed = revealedPasswords.get(intervenantId);
  const stateKey = revealed ? `${revealed.loginId}:${revealed.password}` : `hidden:${email}`;

  if (panel && panel.dataset.stateKey === stateKey) return;

  if (!panel) {
    panel = document.createElement("div");
    panel.dataset.batiproCredentials = "true";
    panel.className = "mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950";
    contactCell.appendChild(panel);
  }

  panel.dataset.stateKey = stateKey;
  const loginId = revealed?.loginId || email || "-";
  panel.innerHTML = "";

  const title = document.createElement("div");
  title.className = "mb-2 font-bold text-blue-950";
  title.textContent = "Identifiants Batipro";
  panel.appendChild(title);

  const idLine = document.createElement("div");
  idLine.innerHTML = `<span style="font-weight:600">ID :</span> ${loginId}`;
  panel.appendChild(idLine);

  const passwordLine = document.createElement("div");
  passwordLine.className = "mt-1 break-all";
  passwordLine.innerHTML = revealed
    ? `<span style="font-weight:600">Mot de passe :</span> ${revealed.password}`
    : `<span style="font-weight:600">Mot de passe :</span> non affichable après création`;
  panel.appendChild(passwordLine);

  const hint = document.createElement("div");
  hint.className = "mt-2 text-[11px] text-blue-800";
  hint.textContent = revealed
    ? "Ce mot de passe vient d'être généré. Copie-le avant de quitter la page."
    : "Supabase ne permet pas de relire un ancien mot de passe. Génère-en un nouveau pour l'afficher ici.";
  panel.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "mt-2 flex flex-wrap gap-2";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-50";
  generateButton.textContent = revealed ? "Générer un nouveau mot de passe" : "Générer et afficher le mot de passe";
  generateButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    generateButton.disabled = true;
    generateButton.textContent = "Génération...";
    try {
      const credentials = await generateCredentials(intervenantId);
      revealedPasswords.set(intervenantId, credentials);
      panel!.dataset.stateKey = "";
      buildCredentialsPanel(row, intervenantId, email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      panel!.querySelector("[data-credential-error]")?.remove();
      const errorBox = document.createElement("div");
      errorBox.dataset.credentialError = "true";
      errorBox.className = "mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700";
      errorBox.textContent = message;
      panel!.appendChild(errorBox);
      generateButton.disabled = false;
      generateButton.textContent = "Réessayer";
    }
  });
  actions.appendChild(generateButton);

  if (revealed) {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 font-semibold text-blue-900 hover:bg-blue-100";
    copyButton.textContent = "Copier ID + mot de passe";
    copyButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(`ID : ${revealed.loginId}\nMot de passe : ${revealed.password}\nConnexion : ${revealed.loginUrl}`);
        copyButton.textContent = "Copié";
        window.setTimeout(() => { copyButton.textContent = "Copier ID + mot de passe"; }, 1500);
      } catch {
        copyButton.textContent = "Copie impossible";
      }
    });
    actions.appendChild(copyButton);
  }

  panel.appendChild(actions);
}

function enhanceAccountRows(root: ParentNode) {
  const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  for (const row of rows) {
    const intervenantId = getIntervenantId(row);
    if (!intervenantId) continue;
    const email = getEmail(row);
    buildCredentialsPanel(row, intervenantId, email);

    const cells = row.querySelectorAll<HTMLTableCellElement>("td");
    if (cells.length < 9) continue;
    const actionsCell = cells[8];
    const buttons = Array.from(actionsCell.querySelectorAll<HTMLButtonElement>("button"));
    for (const button of buttons) {
      const label = (button.textContent ?? "").trim();
      if (label === "Accès actif" || label === "Réinitialiser le mot de passe") button.style.display = "none";
    }
  }
}

function patchDirectAccessUx() {
  if (!window.location.pathname.startsWith("/intervenants")) return;
  replaceText(document.body);
  enhanceAccountRows(document.body);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let scheduled = false;
  const schedulePatch = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      patchDirectAccessUx();
    });
  };
  const observer = new MutationObserver(schedulePatch);
  const start = () => {
    patchDirectAccessUx();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("popstate", schedulePatch);
}
