import { installProductDrawerPricingBridge } from "./services/productDrawerPricingBridge";
import { installProductProcedureDisplayBridge } from "./services/productProcedureDisplayBridge";
import { installTaskTemplateCocoAssistantBridge } from "./services/taskTemplateCocoAssistantBridge";
import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

installProductDrawerPricingBridge();
installProductProcedureDisplayBridge();
installTaskTemplateCocoAssistantBridge();
installTaskTemplateProductAutofillBridge();
