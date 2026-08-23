const REPLACEMENTS: Array<[string, string]> = [
  ["Envoyer invitation compte", "Créer l'accès"],
  ["Regenerer invitation", "Accès actif"],
  ["Generation...", "Création..."],
  ["Derniere invitation :", "Accès créé :"],
  ["Invitation envoyee", "Accès créé"],
  ["Non invité", "Aucun compte"],
  ["Comptes ou invitations", "Comptes créés"],
  ["Portail terrain invité", "Accès terrain créé"],
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

    if (element.dataset.directAccessEnhanced === "true") continue;
    element.dataset.directAccessEnhanced = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Copier les identifiants";
    button.className = "mt-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
    button.addEventListener("click", async () => {
      const credentialText = Array.from(element.childNodes)
        .filter((node) => node !== button)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      try {
        await navigator.clipboard.writeText(credentialText);
        button.textContent = "Copié";
        window.setTimeout(() => {
          button.textContent = "Copier les identifiants";
        }, 1500);
      } catch {
        button.textContent = "Copie impossible";
      }
    });
    element.appendChild(document.createElement("br"));
    element.appendChild(button);
  }
}

function patchDirectAccessUx() {
  if (!window.location.pathname.startsWith("/intervenants")) return;
  replaceText(document.body);
  enhanceCredentials(document.body);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const observer = new MutationObserver(() => patchDirectAccessUx());
  const start = () => {
    patchDirectAccessUx();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("popstate", patchDirectAccessUx);
}
