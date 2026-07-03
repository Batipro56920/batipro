import { installProductDrawerPricingBridge } from "./services/productDrawerPricingBridge";
import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

installProductDrawerPricingBridge();
installTaskTemplateProductAutofillBridge();
