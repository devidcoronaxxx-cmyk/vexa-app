require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key);

const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");

async function run() {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let ok = 0;
  let fail = 0;

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc("exec_sql", { query: stmt + ";" });
      if (error) {
        console.log("FAIL:", error.message, "\n  SQL:", stmt.slice(0, 80));
        fail++;
      } else {
        ok++;
      }
    } catch (e) {
      console.log("ERR:", e.message, "\n  SQL:", stmt.slice(0, 80));
      fail++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} fail`);
}

run();
