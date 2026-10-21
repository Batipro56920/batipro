import { supabase } from "../lib/supabaseClient";
export type WorkerOfficeAssignment = {id:string;chantier_id:string;date_start:string;date_end:string;note:string};
export async function intervenantOfficePlanning(token:string,chantierId:string):Promise<WorkerOfficeAssignment[]> {
 const {data,error}=await (supabase as any).rpc("intervenant_office_planning",{p_token:token,p_chantier_id:chantierId});
 if(error)throw new Error(error.message);
 return Array.isArray(data)?data:[];
}
