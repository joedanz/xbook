import { requireUser } from "@/lib/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConnectionStatus } from "./connection-status";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const { userId } = await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>X Account</CardTitle>
          <CardDescription>
            Manage your X (Twitter) connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionStatus />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode</span>
            <span>Local</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <a
              href="https://github.com/joedanz/xbook"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GitHub
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
