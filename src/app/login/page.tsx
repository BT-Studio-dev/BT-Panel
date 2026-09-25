import { redirect } from "next/navigation";
import { AuthEntry } from "@/components/auth/auth-entry";
import { DEMO_ACCOUNTS, pickTheme } from "@/lib/panel/types";
import { getSessionUser } from "@/lib/server/auth";
import { getSettings, getUserById } from "@/lib/server/data";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  const settings = await getSettings();
  // Only advertise demo credentials that genuinely exist (they are skipped
  // entirely when the panel runs with SEED_DEMO=false on a real server).
  const demoOwner = settings.showDemoLogin ? await getUserById(DEMO_ACCOUNTS[0].id) : null;
  return (
    <AuthEntry
      mode="login"
      theme={pickTheme(settings)}
      panelName={settings.panelName}
      panelLogo={settings.panelLogo}
      title="Sign In to {panel}"
      subtitle="Enter your credentials to access your servers"
      allowRegistration={settings.allowRegistration}
      demos={demoOwner ? DEMO_ACCOUNTS : []}
    />
  );
}
