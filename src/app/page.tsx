/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";

type ScheduleSlot = {
  day: number;
  start: string;
  end: string;
};

type ClassItem = {
  id: string;
  name: string;
  room?: string;
  schedule?: ScheduleSlot[];
  active?: boolean;
  isActive?: boolean;
  enrolledCount?: number;
  checkedCount?: number;
};

type CheckinItem = {
  id: string;
  class_id: string;
  name: string;
  ts: string;
  sim: number;
  image_url?: string;
};

type DashboardData = {
  now: string;
  active_class: ClassItem | null;
  classes: ClassItem[];
  checkins: CheckinItem[];
  total_today: number;
  no_checkin_today: Array<{
    id: string;
    name: string;
    student_number?: string;
    classes: string[];
  }>;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + m;
};

const formatCountdown = (startMinutes: number, endMinutes: number, nowMinutes: number) => {
  if (nowMinutes > endMinutes) return "ended";
  const remaining = Math.max(0, endMinutes - nowMinutes);
  if (remaining <= 1) return "ending now";
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  return `ends in ${parts.join(" ")}`;
};

const getActiveSlot = (schedule: ScheduleSlot[] = [], now: Date) => {
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return schedule.find((slot) => {
    if (slot.day !== day) return false;
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    return nowMinutes >= start && nowMinutes <= end;
  });
};

const getNextSlot = (schedule: ScheduleSlot[] = [], now: Date) => {
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todaySlots = schedule.filter((slot) => slot.day === day);
  const upcoming = todaySlots.filter((slot) => toMinutes(slot.start) > nowMinutes);
  upcoming.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return upcoming[0] || null;
};

const emptyData: DashboardData = {
  now: new Date().toISOString(),
  active_class: null,
  classes: [],
  checkins: [],
  total_today: 0,
  no_checkin_today: [],
};

export default function Home() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const now = useMemo(() => new Date(data.now), [data.now]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch");
        const json = (await res.json()) as DashboardData;
        if (active) setData(json);
      } catch {
        // keep last data
      }
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const activeSessions = useMemo(
    () => data.classes.filter((item) => item.active || item.isActive).length,
    [data.classes]
  );
  const classCounts = useMemo(() => {
    const map = new Map<string, number>();
    data.checkins.forEach((item) => {
      map.set(item.class_id, (map.get(item.class_id) || 0) + 1);
    });
    return map;
  }, [data.checkins]);
  const totalCheckins = data.total_today || data.checkins.length;

  const liveSessions = useMemo(() => {
    return data.classes
      .map((item) => {
        const slot = getActiveSlot(item.schedule || [], now);
        if (!slot) return null;
        return { item, slot };
      })
      .filter(Boolean) as Array<{ item: ClassItem; slot: ScheduleSlot }>;
  }, [data.classes, now]);

  const nextEndingSession = useMemo(() => {
    if (!liveSessions.length) return null;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return liveSessions
      .map(({ item, slot }) => ({
        item,
        slot,
        endMinutes: toMinutes(slot.end),
        nowMinutes,
      }))
      .sort((a, b) => a.endMinutes - b.endMinutes)[0];
  }, [liveSessions, now]);

  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    data.classes.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [data.classes]);

  const latestCheckins = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; image?: string; ts: string; classes: Set<string> }
    >();
    data.checkins.forEach((item) => {
      const key = item.name;
      const label = classNameMap.get(item.class_id) || item.class_id.toUpperCase();
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: item.name,
          image: item.image_url,
          ts: item.ts,
          classes: new Set([label]),
        });
        return;
      }
      const entry = grouped.get(key)!;
      entry.classes.add(label);
      if (new Date(item.ts).getTime() > new Date(entry.ts).getTime()) {
        entry.ts = item.ts;
      }
      if (!entry.image && item.image_url) {
        entry.image = item.image_url;
      }
    });
    return Array.from(grouped.values())
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 6);
  }, [data.checkins, classNameMap]);
  const noCheckins = data.no_checkin_today;

  return (
    <div className="min-h-screen bg-[#f5f8f8] text-slate-800">
      <Header />

      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 p-4 md:p-6 lg:flex-row lg:p-8">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Class Monitor
              </h1>
              <p className="text-base text-slate-500">
                Real-time tracking of active university sessions across campus.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
                <span className="material-symbols-outlined text-[20px]">
                  filter_list
                </span>
                Filter
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-[#00778a] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#00778a]/20 transition-all hover:bg-[#005f6e]">
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
                Export Report
              </button>
            </div>
          </header>

          <section className="rounded-2xl border border-[#00778a]/10 bg-gradient-to-r from-[#e6f5f7] via-white to-[#f2fbf7] p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#00778a]">
                  <span className="material-symbols-outlined text-[18px]">
                    sensors
                  </span>
                  Live Now
                </div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {activeSessions} active session{activeSessions !== 1 ? "s" : ""}
                </h2>
                {nextEndingSession ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Next ends{" "}
                    <span className="font-semibold text-slate-800">
                      {formatCountdown(
                        toMinutes(nextEndingSession.slot.start),
                        nextEndingSession.endMinutes,
                        nextEndingSession.nowMinutes
                      )}
                    </span>{" "}
                    · {nextEndingSession.item.name}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    No session is live right now.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {liveSessions.length ? (
                  liveSessions.map(({ item, slot }) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[#00778a]/20 bg-white px-3 py-1 text-xs font-semibold text-[#005f6e]"
                    >
                      {item.name} · {slot.start}-{slot.end}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    Standby mode
                  </span>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Active Sessions
                </p>
                <span className="rounded-md bg-green-50 p-1.5 text-[#14a14f]">
                  <span className="material-symbols-outlined text-[20px]">
                    podium
                  </span>
                </span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-slate-900">
                  {activeSessions}
                </p>
                <p className="mb-1 text-sm font-bold text-[#14a14f]">
                  live now
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Total Check-ins
                </p>
                <span className="rounded-md bg-blue-50 p-1.5 text-[#00778a]">
                  <span className="material-symbols-outlined text-[20px]">
                    groups
                  </span>
                </span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-slate-900">
                  {totalCheckins}
                </p>
                <p className="mb-1 text-sm font-bold text-[#14a14f]">
                  today
                </p>
              </div>
            </div>

            <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="absolute -right-2 -top-2 h-16 w-16 rounded-bl-full bg-[#f78359]/5" />
              <div className="relative z-10 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Pending Alerts
                </p>
                <span className="rounded-md bg-orange-50 p-1.5 text-[#f78359]">
                  <span className="material-symbols-outlined text-[20px]">
                    warning
                  </span>
                </span>
              </div>
              <div className="relative z-10 flex items-end gap-3">
                <p className="text-3xl font-bold text-slate-900">0</p>
                <p className="mb-1 text-sm font-medium text-slate-400">
                  Needs attention
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <span className="material-symbols-outlined text-[#00778a]">
                  live_tv
                </span>
                Live Class Sessions
              </h3>
              <div className="relative hidden w-full max-w-sm sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-[#00778a]/20"
                  placeholder="Search by course or professor..."
                  type="text"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
              {data.classes.map((item) => {
                const count = item.checkedCount ?? classCounts.get(item.id) ?? 0;
                const enrolled = item.enrolledCount ?? 0;
                const progress =
                  enrolled > 0 ? Math.round((count / enrolled) * 100) : 0;
                const isActive = Boolean(item.active || item.isActive);
                const activeSlot = getActiveSlot(item.schedule || [], now);
                const nextSlot = activeSlot
                  ? null
                  : getNextSlot(item.schedule || [], now);
                const sessionLabel = activeSlot
                  ? "Live session"
                  : nextSlot
                  ? `Next ${dayNames[nextSlot.day]}`
                  : "No session today";
                const sessionWindow = activeSlot
                  ? `${activeSlot.start}-${activeSlot.end}`
                  : nextSlot
                  ? `${nextSlot.start}-${nextSlot.end}`
                  : "--";
                const sessionMeta = activeSlot
                  ? formatCountdown(
                      toMinutes(activeSlot.start),
                      toMinutes(activeSlot.end),
                      now.getHours() * 60 + now.getMinutes()
                    )
                  : "standby";
                const attendanceLabel =
                  enrolled > 0
                    ? `${progress}% (${count}/${enrolled})`
                    : "No roster";
                return (
                  <ClassCard
                    key={item.id}
                    classId={item.id}
                    code={item.id.toUpperCase()}
                    title={item.name}
                    instructor="Staff"
                    room={item.room || "Room"}
                    attendance={attendanceLabel}
                    badge={isActive ? "Live" : "Idle"}
                    badgeTone={isActive ? "green" : "gray"}
                    progress={progress}
                    sessionLabel={sessionLabel}
                    sessionWindow={sessionWindow}
                    sessionMeta={sessionMeta}
                    highlight={isActive}
                    image="https://lh3.googleusercontent.com/aida-public/AB6AXuD24CxJaWNr4NqI-yFacSgnJ_lr1YCtXTnhBMTITH-0QkUsHE7bRM_MF1Ok7rLVTTlYl5quU-GqYEqjeTCtPdmfbV0uCJ8EODkGEIVaC1muFetGbIgpVgp3gvLUNTfhX_H8AtEO3gIeOyZBAtiUX4LOc6B4b4Heg3d8QfHjYzUEhv57e_JmG7YJLK-Ee4XTa7g9vbRfqch34HGGJiNCI5QcaYd4jAlpjCAViiA7YhXXK2gj0LcYpB0j0_GGfW4AP2zsO2PEuMmif7Ki"
                  />
                );
              })}
              {data.classes.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">
                  No classes available. Insert data in Supabase to populate this
                  section.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-96">
          <div className="sticky top-24 flex h-full max-h-[calc(100vh-140px)] flex-col gap-5 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[#00778a]">
                    bolt
                  </span>
                  Latest Check-ins
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  live feed
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {latestCheckins.length ? (
                  latestCheckins.map((item) => (
                    <CheckinFeedItem
                      key={item.name}
                      name={item.name}
                      classes={Array.from(item.classes)}
                      image={item.image}
                      ts={item.ts}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
                    No check-ins recorded yet.
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[#f78359]">
                    person_off
                  </span>
                  No Check-in Today
                </h3>
                <button className="text-xs font-semibold text-[#00778a] hover:text-[#005f6e]">
                  View All
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {noCheckins.length ? (
                  noCheckins.map((student, index) => {
                    const courseLabel = student.classes.length
                      ? student.classes.join(", ")
                      : "No class assigned";
                    return (
                      <AlertItem
                        key={student.id}
                        name={student.name}
                        studentNumber={student.student_number}
                        course={courseLabel}
                        badge="No check-in"
                        tone={index % 2 === 0 ? "peach" : "gray"}
                        image="https://lh3.googleusercontent.com/aida-public/AB6AXuD24CxJaWNr4NqI-yFacSgnJ_lr1YCtXTnhBMTITH-0QkUsHE7bRM_MF1Ok7rLVTTlYl5quU-GqYEqjeTCtPdmfbV0uCJ8EODkGEIVaC1muFetGbIgpVgp3gvLUNTfhX_H8AtEO3gIeOyZBAtiUX4LOc6B4b4Heg3d8QfHjYzUEhv57e_JmG7YJLK-Ee4XTa7g9vbRfqch34HGGJiNCI5QcaYd4jAlpjCAViiA7YhXXK2gj0LcYpB0j0_GGfW4AP2zsO2PEuMmif7Ki"
                      />
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
                    Everyone has checked in today.
                  </div>
                )}
              </div>
            </section>

            <div className="mt-2 border-t border-slate-100 pt-4">
              <p className="text-center text-xs text-slate-400">
                Last updated: Just now
              </p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

type ClassCardProps = {
  classId: string;
  code: string;
  title: string;
  instructor: string;
  room: string;
  attendance: string;
  badge: string;
  badgeTone: "green" | "teal" | "peach" | "gray";
  progress: number;
  image: string;
  sessionLabel: string;
  sessionWindow: string;
  sessionMeta: string;
  highlight?: boolean;
};

const ClassCard = ({
  classId,
  code,
  title,
  instructor,
  room,
  attendance,
  badge,
  badgeTone,
  progress,
  image,
  sessionLabel,
  sessionWindow,
  sessionMeta,
  highlight,
}: ClassCardProps) => {
  const badgeStyles = {
    green: "bg-green-50 text-[#14a14f] border border-green-100",
    teal: "bg-sky-50 text-[#00778a] border border-sky-100",
    peach: "bg-orange-50 text-[#f78359] border border-orange-100",
    gray: "bg-gray-100 text-slate-500 border border-slate-200",
  };
  const barColor =
    badgeTone === "peach"
      ? "bg-[#f78359]"
      : badgeTone === "green"
      ? "bg-[#14a14f]"
      : "bg-[#00778a]";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        highlight
          ? "border-[#f78359]/20 bg-white"
          : "border-slate-100 bg-white"
      }`}
    >
      {highlight && (
        <div className="absolute right-0 top-0 h-full w-1 bg-[#f78359] rounded-r-xl" />
      )}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900">{code}</h4>
          <p className="text-sm text-slate-500">{title}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            badgeStyles[badgeTone]
          }`}
        >
          {badgeTone !== "gray" && (
            <span
              className={`size-1.5 rounded-full ${
                badgeTone === "peach"
                  ? "bg-[#f78359]"
                  : badgeTone === "green"
                  ? "bg-[#14a14f]"
                  : "bg-[#00778a]"
              } animate-pulse`}
            />
          )}
          {badge}
        </span>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <div
          className="size-8 rounded-full bg-slate-200 bg-cover bg-center"
          style={{ backgroundImage: `url('${image}')` }}
        />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">
            {instructor}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="material-symbols-outlined text-[12px]">
              location_on
            </span>
            {room}
          </span>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-600">{sessionLabel}</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-slate-800">{sessionWindow}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#00778a]">
          {sessionMeta}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-slate-600">Attendance</span>
          <span
            className={
              badgeTone === "peach"
                ? "text-[#f78359]"
                : badgeTone === "green"
                ? "text-[#14a14f]"
                : "text-[#00778a]"
            }
          >
            {attendance}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full ${barColor} rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={`/classes/${classId}`}
          className="flex items-center gap-1 text-sm font-bold text-[#00778a] hover:text-[#005f6e]"
        >
          View Details
          <span className="material-symbols-outlined text-[16px]">
            arrow_forward
          </span>
        </a>
      </div>
    </div>
  );
};

type CheckinFeedItemProps = {
  name: string;
  classes: string[];
  ts: string;
  image?: string;
};

const CheckinFeedItem = ({ name, classes, ts, image }: CheckinFeedItemProps) => {
  const time = new Date(ts);
  const timeLabel = Number.isNaN(time.getTime())
    ? "--:--"
    : time.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
  const classLabel = classes.join(", ");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div
        className="size-10 rounded-full bg-slate-200 bg-cover bg-center"
        style={{
          backgroundImage: image ? `url('${image}')` : undefined,
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">
          {classLabel} · {timeLabel}
        </p>
      </div>
      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#00778a]">
        check-in
      </span>
    </div>
  );
};

type AlertItemProps = {
  name: string;
  studentNumber?: string;
  course: string;
  badge: string;
  tone: "peach" | "gray";
  image: string;
};

const AlertItem = ({
  name,
  studentNumber,
  course,
  badge,
  tone,
  image,
}: AlertItemProps) => {
  const isPeach = tone === "peach";
  return (
    <div
      className={`flex gap-4 rounded-xl border p-4 transition-colors ${
        isPeach
          ? "border-orange-100 bg-orange-50/50 hover:bg-orange-50"
          : "border-slate-100 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <div className="shrink-0">
        <div
          className="size-11 rounded-full bg-slate-200 bg-cover bg-center"
          style={{ backgroundImage: `url('${image}')` }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h5 className="truncate text-sm font-bold text-slate-900">{name}</h5>
            {studentNumber && (
              <p className="mt-0.5 text-xs text-slate-400">{studentNumber}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded border px-2 py-1 text-[10px] font-bold ${
              isPeach
                ? "border-orange-100 bg-white text-[#f78359]"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            {badge}
          </span>
        </div>
        <p className="truncate text-xs text-slate-500">{course}</p>
      </div>
    </div>
  );
};
