do $$
begin
  if not exists (select 1 from storage.buckets where id='crm-quote-pdfs'
      and public=false and file_size_limit=20971520) then
    raise exception 'Private PDF bucket is missing';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
    and policyname like 'crm_quote_pdfs_%') <> 3 then
    raise exception 'Expected scoped read/insert/delete policies';
  end if;
end $$;
set app.org = '00000000-0000-0000-0000-000000000001';
set app.office = 'true';
set role authenticated;
insert into storage.objects(bucket_id,name) values (
 'crm-quote-pdfs','00000000-0000-0000-0000-000000000001/obat/opportunity/test.pdf');
do $$
declare blocked boolean := false;
begin
  begin
    insert into storage.objects(bucket_id,name) values (
      'crm-quote-pdfs','00000000-0000-0000-0000-000000000002/obat/opportunity/foreign.pdf');
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then raise exception 'Cross-organization upload was not blocked'; end if;
  if (select count(*) from storage.objects where bucket_id='crm-quote-pdfs') <> 1 then
    raise exception 'Office user could access a different organizations PDF';
  end if;
end $$;
set app.office = 'false';
do $$
begin
 if (select count(*) from storage.objects where bucket_id='crm-quote-pdfs') <> 0 then
   raise exception 'Non-office user can see CRM quote PDFs';
 end if;
end $$;
reset role;
set role anon;
do $$
begin
 if (select count(*) from storage.objects where bucket_id='crm-quote-pdfs') <> 0 then
   raise exception 'Anon user can see CRM quote PDFs';
 end if;
end $$;
reset role;
