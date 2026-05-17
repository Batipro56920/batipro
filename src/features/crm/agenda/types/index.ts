import type { CrmAppointmentRow, CrmTaskRow } from "../../../../services/crm.service";

export type AgendaView = "day" | "week" | "month";
export type AgendaEventKind = "rdv" | "relance" | "task" | "done" | "urgent";

export type AgendaEvent = {
  id: string;
  title: string;
  type: string;
  date: string | null;
  description?: string | null;
  priority?: string | null;
  status: string;
  kind: AgendaEventKind;
  source: "task" | "appointment";
  task?: CrmTaskRow;
  appointment?: CrmAppointmentRow;
};
