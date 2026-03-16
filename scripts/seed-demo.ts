// ABOUTME: Seeds the local SQLite database with realistic demo bookmarks for screenshots.
// ABOUTME: Run with: npx tsx scripts/seed-demo.ts

import { SqliteBookmarkRepository } from "../shared/sqlite-repository.js";
import type { Tweet, User } from "../shared/types.js";
import { resolve } from "path";

const DB_PATH = resolve(process.cwd(), "xbook.db");
const repo = new SqliteBookmarkRepository(DB_PATH);

// --- Users ---

const users = new Map<string, User>([
  ["44196397", { id: "44196397", name: "Guillermo Rauch", username: "rauchg" }],
  ["33521530", { id: "33521530", name: "Dan Abramov", username: "dan_abramov" }],
  ["16076032", { id: "16076032", name: "Wes Bos", username: "wesbos" }],
  ["1542863624", { id: "1542863624", name: "Fireship", username: "fireship_io" }],
  ["2891429640", { id: "2891429640", name: "Theo", username: "t3dotgg" }],
  ["786375033784946688", { id: "786375033784946688", name: "Tina Huang", username: "tina_huang" }],
  ["1467726470533754880", { id: "1467726470533754880", name: "Swyx", username: "swyx" }],
  ["937016930", { id: "937016930", name: "Primeagen", username: "ThePrimeagen" }],
  ["1353287963", { id: "1353287963", name: "Leerob", username: "leeerob" }],
  ["15804774", { id: "15804774", name: "Kent C. Dodds", username: "kentcdodds" }],
  ["107274435", { id: "107274435", name: "Josh W Comeau", username: "JoshWComeau" }],
  ["250112746", { id: "250112746", name: "Cassidy Williams", username: "cassidoo" }],
  ["500100200", { id: "500100200", name: "Sarah Drasner", username: "sarah_edo" }],
  ["600200300", { id: "600200300", name: "Ryan Florence", username: "ryanflorence" }],
  ["700300400", { id: "700300400", name: "Tanner Linsley", username: "tanabornerlinsley" }],
  ["800400500", { id: "800400500", name: "Matt Pocock", username: "mattpocockuk" }],
  ["900500600", { id: "900500600", name: "Evan You", username: "youyuxi" }],
  ["110600700", { id: "110600700", name: "Rich Harris", username: "Rich_Harris" }],
  ["120700800", { id: "120700800", name: "Addy Osmani", username: "addyosmani" }],
  ["130800900", { id: "130800900", name: "Julia Evans", username: "b0rk" }],
]);

// --- Folders ---

const folders = [
  { id: "fl_learn", name: "Learn" },
  { id: "fl_devtools", name: "Dev Tools" },
  { id: "fl_ai", name: "AI / ML" },
  { id: "fl_career", name: "Career" },
  { id: "fl_design", name: "Design" },
  { id: "fl_perf", name: "Performance" },
  { id: "fl_reads", name: "Good Reads" },
  { id: "fl_projects", name: "Project Ideas" },
];

// --- Bookmarks ---

interface SeedBookmark {
  tweet: Tweet;
  authorId: string;
  folderId: string;
  folderName: string;
  tags?: string[];
  notes?: string;
  starred?: boolean;
}

let nextId = 1890001000000000001n;
function id(): string { return String(nextId++); }

const bookmarks: SeedBookmark[] = [
  // --- Learn folder (12) ---
  {
    tweet: { id: id(), text: "React Server Components are not a replacement for client components. They're a new tool. Here's how to think about when to use which.\n\nThread:", created_at: "2026-02-28T09:15:00Z" },
    authorId: "33521530", folderId: "fl_learn", folderName: "Learn",
    tags: ["react", "rsc"], notes: "Great mental model for RSC vs client. Revisit before refactoring the dashboard.", starred: true,
  },
  {
    tweet: { id: id(), text: "TypeScript 5.8 just dropped and the new type-level arithmetic is wild. You can now do conditional types based on numeric ranges. Here's what that unlocks:", created_at: "2026-02-25T14:30:00Z" },
    authorId: "2891429640", folderId: "fl_learn", folderName: "Learn",
    tags: ["typescript"],
  },
  {
    tweet: { id: id(), text: "I spent 3 days debugging a Next.js caching issue. Turns out the answer was one line.\n\nexport const dynamic = 'force-dynamic'\n\nHere's why this matters and when you actually need it:", created_at: "2026-02-22T11:00:00Z" },
    authorId: "1353287963", folderId: "fl_learn", folderName: "Learn",
    tags: ["nextjs", "caching"],
  },
  {
    tweet: { id: id(), text: "CSS :has() is the parent selector we waited 20 years for. But it can do way more than select parents.\n\n10 real-world uses you probably haven't thought of:", created_at: "2026-02-20T16:45:00Z" },
    authorId: "107274435", folderId: "fl_learn", folderName: "Learn",
    tags: ["css"],
  },
  {
    tweet: { id: id(), text: "The best way to learn system design isn't reading blog posts. It's building things that break and figuring out why.\n\nHere are 5 projects that taught me more than any course:", created_at: "2026-02-18T08:20:00Z" },
    authorId: "937016930", folderId: "fl_learn", folderName: "Learn",
    tags: ["system-design"], starred: true,
  },
  {
    tweet: { id: id(), text: "Zustand vs Jotai vs Signals — I've shipped production apps with all three.\n\nHere's when I reach for each one and why:", created_at: "2026-02-15T13:10:00Z" },
    authorId: "2891429640", folderId: "fl_learn", folderName: "Learn",
    tags: ["react", "state-management"],
  },
  {
    tweet: { id: id(), text: "A thread on database indexing that I wish I had when I started:\n\n1. Indexes aren't magic\n2. Order matters more than you think\n3. Covering indexes change everything\n\nLet me explain each:", created_at: "2026-02-12T10:00:00Z" },
    authorId: "937016930", folderId: "fl_learn", folderName: "Learn",
    tags: ["databases", "performance"],
  },
  {
    tweet: { id: id(), text: "Testing React components: stop testing implementation details.\n\nTest what the user sees. Test what the user does. That's it.\n\nHere's the pattern I use for every component:", created_at: "2026-02-10T15:30:00Z" },
    authorId: "15804774", folderId: "fl_learn", folderName: "Learn",
    tags: ["testing", "react"],
  },
  {
    tweet: { id: id(), text: "Discriminated unions in TypeScript are incredibly powerful. If you're not using them, you're writing way more code than you need to.\n\nQuick explainer with real examples:", created_at: "2026-02-08T09:00:00Z" },
    authorId: "800400500", folderId: "fl_learn", folderName: "Learn",
    tags: ["typescript"], notes: "Share with the team — we should use this pattern for API responses.",
  },
  {
    tweet: { id: id(), text: "The Web Platform is moving fast in 2026. Popover API, View Transitions, Container Queries, :has() — all stable in every major browser now.\n\nHere's what I'd learn first:", created_at: "2026-02-05T11:20:00Z" },
    authorId: "107274435", folderId: "fl_learn", folderName: "Learn",
    tags: ["web-platform", "css"],
  },
  {
    tweet: { id: id(), text: "React 19 use() is the hook that changes everything. It replaces useEffect for data fetching, Suspense boundaries become trivial, and error handling just works.\n\nMigration thread:", created_at: "2026-02-03T14:00:00Z" },
    authorId: "33521530", folderId: "fl_learn", folderName: "Learn",
    tags: ["react"],
  },
  {
    tweet: { id: id(), text: "Every developer should understand event loops. Not just \"it's single threaded\" — actually understand microtasks, macrotasks, and how Promise.then() differs from setTimeout.\n\nVisual guide:", created_at: "2026-01-30T08:45:00Z" },
    authorId: "130800900", folderId: "fl_learn", folderName: "Learn",
    tags: ["javascript", "fundamentals"], starred: true,
  },

  // --- Dev Tools folder (10) ---
  {
    tweet: { id: id(), text: "Just shipped Turbopack 2.0. Cold starts are now under 100ms for most projects. Hot reloads are instant.\n\nWe rewrote the module graph from scratch. Here's what changed:", created_at: "2026-03-01T10:00:00Z" },
    authorId: "44196397", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["turbopack", "nextjs"], starred: true,
  },
  {
    tweet: { id: id(), text: "Biome just hit 1.0. It replaces ESLint AND Prettier in a single tool. 100x faster.\n\nI migrated a 200k LOC monorepo in 20 minutes. Here's the guide:", created_at: "2026-02-26T09:45:00Z" },
    authorId: "1542863624", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["tooling", "dx"],
  },
  {
    tweet: { id: id(), text: "VS Code shortcuts that save me ~30 min/day:\n\n- Cmd+Shift+P → everything\n- Cmd+D → multi-select same word\n- Opt+Up/Down → move lines\n- Cmd+Shift+K → delete line\n\nMore in thread:", created_at: "2026-02-23T12:15:00Z" },
    authorId: "16076032", folderId: "fl_devtools", folderName: "Dev Tools",
  },
  {
    tweet: { id: id(), text: "Docker Compose tips nobody told me:\n\n1. Use profiles for dev vs prod\n2. depends_on with healthcheck\n3. Named volumes > bind mounts for databases\n4. .env files are loaded automatically", created_at: "2026-02-19T14:00:00Z" },
    authorId: "16076032", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["docker"], notes: "Review #3 — should we switch xbook to named volumes?",
  },
  {
    tweet: { id: id(), text: "Drizzle ORM just shipped drizzle-seed for generating realistic test data. Type-safe, respects your schema constraints.\n\nThis is exactly what I've been wanting.", created_at: "2026-02-16T11:30:00Z" },
    authorId: "2891429640", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["drizzle", "testing"],
  },
  {
    tweet: { id: id(), text: "GitHub Actions just added native arm64 runners. M-series Mac builds are now first class. No more QEMU emulation.\n\nHere's how to set it up:", created_at: "2026-02-13T16:30:00Z" },
    authorId: "1353287963", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["ci-cd", "github-actions"],
  },
  {
    tweet: { id: id(), text: "Bun 1.2 dropped last night. Built-in S3 support, cross-compile to standalone binaries, and node_modules are optional now.\n\nIt's getting really hard to not switch.", created_at: "2026-02-10T09:15:00Z" },
    authorId: "1542863624", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["bun", "javascript-runtime"],
  },
  {
    tweet: { id: id(), text: "My terminal setup in 2026:\n\n- Ghostty (fast, GPU-rendered)\n- Starship prompt\n- zoxide (smarter cd)\n- fzf + ripgrep\n- lazygit\n\nThe combo is insane. Thread with configs:", created_at: "2026-02-07T13:00:00Z" },
    authorId: "16076032", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["terminal", "productivity"], starred: true,
  },
  {
    tweet: { id: id(), text: "TanStack Router v2 is genuinely the best type-safe routing I've used. Search params are validated at the type level. Route params just work.\n\nCompare it to Next.js App Router:", created_at: "2026-02-04T10:30:00Z" },
    authorId: "700300400", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["tanstack", "routing"],
  },
  {
    tweet: { id: id(), text: "The Playwright MCP server lets Claude Code control a browser. I've been using it to write E2E tests by just describing what to test.\n\nThis is the workflow I've been waiting for.", created_at: "2026-02-01T15:45:00Z" },
    authorId: "1467726470533754880", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["testing", "playwright", "ai"],
  },

  // --- AI / ML folder (10) ---
  {
    tweet: { id: id(), text: "Claude's new tool use API is absurdly good. I built a code review agent in 50 lines.\n\nThe trick: give it specific, narrow tools. Don't try to make a general-purpose agent.\n\nHere's the code:", created_at: "2026-03-02T08:30:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "claude", "agents"], starred: true, notes: "Try building something similar for xbook — auto-tag bookmarks?",
  },
  {
    tweet: { id: id(), text: "RAG is simple in concept, tricky in practice. Here are the 5 mistakes I kept making:\n\n1. Chunks too large\n2. No metadata filtering\n3. Reranking skipped\n4. Embeddings not fine-tuned\n5. No evaluation pipeline", created_at: "2026-02-27T16:00:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "rag"],
  },
  {
    tweet: { id: id(), text: "The AI coding assistant landscape right now:\n\n- Cursor: best IDE experience\n- Claude Code: best for complex refactors\n- GitHub Copilot: best for autocomplete\n- Aider: best for CLI-first workflows\n\nI use different ones for different tasks.", created_at: "2026-02-24T10:15:00Z" },
    authorId: "1542863624", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "dev-tools"],
  },
  {
    tweet: { id: id(), text: "Fine-tuning vs RAG vs prompt engineering — a decision framework:\n\nUse prompt engineering first. Always.\nUse RAG when you need current/private data.\nUse fine-tuning when you need a specific style or format.\n\nDon't jump to fine-tuning.", created_at: "2026-02-21T09:00:00Z" },
    authorId: "786375033784946688", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "llm"],
  },
  {
    tweet: { id: id(), text: "Built a local AI assistant that runs entirely on my MacBook. No API calls, no cloud, no data leaving my machine.\n\nOllama + llama3 + a simple Node.js wrapper. 15 min setup.\n\nThread with instructions:", created_at: "2026-02-17T13:45:00Z" },
    authorId: "1542863624", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "local-llm", "privacy"],
  },
  {
    tweet: { id: id(), text: "MCP (Model Context Protocol) is going to be bigger than most people realize. It's the USB-C of AI — one standard interface for every tool.\n\nHere's why it matters:", created_at: "2026-02-14T11:30:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "mcp"], notes: "Follow up on the MCP server list he linked.",
  },
  {
    tweet: { id: id(), text: "Stop building AI features that are just ChatGPT wrappers.\n\nThe good AI products:\n1. Use AI as a layer, not the product\n2. Have clear fallbacks\n3. Let users correct mistakes\n4. Cache aggressively", created_at: "2026-02-11T08:00:00Z" },
    authorId: "2891429640", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "product"],
  },
  {
    tweet: { id: id(), text: "Structured output from LLMs changes everything for developer tools. No more regex parsing. No more \"please format your response as JSON.\"\n\nAnthropic's tool_use and OpenAI's structured outputs both nail this.", created_at: "2026-02-08T14:20:00Z" },
    authorId: "800400500", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "structured-output"],
  },
  {
    tweet: { id: id(), text: "I benchmarked 6 embedding models for code search. Results surprised me:\n\n1. Voyage Code 3 — best overall\n2. Cohere embed v4 — best on short snippets\n3. OpenAI text-3-large — most consistent\n\nFull results and methodology:", created_at: "2026-02-05T16:00:00Z" },
    authorId: "786375033784946688", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "embeddings", "search"],
  },
  {
    tweet: { id: id(), text: "The agent loop pattern is deceptively simple:\n\nwhile (true) {\n  observe → think → act → check\n}\n\nBut getting the 'check' step right is what separates toy demos from production agents.", created_at: "2026-02-02T09:30:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "agents"], starred: true,
  },

  // --- Career folder (7) ---
  {
    tweet: { id: id(), text: "After 8 years of hiring engineers, here's what actually matters in interviews:\n\n1. Can you explain your thinking?\n2. Do you ask good questions?\n3. Can you handle ambiguity?\n\nThe code is 20% of it. The other 80% is communication.", created_at: "2026-02-28T07:30:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career", "interviews"],
  },
  {
    tweet: { id: id(), text: "The best career advice I ever got: \"Optimize for learning rate, not salary, in your first 5 years.\"\n\nJoin the team where you'll learn the fastest, even if the pay is 20% less. The compound returns are insane.", created_at: "2026-02-24T08:00:00Z" },
    authorId: "15804774", folderId: "fl_career", folderName: "Career",
    starred: true,
  },
  {
    tweet: { id: id(), text: "How to get promoted as a senior engineer:\n\nStop waiting for someone to give you a project. Find the problem nobody wants to own. Fix it. Write about what you did.\n\nThat's it. That's the entire strategy.", created_at: "2026-02-20T11:30:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career"],
  },
  {
    tweet: { id: id(), text: "Your side project doesn't need to make money. It doesn't need users. It doesn't need to be original.\n\nIt needs to teach you something you can't learn at work.\n\nThat's a good enough reason to build it.", created_at: "2026-02-14T16:00:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career", "side-projects"], notes: "This is basically why I built xbook.",
  },
  {
    tweet: { id: id(), text: "The biggest mistake I see in engineering careers: optimizing for title instead of skills.\n\nA \"Senior\" at a company that ships nothing is worth less than a \"Mid\" at a company shipping daily.", created_at: "2026-02-10T07:45:00Z" },
    authorId: "937016930", folderId: "fl_career", folderName: "Career",
    tags: ["career"],
  },
  {
    tweet: { id: id(), text: "Writing is the most underrated engineering skill. Code communicates to machines. Writing communicates to humans. Both are required to ship things that matter.", created_at: "2026-02-06T12:00:00Z" },
    authorId: "500100200", folderId: "fl_career", folderName: "Career",
    tags: ["career", "writing"],
  },
  {
    tweet: { id: id(), text: "Negotiation tip I wish I knew earlier: never give a number first.\n\n\"What's your budget for this role?\" works way better than volunteering a salary expectation.\n\nThe anchor effect is real.", created_at: "2026-02-02T09:00:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career", "negotiation"],
  },

  // --- Design folder (6) ---
  {
    tweet: { id: id(), text: "The best landing pages in 2026 all follow the same pattern:\n\n1. Hero with ONE clear value prop\n2. Social proof immediately\n3. Feature grid (3-6 items)\n4. Pricing\n5. FAQ\n6. CTA repeat\n\nStop overcomplicating this.", created_at: "2026-02-27T10:00:00Z" },
    authorId: "500100200", folderId: "fl_design", folderName: "Design",
    tags: ["design", "landing-pages"], starred: true,
  },
  {
    tweet: { id: id(), text: "Shadcn/ui changed how I think about component libraries. You own the code. You can read every line. No version lock-in, no bloated bundle.\n\nThis is the right model.", created_at: "2026-02-22T14:30:00Z" },
    authorId: "2891429640", folderId: "fl_design", folderName: "Design",
    tags: ["shadcn", "ui"],
  },
  {
    tweet: { id: id(), text: "Motion design for developers — the 5 animations that make any app feel polished:\n\n1. Page transitions (View Transitions API)\n2. List reordering (layout animations)\n3. Skeleton loading\n4. Micro-interactions on buttons\n5. Toast entrances", created_at: "2026-02-18T11:15:00Z" },
    authorId: "500100200", folderId: "fl_design", folderName: "Design",
    tags: ["design", "animation"],
  },
  {
    tweet: { id: id(), text: "Dark mode is not \"invert all the colors.\" It's a completely separate color system.\n\nHere's a framework for building dark mode that actually looks good:", created_at: "2026-02-14T08:30:00Z" },
    authorId: "107274435", folderId: "fl_design", folderName: "Design",
    tags: ["css", "dark-mode"],
  },
  {
    tweet: { id: id(), text: "Typography rules I follow for every project:\n\n- Body: 16-18px, 1.5-1.7 line height\n- Headings: max 3 sizes\n- One font family (two max)\n- Measure: 50-75 characters per line\n\nBreak these and everything looks off.", created_at: "2026-02-09T13:00:00Z" },
    authorId: "107274435", folderId: "fl_design", folderName: "Design",
    tags: ["design", "typography"],
  },
  {
    tweet: { id: id(), text: "Tailwind v4 is the biggest leap since v1. @theme replaces config, CSS-first approach, automatic content detection.\n\nI migrated a 50-file project in 8 minutes. Here's the diff:", created_at: "2026-02-04T15:00:00Z" },
    authorId: "107274435", folderId: "fl_design", folderName: "Design",
    tags: ["tailwind", "css"],
  },

  // --- Performance folder (6) ---
  {
    tweet: { id: id(), text: "Core Web Vitals in 2026 — what actually moves the needle:\n\n- LCP: lazy load below fold, preload hero image\n- INP: useTransition for heavy state updates\n- CLS: explicit width/height on all images\n\nStop optimizing things that don't matter.", created_at: "2026-02-26T08:00:00Z" },
    authorId: "120700800", folderId: "fl_perf", folderName: "Performance",
    tags: ["performance", "web-vitals"], starred: true,
  },
  {
    tweet: { id: id(), text: "React rendering is not your performance problem. Re-renders are almost never the bottleneck.\n\nThe real bottlenecks:\n1. Bundle size\n2. Waterfall requests\n3. Unoptimized images\n4. Third-party scripts\n\nProfile before you optimize.", created_at: "2026-02-21T10:30:00Z" },
    authorId: "33521530", folderId: "fl_perf", folderName: "Performance",
    tags: ["react", "performance"],
  },
  {
    tweet: { id: id(), text: "SQLite is fast enough for 99% of web apps. I ran benchmarks:\n\n- 50k reads/sec on a $5 VPS\n- 10k writes/sec with WAL mode\n- Single file, zero config\n\nStop reaching for Postgres by default.", created_at: "2026-02-16T15:00:00Z" },
    authorId: "937016930", folderId: "fl_perf", folderName: "Performance",
    tags: ["sqlite", "databases", "performance"],
  },
  {
    tweet: { id: id(), text: "If your Next.js app is slow, check these first:\n\n1. Are you fetching in client components? Move to server.\n2. Are you importing entire libraries? Tree shake.\n3. Are you using dynamic imports? You should be.\n4. Is your middleware doing too much?", created_at: "2026-02-12T09:00:00Z" },
    authorId: "1353287963", folderId: "fl_perf", folderName: "Performance",
    tags: ["nextjs", "performance"],
  },
  {
    tweet: { id: id(), text: "Edge computing is overhyped for most apps. Unless your users are globally distributed AND latency-sensitive, a single region is fine.\n\nSaved a client $2k/month by moving off edge functions back to a normal server.", created_at: "2026-02-08T14:00:00Z" },
    authorId: "2891429640", folderId: "fl_perf", folderName: "Performance",
    tags: ["edge", "infrastructure"],
  },
  {
    tweet: { id: id(), text: "The fastest code is code that doesn't run. Before optimizing:\n\n1. Remove unused dependencies\n2. Delete dead code paths\n3. Simplify your data model\n4. Cache at the right layer\n\nThen profile. Then optimize.", created_at: "2026-02-03T11:00:00Z" },
    authorId: "120700800", folderId: "fl_perf", folderName: "Performance",
    tags: ["performance", "optimization"],
  },

  // --- Good Reads folder (6) ---
  {
    tweet: { id: id(), text: "\"Choose Boring Technology\" by Dan McKinley is still the best engineering blog post ever written. If you haven't read it, stop everything and read it now.\n\nhttps://boringtechnology.club", created_at: "2026-02-25T07:30:00Z" },
    authorId: "937016930", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["engineering-culture"], starred: true, notes: "Send this to every new hire.",
  },
  {
    tweet: { id: id(), text: "This post on \"Write code that is easy to delete, not easy to extend\" completely changed how I architect systems.\n\nModularity isn't about reuse. It's about replaceability.", created_at: "2026-02-20T16:30:00Z" },
    authorId: "110600700", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["architecture", "engineering-culture"],
  },
  {
    tweet: { id: id(), text: "Paul Graham's \"Do Things That Don't Scale\" — I re-read this every 6 months. Every time I catch something new.\n\nThe core insight: manual effort reveals what to automate.", created_at: "2026-02-15T09:00:00Z" },
    authorId: "250112746", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["startups"],
  },
  {
    tweet: { id: id(), text: "Just read \"The Grug Brained Developer\" for the third time. \"Complexity very, very bad\" is genuinely the most important lesson in software engineering.\n\nhttps://grugbrain.dev", created_at: "2026-02-10T11:00:00Z" },
    authorId: "937016930", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["engineering-culture", "complexity"],
  },
  {
    tweet: { id: id(), text: "\"Scaling to 100k Users\" — the step-by-step infrastructure guide that should be mandatory reading. Goes from single server to distributed system in realistic increments.", created_at: "2026-02-06T14:00:00Z" },
    authorId: "786375033784946688", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["infrastructure", "scaling"],
  },
  {
    tweet: { id: id(), text: "Found this old Joel Spolsky post on \"The Joel Test.\" Written in 2000 and still relevant. 12 yes/no questions to measure engineering team quality.\n\nHow does your team score?", created_at: "2026-02-01T08:30:00Z" },
    authorId: "130800900", folderId: "fl_reads", folderName: "Good Reads",
    tags: ["engineering-culture"],
  },

  // --- Project Ideas folder (5) ---
  {
    tweet: { id: id(), text: "Weekend project idea: build a CLI tool that watches your git commits and generates a weekly changelog email.\n\ngit log + LLM summarization + Resend = done in a day.", created_at: "2026-02-26T17:00:00Z" },
    authorId: "16076032", folderId: "fl_projects", folderName: "Project Ideas",
    tags: ["project-idea", "cli"], notes: "Could pair this with xbook's newsletter system.",
  },
  {
    tweet: { id: id(), text: "Someone should build a tool that monitors your npm dependencies and tells you which ones are unmaintained, have CVEs, or have better alternatives.\n\nnpm audit is not enough.", created_at: "2026-02-20T08:00:00Z" },
    authorId: "2891429640", folderId: "fl_projects", folderName: "Project Ideas",
    tags: ["project-idea", "npm"],
  },
  {
    tweet: { id: id(), text: "I want a tool that takes my browser bookmarks, X bookmarks, and Hacker News saves and puts them in one searchable database.\n\nWhy does this not exist?", created_at: "2026-02-15T19:30:00Z" },
    authorId: "600200300", folderId: "fl_projects", folderName: "Project Ideas",
    tags: ["project-idea", "bookmarks"], notes: "This is literally what we're building. Ship it!",
  },
  {
    tweet: { id: id(), text: "Project idea: a Markdown-powered personal knowledge base that runs as a single binary. No Electron, no cloud, just a Go binary with embedded SQLite and a web UI.\n\nObsidian but lighter.", created_at: "2026-02-09T10:00:00Z" },
    authorId: "937016930", folderId: "fl_projects", folderName: "Project Ideas",
    tags: ["project-idea", "knowledge-base"],
  },
  {
    tweet: { id: id(), text: "Idea: a GitHub Action that posts your repo's test coverage as a comment on every PR, with a diff against main.\n\nSeems simple but I can't find one that does it well.", created_at: "2026-02-03T13:00:00Z" },
    authorId: "1353287963", folderId: "fl_projects", folderName: "Project Ideas",
    tags: ["project-idea", "ci-cd"],
  },

  // --- Unsorted (6) ---
  {
    tweet: { id: id(), text: "Hot take: most \"clean code\" advice makes code harder to read, not easier.\n\nAbstracting everything into tiny functions means you have to jump through 15 files to understand what happens on a button click.", created_at: "2026-03-01T17:00:00Z" },
    authorId: "2891429640", folderId: "", folderName: "",
  },
  {
    tweet: { id: id(), text: "I asked 50 senior engineers what they wish they knew as juniors. Top 3:\n\n1. Read more code than you write\n2. Learn to say \"I don't know\" comfortably\n3. The best code is the code you don't write", created_at: "2026-02-13T09:30:00Z" },
    authorId: "786375033784946688", folderId: "", folderName: "",
  },
  {
    tweet: { id: id(), text: "Reminder: you don't need microservices.\n\nYou probably don't need Kubernetes either.\n\nA single well-written monolith can handle way more traffic than you think.", created_at: "2026-02-11T14:20:00Z" },
    authorId: "937016930", folderId: "", folderName: "",
    tags: ["architecture"],
  },
  {
    tweet: { id: id(), text: "The Tailwind CSS v4 migration took me 10 minutes. The new @theme directive is so much cleaner than the old tailwind.config.js.\n\nQuick before/after thread:", created_at: "2026-02-08T12:00:00Z" },
    authorId: "107274435", folderId: "", folderName: "",
    tags: ["css", "tailwind"],
  },
  {
    tweet: { id: id(), text: "Every time I think GraphQL is dead, I see a codebase where REST would've been 10x more work.\n\nNeither is universally better. Use what fits.", created_at: "2026-02-05T10:45:00Z" },
    authorId: "2891429640", folderId: "", folderName: "",
  },
  {
    tweet: { id: id(), text: "Sunday reminder: the productivity hack that actually works is sleeping 8 hours.\n\nNot a new app. Not a new framework. Not a new monitor setup.\n\nSleep.", created_at: "2026-02-02T20:00:00Z" },
    authorId: "250112746", folderId: "", folderName: "",
    tags: ["life"],
  },
];

// --- Seed ---

async function seed() {
  console.log(`Seeding database at ${DB_PATH}...\n`);

  // Create folders
  for (const folder of folders) {
    await repo.upsertFolder(folder);
    console.log(`  Folder: ${folder.name}`);
  }

  // Create bookmarks
  let count = 0;
  for (const b of bookmarks) {
    const user = users.get(b.authorId);
    if (!user) throw new Error(`Unknown author: ${b.authorId}`);

    const userMap = new Map([[b.authorId, user]]);
    const folderId = b.folderId || undefined;
    const folderName = b.folderName || undefined;
    const tweet = { ...b.tweet, author_id: b.authorId };

    await repo.upsertBookmark(tweet, userMap, folderId, folderName);
    count++;

    // Add tags
    if (b.tags) {
      for (const tag of b.tags) {
        await repo.addBookmarkTag(b.tweet.id, tag);
      }
    }

    // Add notes
    if (b.notes) {
      await repo.updateBookmarkNotes(b.tweet.id, b.notes);
    }

    // Star
    if (b.starred) {
      await repo.setStarred(b.tweet.id, true);
    }
  }

  console.log(`\n  ${count} bookmarks seeded`);
  console.log(`  ${folders.length} folders created`);
  console.log(`  ${bookmarks.filter(b => b.tags).length} bookmarks with tags`);
  console.log(`  ${bookmarks.filter(b => b.notes).length} bookmarks with notes`);
  console.log(`  ${bookmarks.filter(b => b.starred).length} bookmarks starred`);
  console.log(`\nDone. Run 'cd web && npm run dev' to see the dashboard.`);

  repo.close();
}

seed().catch(console.error);
