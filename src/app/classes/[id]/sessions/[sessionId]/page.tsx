/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
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

const formatTime = (iso: string) => {
  const match = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : iso;
};

export default function SessionDetail() {
  const params = useParams<{ id: string; sessionId: string }>();
  const classId = params?.id || "";
  const sessionId = params?.sessionId || "";
  const [rows, setRows] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await fetch(
        `/api/checkins?class_session_id=${sessionId}`
      );
      const json = (await res.json()) as CheckinItem[];
      if (active) setRows(Array.isArray(json) ? json : []);
      if (active) setLoading(false);
    };
    if (sessionId) load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#f5f8f8]">
      <Header />
      <div className="p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Session Detail</p>
              <h1 className="text-2xl font-bold text-slate-900">
                {classId.toUpperCase()} · {sessionId.slice(0, 8)}
              </h1>
            </div>
            <a
              href={`/classes/${classId}`}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Class
            </a>
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
                      {formatTime(row.ts)} · sim {row.sim.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              {!loading && rows.length === 0 && (
                <p className="text-sm text-slate-400">
                  No check-ins yet for this session.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
