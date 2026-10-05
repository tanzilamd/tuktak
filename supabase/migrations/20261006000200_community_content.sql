-- Admin-managed public community content; legacy social mutations remain compatible.
create table public.community_questions (
 id uuid primary key default gen_random_uuid(),body text not null check(char_length(body) between 1 and 160 and has_text(body)),
 active boolean not null default true,position int not null default 0 check(position between 0 and 9999),updated_at timestamptz not null default clock_timestamp()
);
create table public.community_prompts (
 id uuid primary key default gen_random_uuid(),body text not null check(char_length(body) between 1 and 120 and has_text(body)),
 active boolean not null default true,position int not null default 0 check(position between 0 and 9999),updated_at timestamptz not null default clock_timestamp()
);
create table public.community_moods (
 id uuid primary key default gen_random_uuid(),label text not null check(char_length(label) between 1 and 40 and has_text(label)),
 emoji text not null default '' check(char_length(emoji)<=12),
 value text generated always as (case when emoji='' then label else emoji||' '||label end) stored,
 active boolean not null default true,position int not null default 0 check(position between 0 and 9999),updated_at timestamptz not null default clock_timestamp(),unique(value)
);
create table public.community_topics (
 id uuid primary key default gen_random_uuid(),tag text not null unique check(tag=lower(tag) and tag ~ '^[a-z0-9_ঀ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-৯ৰৱ৴-৹ৼ৾]{1,40}$'),
 active boolean not null default true,position int not null default 0 check(position between 0 and 9999),expires_at timestamptz,updated_at timestamptz not null default clock_timestamp()
);
create table public.community_announcements (
 id uuid primary key default gen_random_uuid(),title text not null default '' check(char_length(title)<=60),body text not null check(char_length(body) between 1 and 240 and has_text(body)),
 priority int not null default 1 check(priority in (1,2,3)),active boolean not null default true,dismissible boolean not null default true,
 starts_at timestamptz not null default clock_timestamp(),ends_at timestamptz,link text not null default '',updated_at timestamptz not null default clock_timestamp(),
 check(ends_at is null or ends_at>starts_at),
 check(char_length(link)<=1000 and link !~ '[[:space:]]' and position(chr(92) in link)=0 and
  (link='' or link='/' or link ~ '^/[^/]' or link ~ '^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?([/?#]|$)'))
);
create table public.community_question_override (
 singleton boolean primary key default true check(singleton),day date not null,question_id uuid references public.community_questions on delete set null
);
alter table community_questions enable row level security;
alter table community_prompts enable row level security;
alter table community_moods enable row level security;
alter table community_topics enable row level security;
alter table community_announcements enable row level security;
alter table community_question_override enable row level security;
revoke all on community_questions,community_prompts,community_moods,community_topics,community_announcements,community_question_override from anon,authenticated;
-- Public callers read only active/current projections through community_public().
-- Management reads also use a checked RPC; no direct table grant or write policy.
create index community_questions_order on community_questions(position,id) where active;
create index community_prompts_order on community_prompts(position,id) where active;
create index community_moods_order on community_moods(position,id) where active;
create index community_topics_order on community_topics(position,id) where active;
create index community_announcements_current on community_announcements(priority desc,starts_at desc,id) where active;

-- Preserve the current curated content and daily ordering; these are public defaults, not test accounts.
insert into community_questions(body,position) select body,ordinality-1 from unnest(array[
 'এই সপ্তাহে সবচেয়ে বেশি কোন কথাটা বলেছ?','আজকের মুড এক ইমোজিতে বললে কী হবে?','কোন খাবারটা দেখলে মন ভালো হয়ে যায়?',
 'ছোটবেলায় কোন অদ্ভুত জিনিসকে ভয় পেতে?','একদিনের জন্য একটা নতুন দক্ষতা পেলে কী নিতে?','আজকের ছোট্ট ভালো লাগাটা কী?',
 'তোমার জীবনের পেছনে একটা গান বাজলে কোনটা বাজত?','সবাই পছন্দ করে, কিন্তু তোমার ভালো লাগে না—এমন কী আছে?','বৃষ্টির দিনে খিচুড়ি না নুডলস?',
 'বন্ধুর কোন অভ্যাসটা তোমার ভালো লাগে?','বন্ধুদের সঙ্গে শেষ কবে হাসতে হাসতে পেট ব্যথা হয়েছে?','ক্যান্টিনের কোন খাবারটা সবচেয়ে মনে পড়ে?',
 'ছুটি পেলে ঘুম, ঘোরাঘুরি না বন্ধুদের আড্ডা?','কোন মিমটা দেখে এখনো হাসি পায়?','তোমার পছন্দের চায়ের সঙ্গে কী লাগে?',
 'হঠাৎ পুরোনো বন্ধুর সঙ্গে দেখা হলে প্রথমে কী বলবে?','কোন ছোট্ট জিনিসটা তোমার দিন ভালো করে দেয়?','কোন গানটা শুনলে সঙ্গে সঙ্গে গলা মেলাও?',
 'ফোনের কোন অ্যাপটা একদিন বাদ দিতে পারবে?','ছোটবেলার কোন খেলাটা আবার খেলতে ইচ্ছা করে?','তোমার ব্যাগে সবচেয়ে অদ্ভুত কী থাকে?',
 'আজ কাউকে একটা ধন্যবাদ দিতে হলে কাকে দেবে?','কোন সিনেমা বা সিরিজটা বন্ধুকে দেখতে বলবে?','তোমাদের আড্ডার সবচেয়ে মজার কথাটা কী?',
 'একটা দিনের কাজ বন্ধুকে দিতে পারলে কোনটা দিতে?','যেতে ইচ্ছা করে, কিন্তু এখনো যাওয়া হয়নি—কোথায়?','তোমার নিজের কোন অভ্যাসটা দেখে হাসি পায়?',
 'কোন খাবারটা ভাগ করে খেতে মন চায় না?','আজকের দিনটার একটা নাম দিলে কী হবে?','কোন পুরোনো ছবিটা দেখলে গল্প মনে পড়ে?','তোমার শহরের কোন জায়গাটা সবচেয়ে ভালো লাগে?'
]::text[]) with ordinality as q(body,ordinality);
insert into community_prompts(body) values('আজকের আজাইরা ভাবনা কী?');
insert into community_moods(emoji,label,position) values
 ('😄','জমে গেছে',0),('😂','হাসি পাচ্ছে',1),('😭','আর পারি না',2),('😵‍💫','মাথা শেষ',3),('😌','শান্তি',4),
 ('😤','বিরক্ত',5),('🥹','ইমোশনাল',6),('🤔','ভাবছি',7),('🔥','উত্তেজিত',8),('🎲','র‍্যান্ডম',9);

create function public.community_pick(kind text,day date) returns text language sql stable security definer set search_path=public,pg_temp as $$
 with pool as (
  select body,row_number() over(order by position,id)-1 n,count(*) over() total from (
   select body,position,id from community_questions where active and kind='questions'
   union all select body,position,id from community_prompts where active and kind='prompts'
  ) x order by position,id limit 200
 ) select body from pool where n=mod(mod(day-date '1970-01-01',total)+total,total)
$$;
create function public.community_snapshot(at_time timestamptz) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare question text; announcement jsonb; tags jsonb; calendar_day date:=(at_time at time zone 'Asia/Dhaka')::date;
begin
 select q.body into question from community_question_override o join community_questions q on q.id=o.question_id and q.active where o.singleton and o.day=calendar_day;
 if question is null then question:=community_pick('questions',calendar_day); end if;
 select jsonb_build_object('id',id,'title',title,'body',body,'priority',priority,'dismissible',dismissible,'link',link,'ends_at',ends_at,'updated_at',updated_at) into announcement
 from community_announcements where active and starts_at<=at_time and (ends_at is null or ends_at>at_time) order by priority desc,starts_at desc,id limit 1;
 with featured as (select tag,position from community_topics where active and (expires_at is null or expires_at>at_time) order by position,id limit 6),
 curated as (
  select f.tag,f.position,count(distinct p.author_id) count from featured f left join post_hashtags ph on ph.tag=f.tag
  left join posts p on p.id=ph.post_id and p.created_at>at_time-interval '7 days' and visible_post(p.id) group by f.tag,f.position
 ), combined as (
  select tag,count,0 tier,position rank from curated union all
  select o.tag,o.count,1 tier,row_number() over(order by o.count desc,o.tag)::int rank from popular_topics() o where not exists(select 1 from featured f where f.tag=o.tag)
 ) select coalesce(jsonb_agg(x),'[]'::jsonb) into tags from (select tag,count from combined order by tier,rank,tag limit 6) x;
 return jsonb_build_object('question',question,'prompt',community_pick('prompts',calendar_day),
  'moods',coalesce((select jsonb_agg(value order by position,id) from (select value,position,id from community_moods where active order by position,id limit 40) x),'[]'::jsonb),
  'topics',tags,'announcement',announcement,
  'manualQuestion',exists(select 1 from community_question_override o join community_questions q on q.id=o.question_id and q.active where o.singleton and o.day=calendar_day));
end $$;
create function public.community_public() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$ select community_snapshot(clock_timestamp()) $$;

create function public.community_list(kind text,filters jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare rows jsonb; q text:=left(coalesce(filters->>'q',''),60); after_position int; after_id uuid; state text:=coalesce(filters->>'status','all');
begin
 if not exists(select 1 from user_roles where user_id=auth.uid() and role='admin' and not suspended) then raise exception 'forbidden'; end if;
 if kind not in ('questions','prompts','moods','topics','announcements') or state not in ('all','active','inactive') then raise exception 'invalid_filter'; end if;
 if filters->>'cursor' is not null then after_position:=split_part(filters->>'cursor','|',1)::int; after_id:=split_part(filters->>'cursor','|',2)::uuid; end if;
 with content as (
  select to_jsonb(x) value,x.position,x.id from community_questions x where kind='questions'
  union all select to_jsonb(x),x.position,x.id from community_prompts x where kind='prompts'
  union all select to_jsonb(x),x.position,x.id from community_moods x where kind='moods'
  union all select to_jsonb(x),x.position,x.id from community_topics x where kind='topics'
  union all select to_jsonb(x),0,x.id from community_announcements x where kind='announcements'
 ) select coalesce(jsonb_agg(value),'[]'::jsonb) into rows from (
  select value||jsonb_build_object('position',position) value from content
  where (state='all' or (value->>'active')::boolean=(state='active')) and (q='' or position(lower(q) in lower(concat_ws(' ',value->>'body',value->>'label',value->>'tag',value->>'title')))>0)
   and (after_id is null or (position,id)>(after_position,after_id)) order by position,id limit 51
 ) x;
 return jsonb_build_object('rows',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(rows) with ordinality where ordinality<=50),
  'next',case when jsonb_array_length(rows)>50 then (rows->49->>'position')||'|'||(rows->49->>'id') else null end,
  'override',coalesce((select question_id::text from community_question_override where singleton and day=(clock_timestamp() at time zone 'Asia/Dhaka')::date),''));
end $$;

alter table posts drop constraint posts_mood_check;
alter table posts add constraint posts_mood_check check(mood is null or (char_length(mood) between 1 and 60 and has_text(mood)));
create function public.community_mood_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.mood is not distinct from old.mood then return new; end if;
 if new.mood is not null then
  perform 1 from community_moods where value=new.mood and active for share;
  if not found then raise exception 'invalid_mood'; end if;
 end if;
 return new;
end $$;
create trigger community_post_mood before insert or update of mood on posts for each row execute function community_mood_guard();

-- Keep the reviewed legacy function bytes and behavior, but remove any alternate caller entry point.
alter function public.command(text,jsonb) rename to command_before_community;
revoke execute on function public.command_before_community(text,jsonb) from public,anon,authenticated;
create function public.community_manage(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare me uuid:=auth.uid(); kind text:=payload->>'kind'; target uuid:=nullif(payload->>'id','')::uuid; new_id uuid;
 active_value boolean:=coalesce((payload->>'active')::boolean,true); order_value int:=coalesce((payload->>'position')::int,0);
 body_value text:=engagement_trim(coalesce(payload->>'body','')); emoji_value text:=engagement_trim(coalesce(payload->>'emoji','')); label_value text:=engagement_trim(coalesce(payload->>'label',''));
 tag_value text:=lower(engagement_trim(coalesce(payload->>'tag',''))); title_value text:=engagement_trim(coalesce(payload->>'title','')); link_value text:=engagement_trim(coalesce(payload->>'link',''));
 size int; cap int;
begin
 if me is null then raise exception 'authentication_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 perform pg_advisory_xact_lock(hashtextextended('community-content',0));
 -- Re-read and lock live authorization after waits; never use client or token role metadata.
 perform 1 from user_roles where user_id=me and role='admin' and not suspended for share;
 if not found then raise exception 'forbidden'; end if;
 perform 1 from auth.users where id=me and email_confirmed_at is not null for share;
 if not found then raise exception 'email_unverified'; end if;
 if operation not in ('community_save','community_delete','community_toggle','community_pin','community_release') then raise exception 'invalid_action'; end if;
 perform take_rate('community_manage',100);
 if operation='community_release' then
  select question_id into target from community_question_override where singleton;
  delete from community_question_override where singleton;
  target:=coalesce(target,me); kind:='questions';
 elsif operation='community_pin' then
  perform 1 from community_questions where id=target and active;
  if not found then raise exception 'not_found'; end if;
  insert into community_question_override(singleton,day,question_id) values(true,(clock_timestamp() at time zone 'Asia/Dhaka')::date,target)
   on conflict(singleton) do update set day=excluded.day,question_id=excluded.question_id;
  kind:='questions';
 else
  if kind is null or kind not in ('questions','prompts','moods','topics','announcements') then raise exception 'invalid_content'; end if;
  if target is not null then
   case kind
    when 'questions' then perform 1 from community_questions where id=target for update;
    when 'prompts' then perform 1 from community_prompts where id=target for update;
    when 'moods' then perform 1 from community_moods where id=target for update;
    when 'topics' then perform 1 from community_topics where id=target for update;
    when 'announcements' then perform 1 from community_announcements where id=target for update;
   end case;
   if not found then raise exception 'not_found'; end if;
  elsif operation<>'community_save' then raise exception 'not_found'; end if;
  if operation='community_delete' then
   case kind
    when 'questions' then delete from community_questions where id=target;
    when 'prompts' then delete from community_prompts where id=target;
    when 'moods' then delete from community_moods where id=target;
    when 'topics' then delete from community_topics where id=target;
    when 'announcements' then delete from community_announcements where id=target;
   end case;
  elsif operation='community_toggle' then
   if payload->>'active' is null then raise exception 'invalid_content'; end if;
   case kind
    when 'questions' then update community_questions set active=active_value,updated_at=clock_timestamp() where id=target;
    when 'prompts' then update community_prompts set active=active_value,updated_at=clock_timestamp() where id=target;
    when 'moods' then update community_moods set active=active_value,updated_at=clock_timestamp() where id=target;
    when 'topics' then update community_topics set active=active_value,updated_at=clock_timestamp() where id=target;
    when 'announcements' then update community_announcements set active=active_value,updated_at=clock_timestamp() where id=target;
   end case;
  else
   new_id:=coalesce(target,gen_random_uuid());
   if target is null then
    select count(*) into size from (
     select id from community_questions where kind='questions' union all select id from community_prompts where kind='prompts'
     union all select id from community_moods where kind='moods' union all select id from community_topics where kind='topics'
     union all select id from community_announcements where kind='announcements'
    ) x;
    cap:=case kind when 'moods' then 40 when 'topics' then 100 when 'announcements' then 100 else 200 end;
    if size>=cap then raise exception 'content_pool_full'; end if;
   end if;
   case kind
    when 'questions' then insert into community_questions(id,body,active,position) values(new_id,body_value,active_value,order_value)
     on conflict(id) do update set body=excluded.body,active=excluded.active,position=excluded.position,updated_at=clock_timestamp();
    when 'prompts' then insert into community_prompts(id,body,active,position) values(new_id,body_value,active_value,order_value)
     on conflict(id) do update set body=excluded.body,active=excluded.active,position=excluded.position,updated_at=clock_timestamp();
    when 'moods' then insert into community_moods(id,label,emoji,active,position) values(new_id,label_value,emoji_value,active_value,order_value)
     on conflict(id) do update set label=excluded.label,emoji=excluded.emoji,active=excluded.active,position=excluded.position,updated_at=clock_timestamp();
    when 'topics' then insert into community_topics(id,tag,active,position,expires_at) values(new_id,tag_value,active_value,order_value,nullif(payload->>'expires_at','')::timestamptz)
     on conflict(id) do update set tag=excluded.tag,active=excluded.active,position=excluded.position,expires_at=excluded.expires_at,updated_at=clock_timestamp();
    when 'announcements' then insert into community_announcements(id,title,body,priority,active,dismissible,starts_at,ends_at,link)
     values(new_id,title_value,body_value,coalesce((payload->>'priority')::int,1),active_value,coalesce((payload->>'dismissible')::boolean,true),coalesce(nullif(payload->>'starts_at','')::timestamptz,clock_timestamp()),nullif(payload->>'ends_at','')::timestamptz,link_value)
     on conflict(id) do update set title=excluded.title,body=excluded.body,priority=excluded.priority,active=excluded.active,dismissible=excluded.dismissible,starts_at=excluded.starts_at,ends_at=excluded.ends_at,link=excluded.link,updated_at=clock_timestamp();
   end case;
   target:=new_id;
  end if;
 end if;
 insert into moderation_actions(actor_id,action,target_type,target_id,note) values(me,operation,kind,target,case when operation='community_toggle' then active_value::text else '' end);
 return jsonb_build_object('id',target);
end $$;
create function public.command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if action in ('community_save','community_delete','community_toggle','community_pin','community_release') then return community_manage(action,payload); end if;
 return command_before_community(action,payload);
end $$;
revoke execute on function public.community_pick(text,date),public.community_snapshot(timestamptz),public.community_mood_guard(),public.community_manage(text,jsonb) from public,anon,authenticated;
revoke execute on function public.community_public(),public.community_list(text,jsonb),public.command(text,jsonb) from public,anon,authenticated;
grant execute on function public.community_public() to anon,authenticated;
grant execute on function public.community_list(text,jsonb),public.command(text,jsonb) to authenticated;
