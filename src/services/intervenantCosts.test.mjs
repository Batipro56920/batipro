import assert from "node:assert/strict";
import test from "node:test";
import { effectiveIntervenantHourlyCost } from "./intervenantCosts.service.ts";

test("employee hourly cost uses the configured cost", () => {
  assert.equal(effectiveIntervenantHourlyCost({ status: "employee", hourly_cost_ht: 24.92, daily_rate_ht: null }), 24.92);
});

test("subcontractor daily cost converts using seven productive hours", () => {
  assert.equal(effectiveIntervenantHourlyCost({ status: "subcontractor", hourly_cost_ht: null, daily_rate_ht: 245 }), 35);
});

test("explicit hourly cost takes precedence over daily amount", () => {
  assert.equal(effectiveIntervenantHourlyCost({ status: "temporary_worker", hourly_cost_ht: 38, daily_rate_ht: 245 }), 38);
});

test("missing costs do not silently become zero", () => {
  assert.equal(effectiveIntervenantHourlyCost({ status: "employee", hourly_cost_ht: null, daily_rate_ht: null }), null);
  assert.equal(effectiveIntervenantHourlyCost({ status: "subcontractor", hourly_cost_ht: null, daily_rate_ht: null }), null);
});
