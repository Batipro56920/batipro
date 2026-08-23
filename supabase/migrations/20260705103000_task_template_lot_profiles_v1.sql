create table if not exists public.task_template_lot_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  keywords text[] not null default '{}'::text[],
  labor_margin_rate numeric(6,2) not null default 30,
  equipment_margin_rate numeric(6,2) not null default 25,
  materials_margin_rate numeric(6,2) not null default 30,
  fees_margin_rate numeric(6,2) not null default 20,
  default_unit text null,
  average_time_hours numeric null,
  quality_controls text[] not null default '{}'::text[],
  common_mistakes text[] not null default '{}'::text[],
  chantier_instructions text[] not null default '{}'::text[],
  default_equipment text[] not null default '{}'::text[],
  default_ppe text[] not null default '{}'::text[],
  default_consumables text[] not null default '{}'::text[],
  doe_documents text[] not null default '{}'::text[],
  field_returns text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_template_lot_profiles_name_chk check (char_length(btrim(name)) > 0),
  constraint task_template_lot_profiles_name_unique unique (name),
  constraint task_template_lot_profiles_margins_chk check (
    labor_margin_rate >= 0 and labor_margin_rate <= 300 and
    equipment_margin_rate >= 0 and equipment_margin_rate <= 300 and
    materials_margin_rate >= 0 and materials_margin_rate <= 300 and
    fees_margin_rate >= 0 and fees_margin_rate <= 300
  ),
  constraint task_template_lot_profiles_average_time_chk check (average_time_hours is null or average_time_hours >= 0)
);

create index if not exists task_template_lot_profiles_active_idx
  on public.task_template_lot_profiles(is_active, sort_order, name);

create or replace function public.set_task_template_lot_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_task_template_lot_profiles_updated_at on public.task_template_lot_profiles;
create trigger trg_task_template_lot_profiles_updated_at
before update on public.task_template_lot_profiles
for each row
execute function public.set_task_template_lot_profiles_updated_at();

alter table public.task_template_lot_profiles enable row level security;

drop policy if exists task_template_lot_profiles_read on public.task_template_lot_profiles;
create policy task_template_lot_profiles_read
  on public.task_template_lot_profiles
  for select
  to authenticated
  using (true);

drop policy if exists task_template_lot_profiles_admin_write on public.task_template_lot_profiles;
create policy task_template_lot_profiles_admin_write
  on public.task_template_lot_profiles
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'ADMIN'
    )
  );

grant select on table public.task_template_lot_profiles to authenticated;
grant insert, update, delete on table public.task_template_lot_profiles to authenticated;

insert into public.task_template_lot_profiles (
  name,
  keywords,
  labor_margin_rate,
  equipment_margin_rate,
  materials_margin_rate,
  fees_margin_rate,
  default_unit,
  average_time_hours,
  quality_controls,
  common_mistakes,
  chantier_instructions,
  default_equipment,
  default_ppe,
  default_consumables,
  doe_documents,
  field_returns,
  sort_order
) values
('Electricité', array['courant fort','courant faible','tableau','cable','gaine','prise','luminaire'], 35, 25, 30, 20, 'u', 0.75, array['Serrage controle','Continuite verifiee','Repere tableau coherent'], array['Oublier reperage','Melanger circuits','Ne pas verifier absence tension'], array['Couper et securiser alimentation avant intervention'], array['testeur','aiguille tire-fil','tournevis isole','perceuse'], array['gants isolants','lunettes'], array['chevilles','colliers','embouts','dominos/wago'], array['schema electrique','fiche materiel'], array['photos tableau','ecarts reseau','points a verifier'], 10),
('Plâtrerie', array['placo','cloison','doublage','ba13','rail','montant','enduit'], 35, 25, 28, 20, 'm2', 0.45, array['Aplomb','Planéité','Entraxes ossature','Joints propres'], array['Oublier renforts','Mauvais entraxe','Support non sec'], array['Verifier implantation et réservations avant fermeture'], array['visseuse','laser','cutter','lève-plaque'], array['gants','lunettes','masque poussiere'], array['bandes','enduit','vis','protection sol'], array['fiche systeme','PV feu/acoustique si requis'], array['photos ossature avant fermeture','renforts','réservations'], 20),
('Peinture', array['peinture','impression','finition','rouleau','facade','mat','satin'], 35, 20, 30, 20, 'm2', 0.18, array['Support sec','Teinte homogene','Recouvrement complet','Consommation coherente'], array['Application sur support humide','Produit mal brasse','Application plein soleil'], array['Verifier humidite support et conditions meteo'], array['rouleau polyamide','brosse rechampir','bac','perche'], array['gants','lunettes','masque si projection'], array['baches','adhesif','films protection','manchons'], array['fiche technique','fiche produit','teinte appliquee'], array['photos avant/apres','consommation reelle','defauts support'], 30),
('Façade', array['facade','ravalement','enduit','nettoyage','hydrofuge','ite'], 35, 25, 30, 20, 'm2', 0.35, array['Support sain','Adherence','Aspect uniforme','Points singuliers traites'], array['Ne pas traiter fissures','Application pluie/gel','Mauvaise preparation'], array['Controler meteo, accès et protections avant démarrage'], array['nettoyeur HP','échafaudage','rouleau facade','taloche'], array['casque','harnais si hauteur','gants','lunettes'], array['baches','adhesif facade','protections menuiseries'], array['fiche technique','photos support','teinte/enduit'], array['photos points singuliers','meteo','consommation'], 40),
('ITE', array['isolation thermique exterieure','isolant','cheville','sous-enduit','trame'], 35, 25, 28, 20, 'm2', 0.85, array['Calepinage','Fixations','Marouflage','Epaisseur sous-enduit'], array['Joints alignes','Trame mal noyee','Chevillage insuffisant'], array['Verifier support, appuis et points singuliers'], array['échafaudage','fil chaud','taloche','malaxeur'], array['casque','gants','lunettes','harnais si hauteur'], array['trame','chevilles','profilés','mousse PU'], array['ATE/ETA','fiche systeme','photos avant enduit'], array['photos calepinage','chevillage','points singuliers'], 50),
('Plomberie', array['eau','evacuation','cuivre','per','multicouche','sanitaire'], 35, 25, 30, 20, 'u', 1.00, array['Etancheite','Pente evacuation','Fixations','Essai pression'], array['Oublier purge','Pente insuffisante','Raccord mal serti'], array['Couper eau et proteger zones sensibles'], array['sertisseuse','coupe tube','clé','niveau'], array['gants','lunettes'], array['colliers','filasse','teflon','joints'], array['fiche équipement','PV essai si requis'], array['photos réseaux avant fermeture','essai etancheite'], 60),
('Couverture', array['toiture','tuile','ardoise','zinguerie','gouttiere','etancheite'], 35, 25, 28, 20, 'm2', 0.60, array['Etancheite','Recouvrements','Fixations','Evacuations libres'], array['Intervenir vent fort','Recouvrement insuffisant','Oublier sécurité hauteur'], array['Verifier meteo et protection chute avant accès toiture'], array['échafaudage','échelle de toit','grignoteuse','visseuse'], array['casque','harnais','chaussures antidérapantes','gants'], array['vis','crochets','bandes etancheite','mastic'], array['photos toiture','fiche produit etancheite'], array['photos avant/apres','points singuliers','infiltrations'], 70),
('Menuiserie', array['porte','fenetre','menuiserie','habillage','pose','réglage'], 35, 25, 28, 20, 'u', 1.50, array['Aplomb','Jeux réguliers','Etancheite périphérique','Fonctionnement'], array['Mauvais calage','Joint discontinu','Mesures non verifiees'], array['Verifier cotes et support avant dépose'], array['laser','niveau','visseuse','pistolet mastic'], array['gants','lunettes','chaussures sécurité'], array['cales','mousse PU','mastic','visserie'], array['fiche menuiserie','PV classement si requis'], array['photos calage','joints','réglages'], 80),
('Carrelage', array['carrelage','faience','colle','joint','ragréage'], 35, 20, 30, 20, 'm2', 0.65, array['Planéité','Alignement joints','Adherence','Pentes respectées'], array['Support non préparé','Double encollage oublié','Joints trop tôt'], array['Verifier support, calepinage et contraintes eau'], array['coupe carreaux','peigne colle','croisillons','malaxeur'], array['gants','genouilleres','lunettes'], array['croisillons','joint','primaire','protection'], array['fiche colle','fiche joint','classement local humide'], array['photos calepinage','support','joints'], 90),
('Sol', array['sol','parquet','stratifie','pvc','ragréage','moquette'], 35, 20, 30, 20, 'm2', 0.45, array['Planéité','Sens pose','Jeux périphériques','Finition seuils'], array['Support humide','Oublier acclimatation','Jeu insuffisant'], array['Verifier hygrométrie et planéité avant pose'], array['scie','cutter','maroufleur','spatule'], array['gants','genouilleres','masque poussiere'], array['adhesif','colle','sous-couche','barres seuil'], array['fiche revêtement','PV classement feu/usure si requis'], array['photos support','pose','finitions'], 100),
('VRD', array['vrd','tranchée','réseau','regard','drainage','terrassement'], 35, 25, 25, 20, 'ml', 0.55, array['Pentes','Profondeur','Compactage','Signalisation réseau'], array['Réseau non repéré','Pente insuffisante','Compactage oublié'], array['Verifier DICT/repérage réseaux et accès engins'], array['mini-pelle','plaque vibrante','laser','pelle'], array['casque','gilet HV','chaussures sécurité','gants'], array['grillage avertisseur','sable','regards','gaines'], array['plan recollement','photos réseaux avant remblai'], array['photos profondeur','pentes','réseaux rencontrés'], 110),
('Maçonnerie', array['maconnerie','beton','parpaing','mortier','seuil','mur'], 35, 25, 28, 20, 'm2', 0.75, array['Aplomb','Niveau','Dosage','Cure/protection'], array['Support non humidifie','Dosage aleatoire','Pas de protection gel'], array['Verifier implantation, support et conditions meteo'], array['bétonnière','malaxeur','truelle','niveau'], array['gants','lunettes','chaussures sécurité'], array['mortier','adjuvant','cales','protections'], array['fiche béton/mortier','photos ferraillage si concerné'], array['photos implantation','ferraillage','conditions meteo'], 120)
on conflict (name) do update set
  keywords = excluded.keywords,
  default_unit = excluded.default_unit,
  quality_controls = excluded.quality_controls,
  common_mistakes = excluded.common_mistakes,
  chantier_instructions = excluded.chantier_instructions,
  default_equipment = excluded.default_equipment,
  default_ppe = excluded.default_ppe,
  default_consumables = excluded.default_consumables,
  doe_documents = excluded.doe_documents,
  field_returns = excluded.field_returns,
  sort_order = excluded.sort_order;
