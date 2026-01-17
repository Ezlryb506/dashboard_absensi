import { NextRequest, NextResponse } from "next/server";

const supabaseFetch = async (path: string, init?: RequestInit) => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !key) {
    throw new Error("Supabase service key not set");
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  return res;
};

const parseSupabaseError = async (res: Response) => {
  try {
    const json = await res.json();
    return json?.message || JSON.stringify(json);
  } catch {
    return res.statusText || "Unknown error";
  }
};

const parseJsonOrNull = async (res: Response) => {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getCount = async (table: string, classId: string) => {
  const res = await supabaseFetch(
    `${table}?select=id&class_id=eq.${encodeURIComponent(classId)}`,
    {
      method: "HEAD",
      headers: {
        Prefer: "count=exact",
      },
    }
  );
  const range = res.headers.get("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const getActiveClassIds = async (schedulesTable: string) => {
  const schedulesRes = await supabaseFetch(
    `${schedulesTable}?select=class_id,day_of_week,start_time,end_time`
  );
  if (!schedulesRes.ok) {
    throw new Error(await parseSupabaseError(schedulesRes));
  }
  const schedules = (await schedulesRes.json()) as Array<{
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;

  const now = new Date();
  const day = now.getDay(); // Sunday=0
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const active = new Set<string>();
  for (const slot of schedules) {
    if (slot.day_of_week !== day) continue;
    const start = String(slot.start_time || "00:00").slice(0, 5);
    const end = String(slot.end_time || "23:59").slice(0, 5);
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) {
      continue;
    }
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (startMinutes <= nowMinutes && nowMinutes <= endMinutes) {
      active.add(slot.class_id);
    }
  }
  return Array.from(active);
};

export async function GET() {
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";
  const schedulesTable = process.env.SUPABASE_SCHEDULES_TABLE || "class_schedules";
  const classSessionsTable =
    process.env.SUPABASE_CLASS_SESSIONS_TABLE || "class_sessions";
  const checkinsTable = process.env.SUPABASE_CHECKINS_TABLE || "checkins";

  try {
    const classesRes = await supabaseFetch(
      `${classesTable}?select=id,name,active&order=id.asc`
    );
    const schedulesRes = await supabaseFetch(
      `${schedulesTable}?select=id,class_id,day_of_week,start_time,end_time&order=day_of_week.asc`
    );
    const sessionsRes = await supabaseFetch(
      `${classSessionsTable}?select=id,class_id,session_no,session_type,status,start_at,end_at&order=session_no.asc`
    );
    const classes = (await classesRes.json()) as Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
    const schedules = (await schedulesRes.json()) as Array<{
      id: string;
      class_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    const classSessions = (await sessionsRes.json()) as Array<{
      id: string;
      class_id: string;
      session_no: number;
      session_type: string;
      status: string;
      start_at: string | null;
      end_at: string | null;
    }>;

    const counts: Record<string, number> = {};
    for (const item of classes) {
      counts[item.id] = await getCount(checkinsTable, item.id);
    }

    return NextResponse.json({ classes, schedules, classSessions, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kind = body.kind || "class";
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";
  const schedulesTable = process.env.SUPABASE_SCHEDULES_TABLE || "class_schedules";
  const classSessionsTable =
    process.env.SUPABASE_CLASS_SESSIONS_TABLE || "class_sessions";
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";
  const enrollmentsTable = process.env.SUPABASE_ENROLLMENTS_TABLE || "enrollments";

  try {
    if (kind === "schedule") {
      const payload = {
        class_id: body.class_id,
        day_of_week: Number(body.day_of_week),
        start_time: body.start_time,
        end_time: body.end_time,
      };
      const res = await supabaseFetch(`${schedulesTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      return NextResponse.json(await parseJsonOrNull(res));
    }
    if (kind === "class_session") {
      const payload = {
        class_id: body.class_id,
        session_no: Number(body.session_no),
        session_type: body.session_type,
        status: body.status || "planned",
      };
      const res = await supabaseFetch(`${classSessionsTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      return NextResponse.json(await parseJsonOrNull(res));
    }
    if (kind === "enroll_all") {
      const studentsRes = await supabaseFetch(
        `${studentsTable}?select=id&order=created_at.asc`
      );
      if (!studentsRes.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(studentsRes) },
          { status: studentsRes.status }
        );
      }
      const students = (await studentsRes.json()) as Array<{ id: string }>;
      if (!students.length) {
        return NextResponse.json({ ok: true, inserted: 0 });
      }
      const payload = students.map((row) => ({
        student_id: row.id,
        class_id: body.class_id,
      }));
      const enrollRes = await supabaseFetch(`${enrollmentsTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!enrollRes.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(enrollRes) },
          { status: enrollRes.status }
        );
      }
      return NextResponse.json({ ok: true, inserted: students.length });
    }
    if (kind === "auto_open_today") {
      const nowIso = new Date().toISOString();
      const activeClassIds = await getActiveClassIds(schedulesTable);
      if (!activeClassIds.length) {
        return NextResponse.json({ ok: true, opened: 0, closed: 0 });
      }

      const openRes = await supabaseFetch(
        `${classSessionsTable}?select=id,class_id,status&status=eq.open`
      );
      if (!openRes.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(openRes) },
          { status: openRes.status }
        );
      }
      const openSessions = (await openRes.json()) as Array<{
        id: string;
        class_id: string;
        status: string;
      }>;

      let closed = 0;
      for (const session of openSessions) {
        if (!activeClassIds.includes(session.class_id)) {
          const closeRes = await supabaseFetch(
            `${classSessionsTable}?id=eq.${session.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ status: "closed", end_at: nowIso }),
            }
          );
          if (!closeRes.ok) {
            return NextResponse.json(
              { error: await parseSupabaseError(closeRes) },
              { status: closeRes.status }
            );
          }
          closed += 1;
        }
      }

      let opened = 0;
      for (const classId of activeClassIds) {
        const alreadyOpen = openSessions.find((sess) => sess.class_id === classId);
        if (alreadyOpen) continue;
        const plannedRes = await supabaseFetch(
          `${classSessionsTable}?select=id,status&class_id=eq.${classId}&status=eq.planned&order=session_no.asc&limit=1`
        );
        if (!plannedRes.ok) {
          return NextResponse.json(
            { error: await parseSupabaseError(plannedRes) },
            { status: plannedRes.status }
          );
        }
        const planned = (await plannedRes.json()) as Array<{ id: string }>;
        if (!planned.length) continue;
        const openRes = await supabaseFetch(
          `${classSessionsTable}?id=eq.${planned[0].id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({ status: "open", start_at: nowIso }),
          }
        );
        if (!openRes.ok) {
          return NextResponse.json(
            { error: await parseSupabaseError(openRes) },
            { status: openRes.status }
          );
        }
        opened += 1;
      }

      return NextResponse.json({ ok: true, opened, closed });
    }

    const payload = {
      id: body.id,
      name: body.name,
      active: Boolean(body.active),
    };
    const res = await supabaseFetch(`${classesTable}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: await parseSupabaseError(res) },
        { status: res.status }
      );
    }
    // Auto-generate 16 academic sessions per class
    const sessionsPayload = Array.from({ length: 16 }, (_, idx) => {
      const sessionNo = idx + 1;
      const sessionType =
        sessionNo === 8 ? "uts" : sessionNo === 16 ? "uas" : "regular";
      return {
        class_id: body.id,
        session_no: sessionNo,
        session_type: sessionType,
        status: "planned",
      };
    });
    const sessionsRes = await supabaseFetch(`${classSessionsTable}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(sessionsPayload),
    });
    if (!sessionsRes.ok) {
      return NextResponse.json(
        { error: await parseSupabaseError(sessionsRes) },
        { status: sessionsRes.status }
      );
    }
    return NextResponse.json(await parseJsonOrNull(res));
  } catch {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const kind = body.kind || "class";
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";
  const schedulesTable = process.env.SUPABASE_SCHEDULES_TABLE || "class_schedules";
  const classSessionsTable =
    process.env.SUPABASE_CLASS_SESSIONS_TABLE || "class_sessions";

  try {
    if (kind === "schedule") {
      const res = await supabaseFetch(`${schedulesTable}?id=eq.${body.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          day_of_week: Number(body.day_of_week),
          start_time: body.start_time,
          end_time: body.end_time,
        }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      return NextResponse.json(await parseJsonOrNull(res));
    }
    if (kind === "class_session") {
      const payload: Record<string, unknown> = {};
      if (body.session_no !== undefined) {
        payload.session_no = Number(body.session_no);
      }
      if (body.session_type !== undefined) {
        payload.session_type = body.session_type;
      }
      if (body.status !== undefined) {
        payload.status = body.status;
      }
      if (body.start_at !== undefined) {
        payload.start_at = body.start_at || null;
      }
      if (body.end_at !== undefined) {
        payload.end_at = body.end_at || null;
      }
      const res = await supabaseFetch(`${classSessionsTable}?id=eq.${body.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      return NextResponse.json(await parseJsonOrNull(res));
    }

    const res = await supabaseFetch(`${classesTable}?id=eq.${body.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: body.name,
        active: Boolean(body.active),
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: await parseSupabaseError(res) },
        { status: res.status }
      );
    }
    return NextResponse.json(await parseJsonOrNull(res));
  } catch {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const kind = body.kind || "class";
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";
  const schedulesTable = process.env.SUPABASE_SCHEDULES_TABLE || "class_schedules";
  const classSessionsTable =
    process.env.SUPABASE_CLASS_SESSIONS_TABLE || "class_sessions";
  const sessionsTable = process.env.SUPABASE_SESSIONS_TABLE || "sessions";

  try {
    if (kind === "schedule") {
      const res = await supabaseFetch(`${schedulesTable}?id=eq.${body.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      const payload = await parseJsonOrNull(res);
      return NextResponse.json(payload ?? { ok: true });
    }
    if (kind === "class_session") {
      const res = await supabaseFetch(`${classSessionsTable}?id=eq.${body.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: await parseSupabaseError(res) },
          { status: res.status }
        );
      }
      const payload = await parseJsonOrNull(res);
      return NextResponse.json(payload ?? { ok: true });
    }

    await supabaseFetch(`${schedulesTable}?class_id=eq.${body.id}`, {
      method: "DELETE",
    });
    await supabaseFetch(`${classSessionsTable}?class_id=eq.${body.id}`, {
      method: "DELETE",
    });
    await supabaseFetch(`${sessionsTable}?class_id=eq.${body.id}`, {
      method: "DELETE",
    });
    const res = await supabaseFetch(`${classesTable}?id=eq.${body.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: await parseSupabaseError(res) },
        { status: res.status }
      );
    }
    const payload = await parseJsonOrNull(res);
    return NextResponse.json(payload ?? { ok: true });
  } catch {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
