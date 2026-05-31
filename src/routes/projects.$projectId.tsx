import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, UserPlus, Calendar, ArrowLeft } from "lucide-react";

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — TaskFlow" }] }),
  component: () => <RequireAuth><AppLayout><ProjectDetail /></AppLayout></RequireAuth>,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const membersQ = useQuery({
    queryKey: ["members", projectId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("project_members")
        .select("id,role,user_id")
        .eq("project_id", projectId);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs, error: pErr } = await supabase
        .from("profiles").select("id,name,email").in("id", ids);
      if (pErr) throw pErr;
      const map = new Map((profs ?? []).map((p) => [p.id, p as { id: string; name: string; email: string }]));
      return (rows ?? []).map((r) => ({ ...r, profiles: map.get(r.user_id) ?? null }));
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const myRole = useMemo(
    () => membersQ.data?.find((m: any) => m.user_id === user?.id)?.role,
    [membersQ.data, user?.id]
  );
  const isAdmin = myRole === "admin";

  if (projectQ.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!projectQ.data) return <p className="text-muted-foreground">Project not found or you don't have access.</p>;

  const project = projectQ.data;

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate({ to: "/projects" })} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.description && <p className="mt-1 text-muted-foreground">{project.description}</p>}
          </div>
          <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            You are {myRole ?? "—"}
          </span>
        </div>
      </div>

      <MembersPanel
        projectId={projectId}
        members={membersQ.data ?? []}
        isAdmin={isAdmin}
        onChange={() => qc.invalidateQueries({ queryKey: ["members", projectId] })}
      />

      <TasksBoard
        projectId={projectId}
        tasks={tasksQ.data ?? []}
        members={membersQ.data ?? []}
        isAdmin={isAdmin}
        currentUserId={user!.id}
        onChange={() => qc.invalidateQueries({ queryKey: ["tasks", projectId] })}
      />
    </div>
  );
}

function MembersPanel({
  projectId, members, isAdmin, onChange,
}: { projectId: string; members: any[]; isAdmin: boolean; onChange: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const addMember = async () => {
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    setBusy(true);
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("id").eq("email", parsed.data).maybeSingle();
    if (pErr) { setBusy(false); return toast.error(pErr.message); }
    if (!profile) { setBusy(false); return toast.error("No user found with that email. They need to sign up first."); }
    const { error } = await supabase.from("project_members").insert({
      project_id: projectId, user_id: profile.id, role: "member",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setEmail(""); onChange();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("project_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed"); onChange();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Team ({members.length})</h2>
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">{m.profiles?.name}</div>
              <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{m.role}</span>
              {isAdmin && m.role !== "admin" && (
                <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="mt-4 flex gap-2">
          <Input placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={addMember} disabled={busy}><UserPlus className="h-4 w-4" /> Add</Button>
        </div>
      )}
    </div>
  );
}

const STATUSES: { id: Status; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-info/15 text-info",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  assignee_id: z.string().optional(),
});

function TasksBoard({
  projectId, tasks, members, isAdmin, currentUserId, onChange,
}: {
  projectId: string; tasks: any[]; members: any[];
  isAdmin: boolean; currentUserId: string; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; due_date: string; priority: Priority; assignee_id: string }>(
    { title: "", description: "", due_date: "", priority: "medium", assignee_id: "" }
  );

  const create = async () => {
    const parsed = taskSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      due_date: parsed.data.due_date || null,
      priority: parsed.data.priority,
      assignee_id: parsed.data.assignee_id || null,
      created_by: currentUserId,
    });
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setOpen(false);
    setForm({ title: "", description: "", due_date: "", priority: "medium", assignee_id: "" });
    onChange();
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const removeTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Task deleted"); onChange();
  };

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v: Priority) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select value={form.assignee_id || "unassigned"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "unassigned" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Create task</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STATUSES.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{col.label}</h3>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="space-y-3">
                {colTasks.map((t) => {
                  const canEdit = isAdmin || t.assignee_id === currentUserId;
                  const assignee = members.find((m) => m.user_id === t.assignee_id);
                  const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < today;
                  return (
                    <div key={t.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{t.title}</div>
                        {isAdmin && (
                          <button onClick={() => removeTask(t.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[t.priority as Priority]}`}>{t.priority}</span>
                        {t.due_date && (
                          <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" /> {t.due_date}
                          </span>
                        )}
                        {assignee && <span className="text-xs text-muted-foreground">· {assignee.profiles?.name}</span>}
                      </div>
                      {canEdit && (
                        <div className="mt-3">
                          <Select value={t.status} onValueChange={(v: Status) => updateStatus(t.id, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
