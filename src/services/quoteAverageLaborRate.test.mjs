import assert from "node:assert/strict";
import test from "node:test";
import { quoteAverageLaborHourlyCost } from "./quoteAverageLaborRate.ts";

test("le devis prend la moyenne des salariés productifs", () => {
 assert.equal(quoteAverageLaborHourlyCost(27.85), 27.85);
});
test("une moyenne absente ne génère pas un tarif fictif", () => {
 assert.equal(quoteAverageLaborHourlyCost(null), 0);
 assert.equal(quoteAverageLaborHourlyCost(undefined), 0);
 assert.equal(quoteAverageLaborHourlyCost(Number.NaN), 0);
 assert.equal(quoteAverageLaborHourlyCost(-2), 0);
});
