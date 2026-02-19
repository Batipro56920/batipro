type AnyRow = Record<string, any>;
type DatabaseRelationship = {
  foreignKeyName: string;
  columns: string[];
  referencedRelation: string;
  referencedColumns: string[];
  isOneToOne?: boolean;
};
type AnyTable = {
  Row: AnyRow;
  Insert: AnyRow;
  Update: AnyRow;
  Relationships: DatabaseRelationship[];
};

export type Database = {
  public: {
    Tables: {
      chantier_documents: {
        Row: {
          id: string;
          chantier_id: string;
          title: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          category: string;
          document_type: string;
          visibility_mode: string | null;
          visibility: string | null;
          allowed_intervenant_ids: string[] | null;
          uploaded_by_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chantier_id: string;
          title: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          category: string;
          document_type: string;
          visibility_mode?: string | null;
          visibility?: string | null;
          allowed_intervenant_ids?: string[] | null;
          uploaded_by_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chantier_id?: string;
          title?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          category?: string;
          document_type?: string;
          visibility_mode?: string | null;
          visibility?: string | null;
          allowed_intervenant_ids?: string[] | null;
          uploaded_by_email?: string | null;
          created_at?: string;
        };
        Relationships: DatabaseRelationship[];
      };
      chantier_reserves: {
        Row: {
          id: string;
          chantier_id: string;
          task_id: string | null;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          intervenant_id: string | null;
          levee_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chantier_id: string;
          task_id?: string | null;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          intervenant_id?: string | null;
          levee_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chantier_id?: string;
          task_id?: string | null;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          intervenant_id?: string | null;
          levee_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: DatabaseRelationship[];
      };
      document_access: {
        Row: {
          id: string;
          document_id: string;
          intervenant_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          intervenant_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          intervenant_id?: string;
          created_at?: string | null;
        };
        Relationships: DatabaseRelationship[];
      };
      chantier_task_assignees: {
        Row: {
          id: string;
          task_id: string;
          intervenant_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          intervenant_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          intervenant_id?: string;
          created_at?: string | null;
        };
        Relationships: DatabaseRelationship[];
      };
      chantier_intervenant_access: AnyTable;
      chantier_doe_items: AnyTable;
      chantier_visite_actions: AnyTable;
      chantier_visites: AnyTable;
      chantier_lots: AnyTable;
      chantier_tasks: AnyTable;
      chantiers: AnyTable;
      company_settings: AnyTable;
      devis: AnyTable;
      devis_lignes: AnyTable;
      "devis-pdf": AnyTable;
      intervenants: AnyTable;
      materiel_demandes: AnyTable;
      planning_entries: AnyTable;
      planning_annotations: AnyTable;
      reserve_documents: AnyTable;
      reserve_plan_markers: AnyTable;
      suppliers: AnyTable;
      task_templates: AnyTable;
      task_dependencies: AnyTable;
      task_documents: AnyTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};




