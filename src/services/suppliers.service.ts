import { supabase } from "../lib/supabaseClient";

const TABLE = "suppliers";

export type SupplierRow = {
  id: string;
  organization_id: string;
  name: string;
  specialty: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupplierCreateInput = {
  name: string;
  specialty?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export type SupplierUpdateInput = Partial<SupplierCreateInput>;

function sanitizeNullable(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned : null;
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(input: SupplierCreateInput): Promise<SupplierRow> {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Le nom du fournisseur est obligatoire.");

  const payload = {
    name,
    specialty: sanitizeNullable(input.specialty),
    address: sanitizeNullable(input.address),
    city: sanitizeNullable(input.city),
    phone: sanitizeNullable(input.phone),
    email: sanitizeNullable(input.email),
    siret: sanitizeNullable(input.siret),
    notes: sanitizeNullable(input.notes),
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as SupplierRow;
}

export async function updateSupplier(id: string, patch: SupplierUpdateInput): Promise<SupplierRow> {
  if (!id) throw new Error("ID fournisseur manquant.");

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const cleanedName = String(patch.name ?? "").trim();
    if (!cleanedName) throw new Error("Le nom du fournisseur est obligatoire.");
    payload.name = cleanedName;
  }
  if (patch.specialty !== undefined) payload.specialty = sanitizeNullable(patch.specialty);
  if (patch.address !== undefined) payload.address = sanitizeNullable(patch.address);
  if (patch.city !== undefined) payload.city = sanitizeNullable(patch.city);
  if (patch.phone !== undefined) payload.phone = sanitizeNullable(patch.phone);
  if (patch.email !== undefined) payload.email = sanitizeNullable(patch.email);
  if (patch.siret !== undefined) payload.siret = sanitizeNullable(patch.siret);
  if (patch.notes !== undefined) payload.notes = sanitizeNullable(patch.notes);
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;

  const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as SupplierRow;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) throw new Error("ID fournisseur manquant.");
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
