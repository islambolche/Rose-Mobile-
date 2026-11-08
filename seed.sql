-- Execute this SQL in your Supabase SQL Editor to grant admin access
-- and an active subscription to your account.

-- 1. Update/Insert Profile for Admin
insert into public.profiles (id, email, role, status)
select id, email, 'admin', 'active' from auth.users
where email = 'islambolche@gmail.com'
on conflict (id) do update set role = 'admin', status = 'active';

-- 2. Update/Insert Subscription for Admin
insert into public.subscriptions (user_id, plan, status, ends_at)
select id, 'admin', 'active', null from auth.users
where email = 'islambolche@gmail.com'
on conflict do nothing;
