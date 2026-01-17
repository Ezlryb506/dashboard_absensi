import dummy from "@/data/dummy.json";

export type ScheduleSlot = {
  day: number;
  start: string;
  end: string;
};

export type ClassItem = {
  id: string;
  name: string;
  room?: string;
  schedule: ScheduleSlot[];
  isActive?: boolean;
  enrolledCount?: number;
  checkedCount?: number;
};

export type CheckinItem = {
  id: string;
  class_id: string;
  name: string;
  ts: string;
  sim: number;
  image_url?: string;
};

export type NoCheckinItem = {
  id: string;
  name: string;
  student_number?: string;
  classes: string[];
};

export type DashboardData = {
  now: string;
  active_class: ClassItem | null;
  classes: ClassItem[];
  checkins: CheckinItem[];
  total_today: number;
  no_checkin_today: NoCheckinItem[];
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map((v) => Number(v));
  return h * 60 + m;
};

const withActiveFlag = (classes: ClassItem[], now: Date) => {
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return classes.map((item) => {
    const isActive = item.schedule.some((slot) => {
      if (slot.day !== day) return false;
      const start = toMinutes(slot.start);
      const end = toMinutes(slot.end);
      return nowMinutes >= start && nowMinutes <= end;
    });
    return { ...item, isActive };
  });
};

export const formatSchedule = (schedule: ScheduleSlot[]) => {
  if (!schedule.length) return "No schedule";
  return schedule
    .map((slot) => `${dayNames[slot.day]} ${slot.start}-${slot.end}`)
    .join(", ");
};

const getDummyData = (): DashboardData => {
  const now = new Date();
  const classes = withActiveFlag(dummy.classes as ClassItem[], now);
  const activeClass = classes.find((item) => item.isActive) || null;

  const checkins = [...(dummy.checkins as CheckinItem[])]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 12);
  const countMap = new Map<string, number>();
  checkins.forEach((item) => {
    countMap.set(item.class_id, (countMap.get(item.class_id) || 0) + 1);
  });
  const classesWithCounts = classes.map((item) => ({
    ...item,
    enrolledCount: 30,
    checkedCount: countMap.get(item.id) || 0,
  }));

  return {
    now: now.toISOString(),
    active_class: activeClass,
    classes: classesWithCounts,
    checkins,
    total_today: checkins.length,
    no_checkin_today: [],
  };
};

const fetchSupabase = async <T>(path: string) => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
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

type ScheduleRow = {
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type SupabaseCheckin = {
  id: string;
  class_id: string;
  person_name: string;
  ts: string;
  sim: number;
  image_url?: string;
  student_id?: string;
};

const getSupabaseData = async (): Promise<DashboardData> => {
  const now = new Date();
  const day = now.getDay();
  const classesTable = process.env.SUPABASE_CLASSES_TABLE || "classes";
  const checkinsTable = process.env.SUPABASE_CHECKINS_TABLE || "checkins";
  const schedulesTable = process.env.SUPABASE_SCHEDULES_TABLE || "class_schedules";
  const enrollmentsTable = process.env.SUPABASE_ENROLLMENTS_TABLE || "enrollments";
  const studentsTable = process.env.SUPABASE_STUDENTS_TABLE || "students";

  const classRows = await fetchSupabase<Array<ClassItem & { active?: boolean }>>(
    `${classesTable}?select=id,name,active`
  );
  const scheduleRows = await fetchSupabase<ScheduleRow[]>(
    `${schedulesTable}?select=class_id,day_of_week,start_time,end_time`
  );

  const scheduleMap = new Map<string, ScheduleSlot[]>();
  scheduleRows.forEach((row) => {
    const list = scheduleMap.get(row.class_id) || [];
    list.push({
      day: row.day_of_week,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
    });
    scheduleMap.set(row.class_id, list);
  });

  const classesWithSchedule = classRows.map((item) => ({
    id: item.id,
    name: item.name,
    schedule: scheduleMap.get(item.id) || [],
    isActive: Boolean(item.active),
  }));

  const todayClasses = classesWithSchedule.filter((item) =>
    item.schedule.some((slot) => slot.day === day)
  );
  const classes = scheduleRows.length
    ? withActiveFlag(todayClasses, now)
    : todayClasses;
  const todayClassIds = todayClasses.map((item) => item.id);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const checkins = await fetchSupabase<SupabaseCheckin[]>(
    `${checkinsTable}?select=id,class_id,person_name,ts,sim,image_url,student_id&ts=gte.${dayStart.toISOString()}&ts=lt.${dayEnd.toISOString()}&order=ts.desc&limit=12`
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      class_id: row.class_id,
      name: row.person_name,
      ts: row.ts,
      sim: row.sim,
      image_url: row.image_url,
    }))
  );

  let classesWithCounts = classes;
  if (todayClassIds.length) {
    const classFilter = todayClassIds.join(",");
    const enrollments = await fetchSupabase<
      Array<{ student_id: string; class_id: string }>
    >(
      `${enrollmentsTable}?select=student_id,class_id&class_id=in.(${classFilter})`
    );
    const enrollMap = new Map<string, Set<string>>();
    enrollments.forEach((row) => {
      if (!row.class_id || !row.student_id) return;
      const list = enrollMap.get(row.class_id) || new Set<string>();
      list.add(row.student_id);
      enrollMap.set(row.class_id, list);
    });

    const checkinRows = await fetchSupabase<
      Array<{ class_id: string; student_id: string }>
    >(
      `${checkinsTable}?select=class_id,student_id&ts=gte.${dayStart.toISOString()}&ts=lt.${dayEnd.toISOString()}&class_id=in.(${classFilter})`
    );
    const checkinMap = new Map<string, Set<string>>();
    checkinRows.forEach((row) => {
      if (!row.class_id || !row.student_id) return;
      const list = checkinMap.get(row.class_id) || new Set<string>();
      list.add(row.student_id);
      checkinMap.set(row.class_id, list);
    });

    classesWithCounts = classes.map((item) => ({
      ...item,
      enrolledCount: enrollMap.get(item.id)?.size || 0,
      checkedCount: checkinMap.get(item.id)?.size || 0,
    }));
  }

  let noCheckinToday: NoCheckinItem[] = [];
  if (todayClassIds.length) {
    const classFilter = todayClassIds.join(",");
    const enrollments = await fetchSupabase<
      Array<{ student_id: string; class_id: string }>
    >(
      `${enrollmentsTable}?select=student_id,class_id&class_id=in.(${classFilter})`
    );
    const studentIds = Array.from(
      new Set(enrollments.map((row) => row.student_id).filter(Boolean))
    );
    if (studentIds.length) {
      const studentFilter = studentIds.join(",");
      const students = await fetchSupabase<
        Array<{ id: string; name: string; student_number?: string }>
      >(`${studentsTable}?select=id,name,student_number&id=in.(${studentFilter})`);

      const checkedIds = await fetchSupabase<Array<{ student_id: string }>>(
        `${checkinsTable}?select=student_id&ts=gte.${dayStart.toISOString()}&ts=lt.${dayEnd.toISOString()}&student_id=in.(${studentFilter})`
      ).then((rows) =>
        new Set(rows.map((row) => row.student_id).filter(Boolean))
      );

      const classNameMap = new Map(classesWithSchedule.map((c) => [c.id, c.name]));
      const enrollMap = new Map<string, string[]>();
      enrollments.forEach((row) => {
        if (!row.student_id || !row.class_id) return;
        const list = enrollMap.get(row.student_id) || [];
        const label = classNameMap.get(row.class_id) || row.class_id;
        if (!list.includes(label)) list.push(label);
        enrollMap.set(row.student_id, list);
      });

      noCheckinToday = students
        .filter((student) => !checkedIds.has(student.id))
        .map((student) => ({
          id: student.id,
          name: student.name,
          student_number: student.student_number,
          classes: enrollMap.get(student.id) || [],
        }))
        .slice(0, 6);
    }
  }

  const activeClass = classes.find((item) => item.isActive) || null;
  return {
    now: now.toISOString(),
    active_class: activeClass,
    classes: classesWithCounts,
    checkins,
    total_today: checkins.length,
    no_checkin_today: noCheckinToday,
  };
};

export const getDashboardData = async (): Promise<DashboardData> => {
  const mode = process.env.DASHBOARD_DATA_MODE || "dummy";
  if (mode === "supabase") {
    try {
      return await getSupabaseData();
    } catch {
      return getDummyData();
    }
  }
  return getDummyData();
};
