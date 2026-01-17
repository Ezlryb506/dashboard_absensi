/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";

type ClassRow = {
  id: string;
  name: string;
  active: boolean;
};

type ScheduleRow = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type AdminData = {
  classes: ClassRow[];
  schedules: ScheduleRow[];
  classSessions: {
    id: string;
    class_id: string;
    session_no: number;
    session_type: string;
    status: string;
    start_at: string | null;
    end_at: string | null;
  }[];
  counts: Record<string, number>;
};

type Notice = {
  type: "error" | "success";
  message: string;
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const toLocalInputValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ClassesAdmin() {
  const [data, setData] = useState<AdminData>({
    classes: [],
    schedules: [],
    classSessions: [],
    counts: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [sessionEdits, setSessionEdits] = useState<
    Record<string, { start_at: string; end_at: string }>
  >({});
  const [scheduleVisible, setScheduleVisible] = useState<Record<string, boolean>>({});
  const [sessionsVisible, setSessionsVisible] = useState<Record<string, boolean>>({});

  const schedulesByClass = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    data.schedules.forEach((row) => {
      const list = map.get(row.class_id) || [];
      list.push(row);
      map.set(row.class_id, list);
    });
    return map;
  }, [data.schedules]);

  const sessionsByClass = useMemo(() => {
    const map = new Map<string, AdminData["classSessions"]>();
    const sessions = Array.isArray(data.classSessions) ? data.classSessions : [];
    sessions.forEach((row) => {
      const list = map.get(row.class_id) || [];
      list.push(row);
      map.set(row.class_id, list);
    });
    return map;
  }, [data.classSessions]);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/classes", { cache: "no-store" });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setError(msg.error || "Failed to fetch data.");
        setLoading(false);
        return;
      }
      const json = (await res.json()) as AdminData;
      setData({
        classes: json.classes || [],
        schedules: json.schedules || [],
        classSessions: Array.isArray(json.classSessions) ? json.classSessions : [],
        counts: json.counts || {},
      });
      setError("");
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch data.");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const next: Record<string, { start_at: string; end_at: string }> = {};
    data.classSessions.forEach((sess) => {
      next[sess.id] = {
        start_at: toLocalInputValue(sess.start_at),
        end_at: toLocalInputValue(sess.end_at),
      };
    });
    setSessionEdits(next);
  }, [data.classSessions]);

  const showNotice = (type: Notice["type"], message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => {
      setNotice((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  const requestJson = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        showNotice("error", msg.error || "Request failed.");
        return null;
      }
      return res.json().catch(() => ({}));
    } catch (err) {
      showNotice("error", "Network error. Please try again.");
      return null;
    }
  };

  const createClass = async () => {
    const id = newId || slugify(newName);
    if (!id || !newName) {
      showNotice("error", "Class name is required.");
      return;
    }
    const res = await requestJson("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: newName, active: true }),
    });
    if (!res) return;
    showNotice("success", "Class added.");
    setNewName("");
    setNewId("");
    load();
  };

  const updateClass = async (row: ClassRow, active: boolean) => {
    const res = await requestJson("/api/admin/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, name: row.name, active }),
    });
    if (!res) return;
    load();
  };

  const deleteClass = async (row: ClassRow) => {
    if (!confirm(`Delete class ${row.name}?`)) return;
    const res = await requestJson("/api/admin/classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    if (!res) return;
    load();
  };

  const updateSessionStatus = async (id: string, status: string) => {
    const res = await requestJson("/api/admin/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "class_session",
        id,
        status,
      }),
    });
    if (!res) return;
    load();
  };

  const addSchedule = async (classId: string) => {
    const res = await requestJson("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "schedule",
        class_id: classId,
        day_of_week: 1,
        start_time: "08:00",
        end_time: "10:00",
      }),
    });
    if (!res) return;
    load();
  };

  const toggleSchedule = (classId: string) => {
    setScheduleVisible((prev) => ({
      ...prev,
      [classId]: !(prev[classId] ?? false),
    }));
  };

  const toggleSessions = (classId: string) => {
    setSessionsVisible((prev) => ({
      ...prev,
      [classId]: !(prev[classId] ?? false),
    }));
  };

  const updateSessionTime = async (id: string) => {
    const edit = sessionEdits[id];
    if (!edit) return;
    const res = await requestJson("/api/admin/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "class_session",
        id,
        start_at: edit.start_at ? new Date(edit.start_at).toISOString() : null,
        end_at: edit.end_at ? new Date(edit.end_at).toISOString() : null,
      }),
    });
    if (!res) return;
    showNotice("success", "Session time updated.");
    load();
  };

  const enrollAllStudents = async (classId: string) => {
    const res = await requestJson("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "enroll_all",
        class_id: classId,
      }),
    });
    if (!res) return;
    showNotice("success", "All students enrolled.");
  };

  const updateSchedule = async (row: ScheduleRow, field: keyof ScheduleRow, value: string) => {
    const updated = { ...row, [field]: value };
    const res = await requestJson("/api/admin/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "schedule",
        id: updated.id,
        day_of_week: Number(updated.day_of_week),
        start_time: updated.start_time,
        end_time: updated.end_time,
      }),
    });
    if (!res) return;
    load();
  };

  const deleteSchedule = async (id: string) => {
    const res = await requestJson("/api/admin/classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "schedule", id }),
    });
    if (!res) return;
    load();
  };

  return (
    <div className="min-h-screen bg-[#f5f8f8] text-slate-800">
      <Header />
      {notice && (
        <div className="fixed right-6 top-24 z-50 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-xs font-semibold uppercase ${
                  notice.type === "error" ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {notice.type === "error" ? "Error" : "Success"}
              </p>
              <p className="mt-1 text-sm text-slate-700">{notice.message}</p>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div className="p-6">
        <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Classes Control</h1>
            <p className="text-sm text-slate-500">
              Manage classes, schedules, and active status.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                const res = await requestJson("/api/admin/classes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kind: "auto_open_today" }),
                });
                if (!res) return;
                showNotice(
                  "success",
                  `Auto open done. Opened ${res.opened || 0}, closed ${res.closed || 0}.`
                );
                load();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
            >
              Auto Open Today
            </button>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Class name"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="Class id (optional)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={createClass}
              className="rounded-lg bg-[#00778a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f6e]"
            >
              Add Class
            </button>
          </div>
        </header>

        <div className="space-y-6">
          {loading && <p className="text-sm text-slate-500">Loading...</p>}
          {!loading && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {!loading &&
            data.classes.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{row.id}</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {row.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Check-ins: {data.counts[row.id] || 0}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => enrollAllStudents(row.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      Enroll All Students
                    </button>
                    <button
                      onClick={() => updateClass(row, !row.active)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        row.active
                          ? "bg-green-100 text-[#14a14f]"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => deleteClass(row)}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase text-slate-400">Status</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {row.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-400">Schedules</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {(schedulesByClass.get(row.id) || []).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-400">Sessions</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {(sessionsByClass.get(row.id) || []).length}
                    </p>
                  </div>
                </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700">
                        Schedules
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSchedule(row.id)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                        >
                        {(scheduleVisible[row.id] ?? false) ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={() => addSchedule(row.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Add
                        </button>
                      </div>
                  </div>
                  {(scheduleVisible[row.id] ?? false) && (
                    <div className="space-y-2">
                    {(schedulesByClass.get(row.id) || []).map((sch) => (
                      <div
                        key={sch.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <select
                          value={sch.day_of_week}
                          onChange={(e) =>
                            updateSchedule(
                              sch,
                              "day_of_week",
                              e.target.value
                            )
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {days.map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={sch.start_time.slice(0, 5)}
                          onChange={(e) =>
                            updateSchedule(sch, "start_time", e.target.value)
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        />
                        <input
                          type="time"
                          value={sch.end_time.slice(0, 5)}
                          onChange={(e) =>
                            updateSchedule(sch, "end_time", e.target.value)
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => deleteSchedule(sch.id)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {(schedulesByClass.get(row.id) || []).length === 0 && (
                      <p className="text-xs text-slate-400">
                        No schedules yet.
                      </p>
                    )}
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Sessions (16)
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSessions(row.id)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                      >
                        {(sessionsVisible[row.id] ?? false) ? "Hide" : "Show"}
                      </button>
                      <span className="text-xs text-slate-400">
                        Open / Close
                      </span>
                    </div>
                  </div>
                  {(sessionsVisible[row.id] ?? false) && (
                    <div className="grid gap-2 md:grid-cols-2">
                    {(sessionsByClass.get(row.id) || []).map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Sesi {sess.session_no} · {sess.session_type.toUpperCase()}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Status: {sess.status}
                          </p>
                          <div className="mt-2 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
                            <label className="flex flex-col gap-1">
                              Start
                              <input
                                type="datetime-local"
                                value={sessionEdits[sess.id]?.start_at || ""}
                                onChange={(e) =>
                                  setSessionEdits((prev) => ({
                                    ...prev,
                                    [sess.id]: {
                                      start_at: e.target.value,
                                      end_at: prev[sess.id]?.end_at || "",
                                    },
                                  }))
                                }
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              End
                              <input
                                type="datetime-local"
                                value={sessionEdits[sess.id]?.end_at || ""}
                                onChange={(e) =>
                                  setSessionEdits((prev) => ({
                                    ...prev,
                                    [sess.id]: {
                                      start_at: prev[sess.id]?.start_at || "",
                                      end_at: e.target.value,
                                    },
                                  }))
                                }
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]"
                              />
                            </label>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/classes/${row.id}/sessions/${sess.id}`}
                            className="text-xs font-semibold text-[#00778a] hover:text-[#005f6e]"
                          >
                            View
                          </a>
                          <button
                            onClick={() => updateSessionTime(sess.id)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                          >
                            Save Time
                          </button>
                          <button
                            onClick={() =>
                              updateSessionStatus(
                                sess.id,
                                sess.status === "open" ? "closed" : "open"
                              )
                            }
                            className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                              sess.status === "open"
                                ? "bg-green-100 text-[#14a14f]"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {sess.status === "open" ? "Close" : "Open"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {(sessionsByClass.get(row.id) || []).length === 0 && (
                      <p className="text-xs text-slate-400">
                        No sessions found. Run seed again.
                      </p>
                    )}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
        </div>
      </div>
    </div>
  );
}
