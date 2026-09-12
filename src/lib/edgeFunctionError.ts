/**
 * Le vrai message d'une fonction serveur.
 *
 * supabase-js jette « Edge Function returned a non-2xx status code » et range
 * la réponse dans error.context. Sans la lire, l'écran affiche un code HTTP
 * habillé en français et personne ne sait ce qui a échoué.
 */
export async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      const message = String((payload as { error?: unknown })?.error ?? "").trim();
      if (message) return message;
    } catch {
      try {
        const text = (await context.clone().text()).trim();
        if (text) return text.slice(0, 300);
      } catch {
        // corps illisible : on retombe sur le message générique
      }
    }
  }
  const direct = String((error as { message?: string } | null)?.message ?? "").trim();
  if (direct && !/non-2xx status code/i.test(direct)) return direct;
  return fallback;
}
