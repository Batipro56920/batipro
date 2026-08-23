import { supabase } from "../../../lib/supabaseClient";
import type { ProductCatalogDraft, ProductCatalogItem, ProductKnowledge } from "../domain/types";

type ProductLike = ProductCatalogItem | ProductCatalogDraft;

const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function confidence(value: unknown): "high" | "medium" | "low" {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CONFIDENCE_VALUES.has(normalized) ? normalized as "high" | "medium" | "low" : "low";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter((item): item is string => Boolean(item));
}

function block<T>(raw: any, value: T, fallbackSource: string | null) {
  return {
    value,
    confidence: confidence(raw?.confidence),
    reasoning: text(raw?.reasoning) ?? "",
    sourceDocument: text(raw?.sourceDocument) ?? fallbackSource,
  };
}

function bool(value: unknown) {
  return value === true;
}

export function emptyProductKnowledge(product?: Partial<ProductLike> | null): ProductKnowledge {
  return {
    identity: block(null, {
      designation: text(product?.designation),
      brand: text(product?.brand),
      manufacturer: null,
      manufacturerReference: text(product?.manufacturerReference),
      ean: null,
      conditionnement: null,
      unit: product?.unit ?? null,
    }, null),
    supplier: block(null, {
      supplier: text(product?.mainSupplierName),
      supplierReference: null,
      supplierProductCode: null,
    }, null),
    pricing: block(null, {
      purchasePrice: number(product?.standardPurchasePriceHt),
      recommendedSalePrice: number(product?.recommendedSalePriceHt),
      currency: "EUR",
      vat: number(product?.vatRate),
    }, null),
    materialUsage: block(null, {
      ratioQuantity: null,
      ratioUnit: null,
      sourceUnit: product?.unit ?? null,
      lossPercent: null,
      minimumOrder: null,
      coverage: null,
    }, null),
    application: block(null, {
      interior: false,
      exterior: false,
      wall: false,
      floor: false,
      ceiling: false,
      wood: false,
      metal: false,
      placo: false,
      concrete: false,
      facade: false,
    }, null),
    supports: block(null, [], null),
    forbiddenSupports: block(null, [], null),
    tools: block(null, [], null),
    consumables: block(null, [], null),
    PPE: block(null, [], null),
    weatherLimits: block(null, {
      minTemperature: null,
      maxTemperature: null,
      humidity: null,
      frost: null,
      rain: null,
      wind: null,
      sun: null,
    }, null),
    dryingTimes: block(null, [], null),
    procedure: block(null, [], null),
    controls: block(null, [], null),
    commonMistakes: block(null, [], null),
    doe: block(null, [], null),
    fieldExperience: block(null, [], null),
    confidence: block(null, { global: "low", missingInformation: [] }, null),
  };
}

export function normalizeProductKnowledge(raw: unknown, product?: Partial<ProductLike> | null): ProductKnowledge {
  const source = (raw as any)?.sourceDocument ? text((raw as any).sourceDocument) : null;
  const fallback = emptyProductKnowledge(product);
  const data = raw as any;
  return {
    identity: block(data?.identity, {
      designation: text(data?.identity?.value?.designation ?? data?.identity?.designation) ?? fallback.identity.value.designation,
      brand: text(data?.identity?.value?.brand ?? data?.identity?.brand) ?? fallback.identity.value.brand,
      manufacturer: text(data?.identity?.value?.manufacturer ?? data?.identity?.manufacturer),
      manufacturerReference: text(data?.identity?.value?.manufacturerReference ?? data?.identity?.manufacturerReference) ?? fallback.identity.value.manufacturerReference,
      ean: text(data?.identity?.value?.ean ?? data?.identity?.ean),
      conditionnement: text(data?.identity?.value?.conditionnement ?? data?.identity?.conditionnement),
      unit: text(data?.identity?.value?.unit ?? data?.identity?.unit) as ProductKnowledge["identity"]["value"]["unit"],
    }, source),
    supplier: block(data?.supplier, {
      supplier: text(data?.supplier?.value?.supplier ?? data?.supplier?.supplier),
      supplierReference: text(data?.supplier?.value?.supplierReference ?? data?.supplier?.supplierReference),
      supplierProductCode: text(data?.supplier?.value?.supplierProductCode ?? data?.supplier?.supplierProductCode),
    }, source),
    pricing: block(data?.pricing, {
      purchasePrice: number(data?.pricing?.value?.purchasePrice ?? data?.pricing?.purchasePrice),
      recommendedSalePrice: number(data?.pricing?.value?.recommendedSalePrice ?? data?.pricing?.recommendedSalePrice),
      currency: text(data?.pricing?.value?.currency ?? data?.pricing?.currency) ?? "EUR",
      vat: number(data?.pricing?.value?.vat ?? data?.pricing?.vat),
    }, source),
    materialUsage: block(data?.materialUsage, {
      ratioQuantity: number(data?.materialUsage?.value?.ratioQuantity ?? data?.materialUsage?.ratioQuantity),
      ratioUnit: text(data?.materialUsage?.value?.ratioUnit ?? data?.materialUsage?.ratioUnit),
      sourceUnit: text(data?.materialUsage?.value?.sourceUnit ?? data?.materialUsage?.sourceUnit),
      lossPercent: number(data?.materialUsage?.value?.lossPercent ?? data?.materialUsage?.lossPercent),
      minimumOrder: number(data?.materialUsage?.value?.minimumOrder ?? data?.materialUsage?.minimumOrder),
      coverage: number(data?.materialUsage?.value?.coverage ?? data?.materialUsage?.coverage),
    }, source),
    application: block(data?.application, {
      interior: bool(data?.application?.value?.interior ?? data?.application?.interior),
      exterior: bool(data?.application?.value?.exterior ?? data?.application?.exterior),
      wall: bool(data?.application?.value?.wall ?? data?.application?.wall),
      floor: bool(data?.application?.value?.floor ?? data?.application?.floor),
      ceiling: bool(data?.application?.value?.ceiling ?? data?.application?.ceiling),
      wood: bool(data?.application?.value?.wood ?? data?.application?.wood),
      metal: bool(data?.application?.value?.metal ?? data?.application?.metal),
      placo: bool(data?.application?.value?.placo ?? data?.application?.placo),
      concrete: bool(data?.application?.value?.concrete ?? data?.application?.concrete),
      facade: bool(data?.application?.value?.facade ?? data?.application?.facade),
    }, source),
    supports: block(data?.supports, strings(data?.supports?.value ?? data?.supports), source),
    forbiddenSupports: block(data?.forbiddenSupports, strings(data?.forbiddenSupports?.value ?? data?.forbiddenSupports), source),
    tools: block(data?.tools, strings(data?.tools?.value ?? data?.tools), source),
    consumables: block(data?.consumables, strings(data?.consumables?.value ?? data?.consumables), source),
    PPE: block(data?.PPE, strings(data?.PPE?.value ?? data?.PPE), source),
    weatherLimits: block(data?.weatherLimits, {
      minTemperature: number(data?.weatherLimits?.value?.minTemperature ?? data?.weatherLimits?.minTemperature),
      maxTemperature: number(data?.weatherLimits?.value?.maxTemperature ?? data?.weatherLimits?.maxTemperature),
      humidity: text(data?.weatherLimits?.value?.humidity ?? data?.weatherLimits?.humidity),
      frost: text(data?.weatherLimits?.value?.frost ?? data?.weatherLimits?.frost),
      rain: text(data?.weatherLimits?.value?.rain ?? data?.weatherLimits?.rain),
      wind: text(data?.weatherLimits?.value?.wind ?? data?.weatherLimits?.wind),
      sun: text(data?.weatherLimits?.value?.sun ?? data?.weatherLimits?.sun),
    }, source),
    dryingTimes: block(data?.dryingTimes, strings(data?.dryingTimes?.value ?? data?.dryingTimes), source),
    procedure: block(data?.procedure, strings(data?.procedure?.value ?? data?.procedure), source),
    controls: block(data?.controls, strings(data?.controls?.value ?? data?.controls), source),
    commonMistakes: block(data?.commonMistakes, strings(data?.commonMistakes?.value ?? data?.commonMistakes), source),
    doe: block(data?.doe, strings(data?.doe?.value ?? data?.doe), source),
    fieldExperience: block(data?.fieldExperience, strings(data?.fieldExperience?.value ?? data?.fieldExperience), source),
    confidence: block(data?.confidence, {
      global: confidence(data?.confidence?.value?.global ?? data?.confidence?.global),
      missingInformation: strings(data?.confidence?.value?.missingInformation ?? data?.confidence?.missingInformation),
    }, source),
  };
}

export async function analyzeProductDocumentsWithCoco(product: ProductLike): Promise<ProductKnowledge> {
  const { data, error } = await supabase.functions.invoke("analyze-product-documents", {
    body: {
      product: {
        designation: product.designation,
        brand: product.brand,
        manufacturerReference: product.manufacturerReference,
        unit: product.unit,
        mainSupplierName: product.mainSupplierName,
        standardPurchasePriceHt: product.standardPurchasePriceHt,
        recommendedSalePriceHt: product.recommendedSalePriceHt,
        vatRate: product.vatRate,
        supplierPrices: product.supplierPrices,
      },
      documents: product.documents,
    },
  });
  if (error) throw error;
  return normalizeProductKnowledge((data as { knowledge?: unknown } | null)?.knowledge, product);
}
