import { useState } from "react";
import { toast } from "sonner";
import { createPanelUser, deletePanelUser, setUserRole, setUserStatus } from "@/lib/panel/server";
import { formatJoined } from "@/lib/utils";
import { PresenceAvatar } from "../avatar";
import { usePanel } from "../context";

export function UsersView() {
  const { team, setTeam, profile } = usePanel();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    setBusy(true);
    try {
      const next = await createPanelUser({ data: { username, email, password, role } });
      setTeam(next);
      setUsername("");
      setEmail("");
      setPassword("");
      setOpen(false);
      toast.success("User created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-[16px] font-extrabold">User Management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "+ Add User"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-4">
          <input className="panel-input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="panel-input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="panel-input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <select
              className="panel-input"
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
            >
              <option value="member">Member</option>
              {profile?.role === "owner" ? <option value="admin">Admin</option> : null}
            </select>
            <button type="button" className="btn-accent shrink-0" disabled={busy} onClick={() => void onCreate()}>
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {team.map((user) => (
              <tr key={user.userId}>
                <td>
                  <div className="flex items-center gap-3">
                    <PresenceAvatar name={user.username} src={user.profilePic || user.image} size="sm" />
                    <div>
                      <div className="font-extrabold">{user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="text-[13px] font-semibold text-steel">{user.email || "—"}</td>
                <td>
                  {profile?.role === "owner" && user.role !== "owner" ? (
                    <select
                      className="panel-input min-h-10 py-1 text-[12px]"
                      value={user.role}
                      onChange={(e) => {
                        void setUserRole({ data: { userId: user.userId, role: e.target.value } })
                          .then(setTeam)
                          .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                      }}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span className="text-[12px] font-extrabold tracking-wide uppercase">{user.role}</span>
                  )}
                </td>
                <td>
                  <span className={user.status === "active" ? "text-ok" : "text-danger"}>
                    {user.status}
                  </span>
                </td>
                <td className="text-[13px] font-semibold text-steel">{formatJoined(user.createdAt)}</td>
                <td className="text-right">
                  {user.userId !== profile?.userId && user.role !== "owner" ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost min-h-10 px-3 text-[12px]"
                        onClick={() => {
                          const next = user.status === "active" ? "suspended" : "active";
                          void setUserStatus({ data: { userId: user.userId, status: next } })
                            .then(setTeam)
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                        }}
                      >
                        {user.status === "active" ? "Suspend" : "Restore"}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => {
                          if (!window.confirm(`Delete ${user.username}?`)) return;
                          void deletePanelUser({ data: { userId: user.userId } })
                            .then(setTeam)
                            .then(() => toast.success("User deleted"))
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
