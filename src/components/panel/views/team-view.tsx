import { formatJoined } from "@/lib/utils";
import { PresenceAvatar } from "../avatar";
import { usePanel } from "../context";

export function TeamView() {
  const { team } = usePanel();

  return (
    <div className="glass overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-[16px] font-extrabold">Team Members</h2>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {team.length === 0 ? (
          <p className="col-span-full px-2 py-8 text-center text-sm font-semibold text-steel">No members yet.</p>
        ) : (
          team.map((member) => (
            <div key={member.userId} className="glass-soft flex items-center gap-3 rounded-[14px] border border-white/8 p-3">
              <PresenceAvatar name={member.username} src={member.profilePic || member.image} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-extrabold">{member.username}</div>
                <div className="text-[11px] font-bold tracking-[0.12em] text-steel uppercase">{member.role}</div>
                <div className="mt-1 text-[11px] font-semibold text-white/45">Joined {formatJoined(member.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
