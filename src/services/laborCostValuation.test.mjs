import assert from "node:assert/strict";
import test from "node:test";
import { configuredWorkerRates, valueLaborEntry, sumLaborValues } from "./laborCostValuation.service.ts";

const worker = {id:"worker",status:"employee",hourly_cost_ht:24.92,daily_rate_ht:null};
const entry = (patch={}) => ({chantier_id:"chantier",task_id:"task",intervenant_id:"worker",duration_hours:7,...patch});

test("pointage avec coût salarié individualisé",()=>{
 const rates=configuredWorkerRates([worker]);
 assert.equal(valueLaborEntry(entry(),rates,48).laborCostHt,174.44);
});
test("historique figé prime sur le tarif modifié",()=>{
 const rates=configuredWorkerRates([{...worker,hourly_cost_ht:40}]);
 const v=valueLaborEntry(entry({hourly_cost_snapshot_ht:24.92}),rates,48);
 assert.equal(v.laborCostHt,174.44);
 assert.equal(v.hoursUsingSnapshot,7);
});
test("sous traitance au forfait journée avec repli horaire",()=>{
 const rates=configuredWorkerRates([{...worker,status:"subcontractor",hourly_cost_ht:null,daily_rate_ht:245}]);
 assert.equal(valueLaborEntry(entry(),rates,48).laborCostHt,245);
});
test("taux chantier seulement lorsque le tarif individuel est absent",()=>{
 const v=valueLaborEntry(entry(),new Map(),48);
 assert.equal(v.laborCostHt,336);
 assert.equal(v.hoursUsingChantierRate,7);
});
test("les heures inutilisables ne produisent aucun coût",()=>{
 const v=valueLaborEntry(entry({duration_hours:null}),new Map(),48);
 assert.equal(v.laborCostHt,0);
});
test("consolidation de plusieurs coûts et taux",()=>{
 const vals=[
 valueLaborEntry(entry({duration_hours:2,hourly_cost_snapshot_ht:20}),new Map(),48),
 valueLaborEntry(entry({duration_hours:3}),new Map(),48),
 ];
 const s=sumLaborValues(vals);
 assert.deepEqual(s,{hours:5,laborCostHt:184,hoursUsingChantierRate:3,hoursUsingSnapshot:2});
});
