import { NextRequest, NextResponse } from "next/server";

const fetchSupabase = async <T>(path: string) => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    throw new Error("Supabase env not set");
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase error ${res.status}`);
  }
  return (await res.json()) as T;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const classId = searchParams.get("class_id");
  const classSessionId = searchParams.get("class_session_id");
  const limit = searchParams.get("limit") || "50";
  if (!classId && !classSessionId) {
    return NextResponse.json(
      { error: "class_id or class_session_id required" },
      { status: 400 }
    );
  }
  const checkinsTable = process.env.SUPABASE_CHECKINS_TABLE || "checkins";
  try {
    const classParam = classId ? encodeURIComponent(classId) : "";
    const sessionParam = classSessionId ? encodeURIComponent(classSessionId) : "";
    const limitParam = encodeURIComponent(limit);
    const query = sessionParam
      ? `${checkinsTable}?select=id,class_id,person_name,ts,sim,image_url&class_session_id=eq.${sessionParam}&order=ts.desc&limit=${limitParam}`
      : `${checkinsTable}?select=id,class_id,person_name,ts,sim,image_url&class_id=eq.${classParam}&order=ts.desc&limit=${limitParam}`;
    const rows = await fetchSupabase<
      Array<{
        id: string;
        class_id: string;
        person_name: string;
        ts: string;
        sim: number;
        image_url?: string;
      }>
    >(query);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
