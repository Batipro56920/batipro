import { installProductDrawerPricingBridge } from "./services/productDrawerPricingBridge";
import { installProductProcedureDisplayBridge } from "./services/productProcedureDisplayBridge";
import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

installProductDrawerPricingBridge();
installProductProcedureDisplayBridge();
installTaskTemplateProductAutofillBridge();
