import { cookies } from "next/headers";
import { ClientGate } from "@/components/panel/client-gate";
import { PanelShell } from "@/components/panel/shell";
import { MODE_COOKIE, parseMode } from "@/lib/panel/theme";
import { pickTheme, resolveView } from "@/lib/panel/types";
import { getSessionUser } from "@/lib/server/auth";
import { getBootstrap, getSettings } from "@/lib/server/data";

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) {
    // No cookie session: the browser may still hold a token (third-party
    // cookies blocked in an embedded preview) — let the client decide.
    const settings = await getSettings();
    return <ClientGate theme={pickTheme(settings)} />;
  }
  const [data, params, store] = await Promise.all([getBootstrap(user), searchParams, cookies()]);
  const view = resolveView(params.view, user.role);
  const serverId = view === "servers" && typeof params.server === "string" ? params.server : null;
  return (
    <PanelShell
      initial={data}
      initialView={view}
      initialServerId={serverId}
      initialModeOverride={parseMode(store.get(MODE_COOKIE)?.value)}
    />
  );
}
