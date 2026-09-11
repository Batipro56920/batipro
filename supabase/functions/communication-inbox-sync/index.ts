import { corsHeaders, getServiceClient, jsonResponse } from "../_shared/communicationAuth.ts";
import { accountAccessToken, listConnectedAccounts, recordAccountError } from "../_shared/socialAccounts.ts";
import { fetchThreads } from "../_shared/socialInbox.ts";

/**
 * Remplit la boite de reception.
 *
 * Un compte en panne ne doit pas arreter les autres : chaque compte est traite
 * isolement et son erreur est ecrite sur sa fiche, la ou le bureau la verra.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("COMMUNICATION_CRON_SECRET");
  if (!expected) return jsonResponse({ error: "Secret COMMUNICATION_CRON_SECRET manquant sur le serveur." }, 503);
  if (req.headers.get("x-communication-cron") !== expected) return jsonResponse({ error: "Appel non autorisé." }, 401);

  const service = getServiceClient();
  let accounts;
  try {
    accounts = await listConnectedAccounts(service);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Comptes illisibles." }, 500);
  }

  let threadsSeen = 0;
  let messagesSeen = 0;
  const failures: Array<{ account: string; error: string }> = [];

  for (const account of accounts) {
    try {
      const token = await accountAccessToken(service, account);
      const threads = await fetchThreads({
        provider: account.provider,
        externalAccountId: account.external_account_id,
        parentAccountId: account.parent_account_id,
        accessToken: token,
      });

      for (const thread of threads) {
        const { data: saved, error: threadError } = await service
          .from("communication_inbox_threads")
          .upsert({
            organization_id: account.organization_id,
            social_account_id: account.id,
            provider_thread_id: thread.providerThreadId,
            kind: thread.kind,
            contact_name: thread.contactName,
            contact_avatar_url: thread.contactAvatarUrl,
            subject: thread.subject,
            permalink: thread.permalink,
            last_message_at: thread.lastMessageAt,
            last_synced_at: new Date().toISOString(),
            metadata: thread.metadata,
          }, { onConflict: "organization_id,social_account_id,provider_thread_id", ignoreDuplicates: false })
          .select("id")
          .single();
        if (threadError) throw new Error(threadError.message);
        threadsSeen += 1;

        if (!thread.messages.length) continue;
        const { error: messageError } = await service.from("communication_inbox_messages").upsert(
          thread.messages.map((message) => ({
            organization_id: account.organization_id,
            thread_id: saved.id,
            provider_message_id: message.providerMessageId,
            provider_parent_id: message.providerParentId,
            direction: message.direction,
            body: message.body,
            author_name: message.authorName,
            sent_at: message.sentAt,
          })),
          { onConflict: "thread_id,provider_message_id", ignoreDuplicates: true },
        );
        if (messageError) throw new Error(messageError.message);
        messagesSeen += thread.messages.length;
      }

      await recordAccountError(service, account.id, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synchronisation impossible.";
      failures.push({ account: account.display_name, error: message });
      await recordAccountError(service, account.id, message);
    }
  }

  return jsonResponse({ accounts: accounts.length, threads: threadsSeen, messages: messagesSeen, failures });
});
