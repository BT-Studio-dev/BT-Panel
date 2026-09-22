import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { saveProfile, saveProfilePic } from "@/lib/panel/server";
import { compressImageFile, formatJoined } from "@/lib/utils";
import { PresenceAvatar } from "../avatar";
import { usePanel } from "../context";

export function AccountView() {
  const { profile, setProfile } = usePanel();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  if (!profile) return null;

  async function onSaveProfile() {
    setSaving(true);
    try {
      const next = await saveProfile({ data: { bio, username } });
      if (next) setProfile(next);
      toast.success("Profile saved");
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
      const next = await saveProfilePic({ data: { dataUrl } });
      if (next) setProfile(next);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    }
  }

  async function onPassword() {
    setPwError("");
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword });
      if (result.error) throw new Error(result.error.message || "Could not update password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      toast.success("Password updated");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="glass px-6 py-8 text-center">
        <div className="mx-auto w-fit">
          <PresenceAvatar name={profile.username} src={profile.profilePic || profile.image} size="lg" />
        </div>
        <div className="mt-4 text-[20px] font-extrabold">{profile.username}</div>
        <div className="mt-1 text-[13px] font-semibold text-steel">{profile.email}</div>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase">
            {profile.role}
          </span>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ok uppercase">
            {profile.status}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <MiniStat label="2FA" value="Off" />
          <MiniStat label="User ID" value={profile.userId.slice(0, 6)} />
          <MiniStat label="Joined" value={formatJoined(profile.createdAt)} />
        </div>
        <p className="mt-5 text-[13px] font-semibold text-steel">{profile.bio || "No bio yet."}</p>
      </div>

      <div className="grid gap-4">
        <section className="glass p-5">
          <h3 className="text-[14px] font-extrabold">Edit Profile</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-[12px] font-bold text-steel">
              Profile Picture
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="panel-input mt-1.5 pt-2.5 text-[12px]"
                onChange={(e) => void onPic(e.target.files?.[0])}
              />
              <span className="mt-1 block text-[11px] font-semibold text-white/40">PNG or JPEG, saved at 128×128.</span>
            </label>
            <label className="block text-[12px] font-bold text-steel">
              Username
              <input className="panel-input mt-1.5" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="sm:col-span-2 block text-[12px] font-bold text-steel">
              Bio
              <textarea
                className="panel-input mt-1.5 min-h-[96px] resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
              />
            </label>
          </div>
          <button type="button" className="btn-accent mt-4" disabled={saving} onClick={() => void onSaveProfile()}>
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </section>

        <section className="glass p-5">
          <h3 className="text-[14px] font-extrabold">Change Password</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              className="panel-input"
              type="password"
              placeholder="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              className="panel-input"
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              className="panel-input"
              type="password"
              placeholder="Confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {pwError ? <p className="mt-2 text-[13px] font-semibold text-danger">{pwError}</p> : null}
          <button type="button" className="btn-accent mt-4" disabled={pwBusy} onClick={() => void onPassword()}>
            {pwBusy ? "Updating…" : "Update Password"}
          </button>
        </section>

        <section className="glass p-5">
          <h3 className="text-[14px] font-extrabold">Two-Factor Authentication</h3>
          <p className="mt-2 text-[13px] font-semibold text-steel">
            Authenticator-app 2FA is not available in this panel yet. Use a strong unique password in the meantime.
          </p>
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[12px] font-bold">{value}</div>
      <div className="text-[10px] font-bold tracking-wide text-steel uppercase">{label}</div>
    </div>
  );
}
