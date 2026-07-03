export * from "./domain/types";
export * from "./infrastructure/productCatalogRepository";

import { installTaskTemplateProductAutofillBridge } from "./services/taskTemplateProductAutofillBridge";

installTaskTemplateProductAutofillBridge();
