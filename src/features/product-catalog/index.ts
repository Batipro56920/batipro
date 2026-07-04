import { installProductDrawerPricingBridge } from "./services/productDrawerPricingBridge";
import { installProductProcedureDisplayBridge } from "./services/productProcedureDisplayBridge";
import { installTaskTemplateCocoAssistantBridge } from "./services/taskTemplateCocoAssistantBridge";
import { installTaskTemplateLotDropdownBridge } from "./services/taskTemplateLotDropdownBridge";
import { installTaskTemplateLotSettingsBridge } from "./services/taskTemplateLotSettingsBridge";
import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

installProductDrawerPricingBridge();
installProductProcedureDisplayBridge();
installTaskTemplateCocoAssistantBridge();
installTaskTemplateLotDropdownBridge();
installTaskTemplateLotSettingsBridge();
installTaskTemplateProductAutofillBridge();
