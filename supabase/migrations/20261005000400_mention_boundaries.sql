-- Match JavaScript whitespace when separating a URL from a following mention.
-- Keep the already-applied engagement migration immutable.
create or replace function public.mention_names(value text) returns text[] language sql immutable
set search_path=public,pg_temp as $$
 select coalesce(array_agg(name order by name),'{}') from (
  select distinct m[1] name from regexp_matches(
   regexp_replace(lower(left(value,240)),'https?://[^[:space:]   -     　﻿<>]+','','g'),
   '(?:^|[[:space:]   -     　﻿(\[{])@([a-z0-9_]{3,20})(?![a-z0-9_])','g') m
 ) q
$$;
revoke all on function public.mention_names(text) from public,anon,authenticated;
