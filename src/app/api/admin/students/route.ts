import { NextRequest, NextResponse } from "next/server";

const supabaseFetch = async <T>(path: string, init?: RequestInit) => {
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
  if (!res.ok) {
    throw new Error(`Supabase error ${res.status}`);
  }
  const text = await res.text();
  if (!text) {
    return [] as T;
  }
  return JSON.parse(text) as T;
};

export async function GET() {
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";
  const enrollmentsTable = process.env.SUPABASE_ENROLLMENTS_TABLE || "enrollments";
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";

  try {
    const students = await supabaseFetch<Array<{ id: string; name: string; face_id: string | null; student_number: string | null; face_enrolled: boolean | null }>>(
      `${studentsTable}?select=id,name,face_id,student_number,face_enrolled&order=name.asc`
    );
    const enrollments = await supabaseFetch<
      Array<{ id: string; student_id: string; class_id: string }>
    >(`${enrollmentsTable}?select=id,student_id,class_id`);
    const classes = await supabaseFetch<Array<{ id: string; name: string }>>(
      `${classesTable}?select=id,name&order=name.asc`
    );
    return NextResponse.json({ students, enrollments, classes });
  } catch (err) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const kind = body.kind || "student";
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";
  const enrollmentsTable = process.env.SUPABASE_ENROLLMENTS_TABLE || "enrollments";

  try {
    if (kind === "enrollment") {
      const payload = {
        student_id: body.student_id,
        class_id: body.class_id,
      };
      const res = await supabaseFetch(`${enrollmentsTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      return NextResponse.json(res);
    }

    const payload = {
      name: body.name,
      face_id: body.face_id,
      student_number: body.student_number,
      face_enrolled: Boolean(body.face_enrolled),
    };
    const res = await supabaseFetch(`${studentsTable}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";

  try {
    const res = await supabaseFetch(`${studentsTable}?id=eq.${body.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: body.name,
        face_id: body.face_id,
        student_number: body.student_number,
        face_enrolled: body.face_enrolled,
      }),
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const kind = body.kind || "student";
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";
  const enrollmentsTable = process.env.SUPABASE_ENROLLMENTS_TABLE || "enrollments";

  try {
    if (kind === "enrollment") {
      const res = await supabaseFetch(`${enrollmentsTable}?id=eq.${body.id}`, {
        method: "DELETE",
      });
      return NextResponse.json(res);
    }

    await supabaseFetch(`${enrollmentsTable}?student_id=eq.${body.id}`, {
      method: "DELETE",
    });
    const res = await supabaseFetch(`${studentsTable}?id=eq.${body.id}`, {
      method: "DELETE",
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
