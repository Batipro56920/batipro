import { z } from "zod";

export const documentPartySchema = z.object({
  id: z.string().nullable().optional(),
  kind: z.enum(["company", "client", "prospect", "supplier", "project", "chantier"]),
  displayName: z.string().min(1, "Le nom est obligatoire"),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
});

export const documentSettingsSchema = z.object({
  defaultVatRate: z.number().min(0),
  showUnitPrices: z.boolean(),
  showVatColumn: z.boolean(),
  showSectionTotals: z.boolean(),
  showCompositeDetails: z.boolean(),
  showInternalNotes: z.boolean(),
  numberingMode: z.enum(["automatic", "manual"]),
});

export const documentTermsSchema = z.object({
  paymentTerms: z.string(),
  legalMentions: z.string(),
  wasteManagement: z.string().optional(),
  footerNotes: z.string().optional(),
  depositPercent: z.number().nullable().optional(),
  depositAmount: z.number().nullable().optional(),
  paymentMethods: z.array(z.enum(["card", "transfer", "cash", "cheque", "direct_debit"])),
});

export const businessDocumentSchema = z.object({
  id: z.string().nullable(),
  kind: z.enum(["quote", "invoice", "credit_note", "purchase_order", "reception_report"]),
  number: z.string().min(1),
  status: z.enum(["draft", "ready", "sent", "viewed", "accepted", "modification_requested", "signed", "refused", "expired", "cancelled", "paid", "partially_paid", "overdue"]),
  issueDate: z.string().min(1),
  recipient: documentPartySchema,
  company: documentPartySchema,
  title: z.string().min(1),
  currency: z.literal("EUR"),
  settings: documentSettingsSchema,
  terms: documentTermsSchema,
});

export function validateBusinessDocument(input: unknown) {
  return businessDocumentSchema.safeParse(input);
}
