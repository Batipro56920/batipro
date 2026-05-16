import { z } from "zod";

export const quoteMetaSchema = z.object({
  number: z.string().min(1, "Numero obligatoire"),
  clientId: z.string().nullable(),
  prospectId: z.string().nullable(),
  projectId: z.string().nullable(),
  clientName: z.string().optional(),
  siteAddress: z.string().optional(),
  validityDate: z.string().nullable(),
});

export type QuoteMetaFormValues = z.infer<typeof quoteMetaSchema>;
