import { installProductDrawerPricingBridge } from "./services/productDrawerPricingBridge";
import { installProductProcedureDisplayBridge } from "./services/productProcedureDisplayBridge";
import { installTaskTemplateLotSettingsBridge } from "./services/taskTemplateLotSettingsBridge";
import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

installProductDrawerPricingBridge();
installProductProcedureDisplayBridge();
installTaskTemplateLotSettingsBridge();
installTaskTemplateProductAutofillBridge();
