import { requireUser } from "@/lib/session";
import { ImportForm } from "@/components/import-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Import", robots: { index: false } };

export default async function ImportPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Bookmarks</h1>
      <p className="text-muted-foreground text-sm max-w-2xl">
        Import bookmarks from a JSON or CSV file. The X API only returns your
        ~100 most recent bookmarks. To export your full collection, use{" "}
        <a
          href="https://github.com/prinsss/twitter-web-exporter"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          twitter-web-exporter
        </a>{" "}
        (browser extension), then upload the exported file here.
      </p>
      <ImportForm />
    </div>
  );
}
