import { supabase } from "../lib/supabaseClient";
import { listBackofficeAccounts } from "./backofficeAccounts.service";

const db = supabase as any;

export type Salesperson = {
  id: string;
  name: string;
};

function label(row: { display_name?: unknown; email?: unknown; id?: unknown }): string {
  const name = String(row.display_name ?? "").trim();
  if (name) return name;
  const email = String(row.email ?? "").trim();
  if (email) return email;
  return "Compte sans nom";
}

/**
 * Comptes pouvant porter un dossier commercial.
 *
 * On lit d'abord "profiles" : la RLS laisse passer les membres de l'organisation,
 * donc le bureau voit la liste. La fonction d'administration ne sert que de
 * repli, elle refuse les non-ADMIN.
 */
export async function listSalespeople(): Promise<Salesperson[]> {
  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,role")
    .in("role", ["ADMIN", "BUREAU"]);

  if (!error && Array.isArray(data) && data.length) {
    return (data as Array<Record<string, unknown>>)
      .map((row) => ({ id: String(row.id ?? ""), name: label(row) }))
      .filter((row) => row.id)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  try {
    const accounts = await listBackofficeAccounts();
    return accounts
      .map((account) => ({ id: account.id, name: label(account) }))
      .filter((row) => row.id)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } catch {
    return [];
  }
}

/** Le dossier suit l'affaire quand elle existe, sinon le prospect. */
export async function assignProjectSalesperson(
  target: { opportunityId?: string | null; prospectId?: string | null },
  salespersonId: string | null,
): Promise<void> {
  const value = salespersonId || null;
  if (target.opportunityId) {
    const { error } = await db.from("crm_opportunities").update({ responsable_id: value }).eq("id", target.opportunityId);
    if (error) throw error;
  }
  if (target.prospectId) {
    const { error } = await db.from("crm_prospects").update({ owner_id: value }).eq("id", target.prospectId);
    if (error) throw error;
  }
}
