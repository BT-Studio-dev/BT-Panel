"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, CloudUpload, Eye, EyeOff, KeyRound } from "lucide-react";
import type { PanelProfile } from "@/lib/panel/types";
import { api, compressImageFile, formatJoined } from "@/lib/utils";
import { usePanel } from "../context";
import { Field, PresenceAvatar, Spinner } from "../ui";

export function AccountView() {
  const { profile, setProfile, servers } = usePanel();
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const myServers = servers.filter((s) => s.ownerId === profile.userId).length;

  async function patch(body: Record<string, unknown>, message: string) {
    const res = await api<{ profile: PanelProfile }>("/api/account", { method: "PATCH", body });
    setProfile({ ...res.profile, online: true });
    toast.success(message);
  }

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await patch({ username, bio }, "Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onPic(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 128, 0.9, file.type.includes("png") ? "image/png" : "image/jpeg");
      await patch({ profilePic: dataUrl }, "Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    setPwError("");
    if (pw.next.length < 8) return setPwError("New password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return setPwError("Passwords do not match.");
    setPwBusy(true);
    try {
      await api("/api/account/password", { body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="glass h-fit px-6 py-8 text-center">
        <div className="mx-auto w-fit">
          <PresenceAvatar name={profile.username} src={profile.profilePic} size="lg" online />
        </div>
        <div className="mt-4 text-[20px] font-extrabold">{profile.username}</div>
        <div className="mt-1 truncate text-[13px] font-semibold text-steel">{profile.email}</div>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase">{profile.role}</span>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ok uppercase">{profile.status}</span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <MiniStat label="Servers" value={String(myServers)} />
          <MiniStat label="User ID" value={profile.userId.replace(/^usr_/, "").slice(0, 6)} />
          <MiniStat label="Joined" value={formatJoined(profile.createdAt)} />
        </div>
        <p className="mt-5 text-[13px] font-semibold text-steel">{profile.bio || "No bio yet."}</p>
      </div>

      <div className="grid content-start gap-4">
        <form onSubmit={onSaveProfile} className="glass p-5">
          <h3 className="text-[14px] font-extrabold">Edit Profile</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[12px] font-bold text-steel">Profile Picture</span>
              <div className="flex items-center gap-3 rounded-[var(--control-radius)] border border-line bg-fill p-2.5">
                <PresenceAvatar name={profile.username} src={profile.profilePic} size="sm" />
                <label className="btn-ghost min-h-9 cursor-pointer px-3 text-[12px]">
                  <CloudUpload className="size-3.5" /> Upload
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void onPic(e.target.files?.[0])} />
                </label>
                {profile.profilePic ? (
                  <button
                    type="button"
                    className="btn-ghost min-h-9 px-3 text-[12px]"
                    onClick={() => void patch({ profilePic: "" }, "Photo removed").catch(() => toast.error("Could not remove photo"))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <span className="mt-1 block text-[11px] font-semibold text-faint">PNG or JPEG, saved at 128×128.</span>
            </div>
            <Field label="Username">
              <input className="panel-input" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} />
            </Field>
            <Field label="Bio" className="sm:col-span-2">
              <textarea
                className="panel-input min-h-[96px] resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                placeholder="Tell your team what you work on…"
              />
            </Field>
          </div>
          <button type="submit" className="btn-accent mt-4" disabled={saving}>
            {saving ? <Spinner /> : <Check className="size-4" />} Save Profile
          </button>
        </form>

        <form onSubmit={onPassword} className="glass p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-extrabold">
            <KeyRound className="size-4 text-accent" /> Change Password
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Current password">
              <PasswordInput
                label="Current password"
                value={pw.current}
                onChange={(value) => setPw({ ...pw, current: value })}
                autoComplete="current-password"
                visible={showPw.current}
                onToggle={() => setShowPw((current) => ({ ...current, current: !current.current }))}
              />
            </Field>
            <Field label="New password">
              <PasswordInput
                label="New password"
                value={pw.next}
                onChange={(value) => setPw({ ...pw, next: value })}
                autoComplete="new-password"
                visible={showPw.next}
                onToggle={() => setShowPw((current) => ({ ...current, next: !current.next }))}
              />
            </Field>
            <Field label="Confirm new password">
              <PasswordInput
                label="Confirm new password"
                value={pw.confirm}
                onChange={(value) => setPw({ ...pw, confirm: value })}
                autoComplete="new-password"
                visible={showPw.confirm}
                onToggle={() => setShowPw((current) => ({ ...current, confirm: !current.confirm }))}
              />
            </Field>
          </div>
          {pwError ? <p className="mt-3 text-[12.5px] font-bold text-danger">{pwError}</p> : null}
          <button type="submit" className="btn-accent mt-4" disabled={pwBusy}>
            {pwBusy ? <Spinner /> : <KeyRound className="size-4" />} Update Password
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const toggleLabel = `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`;
  return (
    <div className="relative">
      <input
        className="panel-input pr-11"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[var(--control-radius)] text-steel transition-colors hover:bg-fill hover:text-ice"
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-pressed={visible}
        title={toggleLabel}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--control-radius)] border border-line bg-fill px-2 py-2">
      <div className="text-[9.5px] font-extrabold tracking-[0.12em] text-steel uppercase">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-extrabold">{value}</div>
    </div>
  );
}
