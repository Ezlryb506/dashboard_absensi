/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";

type CheckinItem = {
  id: string;
  class_id: string;
  person_name: string;
  ts: string;
  sim: number;
  image_url?: string;
};

type SessionItem = {
  id: string;
  class_id: string;
  session_no: number;
  session_type: string;
  status: string;
  start_at: string | null;
  end_at: string | null;
};

const formatTime = (iso: string) => {
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : iso;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const match = iso.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : iso;
};

export default function ClassDetail() {
  const params = useParams<{ id: string }>();
  const classId = params?.id || "";
  const [rows, setRows] = useState<CheckinItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const openSessions = sessions.filter((sess) => sess.status === "open");
  const lastCheckin = rows[0];
  const [sessionsVisible, setSessionsVisible] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/checkins?class_id=${classId}`);
        const json = (await res.json()) as CheckinItem[];
        if (active) setRows(Array.isArray(json) ? json : []);
        const sess = await fetch(`/api/class-sessions?class_id=${classId}`);
        const sessJson = (await sess.json()) as SessionItem[];
        if (active) setSessions(Array.isArray(sessJson) ? sessJson : []);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (classId) {
      load();
    }
    const id = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [classId]);

  return (
    <div className="min-h-screen bg-[#f5f8f8]">
      <Header />
      <div className="p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Class Detail</p>
              <h1 className="text-2xl font-bold text-slate-900">
                {classId.toUpperCase()}
              </h1>
            </div>
            <Link
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-400">Open Sessions</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {openSessions.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-400">Total Check-ins</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "-" : rows.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-400">Last Check-in</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {lastCheckin ? formatDateTime(lastCheckin.ts) : "-"}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {sessions.length} total
                </span>
                <button
                  onClick={() => setSessionsVisible((prev) => !prev)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                >
                  {sessionsVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {sessionsVisible ? (
              <div className="grid gap-2 md:grid-cols-2">
                {sessions.map((sess) => (
                  <a
                    key={sess.id}
                    href={`/classes/${classId}/sessions/${sess.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        Sesi {sess.session_no} - {sess.session_type.toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          sess.status === "open"
                            ? "bg-emerald-100 text-emerald-700"
                            : sess.status === "closed"
                            ? "bg-slate-200 text-slate-600"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Start: {formatDateTime(sess.start_at)}</span>
                      <span>End: {formatDateTime(sess.end_at)}</span>
                    </div>
                  </a>
                ))}
                {sessions.length === 0 && (
                  <p className="text-sm text-slate-400">No sessions found.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Sessions list hidden. Click Show to view.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Check-ins</h2>
            <span className="text-xs text-slate-500">
              {loading ? "Loading..." : `${rows.length} records`}
            </span>
          </div>
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white">
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt={row.person_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                      {row.person_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.person_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTime(row.ts)} - sim {row.sim.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <p className="text-sm text-slate-400">
                No check-ins yet for this class.
              </p>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
