import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const [showingRoot, transactionRoot, managerEmail] = process.argv.slice(2);
if (!showingRoot || !transactionRoot || !managerEmail) throw new Error("Usage: node scripts/import-resource-folders.mjs <showing-folder> <transaction-folder> <manager-email>");
for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const users = await clerk.users.getUserList({ emailAddress: [managerEmail], limit: 1 });
const user = users.data[0];
if (!user) throw new Error(`No Clerk user found for ${managerEmail}`);

const session = await clerk.sessions.createSession({ userId: user.id });
try {
  const token = await clerk.sessions.getToken(session.id);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token.jwt}` } },
    auth: { persistSession: false },
  });
  const groups = [
    { root: showingRoot, prefix: "Showing" },
    { root: transactionRoot, prefix: "Transaction" },
  ];
  let imported = 0;
  let skipped = 0;
  for (const group of groups) {
    for (const kind of ["rental", "sale"]) {
      const folder = path.join(group.root, kind);
      const files = (await readdir(folder, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));
      const category = `${group.prefix} · ${kind === "sale" ? "Sale" : "Rental"}`;
      for (const entry of files) {
        const existing = await supabase.from("company_forms").select("id").eq("category", category).eq("file_name", entry.name).is("deleted_at", null).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) { skipped += 1; continue; }
        const bytes = await readFile(path.join(folder, entry.name));
        const safeName = entry.name.replace(/[^a-z0-9._-]/gi, "-").slice(-120);
        const storagePath = `resources/${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${crypto.randomUUID()}-${safeName}`;
        const upload = await supabase.storage.from("company-forms").upload(storagePath, bytes, { contentType: "application/pdf", cacheControl: "3600", upsert: false });
        if (upload.error) throw upload.error;
        const insert = await supabase.from("company_forms").insert({
          title: humanize(entry.name),
          description: `${group.prefix} resource for ${kind} transactions.`,
          category,
          file_name: entry.name,
          file_path: storagePath,
          mime_type: "application/pdf",
          file_size: bytes.byteLength,
          created_by: user.id,
          updated_by: user.id,
        });
        if (insert.error) {
          await supabase.storage.from("company-forms").remove([storagePath]);
          throw insert.error;
        }
        imported += 1;
      }
    }
  }
  console.log(`Imported ${imported} resources; skipped ${skipped} existing resources.`);
} finally {
  await clerk.sessions.revokeSession(session.id);
}

function humanize(fileName) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\s+/g, " ").trim();
}
