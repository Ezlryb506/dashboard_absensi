import { NextRequest, NextResponse } from "next/server";

const supabaseFetch = async <T>(path: string) => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) {
    throw new Error("Supabase key not set");
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase error ${res.status}`);
  }
  return (await res.json()) as T;
};

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("class_id");
  if (!classId) {
    return NextResponse.json({ error: "class_id required" }, { status: 400 });
  }
  const table = process.env.SUPABASE_CLASS_SESSIONS_TABLE || "class_sessions";
  try {
    const rows = await supabaseFetch<
      Array<{
        id: string;
        class_id: string;
        session_no: number;
        session_type: string;
        status: string;
        start_at: string | null;
        end_at: string | null;
      }>
    >(
      `${table}?select=id,class_id,session_no,session_type,status,start_at,end_at&class_id=eq.${encodeURIComponent(
        classId
      )}&order=session_no.asc`
    );
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
