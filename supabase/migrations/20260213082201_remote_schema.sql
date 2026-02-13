drop extension if exists "pg_net";

create type "public"."devis_status" as enum ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE');


  create table "public"."chantier_intervenants" (
    "chantier_id" uuid not null,
    "intervenant_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chantier_intervenants" enable row level security;


  create table "public"."chantier_task_assignees" (
    "id" uuid not null default gen_random_uuid(),
    "task_id" uuid not null,
    "intervenant_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chantier_task_assignees" enable row level security;


  create table "public"."chantier_task_planning_segments" (
    "id" uuid not null default gen_random_uuid(),
    "chantier_id" uuid not null,
    "task_id" uuid not null,
    "intervenant_id" uuid,
    "start_at" timestamp with time zone not null,
    "end_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."chantier_task_planning_segments" enable row level security;


  create table "public"."chantier_task_segments" (
    "id" uuid not null default gen_random_uuid(),
    "chantier_id" uuid not null,
    "task_id" uuid not null,
    "intervenant_id" uuid,
    "start_at" timestamp with time zone not null,
    "end_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."chantier_task_segments" enable row level security;


  create table "public"."document_categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."document_categories" enable row level security;


  create table "public"."document_types" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "label" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."document_types" enable row level security;


  create table "public"."fournisseurs" (
    "id" uuid not null default gen_random_uuid(),
    "nom" text not null,
    "categorie" text,
    "email_commandes" text not null,
    "email_commercial" text,
    "telephone" text,
    "nom_commercial" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."fournisseurs" enable row level security;


  create table "public"."intervenant_chantiers" (
    "id" uuid not null default gen_random_uuid(),
    "intervenant_id" uuid not null,
    "chantier_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."intervenant_chantiers" enable row level security;


  create table "public"."intervenant_users" (
    "user_id" uuid not null,
    "intervenant_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."intervenant_users" enable row level security;


  create table "public"."intervenants" (
    "id" uuid not null default gen_random_uuid(),
    "chantier_id" uuid,
    "nom" text not null,
    "email" text,
    "telephone" text,
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid
      );


alter table "public"."intervenants" enable row level security;


  create table "public"."material_orders" (
    "id" uuid not null default gen_random_uuid(),
    "chantier_id" uuid not null,
    "fournisseur_id" uuid not null,
    "type" text not null,
    "objet" text not null,
    "message" text not null,
    "status" text not null default 'DRAFT'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."material_orders" enable row level security;


  create table "public"."materiel_demandes" (
    "id" uuid not null default gen_random_uuid(),
    "chantier_id" uuid not null,
    "intervenant_id" uuid,
    "designation" text not null,
    "quantite" numeric not null default 1,
    "unite" text,
    "date_besoin" date,
    "statut" text not null default 'A_COMMANDER'::text,
    "remarques" text,
    "created_at" timestamp with time zone not null default now(),
    "fournisseur_id" uuid,
    "order_id" uuid,
    "status" text default 'A_COMMANDER'::text,
    "updated_at" timestamp with time zone not null default now(),
    "task_id" uuid,
    "date_livraison" date
      );


alter table "public"."materiel_demandes" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "role" text not null,
    "display_name" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."task_documents" (
    "id" uuid not null default gen_random_uuid(),
    "task_id" uuid not null,
    "document_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."task_documents" enable row level security;


  create table "public"."task_templates" (
    "id" uuid not null default gen_random_uuid(),
    "titre" text not null,
    "lot" text not null,
    "unite" text,
    "quantite_defaut" numeric,
    "temps_prevu_par_unite_h" numeric,
    "remarques" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."task_templates" enable row level security;

alter table "public"."chantier_documents" enable row level security;

alter table "public"."chantier_reserves" drop column "title";

alter table "public"."chantier_reserves" add column "lot" text;

alter table "public"."chantier_reserves" add column "photo_apres_path" text;

alter table "public"."chantier_reserves" add column "photo_avant_path" text;

alter table "public"."chantier_reserves" add column "piece" text;

alter table "public"."chantier_reserves" add column "priorite" text default 'normale'::text;

alter table "public"."chantier_reserves" add column "statut" text default 'ouverte'::text;

alter table "public"."chantier_reserves" add column "titre" text default ''::text;

alter table "public"."chantier_reserves" alter column "description" set not null;

alter table "public"."chantier_reserves" alter column "updated_at" drop default;

alter table "public"."chantier_reserves" alter column "updated_at" drop not null;

alter table "public"."chantier_reserves" enable row level security;

alter table "public"."chantier_tasks" add column "date_debut" date;

alter table "public"."chantier_tasks" add column "date_fin" date;

alter table "public"."chantier_tasks" add column "devis_ligne_id" uuid;

alter table "public"."chantier_tasks" add column "intervenant_id" uuid;

alter table "public"."chantier_tasks" add column "lot" text;

alter table "public"."chantier_tasks" add column "quantite" numeric not null default 1;

alter table "public"."chantier_tasks" add column "temps_prevu_h" numeric;

alter table "public"."chantier_tasks" add column "temps_reel_h" numeric;

alter table "public"."chantier_tasks" add column "unite" text;

alter table "public"."chantier_tasks" alter column "ordre" set default 1;

alter table "public"."chantier_tasks" alter column "ordre" drop not null;

alter table "public"."chantier_tasks" enable row level security;

alter table "public"."chantiers" add column "budget" numeric;

alter table "public"."chantiers" add column "date_fin" date;

alter table "public"."chantiers" add column "description" text;

alter table "public"."chantiers" add column "reference" text;

alter table "public"."chantiers" add column "statut" text default 'en_cours'::text;

alter table "public"."chantiers" alter column "heures_passees" set default 0;

alter table "public"."chantiers" alter column "heures_passees" set not null;

alter table "public"."chantiers" alter column "heures_prevues" set default 0;

alter table "public"."chantiers" alter column "heures_prevues" set not null;

alter table "public"."chantiers" alter column "status" set default 'EN_ATTENTE'::text;

alter table "public"."chantiers" enable row level security;

alter table "public"."devis" add column "date_devis" date not null default CURRENT_DATE;

alter table "public"."devis" add column "date_validite" date;

alter table "public"."devis" add column "extraction_error" text;

alter table "public"."devis" add column "extraction_status" text not null default 'A_FAIRE'::text;

alter table "public"."devis" add column "notes" text;

alter table "public"."devis" add column "numero" text not null;

alter table "public"."devis" add column "pdf_path" text;

alter table "public"."devis" add column "statut" public.devis_status not null default 'BROUILLON'::public.devis_status;

alter table "public"."devis" add column "titre" text not null;

alter table "public"."devis" add column "total_tva" numeric(12,2) not null default 0;

alter table "public"."devis" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."devis" alter column "total_ht" set default 0;

alter table "public"."devis" alter column "total_ht" set not null;

alter table "public"."devis" alter column "total_ht" set data type numeric(12,2) using "total_ht"::numeric(12,2);

alter table "public"."devis" alter column "total_ttc" set default 0;

alter table "public"."devis" alter column "total_ttc" set not null;

alter table "public"."devis" alter column "total_ttc" set data type numeric(12,2) using "total_ttc"::numeric(12,2);

alter table "public"."devis" enable row level security;

alter table "public"."devis_lignes" add column "task_id" uuid;

alter table "public"."devis_lignes" add column "total_ht" numeric(12,2) not null default 0;

alter table "public"."devis_lignes" add column "total_ttc" numeric(12,2) not null default 0;

alter table "public"."devis_lignes" add column "total_tva" numeric(12,2) not null default 0;

alter table "public"."devis_lignes" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."devis_lignes" alter column "ordre" drop default;

alter table "public"."devis_lignes" alter column "ordre" drop not null;

alter table "public"."devis_lignes" alter column "tva_rate" set data type numeric(6,2) using "tva_rate"::numeric(6,2);

alter table "public"."devis_lignes" enable row level security;

alter table "public"."devis_lines" enable row level security;

CREATE INDEX chantier_intervenants_intervenant_idx ON public.chantier_intervenants USING btree (intervenant_id);

CREATE UNIQUE INDEX chantier_intervenants_pkey ON public.chantier_intervenants USING btree (chantier_id, intervenant_id);

CREATE INDEX chantier_reserves_chantier_id_idx ON public.chantier_reserves USING btree (chantier_id);

CREATE INDEX chantier_reserves_intervenant_id_idx ON public.chantier_reserves USING btree (intervenant_id);

CREATE INDEX chantier_task_assignees_interv_idx ON public.chantier_task_assignees USING btree (intervenant_id);

CREATE INDEX chantier_task_assignees_intervenant_idx ON public.chantier_task_assignees USING btree (intervenant_id);

CREATE UNIQUE INDEX chantier_task_assignees_pkey ON public.chantier_task_assignees USING btree (id);

CREATE INDEX chantier_task_assignees_task_idx ON public.chantier_task_assignees USING btree (task_id);

CREATE UNIQUE INDEX chantier_task_assignees_task_interv_uniq ON public.chantier_task_assignees USING btree (task_id, intervenant_id);

CREATE UNIQUE INDEX chantier_task_planning_segments_pkey ON public.chantier_task_planning_segments USING btree (id);

CREATE INDEX chantier_task_segments_chantier_idx ON public.chantier_task_segments USING btree (chantier_id);

CREATE UNIQUE INDEX chantier_task_segments_pkey ON public.chantier_task_segments USING btree (id);

CREATE INDEX chantier_task_segments_task_idx ON public.chantier_task_segments USING btree (task_id);

CREATE INDEX chantier_tasks_chantier_id_idx ON public.chantier_tasks USING btree (chantier_id);

CREATE INDEX ctpls_chantier_idx ON public.chantier_task_planning_segments USING btree (chantier_id);

CREATE INDEX ctpls_intervenant_idx ON public.chantier_task_planning_segments USING btree (intervenant_id);

CREATE INDEX ctpls_start_idx ON public.chantier_task_planning_segments USING btree (start_at);

CREATE INDEX ctpls_task_idx ON public.chantier_task_planning_segments USING btree (task_id);

CREATE INDEX cts_chantier_idx ON public.chantier_task_segments USING btree (chantier_id);

CREATE INDEX cts_intervenant_idx ON public.chantier_task_segments USING btree (intervenant_id);

CREATE INDEX cts_start_idx ON public.chantier_task_segments USING btree (start_at);

CREATE INDEX cts_task_idx ON public.chantier_task_segments USING btree (task_id);

CREATE INDEX devis_chantier_id_idx ON public.devis USING btree (chantier_id);

CREATE INDEX devis_lignes_corps_etat_idx ON public.devis_lignes USING btree (corps_etat);

CREATE INDEX devis_lignes_task_id_idx ON public.devis_lignes USING btree (task_id);

CREATE INDEX devis_statut_idx ON public.devis USING btree (statut);

CREATE UNIQUE INDEX document_categories_name_key ON public.document_categories USING btree (name);

CREATE UNIQUE INDEX document_categories_pkey ON public.document_categories USING btree (id);

CREATE UNIQUE INDEX document_types_code_key ON public.document_types USING btree (code);

CREATE UNIQUE INDEX document_types_pkey ON public.document_types USING btree (id);

CREATE INDEX fournisseurs_nom_idx ON public.fournisseurs USING btree (nom);

CREATE UNIQUE INDEX fournisseurs_pkey ON public.fournisseurs USING btree (id);

CREATE INDEX idx_chantier_tasks_chantier_id ON public.chantier_tasks USING btree (chantier_id);

CREATE INDEX idx_chantier_tasks_chantier_id_ordre ON public.chantier_tasks USING btree (chantier_id, ordre);

CREATE INDEX idx_chantier_tasks_chantier_ordre ON public.chantier_tasks USING btree (chantier_id, ordre);

CREATE INDEX idx_chantier_tasks_devis_ligne_id ON public.chantier_tasks USING btree (devis_ligne_id);

CREATE INDEX idx_chantier_tasks_status ON public.chantier_tasks USING btree (status);

CREATE INDEX idx_devis_lignes_devis_id ON public.devis_lignes USING btree (devis_id);

CREATE UNIQUE INDEX intervenant_chantiers_intervenant_id_chantier_id_key ON public.intervenant_chantiers USING btree (intervenant_id, chantier_id);

CREATE UNIQUE INDEX intervenant_chantiers_pkey ON public.intervenant_chantiers USING btree (id);

CREATE UNIQUE INDEX intervenant_users_pkey ON public.intervenant_users USING btree (user_id);

CREATE INDEX intervenants_chantier_idx ON public.intervenants USING btree (chantier_id);

CREATE UNIQUE INDEX intervenants_email_unique ON public.intervenants USING btree (lower(email));

CREATE UNIQUE INDEX intervenants_pkey ON public.intervenants USING btree (id);

CREATE UNIQUE INDEX intervenants_user_id_unique ON public.intervenants USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX material_orders_chantier_id_idx ON public.material_orders USING btree (chantier_id);

CREATE INDEX material_orders_fournisseur_id_idx ON public.material_orders USING btree (fournisseur_id);

CREATE UNIQUE INDEX material_orders_pkey ON public.material_orders USING btree (id);

CREATE INDEX materiel_demandes_chantier_idx ON public.materiel_demandes USING btree (chantier_id);

CREATE INDEX materiel_demandes_fournisseur_id_idx ON public.materiel_demandes USING btree (fournisseur_id);

CREATE INDEX materiel_demandes_intervenant_idx ON public.materiel_demandes USING btree (intervenant_id);

CREATE INDEX materiel_demandes_order_id_idx ON public.materiel_demandes USING btree (order_id);

CREATE UNIQUE INDEX materiel_demandes_pkey ON public.materiel_demandes USING btree (id);

CREATE INDEX materiel_demandes_status_idx ON public.materiel_demandes USING btree (status);

CREATE INDEX materiel_demandes_task_idx ON public.materiel_demandes USING btree (task_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE INDEX task_documents_document_idx ON public.task_documents USING btree (document_id);

CREATE UNIQUE INDEX task_documents_pkey ON public.task_documents USING btree (id);

CREATE INDEX task_documents_task_idx ON public.task_documents USING btree (task_id);

CREATE UNIQUE INDEX task_templates_pkey ON public.task_templates USING btree (id);

alter table "public"."chantier_intervenants" add constraint "chantier_intervenants_pkey" PRIMARY KEY using index "chantier_intervenants_pkey";

alter table "public"."chantier_task_assignees" add constraint "chantier_task_assignees_pkey" PRIMARY KEY using index "chantier_task_assignees_pkey";

alter table "public"."chantier_task_planning_segments" add constraint "chantier_task_planning_segments_pkey" PRIMARY KEY using index "chantier_task_planning_segments_pkey";

alter table "public"."chantier_task_segments" add constraint "chantier_task_segments_pkey" PRIMARY KEY using index "chantier_task_segments_pkey";

alter table "public"."document_categories" add constraint "document_categories_pkey" PRIMARY KEY using index "document_categories_pkey";

alter table "public"."document_types" add constraint "document_types_pkey" PRIMARY KEY using index "document_types_pkey";

alter table "public"."fournisseurs" add constraint "fournisseurs_pkey" PRIMARY KEY using index "fournisseurs_pkey";

alter table "public"."intervenant_chantiers" add constraint "intervenant_chantiers_pkey" PRIMARY KEY using index "intervenant_chantiers_pkey";

alter table "public"."intervenant_users" add constraint "intervenant_users_pkey" PRIMARY KEY using index "intervenant_users_pkey";

alter table "public"."intervenants" add constraint "intervenants_pkey" PRIMARY KEY using index "intervenants_pkey";

alter table "public"."material_orders" add constraint "material_orders_pkey" PRIMARY KEY using index "material_orders_pkey";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_pkey" PRIMARY KEY using index "materiel_demandes_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."task_documents" add constraint "task_documents_pkey" PRIMARY KEY using index "task_documents_pkey";

alter table "public"."task_templates" add constraint "task_templates_pkey" PRIMARY KEY using index "task_templates_pkey";

alter table "public"."chantier_intervenants" add constraint "chantier_intervenants_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_intervenants" validate constraint "chantier_intervenants_chantier_id_fkey";

alter table "public"."chantier_intervenants" add constraint "chantier_intervenants_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_intervenants" validate constraint "chantier_intervenants_intervenant_id_fkey";

alter table "public"."chantier_reserves" add constraint "chantier_reserves_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE SET NULL not valid;

alter table "public"."chantier_reserves" validate constraint "chantier_reserves_intervenant_id_fkey";

alter table "public"."chantier_task_assignees" add constraint "chantier_task_assignees_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_assignees" validate constraint "chantier_task_assignees_intervenant_id_fkey";

alter table "public"."chantier_task_assignees" add constraint "chantier_task_assignees_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_assignees" validate constraint "chantier_task_assignees_task_id_fkey";

alter table "public"."chantier_task_planning_segments" add constraint "chantier_task_planning_segments_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_planning_segments" validate constraint "chantier_task_planning_segments_chantier_id_fkey";

alter table "public"."chantier_task_planning_segments" add constraint "chantier_task_planning_segments_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE SET NULL not valid;

alter table "public"."chantier_task_planning_segments" validate constraint "chantier_task_planning_segments_intervenant_id_fkey";

alter table "public"."chantier_task_planning_segments" add constraint "chantier_task_planning_segments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_planning_segments" validate constraint "chantier_task_planning_segments_task_id_fkey";

alter table "public"."chantier_task_segments" add constraint "chantier_task_segments_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_segments" validate constraint "chantier_task_segments_chantier_id_fkey";

alter table "public"."chantier_task_segments" add constraint "chantier_task_segments_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE SET NULL not valid;

alter table "public"."chantier_task_segments" validate constraint "chantier_task_segments_intervenant_id_fkey";

alter table "public"."chantier_task_segments" add constraint "chantier_task_segments_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."chantier_task_segments" validate constraint "chantier_task_segments_task_id_fkey";

alter table "public"."chantier_tasks" add constraint "chantier_tasks_devis_ligne_id_fkey" FOREIGN KEY (devis_ligne_id) REFERENCES public.devis_lignes(id) not valid;

alter table "public"."chantier_tasks" validate constraint "chantier_tasks_devis_ligne_id_fkey";

alter table "public"."devis_lignes" add constraint "devis_lignes_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE SET NULL not valid;

alter table "public"."devis_lignes" validate constraint "devis_lignes_task_id_fkey";

alter table "public"."document_categories" add constraint "document_categories_name_key" UNIQUE using index "document_categories_name_key";

alter table "public"."document_types" add constraint "document_types_code_key" UNIQUE using index "document_types_code_key";

alter table "public"."intervenant_chantiers" add constraint "intervenant_chantiers_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."intervenant_chantiers" validate constraint "intervenant_chantiers_chantier_id_fkey";

alter table "public"."intervenant_chantiers" add constraint "intervenant_chantiers_intervenant_id_chantier_id_key" UNIQUE using index "intervenant_chantiers_intervenant_id_chantier_id_key";

alter table "public"."intervenant_chantiers" add constraint "intervenant_chantiers_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE CASCADE not valid;

alter table "public"."intervenant_chantiers" validate constraint "intervenant_chantiers_intervenant_id_fkey";

alter table "public"."intervenant_users" add constraint "intervenant_users_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE CASCADE not valid;

alter table "public"."intervenant_users" validate constraint "intervenant_users_intervenant_id_fkey";

alter table "public"."intervenant_users" add constraint "intervenant_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."intervenant_users" validate constraint "intervenant_users_user_id_fkey";

alter table "public"."intervenants" add constraint "intervenants_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."intervenants" validate constraint "intervenants_chantier_id_fkey";

alter table "public"."intervenants" add constraint "intervenants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."intervenants" validate constraint "intervenants_user_id_fkey";

alter table "public"."material_orders" add constraint "material_orders_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."material_orders" validate constraint "material_orders_chantier_id_fkey";

alter table "public"."material_orders" add constraint "material_orders_fournisseur_id_fkey" FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE RESTRICT not valid;

alter table "public"."material_orders" validate constraint "material_orders_fournisseur_id_fkey";

alter table "public"."material_orders" add constraint "material_orders_status_check" CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SENT'::text]))) not valid;

alter table "public"."material_orders" validate constraint "material_orders_status_check";

alter table "public"."material_orders" add constraint "material_orders_type_check" CHECK ((type = ANY (ARRAY['PRIX'::text, 'COMMANDE'::text]))) not valid;

alter table "public"."material_orders" validate constraint "material_orders_type_check";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_chantier_id_fkey" FOREIGN KEY (chantier_id) REFERENCES public.chantiers(id) ON DELETE CASCADE not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_chantier_id_fkey";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_fournisseur_id_fkey" FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_fournisseur_id_fkey";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_intervenant_id_fkey" FOREIGN KEY (intervenant_id) REFERENCES public.intervenants(id) ON DELETE SET NULL not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_intervenant_id_fkey";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.material_orders(id) ON DELETE SET NULL not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_order_id_fkey";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_status_check" CHECK ((status = ANY (ARRAY['A_COMMANDER'::text, 'ENVOYE'::text, 'COMMANDE'::text, 'LIVRE'::text]))) not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_status_check";

alter table "public"."materiel_demandes" add constraint "materiel_demandes_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE SET NULL not valid;

alter table "public"."materiel_demandes" validate constraint "materiel_demandes_task_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['ADMIN'::text, 'INTERVENANT'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."task_documents" add constraint "task_documents_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.chantier_documents(id) ON DELETE CASCADE not valid;

alter table "public"."task_documents" validate constraint "task_documents_document_id_fkey";

alter table "public"."task_documents" add constraint "task_documents_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.chantier_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."task_documents" validate constraint "task_documents_task_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.devis_lignes_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.devis_recompute_totals(coalesce(new.devis_id, old.devis_id));
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.devis_lignes_compute_totals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  ht numeric(12,2);
  tva numeric(12,2);
begin
  ht := round((coalesce(new.quantite,0) * coalesce(new.prix_unitaire_ht,0))::numeric, 2);
  tva := round((ht * (coalesce(new.tva_rate,0) / 100.0))::numeric, 2);

  new.total_ht := ht;
  new.total_tva := tva;
  new.total_ttc := ht + tva;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.devis_recompute_totals(devis_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update public.devis d
  set
    total_ht = coalesce(x.sum_ht, 0),
    total_tva = coalesce(x.sum_tva, 0),
    total_ttc = coalesce(x.sum_ttc, 0),
    updated_at = now()
  from (
    select
      devis_id,
      round(coalesce(sum(total_ht),0)::numeric, 2) as sum_ht,
      round(coalesce(sum(total_tva),0)::numeric, 2) as sum_tva,
      round(coalesce(sum(total_ttc),0)::numeric, 2) as sum_ttc
    from public.devis_lignes
    where devis_id = devis_uuid
    group by devis_id
  ) x
  where d.id = x.devis_id;

  -- si aucune ligne, x n'existe pas, on force à zéro
  update public.devis
  set total_ht = 0, total_tva = 0, total_ttc = 0, updated_at = now()
  where id = devis_uuid
    and not exists (select 1 from public.devis_lignes where devis_id = devis_uuid);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant delete on table "public"."chantier_intervenants" to "anon";

grant insert on table "public"."chantier_intervenants" to "anon";

grant references on table "public"."chantier_intervenants" to "anon";

grant select on table "public"."chantier_intervenants" to "anon";

grant trigger on table "public"."chantier_intervenants" to "anon";

grant truncate on table "public"."chantier_intervenants" to "anon";

grant update on table "public"."chantier_intervenants" to "anon";

grant delete on table "public"."chantier_intervenants" to "authenticated";

grant insert on table "public"."chantier_intervenants" to "authenticated";

grant references on table "public"."chantier_intervenants" to "authenticated";

grant select on table "public"."chantier_intervenants" to "authenticated";

grant trigger on table "public"."chantier_intervenants" to "authenticated";

grant truncate on table "public"."chantier_intervenants" to "authenticated";

grant update on table "public"."chantier_intervenants" to "authenticated";

grant delete on table "public"."chantier_intervenants" to "service_role";

grant insert on table "public"."chantier_intervenants" to "service_role";

grant references on table "public"."chantier_intervenants" to "service_role";

grant select on table "public"."chantier_intervenants" to "service_role";

grant trigger on table "public"."chantier_intervenants" to "service_role";

grant truncate on table "public"."chantier_intervenants" to "service_role";

grant update on table "public"."chantier_intervenants" to "service_role";

grant delete on table "public"."chantier_task_assignees" to "anon";

grant insert on table "public"."chantier_task_assignees" to "anon";

grant references on table "public"."chantier_task_assignees" to "anon";

grant select on table "public"."chantier_task_assignees" to "anon";

grant trigger on table "public"."chantier_task_assignees" to "anon";

grant truncate on table "public"."chantier_task_assignees" to "anon";

grant update on table "public"."chantier_task_assignees" to "anon";

grant delete on table "public"."chantier_task_assignees" to "authenticated";

grant insert on table "public"."chantier_task_assignees" to "authenticated";

grant references on table "public"."chantier_task_assignees" to "authenticated";

grant select on table "public"."chantier_task_assignees" to "authenticated";

grant trigger on table "public"."chantier_task_assignees" to "authenticated";

grant truncate on table "public"."chantier_task_assignees" to "authenticated";

grant update on table "public"."chantier_task_assignees" to "authenticated";

grant delete on table "public"."chantier_task_assignees" to "service_role";

grant insert on table "public"."chantier_task_assignees" to "service_role";

grant references on table "public"."chantier_task_assignees" to "service_role";

grant select on table "public"."chantier_task_assignees" to "service_role";

grant trigger on table "public"."chantier_task_assignees" to "service_role";

grant truncate on table "public"."chantier_task_assignees" to "service_role";

grant update on table "public"."chantier_task_assignees" to "service_role";

grant delete on table "public"."chantier_task_planning_segments" to "anon";

grant insert on table "public"."chantier_task_planning_segments" to "anon";

grant references on table "public"."chantier_task_planning_segments" to "anon";

grant select on table "public"."chantier_task_planning_segments" to "anon";

grant trigger on table "public"."chantier_task_planning_segments" to "anon";

grant truncate on table "public"."chantier_task_planning_segments" to "anon";

grant update on table "public"."chantier_task_planning_segments" to "anon";

grant delete on table "public"."chantier_task_planning_segments" to "authenticated";

grant insert on table "public"."chantier_task_planning_segments" to "authenticated";

grant references on table "public"."chantier_task_planning_segments" to "authenticated";

grant select on table "public"."chantier_task_planning_segments" to "authenticated";

grant trigger on table "public"."chantier_task_planning_segments" to "authenticated";

grant truncate on table "public"."chantier_task_planning_segments" to "authenticated";

grant update on table "public"."chantier_task_planning_segments" to "authenticated";

grant delete on table "public"."chantier_task_planning_segments" to "service_role";

grant insert on table "public"."chantier_task_planning_segments" to "service_role";

grant references on table "public"."chantier_task_planning_segments" to "service_role";

grant select on table "public"."chantier_task_planning_segments" to "service_role";

grant trigger on table "public"."chantier_task_planning_segments" to "service_role";

grant truncate on table "public"."chantier_task_planning_segments" to "service_role";

grant update on table "public"."chantier_task_planning_segments" to "service_role";

grant delete on table "public"."chantier_task_segments" to "anon";

grant insert on table "public"."chantier_task_segments" to "anon";

grant references on table "public"."chantier_task_segments" to "anon";

grant select on table "public"."chantier_task_segments" to "anon";

grant trigger on table "public"."chantier_task_segments" to "anon";

grant truncate on table "public"."chantier_task_segments" to "anon";

grant update on table "public"."chantier_task_segments" to "anon";

grant delete on table "public"."chantier_task_segments" to "authenticated";

grant insert on table "public"."chantier_task_segments" to "authenticated";

grant references on table "public"."chantier_task_segments" to "authenticated";

grant select on table "public"."chantier_task_segments" to "authenticated";

grant trigger on table "public"."chantier_task_segments" to "authenticated";

grant truncate on table "public"."chantier_task_segments" to "authenticated";

grant update on table "public"."chantier_task_segments" to "authenticated";

grant delete on table "public"."chantier_task_segments" to "service_role";

grant insert on table "public"."chantier_task_segments" to "service_role";

grant references on table "public"."chantier_task_segments" to "service_role";

grant select on table "public"."chantier_task_segments" to "service_role";

grant trigger on table "public"."chantier_task_segments" to "service_role";

grant truncate on table "public"."chantier_task_segments" to "service_role";

grant update on table "public"."chantier_task_segments" to "service_role";

grant delete on table "public"."document_categories" to "anon";

grant insert on table "public"."document_categories" to "anon";

grant references on table "public"."document_categories" to "anon";

grant select on table "public"."document_categories" to "anon";

grant trigger on table "public"."document_categories" to "anon";

grant truncate on table "public"."document_categories" to "anon";

grant update on table "public"."document_categories" to "anon";

grant delete on table "public"."document_categories" to "authenticated";

grant insert on table "public"."document_categories" to "authenticated";

grant references on table "public"."document_categories" to "authenticated";

grant select on table "public"."document_categories" to "authenticated";

grant trigger on table "public"."document_categories" to "authenticated";

grant truncate on table "public"."document_categories" to "authenticated";

grant update on table "public"."document_categories" to "authenticated";

grant delete on table "public"."document_categories" to "service_role";

grant insert on table "public"."document_categories" to "service_role";

grant references on table "public"."document_categories" to "service_role";

grant select on table "public"."document_categories" to "service_role";

grant trigger on table "public"."document_categories" to "service_role";

grant truncate on table "public"."document_categories" to "service_role";

grant update on table "public"."document_categories" to "service_role";

grant delete on table "public"."document_types" to "anon";

grant insert on table "public"."document_types" to "anon";

grant references on table "public"."document_types" to "anon";

grant select on table "public"."document_types" to "anon";

grant trigger on table "public"."document_types" to "anon";

grant truncate on table "public"."document_types" to "anon";

grant update on table "public"."document_types" to "anon";

grant delete on table "public"."document_types" to "authenticated";

grant insert on table "public"."document_types" to "authenticated";

grant references on table "public"."document_types" to "authenticated";

grant select on table "public"."document_types" to "authenticated";

grant trigger on table "public"."document_types" to "authenticated";

grant truncate on table "public"."document_types" to "authenticated";

grant update on table "public"."document_types" to "authenticated";

grant delete on table "public"."document_types" to "service_role";

grant insert on table "public"."document_types" to "service_role";

grant references on table "public"."document_types" to "service_role";

grant select on table "public"."document_types" to "service_role";

grant trigger on table "public"."document_types" to "service_role";

grant truncate on table "public"."document_types" to "service_role";

grant update on table "public"."document_types" to "service_role";

grant delete on table "public"."fournisseurs" to "anon";

grant insert on table "public"."fournisseurs" to "anon";

grant references on table "public"."fournisseurs" to "anon";

grant select on table "public"."fournisseurs" to "anon";

grant trigger on table "public"."fournisseurs" to "anon";

grant truncate on table "public"."fournisseurs" to "anon";

grant update on table "public"."fournisseurs" to "anon";

grant delete on table "public"."fournisseurs" to "authenticated";

grant insert on table "public"."fournisseurs" to "authenticated";

grant references on table "public"."fournisseurs" to "authenticated";

grant select on table "public"."fournisseurs" to "authenticated";

grant trigger on table "public"."fournisseurs" to "authenticated";

grant truncate on table "public"."fournisseurs" to "authenticated";

grant update on table "public"."fournisseurs" to "authenticated";

grant delete on table "public"."fournisseurs" to "service_role";

grant insert on table "public"."fournisseurs" to "service_role";

grant references on table "public"."fournisseurs" to "service_role";

grant select on table "public"."fournisseurs" to "service_role";

grant trigger on table "public"."fournisseurs" to "service_role";

grant truncate on table "public"."fournisseurs" to "service_role";

grant update on table "public"."fournisseurs" to "service_role";

grant delete on table "public"."intervenant_chantiers" to "anon";

grant insert on table "public"."intervenant_chantiers" to "anon";

grant references on table "public"."intervenant_chantiers" to "anon";

grant select on table "public"."intervenant_chantiers" to "anon";

grant trigger on table "public"."intervenant_chantiers" to "anon";

grant truncate on table "public"."intervenant_chantiers" to "anon";

grant update on table "public"."intervenant_chantiers" to "anon";

grant delete on table "public"."intervenant_chantiers" to "authenticated";

grant insert on table "public"."intervenant_chantiers" to "authenticated";

grant references on table "public"."intervenant_chantiers" to "authenticated";

grant select on table "public"."intervenant_chantiers" to "authenticated";

grant trigger on table "public"."intervenant_chantiers" to "authenticated";

grant truncate on table "public"."intervenant_chantiers" to "authenticated";

grant update on table "public"."intervenant_chantiers" to "authenticated";

grant delete on table "public"."intervenant_chantiers" to "service_role";

grant insert on table "public"."intervenant_chantiers" to "service_role";

grant references on table "public"."intervenant_chantiers" to "service_role";

grant select on table "public"."intervenant_chantiers" to "service_role";

grant trigger on table "public"."intervenant_chantiers" to "service_role";

grant truncate on table "public"."intervenant_chantiers" to "service_role";

grant update on table "public"."intervenant_chantiers" to "service_role";

grant delete on table "public"."intervenant_users" to "anon";

grant insert on table "public"."intervenant_users" to "anon";

grant references on table "public"."intervenant_users" to "anon";

grant select on table "public"."intervenant_users" to "anon";

grant trigger on table "public"."intervenant_users" to "anon";

grant truncate on table "public"."intervenant_users" to "anon";

grant update on table "public"."intervenant_users" to "anon";

grant delete on table "public"."intervenant_users" to "authenticated";

grant insert on table "public"."intervenant_users" to "authenticated";

grant references on table "public"."intervenant_users" to "authenticated";

grant select on table "public"."intervenant_users" to "authenticated";

grant trigger on table "public"."intervenant_users" to "authenticated";

grant truncate on table "public"."intervenant_users" to "authenticated";

grant update on table "public"."intervenant_users" to "authenticated";

grant delete on table "public"."intervenant_users" to "service_role";

grant insert on table "public"."intervenant_users" to "service_role";

grant references on table "public"."intervenant_users" to "service_role";

grant select on table "public"."intervenant_users" to "service_role";

grant trigger on table "public"."intervenant_users" to "service_role";

grant truncate on table "public"."intervenant_users" to "service_role";

grant update on table "public"."intervenant_users" to "service_role";

grant delete on table "public"."intervenants" to "anon";

grant insert on table "public"."intervenants" to "anon";

grant references on table "public"."intervenants" to "anon";

grant select on table "public"."intervenants" to "anon";

grant trigger on table "public"."intervenants" to "anon";

grant truncate on table "public"."intervenants" to "anon";

grant update on table "public"."intervenants" to "anon";

grant delete on table "public"."intervenants" to "authenticated";

grant insert on table "public"."intervenants" to "authenticated";

grant references on table "public"."intervenants" to "authenticated";

grant select on table "public"."intervenants" to "authenticated";

grant trigger on table "public"."intervenants" to "authenticated";

grant truncate on table "public"."intervenants" to "authenticated";

grant update on table "public"."intervenants" to "authenticated";

grant delete on table "public"."intervenants" to "service_role";

grant insert on table "public"."intervenants" to "service_role";

grant references on table "public"."intervenants" to "service_role";

grant select on table "public"."intervenants" to "service_role";

grant trigger on table "public"."intervenants" to "service_role";

grant truncate on table "public"."intervenants" to "service_role";

grant update on table "public"."intervenants" to "service_role";

grant delete on table "public"."material_orders" to "anon";

grant insert on table "public"."material_orders" to "anon";

grant references on table "public"."material_orders" to "anon";

grant select on table "public"."material_orders" to "anon";

grant trigger on table "public"."material_orders" to "anon";

grant truncate on table "public"."material_orders" to "anon";

grant update on table "public"."material_orders" to "anon";

grant delete on table "public"."material_orders" to "authenticated";

grant insert on table "public"."material_orders" to "authenticated";

grant references on table "public"."material_orders" to "authenticated";

grant select on table "public"."material_orders" to "authenticated";

grant trigger on table "public"."material_orders" to "authenticated";

grant truncate on table "public"."material_orders" to "authenticated";

grant update on table "public"."material_orders" to "authenticated";

grant delete on table "public"."material_orders" to "service_role";

grant insert on table "public"."material_orders" to "service_role";

grant references on table "public"."material_orders" to "service_role";

grant select on table "public"."material_orders" to "service_role";

grant trigger on table "public"."material_orders" to "service_role";

grant truncate on table "public"."material_orders" to "service_role";

grant update on table "public"."material_orders" to "service_role";

grant delete on table "public"."materiel_demandes" to "anon";

grant insert on table "public"."materiel_demandes" to "anon";

grant references on table "public"."materiel_demandes" to "anon";

grant select on table "public"."materiel_demandes" to "anon";

grant trigger on table "public"."materiel_demandes" to "anon";

grant truncate on table "public"."materiel_demandes" to "anon";

grant update on table "public"."materiel_demandes" to "anon";

grant delete on table "public"."materiel_demandes" to "authenticated";

grant insert on table "public"."materiel_demandes" to "authenticated";

grant references on table "public"."materiel_demandes" to "authenticated";

grant select on table "public"."materiel_demandes" to "authenticated";

grant trigger on table "public"."materiel_demandes" to "authenticated";

grant truncate on table "public"."materiel_demandes" to "authenticated";

grant update on table "public"."materiel_demandes" to "authenticated";

grant delete on table "public"."materiel_demandes" to "service_role";

grant insert on table "public"."materiel_demandes" to "service_role";

grant references on table "public"."materiel_demandes" to "service_role";

grant select on table "public"."materiel_demandes" to "service_role";

grant trigger on table "public"."materiel_demandes" to "service_role";

grant truncate on table "public"."materiel_demandes" to "service_role";

grant update on table "public"."materiel_demandes" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."task_documents" to "anon";

grant insert on table "public"."task_documents" to "anon";

grant references on table "public"."task_documents" to "anon";

grant select on table "public"."task_documents" to "anon";

grant trigger on table "public"."task_documents" to "anon";

grant truncate on table "public"."task_documents" to "anon";

grant update on table "public"."task_documents" to "anon";

grant delete on table "public"."task_documents" to "authenticated";

grant insert on table "public"."task_documents" to "authenticated";

grant references on table "public"."task_documents" to "authenticated";

grant select on table "public"."task_documents" to "authenticated";

grant trigger on table "public"."task_documents" to "authenticated";

grant truncate on table "public"."task_documents" to "authenticated";

grant update on table "public"."task_documents" to "authenticated";

grant delete on table "public"."task_documents" to "service_role";

grant insert on table "public"."task_documents" to "service_role";

grant references on table "public"."task_documents" to "service_role";

grant select on table "public"."task_documents" to "service_role";

grant trigger on table "public"."task_documents" to "service_role";

grant truncate on table "public"."task_documents" to "service_role";

grant update on table "public"."task_documents" to "service_role";

grant delete on table "public"."task_templates" to "anon";

grant insert on table "public"."task_templates" to "anon";

grant references on table "public"."task_templates" to "anon";

grant select on table "public"."task_templates" to "anon";

grant trigger on table "public"."task_templates" to "anon";

grant truncate on table "public"."task_templates" to "anon";

grant update on table "public"."task_templates" to "anon";

grant delete on table "public"."task_templates" to "authenticated";

grant insert on table "public"."task_templates" to "authenticated";

grant references on table "public"."task_templates" to "authenticated";

grant select on table "public"."task_templates" to "authenticated";

grant trigger on table "public"."task_templates" to "authenticated";

grant truncate on table "public"."task_templates" to "authenticated";

grant update on table "public"."task_templates" to "authenticated";

grant delete on table "public"."task_templates" to "service_role";

grant insert on table "public"."task_templates" to "service_role";

grant references on table "public"."task_templates" to "service_role";

grant select on table "public"."task_templates" to "service_role";

grant trigger on table "public"."task_templates" to "service_role";

grant truncate on table "public"."task_templates" to "service_role";

grant update on table "public"."task_templates" to "service_role";


  create policy "auth can insert chantier documents"
  on "public"."chantier_documents"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "auth can select chantier documents"
  on "public"."chantier_documents"
  as permissive
  for select
  to authenticated
using (true);



  create policy "insert chantier_documents if chantier_access_admin"
  on "public"."chantier_documents"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.chantier_access ca
  WHERE ((ca.chantier_id = chantier_documents.chantier_id) AND (lower(ca.email) = lower(auth.email())) AND (ca.role = 'ADMIN'::text) AND (ca.used_at IS NOT NULL) AND (ca.expires_at > now())))));



  create policy "select chantier_documents if chantier_access"
  on "public"."chantier_documents"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.chantier_access ca
  WHERE ((ca.chantier_id = chantier_documents.chantier_id) AND (lower(ca.email) = lower(auth.email())) AND (ca.used_at IS NOT NULL) AND (ca.expires_at > now())))));



  create policy "chantier_intervenants_admin_delete"
  on "public"."chantier_intervenants"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_intervenants_admin_insert"
  on "public"."chantier_intervenants"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_intervenants_admin_select"
  on "public"."chantier_intervenants"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "Allow read chantier reserves"
  on "public"."chantier_reserves"
  as permissive
  for select
  to public
using (true);



  create policy "Allow update chantier reserves"
  on "public"."chantier_reserves"
  as permissive
  for update
  to public
using (true);



  create policy "Allow write chantier reserves"
  on "public"."chantier_reserves"
  as permissive
  for insert
  to public
with check (true);



  create policy "chantier_reserves_admin_delete"
  on "public"."chantier_reserves"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_reserves_admin_insert"
  on "public"."chantier_reserves"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_reserves_admin_select"
  on "public"."chantier_reserves"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_reserves_admin_update"
  on "public"."chantier_reserves"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "chantier_reserves_intervenant_select"
  on "public"."chantier_reserves"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.chantier_task_assignees cta
     JOIN public.chantier_tasks ct ON ((ct.id = cta.task_id)))
     JOIN public.intervenants i ON ((i.id = cta.intervenant_id)))
  WHERE ((ct.chantier_id = chantier_reserves.chantier_id) AND (lower(i.email) = lower((auth.jwt() ->> 'email'::text)))))));



  create policy "chantier_reserves_intervenant_update"
  on "public"."chantier_reserves"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.intervenants i
  WHERE ((i.id = chantier_reserves.intervenant_id) AND (lower(i.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM public.intervenants i
  WHERE ((i.id = chantier_reserves.intervenant_id) AND (lower(i.email) = lower((auth.jwt() ->> 'email'::text)))))));



  create policy "assignees_delete"
  on "public"."chantier_task_assignees"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "assignees_insert"
  on "public"."chantier_task_assignees"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "assignees_select"
  on "public"."chantier_task_assignees"
  as permissive
  for select
  to authenticated
using (true);



  create policy "assignees_update"
  on "public"."chantier_task_assignees"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "cta_select_intervenant"
  on "public"."chantier_task_assignees"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.intervenant_users iu
  WHERE ((iu.user_id = auth.uid()) AND (iu.intervenant_id = chantier_task_assignees.intervenant_id)))));



  create policy "delete segments"
  on "public"."chantier_task_planning_segments"
  as permissive
  for delete
  to public
using (true);



  create policy "insert segments"
  on "public"."chantier_task_planning_segments"
  as permissive
  for insert
  to public
with check (true);



  create policy "read segments"
  on "public"."chantier_task_planning_segments"
  as permissive
  for select
  to public
using (true);



  create policy "update segments"
  on "public"."chantier_task_planning_segments"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "segments_delete"
  on "public"."chantier_task_segments"
  as permissive
  for delete
  to public
using (true);



  create policy "segments_insert"
  on "public"."chantier_task_segments"
  as permissive
  for insert
  to public
with check (true);



  create policy "segments_read"
  on "public"."chantier_task_segments"
  as permissive
  for select
  to public
using (true);



  create policy "segments_update"
  on "public"."chantier_task_segments"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "delete chantier_tasks"
  on "public"."chantier_tasks"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "insert chantier_tasks"
  on "public"."chantier_tasks"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "read chantier_tasks"
  on "public"."chantier_tasks"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "tasks_select_intervenant"
  on "public"."chantier_tasks"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.chantier_task_assignees cta
     JOIN public.intervenant_users iu ON ((iu.intervenant_id = cta.intervenant_id)))
  WHERE ((iu.user_id = auth.uid()) AND (cta.task_id = chantier_tasks.id)))));



  create policy "update chantier_tasks"
  on "public"."chantier_tasks"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "chantiers_select_intervenant"
  on "public"."chantiers"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.chantier_tasks ct
     JOIN public.chantier_task_assignees cta ON ((cta.task_id = ct.id)))
     JOIN public.intervenant_users iu ON ((iu.intervenant_id = cta.intervenant_id)))
  WHERE ((iu.user_id = auth.uid()) AND (ct.chantier_id = chantiers.id)))));



  create policy "insert chantiers"
  on "public"."chantiers"
  as permissive
  for insert
  to public
with check (true);



  create policy "read chantiers"
  on "public"."chantiers"
  as permissive
  for select
  to public
using (true);



  create policy "devis_insert_authenticated"
  on "public"."devis"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "devis_select_auth"
  on "public"."devis"
  as permissive
  for select
  to authenticated
using (true);



  create policy "devis_write_auth"
  on "public"."devis"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "devis_lignes_select_auth"
  on "public"."devis_lignes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "devis_lignes_write_auth"
  on "public"."devis_lignes"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "fournisseurs_delete_auth"
  on "public"."fournisseurs"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "fournisseurs_insert_auth"
  on "public"."fournisseurs"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "fournisseurs_select_auth"
  on "public"."fournisseurs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "fournisseurs_update_auth"
  on "public"."fournisseurs"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "admin manage mappings"
  on "public"."intervenant_users"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "intervenant_users_admin_all"
  on "public"."intervenant_users"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))));



  create policy "intervenant_users_select_own"
  on "public"."intervenant_users"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "read own mapping"
  on "public"."intervenant_users"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "delete intervenants"
  on "public"."intervenants"
  as permissive
  for delete
  to public
using (true);



  create policy "insert intervenants"
  on "public"."intervenants"
  as permissive
  for insert
  to public
with check (true);



  create policy "read intervenants"
  on "public"."intervenants"
  as permissive
  for select
  to public
using (true);



  create policy "update intervenants"
  on "public"."intervenants"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "material_orders_delete_auth"
  on "public"."material_orders"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "material_orders_insert_auth"
  on "public"."material_orders"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "material_orders_select_auth"
  on "public"."material_orders"
  as permissive
  for select
  to authenticated
using (true);



  create policy "material_orders_update_auth"
  on "public"."material_orders"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "delete materiel_demandes"
  on "public"."materiel_demandes"
  as permissive
  for delete
  to public
using (true);



  create policy "insert materiel_demandes"
  on "public"."materiel_demandes"
  as permissive
  for insert
  to public
with check (true);



  create policy "materiel_demandes_delete_auth"
  on "public"."materiel_demandes"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "materiel_demandes_insert_auth"
  on "public"."materiel_demandes"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "materiel_demandes_select_auth"
  on "public"."materiel_demandes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "materiel_demandes_update_auth"
  on "public"."materiel_demandes"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "read materiel_demandes"
  on "public"."materiel_demandes"
  as permissive
  for select
  to public
using (true);



  create policy "update materiel_demandes"
  on "public"."materiel_demandes"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "profiles_read_own"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "auth can delete task_documents"
  on "public"."task_documents"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "auth can insert task_documents"
  on "public"."task_documents"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "auth can select task_documents"
  on "public"."task_documents"
  as permissive
  for select
  to authenticated
using (true);



  create policy "templates_delete"
  on "public"."task_templates"
  as permissive
  for delete
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "templates_read"
  on "public"."task_templates"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "templates_update"
  on "public"."task_templates"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "templates_write"
  on "public"."task_templates"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));


CREATE TRIGGER trg_cts_updated_at BEFORE UPDATE ON public.chantier_task_segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.chantier_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_set_updated_at_chantier_tasks BEFORE UPDATE ON public.chantier_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_chantiers_updated_at BEFORE UPDATE ON public.chantiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_devis_lignes_after_change AFTER INSERT OR DELETE OR UPDATE ON public.devis_lignes FOR EACH ROW EXECUTE FUNCTION public.devis_lignes_after_change();
ALTER TABLE "public"."devis_lignes" DISABLE TRIGGER "trg_devis_lignes_after_change";

CREATE TRIGGER trg_devis_lignes_totals BEFORE INSERT OR UPDATE ON public.devis_lignes FOR EACH ROW EXECUTE FUNCTION public.devis_lignes_compute_totals();
ALTER TABLE "public"."devis_lignes" DISABLE TRIGGER "trg_devis_lignes_totals";

CREATE TRIGGER trg_devis_lignes_updated_at BEFORE UPDATE ON public.devis_lignes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_fournisseurs_updated_at BEFORE UPDATE ON public.fournisseurs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_material_orders_updated_at BEFORE UPDATE ON public.material_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_materiel_demandes_updated_at BEFORE UPDATE ON public.materiel_demandes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

drop trigger if exists "objects_delete_delete_prefix" on "storage"."objects";

drop trigger if exists "objects_insert_create_prefix" on "storage"."objects";

drop trigger if exists "objects_update_create_prefix" on "storage"."objects";

drop trigger if exists "prefixes_create_hierarchy" on "storage"."prefixes";

drop trigger if exists "prefixes_delete_hierarchy" on "storage"."prefixes";


  create policy "devis_pdf_delete_auth"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'devis-pdf'::text));



  create policy "devis_pdf_insert_auth"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'devis-pdf'::text));



  create policy "devis_pdf_select_auth"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'devis-pdf'::text));



  create policy "devis_pdf_update_auth"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'devis-pdf'::text))
with check ((bucket_id = 'devis-pdf'::text));



  create policy "read chantier-documents if authenticated"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'chantier-documents'::text));



  create policy "upload chantier-documents if authenticated"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'chantier-documents'::text));


CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


