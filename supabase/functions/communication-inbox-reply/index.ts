import { corsHeaders, getCommunicationIdentity, jsonResponse } from "../_shared/communicationAuth.ts";
import { accountAccessToken } from "../_shared/socialAccounts.ts";
import { replyToThread } from "../_shared/socialInbox.ts";

/**
 * Repond dans une conversation, un commentaire ou un avis.
 *
 * La reponse part sous le nom de l'entreprise, avec le jeton du compte : le
 * navigateur n'en voit rien. Elle est ensuite inscrite dans le fil, pour que
 * l'echange reste lisible sans attendre la prochaine synchronisation.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Méthode non supportée." }, 405);

  try {
    const { service, organizationId, name } = await getCommunicationIdentity(req);
    const body = await req.json().catch(() => ({}));
    const threadId = String(body?.threadId ?? "").trim();
    const text = String(body?.body ?? "").trim();
    if (!threadId) return jsonResponse({ error: "Conversation manquante." }, 400);
    if (!text) return jsonResponse({ error: "La réponse est vide." }, 400);

    const { data: thread, error: threadError } = await service
      .from("communication_inbox_threads")
      .select("id, kind, metadata, social_account_id")
      .eq("organization_id", organizationId)
      .eq("id", threadId)
      .single();
    if (threadError) throw new Error("Conversation introuvable.");

    const { data: account, error: accountError } = await service
      .from("communication_social_accounts")
      .select("id, organization_id, provider, external_account_id, parent_account_id, display_name, status")
      .eq("organization_id", organizationId)
      .eq("id", thread.social_account_id)
      .single();
    if (accountError) throw new Error("Compte social introuvable.");

    const token = await accountAccessToken(service, account);
    const sent = await replyToThread({
      provider: String(account.provider),
      kind: thread.kind,
      metadata: (thread.metadata ?? {}) as Record<string, unknown>,
      accessToken: token,
      body: text,
    });

    const sentAt = new Date().toISOString();
    await service.from("communication_inbox_messages").insert({
      organization_id: organizationId,
      thread_id: thread.id,
      provider_message_id: sent.providerMessageId || `local:${crypto.randomUUID()}`,
      direction: "outbound",
      body: text,
      author_name: name,
      sent_at: sentAt,
    });
    await service.from("communication_inbox_threads")
      .update({ status: "pending", unread: false, last_message_at: sentAt })
      .eq("id", thread.id);

    return jsonResponse({ sentAt });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Réponse impossible." }, 400);
  }
});
