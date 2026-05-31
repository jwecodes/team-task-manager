import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { CheckCircle2, Clock, ListTodo, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TaskFlow" }] }),
  component: () => <RequireAuth><AppLayout><Dashboard /></AppLayout></RequireAuth>,
});

function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("id,status,due_date,assignee_id,project_id,title,priority,projects(name)");
      if (error) throw error;
      const { data: profiles } = await supabase.from("profiles").select("id,name");
      return { tasks: tasks ?? [], profiles: profiles ?? [] };
    },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  const tasks = data.tasks;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const byStatus = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
  const overdue = tasks.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < today);
  const myTasks = tasks.filter((t) => t.assignee_id === user?.id);

  const perUser = new Map<string, number>();
  for (const t of tasks) if (t.assignee_id) perUser.set(t.assignee_id, (perUser.get(t.assignee_id) ?? 0) + 1);
  const nameOf = (id: string) => data.profiles.find((p) => p.id === id)?.name ?? "Unknown";

  const stats = [
    { label: "Total tasks", value: tasks.length, icon: ListTodo, tone: "text-info" },
    { label: "In progress", value: byStatus.in_progress, icon: Clock, tone: "text-warning" },
    { label: "Done", value: byStatus.done, icon: CheckCircle2, tone: "text-success" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview across all your projects.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Tasks by status">
          <StatusBar label="To Do" count={byStatus.todo} total={tasks.length} color="bg-info" />
          <StatusBar label="In Progress" count={byStatus.in_progress} total={tasks.length} color="bg-warning" />
          <StatusBar label="Done" count={byStatus.done} total={tasks.length} color="bg-success" />
        </Panel>

        <Panel title="Tasks per teammate">
          {perUser.size === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...perUser.entries()].sort((a, b) => b[1] - a[1]).map(([uid, n]) => (
                <li key={uid} className="flex items-center justify-between text-sm">
                  <span>{nameOf(uid)}{uid === user?.id ? " (you)" : ""}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Assigned to you">
        {myTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing assigned. Enjoy the calm.</p>
        ) : (
          <ul className="divide-y divide-border">
            {myTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{(t as any).projects?.name} · {t.status.replace("_"," ")}</div>
                </div>
                {t.due_date && <span className="text-xs text-muted-foreground">{t.due_date}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
