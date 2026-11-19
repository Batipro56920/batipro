import assert from "node:assert/strict";
import test from "node:test";
import { investmentMonthlyQuoteOverhead, investmentQuoteHourlyRate } from "./investmentQuoteAllocation.ts";

const entry = (extra={}) => ({
  id:"1",name:"Camion",category:"vehicules",targetAmountHt:12000,
  durationMonths:12,startDate:"2026-11-10",notes:"",status:"planned",...extra,
});
test("existing investments without explicit allocation are excluded",()=>{
 assert.equal(investmentMonthlyQuoteOverhead([entry()], new Date("2026-11-19T12:00:00Z")),0);
});
test("treasury reserve and paused investments do not charge quotes",()=>{
 const month=new Date("2026-11-19T12:00:00Z");
 assert.equal(investmentMonthlyQuoteOverhead([
   entry({name:"Trésorerie",quoteAllocation:"reserve"}),
   entry({name:"Autocad",quoteAllocation:"overhead",status:"paused"}),
   entry({name:"Camion acquis",quoteAllocation:"overhead",status:"acquired"}),
 ],month),0);
});
test("explicit costs apply only between start and end months",()=>{
 const chosen=entry({quoteAllocation:"overhead",targetAmountHt:1200,durationMonths:3,startDate:"2027-01-15"});
 assert.equal(investmentMonthlyQuoteOverhead([chosen],new Date("2026-12-20T12:00:00Z")),0);
 assert.equal(investmentMonthlyQuoteOverhead([chosen],new Date("2027-01-19T12:00:00Z")),400);
 assert.equal(investmentMonthlyQuoteOverhead([chosen],new Date("2027-03-01T12:00:00Z")),400);
 assert.equal(investmentMonthlyQuoteOverhead([chosen],new Date("2027-04-01T12:00:00Z")),0);
});
test("scales automatically with the number of productive workers",()=>{
 const monthly=1000,annual=1607;
 assert.equal(investmentQuoteHourlyRate(monthly,2,annual),12000/3214);
 assert.equal(investmentQuoteHourlyRate(monthly,4,annual),12000/6428);
 assert.equal(investmentQuoteHourlyRate(monthly,0,annual),0);
});
test("rejects malformed start date and invalid amounts",()=>{
 const month=new Date("2026-11-19T12:00:00Z");
 assert.equal(investmentMonthlyQuoteOverhead([
   entry({quoteAllocation:"overhead",startDate:"bad"}),
   entry({quoteAllocation:"overhead",targetAmountHt:-50})
 ],month),0);
});
