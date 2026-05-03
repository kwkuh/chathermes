#!/usr/bin/env bun
// chathermes — CLI for self-hosted ChatHermes admins.
// Run from inside the orchestrator/ directory:  bun bin/chathermes.ts <command>
// Or after `bun link`: chathermes <command>

import * as DB from "../src/db";
import * as Power from "../src/power";

const VERSION = "1.0.0";

const HELP = `chathermes ${VERSION} — admin CLI

Usage: chathermes <command> [args]

Commands:
  status                          Show service health (db / stripe / resend / hermes-agent)
  whoami                          Show what server URL is set
  user list                       List all users
  user grant-admin <email>        Promote a user to admin
  user revoke-admin <email>       Revoke admin role
  user disable <email>            Disable an account
  user enable <email>             Re-enable an account
  user export <email>             Print full GDPR export to stdout
  user delete <email>             ⚠️  Delete a user and all their data (asks confirmation)
  apikey create <email> <name>    Provision an API key for a user
  apikey list <email>             List API keys for a user (no tokens shown)
  apikey revoke-all <email>       Revoke all API keys for a user
  webhook list <email>            List webhook subscriptions for a user
  cron list                       Show cron job state
  cron run <name>                 Manually fire a cron job
  backup                          Snapshot the SQLite DB to ./data/backup-<date>.db
  notify <email> <title> [body]   Send an in-app notification to a user
  email-test <template> <to>      Send a sample email (welcome, weekly_digest, etc.)
  stats                           Quick platform stats

Tip: set CHATHERMES_DB to override default path (./data/orchestrator.db).
`;

const args = process.argv.slice(2);
const cmd = args[0];

function err(msg: string): never {
  console.error("[31m✗[0m " + msg);
  process.exit(1);
}
function ok(msg: string) { console.log("[32m✓[0m " + msg); }
function info(msg: string) { console.log("[2m" + msg + "[0m"); }

async function confirm(prompt: string): Promise<boolean> {
  process.stdout.write(prompt + " (yes/no) ");
  for await (const line of console as any) {
    return line.trim().toLowerCase() === "yes";
  }
  return false;
}

function getUserByEmail(email: string): DB.User {
  const u = DB.findUserByEmail(email);
  if (!u) err(`No user with email: ${email}`);
  return u as DB.User;
}

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") { console.log(HELP); return; }
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }

  switch (cmd) {
    case "status": {
      const r = await Power.deepHealthCheck();
      console.log(`\nstatus: ${r.ok ? "[32moperational[0m" : "[31mdegraded[0m"}`);
      console.log(`uptime: ${r.uptime_sec}s\n`);
      for (const [k, v] of Object.entries(r.checks)) {
        const ico = v.ok ? "[32m✓[0m" : "[31m✗[0m";
        const lat = v.latency_ms !== undefined ? `(${v.latency_ms}ms)` : "";
        console.log(`  ${ico} ${k.padEnd(16)} ${v.detail || v.error || ""} ${lat}`);
      }
      return;
    }

    case "whoami": {
      console.log("PUBLIC_BASE_URL:", process.env.PUBLIC_BASE_URL || "(not set)");
      console.log("DATA_ROOT:      ", process.env.DATA_ROOT || "./data");
      console.log("Stripe:         ", process.env.STRIPE_SECRET_KEY ? "configured" : "not configured");
      console.log("Resend:         ", process.env.RESEND_API_KEY ? "configured" : "not configured");
      return;
    }

    case "user": {
      const sub = args[1];
      if (sub === "list") {
        const users = DB.listUsers();
        console.log(`\n${users.length} users\n`);
        for (const u of users) {
          const d = (u as any).disabled ? " [31m[disabled][0m" : "";
          const role = u.role === "admin" ? " [33m[admin][0m" : "";
          console.log(`  ${u.email.padEnd(40)} ${role}${d}`);
        }
        return;
      }
      if (sub === "grant-admin" || sub === "revoke-admin") {
        const u = getUserByEmail(args[2] || "");
        const role = sub === "grant-admin" ? "admin" : "user";
        DB.db.run("UPDATE users SET role = ? WHERE id = ?", [role, u.id]);
        ok(`${u.email} → role: ${role}`);
        return;
      }
      if (sub === "disable" || sub === "enable") {
        const u = getUserByEmail(args[2] || "");
        const flag = sub === "disable" ? 1 : 0;
        DB.db.run("UPDATE users SET disabled = ? WHERE id = ?", [flag, u.id]);
        ok(`${u.email} ${sub}d`);
        return;
      }
      if (sub === "export") {
        const u = getUserByEmail(args[2] || "");
        const data = Power.exportUserData(u.id);
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      if (sub === "delete") {
        const u = getUserByEmail(args[2] || "");
        const yes = await confirm(`This permanently deletes ${u.email} and ALL their data. Continue?`);
        if (!yes) { info("aborted"); return; }
        const r = Power.deleteUserCompletely(u.id);
        ok(`Deleted ${u.email}`);
        for (const [t, n] of Object.entries(r.deletedRows).filter(([_, v]) => v > 0)) console.log(`  ${t}: ${n}`);
        return;
      }
      err("Unknown user subcommand. See: chathermes help");
    }

    case "apikey": {
      const sub = args[1];
      if (sub === "create") {
        const u = getUserByEmail(args[2] || "");
        const name = args[3] || "cli-generated";
        const { token, record } = Power.createApiKey({ userId: u.id, name });
        ok(`API key created for ${u.email}`);
        console.log("\n  [33m" + token + "[0m");
        console.log("\n  ⚠️  This is the only time you'll see this token. Save it now.");
        console.log(`  id:     ${record.id}`);
        console.log(`  prefix: ${record.prefix}`);
        return;
      }
      if (sub === "list") {
        const u = getUserByEmail(args[2] || "");
        const keys = Power.listApiKeys(u.id);
        console.log(`\n${keys.length} API keys for ${u.email}\n`);
        for (const k of keys) {
          const expires = k.expires_at ? new Date(k.expires_at).toISOString().slice(0, 10) : "never";
          const lastUsed = k.last_used_at ? new Date(k.last_used_at).toISOString().slice(0, 10) : "never";
          console.log(`  ${k.name.padEnd(30)} ${k.prefix}…  expires: ${expires}  last: ${lastUsed}`);
        }
        return;
      }
      if (sub === "revoke-all") {
        const u = getUserByEmail(args[2] || "");
        const r = DB.db.run("DELETE FROM api_tokens WHERE user_id = ?", [u.id]);
        ok(`revoked ${(r as any).changes} keys for ${u.email}`);
        return;
      }
      err("Unknown apikey subcommand");
    }

    case "webhook": {
      const sub = args[1];
      if (sub === "list") {
        const u = getUserByEmail(args[2] || "");
        const subs = Power.listWebhooks(u.id);
        console.log(`\n${subs.length} webhooks for ${u.email}\n`);
        for (const w of subs) {
          let evs: string[] = []; try { evs = JSON.parse(w.events); } catch {}
          console.log(`  ${w.url}`);
          console.log(`    events: ${evs.join(", ")}`);
          console.log(`    status: ${w.last_delivery_status || "never delivered"}`);
        }
        return;
      }
      err("Unknown webhook subcommand");
    }

    case "cron": {
      const sub = args[1];
      if (sub === "list") {
        const jobs = Power.listCronJobs();
        console.log("");
        for (const j of jobs as any[]) {
          const last = j.last_run_at ? new Date(j.last_run_at).toISOString() : "never";
          console.log(`  ${j.name.padEnd(30)} ${j.last_status || "—"}  last: ${last}`);
          if (j.last_error) console.log(`    [31merror:[0m ${j.last_error.slice(0, 80)}`);
        }
        return;
      }
      err("Unknown cron subcommand (try: chathermes cron list)");
    }

    case "backup": {
      const path = `./data/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
      DB.db.run(`VACUUM INTO '${path}'`);
      ok(`backup written → ${path}`);
      return;
    }

    case "notify": {
      const u = getUserByEmail(args[1] || "");
      const title = args[2];
      const body = args[3];
      if (!title) err("title required");
      Power.notify(u.id, { kind: "cli", title, body });
      ok(`notification queued for ${u.email}`);
      return;
    }

    case "email-test": {
      const tmpl = args[1];
      const to = args[2];
      if (!tmpl || !to) err("usage: chathermes email-test <template> <email>");
      const Email = await import("../src/email");
      const fn = (Email as any)[`send${tmpl[0]?.toUpperCase() ?? ""}${tmpl.slice(1).replace(/_(.)/g, (_, c) => c.toUpperCase())}`];
      if (!fn) err(`Unknown template: ${tmpl}. Try welcome, magic_link, project_published, weekly_digest, etc.`);
      // Generic fixture args
      const r = await fn({
        to,
        verifyUrl: "https://chathermes.com/auth/verify?token=test",
        projectTitle: "Test project", publicUrl: "https://chathermes.com/p/test", projectId: "test",
        plan: "Pro", status: "active", portalUrl: "https://chathermes.com/app/billing",
        amountCents: 2000, currency: "usd",
        ip: "127.0.0.1", userAgent: "cli/test", when: new Date().toISOString(),
        revokeUrl: "https://chathermes.com/app/settings",
        renewsOn: "2026-06-01",
        pct: 80, used: 4000, limit: 5000, metric: "messages", upgradeUrl: "https://chathermes.com/app/billing",
        jobTitle: "Test job", summary: "All good", openUrl: "https://chathermes.com/app",
        messages: 100, projects: 5, toolCalls: 30,
        orderName: "Test", trialEndsOn: "2026-06-01",
        jobs: [{ title: "Test", summary: "Done." }],
        activeUntil: "2026-06-01", resumeUrl: "https://chathermes.com/app/billing",
      });
      ok(`sent (id: ${r.id || "—"})`);
      if (!r.ok) console.error("error:", r.error);
      return;
    }

    case "stats": {
      const stats = {
        users: (DB.db.query("SELECT COUNT(*) AS n FROM users").get() as any).n,
        admins: (DB.db.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as any).n,
        sessions: (DB.db.query("SELECT COUNT(*) AS n FROM chat_sessions").get() as any).n,
        messages: (DB.db.query("SELECT COUNT(*) AS n FROM messages").get() as any).n,
        projects: (DB.db.query("SELECT COUNT(*) AS n FROM projects").get() as any).n,
        published: (DB.db.query("SELECT COUNT(*) AS n FROM projects WHERE published = 1").get() as any).n,
        memories: (DB.db.query("SELECT COUNT(*) AS n FROM memories").get() as any).n,
        emails: (DB.db.query("SELECT COUNT(*) AS n FROM email_log").get() as any).n,
        api_keys: (DB.db.query("SELECT COUNT(*) AS n FROM api_tokens").get() as any).n,
        webhooks: (DB.db.query("SELECT COUNT(*) AS n FROM outbound_webhooks WHERE active = 1").get() as any).n,
      };
      console.log("");
      for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(12)} ${v}`);
      return;
    }

    default:
      err(`Unknown command: ${cmd}\n\n${HELP}`);
  }
}

main().catch((e) => {
  console.error("[31m✗[0m " + (e?.stack || e));
  process.exit(1);
});
