-- BT Panel application schema (profiles, shared settings, media, music)

create table if not exists profiles (
  user_id text primary key,
  username text not null unique,
  role text not null default 'member',
  status text not null default 'active',
  bio text not null default '',
  profile_pic text not null default '',
  last_seen timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);
create index if not exists profiles_status_idx on profiles (status);

create table if not exists panel_settings (
  id integer primary key,
  wallpaper_url text not null default '',
  bg_blur integer not null default 0,
  bg_opacity integer not null default 100,
  accent_color text not null default '#d00000',
  glass_tint text not null default '#0a0c14',
  nav_text text not null default '#9da3b4',
  nav_text_active text not null default '#e7e9f0',
  glass_blur integer not null default 20,
  glass_saturate integer not null default 160,
  border_radius integer not null default 16,
  glass_opacity integer not null default 62,
  show_team boolean not null default true,
  panel_name text not null default 'BT Panel',
  panel_subtitle text not null default 'Command center',
  favicon_title text not null default 'BT Panel',
  panel_logo text not null default '',
  favicon_logo text not null default '',
  welcome_title text not null default 'Welcome',
  welcome_message text not null default 'Manage your panel from one place.',
  show_admin_stats boolean not null default true,
  show_version boolean not null default true,
  show_role boolean not null default true,
  show_header_user boolean not null default true,
  allow_registration boolean not null default true,
  tutorials_enabled boolean not null default true,
  onboarding_tour boolean not null default false,
  theme_mode text not null default 'dark',
  music_enabled boolean not null default false,
  music_autoplay boolean not null default false,
  music_loop boolean not null default true,
  music_volume real not null default 0.35,
  music_selected_track_id text not null default '',
  constraint panel_settings_singleton check (id = 1)
);

insert into panel_settings (id) values (1) on conflict (id) do nothing;

create table if not exists media_files (
  id text primary key,
  name text not null,
  url text not null,
  kind text not null default 'image',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists music_tracks (
  id text primary key,
  name text not null,
  url text not null,
  source text not null default 'external',
  created_at timestamptz not null default now()
);
