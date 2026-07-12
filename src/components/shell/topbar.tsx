"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  LogOut,
  KeyRound,
  Moon,
  Search,
  Sun,
  CircleUser,
  Boxes,
  Package,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { logoutAction, changePasswordAction } from "@/lib/auth-actions";
import { markAllReadAction } from "@/lib/notification-actions";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

type SearchHit = {
  kind: "component" | "product" | "run";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type NotificationItem = {
  id: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function Topbar({
  user,
  unreadCount,
}: {
  user: { name: string; email: string; role: Role };
  unreadCount: number;
}) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  // Global shortcuts: Ctrl/Cmd+K palette, "n" new run, "/" search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (!typing && e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        router.push("/production/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-surface/95 px-4 backdrop-blur">
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex h-9 w-9 shrink items-center justify-center gap-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-400 hover:border-slate-300 sm:w-64 sm:justify-start sm:px-3 lg:w-80"
        aria-label="Search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden min-w-0 truncate whitespace-nowrap sm:block">
          Search components, products, runs…
        </span>
        <kbd className="ml-auto hidden shrink-0 whitespace-nowrap rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] leading-none text-slate-400 sm:block">
          Ctrl&nbsp;K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell initialUnread={unreadCount} />
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100">
              <CircleUser className="h-6 w-6 text-slate-400" />
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-800">{user.name}</span>
                <span className="block text-[11px] leading-tight text-slate-400">{ROLE_LABELS[user.role]}</span>
              </span>
              <Badge tone="info" className="hidden md:inline-flex">{user.role}</Badge>
            </button>
          </DropdownTrigger>
          <DropdownContent align="end" className="w-56">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => setPwOpen(true)}>
              <KeyRound className="h-4 w-4" /> Change password
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => logoutAction()}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {pwOpen && <ChangePasswordDialog onClose={() => setPwOpen(false)} />}
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unread);
    }
  }, []);

  return (
    <Dropdown onOpenChange={(o) => o && load()}>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-sm font-semibold text-slate-800">Notifications</span>
          {unread > 0 && (
            <button
              className="text-xs font-medium text-primary hover:underline dark:text-slate-700"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllReadAction();
                  setUnread(0);
                  setItems((it) => it?.map((n) => ({ ...n, readAt: new Date().toISOString() })) ?? null);
                })
              }
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items == null ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">All caught up.</div>
          ) : (
            items.map((n) => (
              <DropdownItem
                key={n.id}
                className={cn("items-start px-3 py-2.5", !n.readAt && "bg-primary-soft/50")}
                onSelect={() => n.href && router.push(n.href)}
              >
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.readAt ? "bg-slate-300" : "bg-primary")} />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-700">{n.message}</span>
                  <span className="block text-[11px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </DropdownItem>
            ))
          )}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

const kindIcons = {
  component: <Boxes className="h-4 w-4 text-slate-400" />,
  product: <Package className="h-4 w-4 text-slate-400" />,
  run: <Factory className="h-4 w-4 text-slate-400" />,
};

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          setHits((await res.json()).hits);
          setSelected(0);
        }
      } catch {
        /* aborted */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const go = (hit: SearchHit) => {
    onClose();
    router.push(hit.href);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-28 max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, hits.length - 1));
              else if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
              else if (e.key === "Enter" && hits[selected]) go(hits[selected]);
            }}
            placeholder="Jump to a component, product or production run…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {hits.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              {q.trim() ? "No matches." : "Type to search by SKU or name."}
            </div>
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.kind}:${h.id}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(h)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                  i === selected && "bg-slate-100",
                )}
              >
                {kindIcons[h.kind]}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{h.title}</span>
                  <span className="block truncate text-xs text-slate-400">{h.subtitle}</span>
                </span>
                <Badge tone="neutral">{h.kind}</Badge>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Change password</DialogTitle>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Current password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>New password (min 8 chars)</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await changePasswordAction({ current, next });
                  if (!res.ok) setError(res.error ?? "Failed");
                  else {
                    toast.success("Password updated");
                    onClose();
                  }
                })
              }
            >
              {pending ? "Saving…" : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
