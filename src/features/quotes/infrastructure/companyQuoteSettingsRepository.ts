import { addDays, format } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import { DEFAULT_COMPANY_QUOTE_SETTINGS, type CompanyQuoteSettings } from "../domain/QuoteSettings";
import type { QuoteVatRate } from "../domain/QuoteEnums";

const db = supabase as any;

type SettingsRow = {
  organization_id: string;
  default_vat_rate: number | null;
  default_deposit_percent: number | null;
  accepted_payment_methods: string[] | null;
  default_payment_terms: string | null;
  default_legal_mentions: string | null;
  default_waste_management: string | null;
  default_footer_notes: string | null;
  quote_number_prefix: string | null;
  quote_number_next: number | null;
  quote_number_padding: number | null;
  default_validity_days: number | null;
  default_work_start_delay_days: number | null;
  default_estimated_duration: string | null;
  default_salesperson_id: string | null;
  default_show_margins: boolean | null;
  default_show_references: boolean | null;
  default_show_vat_column: boolean | null;
  default_show_quantity_columns: boolean | null;
  default_hide_composite_details: boolean | null;
  default_show_vat_certificate: boolean | null;
  default_show_waste_management: boolean | null;
  default_custom_numbering: boolean | null;
  cgv: string | null;
};

export async function getCompanyQuoteSettings(): Promise<CompanyQuoteSettings> {
  const organizationId = await currentOrgId();
  const { data, error } = await db.from("company_quote_settings").select("*").eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  if (data) return mapSettings(data as SettingsRow);
  const { data: inserted, error: insertError } = await db.from("company_quote_settings").insert([{ organization_id: organizationId }]).select("*").single();
  if (insertError) throw insertError;
  return mapSettings(inserted as SettingsRow);
}

export async function updateCompanyQuoteSettings(patch: Partial<CompanyQuoteSettings>): Promise<CompanyQuoteSettings> {
  const organizationId = await currentOrgId();
  const { data, error } = await db
    .from("company_quote_settings")
    .upsert({ organization_id: organizationId, ...toDbPatch(patch), updated_at: new Date().toISOString() }, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw error;
  return mapSettings(data as SettingsRow);
}

export function buildQuoteDefaults(settings: CompanyQuoteSettings) {
  const today = new Date();
  return {
    quoteNumber: `${settings.quoteNumberPrefix}-${String(settings.quoteNumberNext).padStart(settings.quoteNumberPadding, "0")}`,
    validUntil: format(addDays(today, settings.defaultValidityDays), "yyyy-MM-dd"),
    workStartDate: settings.defaultWorkStartDelayDays > 0 ? format(addDays(today, settings.defaultWorkStartDelayDays), "yyyy-MM-dd") : null,
    displayOptions: {
      site_address: "",
      footer_notes: settings.defaultFooterNotes,
      default_vat_rate: settings.defaultVatRate,
      work_start_date: settings.defaultWorkStartDelayDays > 0 ? format(addDays(today, settings.defaultWorkStartDelayDays), "yyyy-MM-dd") : null,
      estimated_duration: settings.defaultEstimatedDuration,
      salesperson_id: settings.defaultSalespersonId,
      show_margins: settings.defaultShowMargins,
      show_references: settings.defaultShowReferences,
      show_vat_column: settings.defaultShowVatColumn,
      show_quantity_columns: settings.defaultShowQuantityColumns,
      hide_composite_details: settings.defaultHideCompositeDetails,
      show_vat_certificate: settings.defaultShowVatCertificate,
      show_waste_management: settings.defaultShowWasteManagement,
      custom_numbering: settings.defaultCustomNumbering,
      accepted_payment_methods: settings.acceptedPaymentMethods,
      cgv: settings.cgv,
    },
  };
}

function mapSettings(row: SettingsRow): CompanyQuoteSettings {
  return {
    defaultVatRate: normalizeVat(Number(row.default_vat_rate ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultVatRate)),
    defaultDepositPercent: Number(row.default_deposit_percent ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultDepositPercent),
    acceptedPaymentMethods: row.accepted_payment_methods ?? DEFAULT_COMPANY_QUOTE_SETTINGS.acceptedPaymentMethods,
    defaultPaymentTerms: row.default_payment_terms ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultPaymentTerms,
    defaultLegalMentions: row.default_legal_mentions ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultLegalMentions,
    defaultWasteManagement: row.default_waste_management ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultWasteManagement,
    defaultFooterNotes: row.default_footer_notes ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultFooterNotes,
    quoteNumberPrefix: row.quote_number_prefix ?? DEFAULT_COMPANY_QUOTE_SETTINGS.quoteNumberPrefix,
    quoteNumberNext: Number(row.quote_number_next ?? DEFAULT_COMPANY_QUOTE_SETTINGS.quoteNumberNext),
    quoteNumberPadding: Number(row.quote_number_padding ?? DEFAULT_COMPANY_QUOTE_SETTINGS.quoteNumberPadding),
    defaultValidityDays: Number(row.default_validity_days ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultValidityDays),
    defaultWorkStartDelayDays: Number(row.default_work_start_delay_days ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultWorkStartDelayDays),
    defaultEstimatedDuration: row.default_estimated_duration ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultEstimatedDuration,
    defaultSalespersonId: row.default_salesperson_id ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultSalespersonId,
    defaultShowMargins: Boolean(row.default_show_margins ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowMargins),
    defaultShowReferences: Boolean(row.default_show_references ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowReferences),
    defaultShowVatColumn: Boolean(row.default_show_vat_column ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowVatColumn),
    defaultShowQuantityColumns: Boolean(row.default_show_quantity_columns ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowQuantityColumns),
    defaultHideCompositeDetails: Boolean(row.default_hide_composite_details ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultHideCompositeDetails),
    defaultShowVatCertificate: Boolean(row.default_show_vat_certificate ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowVatCertificate),
    defaultShowWasteManagement: Boolean(row.default_show_waste_management ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultShowWasteManagement),
    defaultCustomNumbering: Boolean(row.default_custom_numbering ?? DEFAULT_COMPANY_QUOTE_SETTINGS.defaultCustomNumbering),
    cgv: row.cgv ?? DEFAULT_COMPANY_QUOTE_SETTINGS.cgv,
  };
}

function toDbPatch(patch: Partial<CompanyQuoteSettings>) {
  return {
    ...(patch.defaultVatRate !== undefined ? { default_vat_rate: patch.defaultVatRate } : {}),
    ...(patch.defaultDepositPercent !== undefined ? { default_deposit_percent: patch.defaultDepositPercent } : {}),
    ...(patch.acceptedPaymentMethods !== undefined ? { accepted_payment_methods: patch.acceptedPaymentMethods } : {}),
    ...(patch.defaultPaymentTerms !== undefined ? { default_payment_terms: patch.defaultPaymentTerms } : {}),
    ...(patch.defaultLegalMentions !== undefined ? { default_legal_mentions: patch.defaultLegalMentions } : {}),
    ...(patch.defaultWasteManagement !== undefined ? { default_waste_management: patch.defaultWasteManagement } : {}),
    ...(patch.defaultFooterNotes !== undefined ? { default_footer_notes: patch.defaultFooterNotes } : {}),
    ...(patch.quoteNumberPrefix !== undefined ? { quote_number_prefix: patch.quoteNumberPrefix } : {}),
    ...(patch.quoteNumberNext !== undefined ? { quote_number_next: patch.quoteNumberNext } : {}),
    ...(patch.quoteNumberPadding !== undefined ? { quote_number_padding: patch.quoteNumberPadding } : {}),
    ...(patch.defaultValidityDays !== undefined ? { default_validity_days: patch.defaultValidityDays } : {}),
    ...(patch.defaultWorkStartDelayDays !== undefined ? { default_work_start_delay_days: patch.defaultWorkStartDelayDays } : {}),
    ...(patch.defaultEstimatedDuration !== undefined ? { default_estimated_duration: patch.defaultEstimatedDuration } : {}),
    ...(patch.defaultSalespersonId !== undefined ? { default_salesperson_id: patch.defaultSalespersonId } : {}),
    ...(patch.defaultShowMargins !== undefined ? { default_show_margins: patch.defaultShowMargins } : {}),
    ...(patch.defaultShowReferences !== undefined ? { default_show_references: patch.defaultShowReferences } : {}),
    ...(patch.defaultShowVatColumn !== undefined ? { default_show_vat_column: patch.defaultShowVatColumn } : {}),
    ...(patch.defaultShowQuantityColumns !== undefined ? { default_show_quantity_columns: patch.defaultShowQuantityColumns } : {}),
    ...(patch.defaultHideCompositeDetails !== undefined ? { default_hide_composite_details: patch.defaultHideCompositeDetails } : {}),
    ...(patch.defaultShowVatCertificate !== undefined ? { default_show_vat_certificate: patch.defaultShowVatCertificate } : {}),
    ...(patch.defaultShowWasteManagement !== undefined ? { default_show_waste_management: patch.defaultShowWasteManagement } : {}),
    ...(patch.defaultCustomNumbering !== undefined ? { default_custom_numbering: patch.defaultCustomNumbering } : {}),
    ...(patch.cgv !== undefined ? { cgv: patch.cgv } : {}),
  };
}

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error("Utilisateur non authentifie.");
  return id;
}

function normalizeVat(value: number): QuoteVatRate {
  if (value === 0 || value === 5.5 || value === 10 || value === 20) return value;
  return 20;
}
