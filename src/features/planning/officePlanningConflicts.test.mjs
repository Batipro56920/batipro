import assert from "node:assert/strict";
import test from "node:test";
import { detectCrossChantierConflicts, taskInterval } from "./officePlanningConflicts.ts";

const task = (chantier_id, intervenant_id, start_date, duration_days = 1, status = "planifie") => ({
  chantier_id, intervenant_id, start_at: null, end_at: null, start_date, duration_days, status,
});

test("une affectation et sa tâche sur le même chantier ne créent pas de conflit", () => {
  const office = [{ chantier_id: "A", intervenant_id: "worker", date_start: "2026-11-09", date_end: "2026-11-10" }];
  assert.deepEqual(detectCrossChantierConflicts(office, [task("A", "worker", "2026-11-09")], ["2026-11-09"]), []);
});

test("une tâche sur un deuxième chantier le même jour crée une seule alerte", () => {
  const office = [{ chantier_id: "A", intervenant_id: "worker", date_start: "2026-11-09", date_end: "2026-11-11" }];
  const tasks = [task("A", "worker", "2026-11-09"), task("B", "worker", "2026-11-10")];
  assert.deepEqual(detectCrossChantierConflicts(office, tasks, ["2026-11-09", "2026-11-10"]), [
    { workerId: "worker", day: "2026-11-10", chantierIds: ["A", "B"] },
  ]);
});

test("les segments annulés et sans intervenant sont ignorés", () => {
  const office = [{ chantier_id: "A", intervenant_id: "worker", date_start: "2026-11-09", date_end: "2026-11-09" }];
  const tasks = [task("B", "worker", "2026-11-09", 1, "annule"), task("B", null, "2026-11-09")];
  assert.deepEqual(detectCrossChantierConflicts(office, tasks, ["2026-11-09"]), []);
});

test("une durée fractionnaire reste limitée à au moins un jour de calendrier", () => {
  assert.deepEqual(taskInterval(task("B", "worker", "2026-11-09", 0.25)), { start: "2026-11-09", end: "2026-11-09" });
  assert.deepEqual(taskInterval(task("B", "worker", "2026-11-09", 1.5)), { start: "2026-11-09", end: "2026-11-10" });
});

test("les dates issues d'un ancien segment restent lisibles", () => {
  assert.deepEqual(taskInterval({
    chantier_id: "B", intervenant_id: "worker",
    start_at: "2026-11-09T08:00:00Z", end_at: "2026-11-11T17:00:00Z",
    start_date: null, duration_days: null,
  }), { start: "2026-11-09", end: "2026-11-11" });
});
