// ABOUTME: Seeds the local SQLite database with realistic demo bookmarks for screenshots.
// ABOUTME: Run with: npx tsx scripts/seed-demo.ts

import { SqliteBookmarkRepository } from "../shared/sqlite-repository.js";
import type { Tweet, User } from "../shared/types.js";
import { resolve } from "path";

const DB_PATH = resolve(process.cwd(), "xbook.db");
const repo = new SqliteBookmarkRepository(DB_PATH);

// --- Users ---

const users = new Map<string, User>([
  ["44196397", { id: "44196397", name: "Guillermo Rauch", username: "raaborern" }],
  ["33521530", { id: "33521530", name: "Dan Abramov", username: "dan_abramov" }],
  ["16076032", { id: "16076032", name: "Wes Bos", username: "wesbos" }],
  ["1542863624", { id: "1542863624", name: "Fireship", username: "firaboreship_io" }],
  ["2891429640", { id: "2891429640", name: "Theo", username: "t3dotgg" }],
  ["786375033784946688", { id: "786375033784946688", name: "Tina Huang", username: "taborina_huang" }],
  ["1467726470533754880", { id: "1467726470533754880", name: "Swyx", username: "swyx" }],
  ["937016930", { id: "937016930", name: "Primeagen", username: "ThePrimeagen" }],
  ["1353287963", { id: "1353287963", name: "Leerob", username: "leeerob" }],
  ["15804774", { id: "15804774", name: "Kent C. Dodds", username: "kentcdodds" }],
  ["107274435", { id: "107274435", name: "Josh W Comeau", username: "JoshWComeau" }],
  ["250112746", { id: "250112746", name: "Cassidy Williams", username: "cassidoo" }],
]);

// --- Folders ---

const folders = [
  { id: "fl_learn", name: "Learn" },
  { id: "fl_devtools", name: "Dev Tools" },
  { id: "fl_ai", name: "AI / ML" },
  { id: "fl_career", name: "Career" },
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

const bookmarks: SeedBookmark[] = [
  // --- Learn folder ---
  {
    tweet: { id: "1890001000000000001", text: "React Server Components are not a replacement for client components. They're a new tool. Here's how to think about when to use which.\n\nThread:", created_at: "2026-02-28T09:15:00Z" },
    authorId: "33521530", folderId: "fl_learn", folderName: "Learn",
    tags: ["react", "rsc"], notes: "Great mental model for RSC vs client. Revisit before refactoring the dashboard.", starred: true,
  },
  {
    tweet: { id: "1890001000000000002", text: "TypeScript 5.8 just dropped and the new type-level arithmetic is wild. You can now do conditional types based on numeric ranges. Here's what that unlocks:", created_at: "2026-02-25T14:30:00Z" },
    authorId: "2891429640", folderId: "fl_learn", folderName: "Learn",
    tags: ["typescript"],
  },
  {
    tweet: { id: "1890001000000000003", text: "I spent 3 days debugging a Next.js caching issue. Turns out the answer was one line.\n\nexport const dynamic = 'force-dynamic'\n\nHere's why this matters and when you actually need it:", created_at: "2026-02-22T11:00:00Z" },
    authorId: "1353287963", folderId: "fl_learn", folderName: "Learn",
    tags: ["nextjs", "caching"],
  },
  {
    tweet: { id: "1890001000000000004", text: "CSS :has() is the parent selector we waited 20 years for. But it can do way more than select parents.\n\n10 real-world uses you probably haven't thought of:", created_at: "2026-02-20T16:45:00Z" },
    authorId: "107274435", folderId: "fl_learn", folderName: "Learn",
    tags: ["css"],
  },
  {
    tweet: { id: "1890001000000000005", text: "The best way to learn system design isn't reading blog posts. It's building things that break and figuring out why.\n\nHere are 5 projects that taught me more than any course:", created_at: "2026-02-18T08:20:00Z" },
    authorId: "937016930", folderId: "fl_learn", folderName: "Learn",
    tags: ["system-design"], starred: true,
  },
  {
    tweet: { id: "1890001000000000006", text: "Zustand vs Jotai vs Signals — I've shipped production apps with all three.\n\nHere's when I reach for each one and why:", created_at: "2026-02-15T13:10:00Z" },
    authorId: "2891429640", folderId: "fl_learn", folderName: "Learn",
    tags: ["react", "state-management"],
  },
  {
    tweet: { id: "1890001000000000007", text: "A thread on database indexing that I wish I had when I started:\n\n1. Indexes aren't magic\n2. Order matters more than you think\n3. Covering indexes change everything\n\nLet me explain each:", created_at: "2026-02-12T10:00:00Z" },
    authorId: "937016930", folderId: "fl_learn", folderName: "Learn",
    tags: ["databases", "performance"],
  },
  {
    tweet: { id: "1890001000000000008", text: "Testing React components: stop testing implementation details.\n\nTest what the user sees. Test what the user does. That's it.\n\nHere's the pattern I use for every component:", created_at: "2026-02-10T15:30:00Z" },
    authorId: "15804774", folderId: "fl_learn", folderName: "Learn",
    tags: ["testing", "react"],
  },

  // --- Dev Tools folder ---
  {
    tweet: { id: "1890001000000000009", text: "Just shipped Turbopack 2.0. Cold starts are now under 100ms for most projects. Hot reloads are instant.\n\nWe rewrote the module graph from scratch. Here's what changed:", created_at: "2026-03-01T10:00:00Z" },
    authorId: "44196397", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["turbopack", "nextjs"], starred: true,
  },
  {
    tweet: { id: "1890001000000000010", text: "Biome just hit 1.0. It replaces ESLint AND Prettier in a single tool. 100x faster.\n\nI migrated a 200k LOC monorepo in 20 minutes. Here's the guide:", created_at: "2026-02-26T09:45:00Z" },
    authorId: "1542863624", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["tooling", "dx"],
  },
  {
    tweet: { id: "1890001000000000011", text: "VS Code shortcuts that save me ~30 min/day:\n\n- Cmd+Shift+P → everything\n- Cmd+D → multi-select same word\n- Opt+Up/Down → move lines\n- Cmd+Shift+K → delete line\n\nMore in thread:", created_at: "2026-02-23T12:15:00Z" },
    authorId: "16076032", folderId: "fl_devtools", folderName: "Dev Tools",
  },
  {
    tweet: { id: "1890001000000000012", text: "Docker Compose tips nobody told me:\n\n1. Use profiles for dev vs prod\n2. depends_on with healthcheck\n3. Named volumes > bind mounts for databases\n4. .env files are loaded automatically", created_at: "2026-02-19T14:00:00Z" },
    authorId: "16076032", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["docker"], notes: "Review #3 — should we switch xbook to named volumes?",
  },
  {
    tweet: { id: "1890001000000000013", text: "Drizzle ORM just shipped drizzle-seed for generating realistic test data. Type-safe, respects your schema constraints.\n\nThis is exactly what I've been wanting.", created_at: "2026-02-16T11:30:00Z" },
    authorId: "2891429640", folderId: "fl_devtools", folderName: "Dev Tools",
    tags: ["drizzle", "testing"],
  },

  // --- AI / ML folder ---
  {
    tweet: { id: "1890001000000000014", text: "Claude's new tool use API is absurdly good. I built a code review agent in 50 lines.\n\nThe trick: give it specific, narrow tools. Don't try to make a general-purpose agent.\n\nHere's the code:", created_at: "2026-03-02T08:30:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "claude", "agents"], starred: true, notes: "Try building something similar for xbook — auto-tag bookmarks?",
  },
  {
    tweet: { id: "1890001000000000015", text: "RAG is simple in concept, tricky in practice. Here are the 5 mistakes I kept making:\n\n1. Chunks too large\n2. No metadata filtering\n3. Reranking skipped\n4. Embeddings not fine-tuned\n5. No evaluation pipeline", created_at: "2026-02-27T16:00:00Z" },
    authorId: "1467726470533754880", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "rag"],
  },
  {
    tweet: { id: "1890001000000000016", text: "The AI coding assistant landscape right now:\n\n- Cursor: best IDE experience\n- Claude Code: best for complex refactors\n- GitHub Copilot: best for autocomplete\n- Aider: best for CLI-first workflows\n\nI use different ones for different tasks.", created_at: "2026-02-24T10:15:00Z" },
    authorId: "1542863624", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "dev-tools"],
  },
  {
    tweet: { id: "1890001000000000017", text: "Fine-tuning vs RAG vs prompt engineering — a decision framework:\n\nUse prompt engineering first. Always.\nUse RAG when you need current/private data.\nUse fine-tuning when you need a specific style or format.\n\nDon't jump to fine-tuning.", created_at: "2026-02-21T09:00:00Z" },
    authorId: "786375033784946688", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "llm"],
  },
  {
    tweet: { id: "1890001000000000018", text: "Built a local AI assistant that runs entirely on my MacBook. No API calls, no cloud, no data leaving my machine.\n\nOllama + llama3 + a simple Node.js wrapper. 15 min setup.\n\nThread with instructions:", created_at: "2026-02-17T13:45:00Z" },
    authorId: "1542863624", folderId: "fl_ai", folderName: "AI / ML",
    tags: ["ai", "local-llm", "privacy"],
  },

  // --- Career folder ---
  {
    tweet: { id: "1890001000000000019", text: "After 8 years of hiring engineers, here's what actually matters in interviews:\n\n1. Can you explain your thinking?\n2. Do you ask good questions?\n3. Can you handle ambiguity?\n\nThe code is 20% of it. The other 80% is communication.", created_at: "2026-02-28T07:30:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career", "interviews"],
  },
  {
    tweet: { id: "1890001000000000020", text: "The best career advice I ever got: \"Optimize for learning rate, not salary, in your first 5 years.\"\n\nJoin the team where you'll learn the fastest, even if the pay is 20% less. The compound returns are insane.", created_at: "2026-02-24T08:00:00Z" },
    authorId: "15804774", folderId: "fl_career", folderName: "Career",
    starred: true,
  },
  {
    tweet: { id: "1890001000000000021", text: "How to get promoted as a senior engineer:\n\nStop waiting for someone to give you a project. Find the problem nobody wants to own. Fix it. Write about what you did.\n\nThat's it. That's the entire strategy.", created_at: "2026-02-20T11:30:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career"],
  },
  {
    tweet: { id: "1890001000000000022", text: "Your side project doesn't need to make money. It doesn't need users. It doesn't need to be original.\n\nIt needs to teach you something you can't learn at work.\n\nThat's a good enough reason to build it.", created_at: "2026-02-14T16:00:00Z" },
    authorId: "250112746", folderId: "fl_career", folderName: "Career",
    tags: ["career", "side-projects"], notes: "This is basically why I built xbook.",
  },

  // --- No folder (uncategorized) ---
  {
    tweet: { id: "1890001000000000023", text: "Hot take: most \"clean code\" advice makes code harder to read, not easier.\n\nAbstracting everything into tiny functions means you have to jump through 15 files to understand what happens on a button click.", created_at: "2026-03-01T17:00:00Z" },
    authorId: "2891429640", folderId: "", folderName: "",
  },
  {
    tweet: { id: "1890001000000000024", text: "I asked 50 senior engineers what they wish they knew as juniors. Top 3:\n\n1. Read more code than you write\n2. Learn to say \"I don't know\" comfortably\n3. The best code is the code you don't write", created_at: "2026-02-13T09:30:00Z" },
    authorId: "786375033784946688", folderId: "", folderName: "",
  },
  {
    tweet: { id: "1890001000000000025", text: "Reminder: you don't need microservices.\n\nYou probably don't need Kubernetes either.\n\nA single well-written monolith can handle way more traffic than you think.", created_at: "2026-02-11T14:20:00Z" },
    authorId: "937016930", folderId: "", folderName: "",
    tags: ["architecture"],
  },
  {
    tweet: { id: "1890001000000000026", text: "The Tailwind CSS v4 migration took me 10 minutes. The new @theme directive is so much cleaner than the old tailwind.config.js.\n\nQuick before/after thread:", created_at: "2026-02-08T12:00:00Z" },
    authorId: "107274435", folderId: "", folderName: "",
    tags: ["css", "tailwind"],
  },
  {
    tweet: { id: "1890001000000000027", text: "Every time I think GraphQL is dead, I see a codebase where REST would've been 10x more work.\n\nNeither is universally better. Use what fits.", created_at: "2026-02-05T10:45:00Z" },
    authorId: "2891429640", folderId: "", folderName: "",
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

    await repo.upsertBookmark(b.tweet, userMap, folderId, folderName);
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
