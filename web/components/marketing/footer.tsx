import Link from "next/link";
import { GitHubIcon } from "./github-icon";

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-semibold text-lg">
              xbook
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Your X bookmarks, organized.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-3">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#features" className="hover:text-foreground transition-colors">Features</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-3">Developers</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://github.com/joedanz/xbook" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://github.com/joedanz/xbook#self-hosting" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  Self-Hosting
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><span>MIT License</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t flex items-center justify-between text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} xbook. Open source under MIT.</p>
          <a
            href="https://github.com/joedanz/xbook"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
            aria-label="xbook on GitHub"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
