"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";

type StudentRow = {
  id: string;
  name: string;
  face_id: string | null;
  student_number: string | null;
  face_enrolled: boolean | null;
};

type ClassRow = {
  id: string;
  name: string;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
};

type AdminData = {
  students: StudentRow[];
  enrollments: EnrollmentRow[];
  classes: ClassRow[];
};

type Notice = {
  type: "error" | "success";
  message: string;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function StudentsAdmin() {
  const [data, setData] = useState<AdminData>({
    students: [],
    enrollments: [],
    classes: [],
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newFaceId, setNewFaceId] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, Partial<StudentRow>>>({});
  const [selectMap, setSelectMap] = useState<Record<string, string>>({});

  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    data.classes.forEach((row) => map.set(row.id, row.name));
    return map;
  }, [data.classes]);

  const enrollmentsByStudent = useMemo(() => {
    const map = new Map<string, EnrollmentRow[]>();
    data.enrollments.forEach((row) => {
      const list = map.get(row.student_id) || [];
      list.push(row);
      map.set(row.student_id, list);
    });
    return map;
  }, [data.enrollments]);

  const showNotice = useCallback((type: Notice["type"], message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => {
      setNotice((current) => (current?.message === message ? null : current));
    }, 4500);
  }, []);

  const requestJson = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        showNotice("error", msg.error || "Request failed.");
        return null;
      }
      return res.json().catch(() => ({}));
    } catch {
      showNotice("error", "Network error. Please try again.");
      return null;
    }
  }, [showNotice]);

  const load = useCallback(async () => {
    const res = await requestJson("/api/admin/students", { cache: "no-store" });
    if (!res) {
      setLoading(false);
      return;
    }
    const json = res as AdminData;
    setData({
      students: json.students || [],
      enrollments: json.enrollments || [],
      classes: json.classes || [],
    });
    setLoading(false);
  }, [requestJson]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter((row) => {
      const number = row.student_number?.toLowerCase() || "";
      const faceId = row.face_id?.toLowerCase() || "";
      return (
        row.name.toLowerCase().includes(q) ||
        number.includes(q) ||
        faceId.includes(q)
      );
    });
  }, [data.students, query]);

  const createStudent = async () => {
    if (!newName.trim()) {
      showNotice("error", "Student name is required.");
      return;
    }
    if (!newNumber.trim()) {
      showNotice("error", "Student number is required.");
      return;
    }
    const faceId = newFaceId.trim() || slugify(newName);
    const res = await requestJson("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        student_number: newNumber.trim(),
        face_id: faceId,
        face_enrolled: false,
      }),
    });
    if (!res) return;
    showNotice("success", "Student added.");
    setNewName("");
    setNewNumber("");
    setNewFaceId("");
    load();
  };

  const saveStudent = async (id: string) => {
    const current = data.students.find((student) => student.id === id);
    const name = (editing[id]?.name ?? "").trim();
    const studentNumber = (editing[id]?.student_number ?? "").trim();
    const faceId = (editing[id]?.face_id ?? "").trim();
    const faceEnrolled = editing[id]?.face_enrolled ?? current?.face_enrolled ?? false;
    if (!name || !studentNumber) {
      showNotice("error", "Name and student number are required.");
      return;
    }
    const res = await requestJson("/api/admin/students", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name,
        student_number: studentNumber,
        face_id: faceId || slugify(name),
        face_enrolled: faceEnrolled,
      }),
    });
    if (!res) return;
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showNotice("success", "Student updated.");
    load();
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    const res = await requestJson("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res) return;
    showNotice("success", "Student deleted.");
    load();
  };

  const addEnrollment = async (studentId: string) => {
    const classId = selectMap[studentId];
    if (!classId) {
      showNotice("error", "Select a class first.");
      return;
    }
    const res = await requestJson("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "enrollment",
        student_id: studentId,
        class_id: classId,
      }),
    });
    if (!res) return;
    showNotice("success", "Enrollment added.");
    setSelectMap((prev) => ({ ...prev, [studentId]: "" }));
    load();
  };

  const removeEnrollment = async (enrollmentId: string) => {
    const res = await requestJson("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "enrollment", id: enrollmentId }),
    });
    if (!res) return;
    showNotice("success", "Enrollment removed.");
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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Students Control</h1>
              <p className="text-sm text-slate-500">
                Manage student identities, face linkage, and enrollments.
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_1fr_1fr_auto]">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Student name"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Student number (NIM)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={newFaceId}
              onChange={(e) => setNewFaceId(e.target.value)}
              placeholder="Face ID (auto from name)"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={createStudent}
              className="rounded-lg bg-[#00778a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005f6e]"
            >
              Add Student
            </button>
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Total students: <span className="font-semibold text-slate-700">{data.students.length}</span>
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, NIM, or face id"
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {loading && <p className="text-sm text-slate-500">Loading...</p>}

          <div className="space-y-5">
            {filtered.map((student) => {
              const enrolled = enrollmentsByStudent.get(student.id) || [];
              return (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs uppercase text-slate-400">
                          {student.student_number || "No NIM"}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            student.face_enrolled
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {student.face_enrolled ? "Face linked" : "Face missing"}
                        </span>
                      </div>
                      <input
                        value={editing[student.id]?.name ?? student.name}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [student.id]: {
                              ...prev[student.id],
                              name: e.target.value,
                              student_number: prev[student.id]?.student_number ?? student.student_number ?? "",
                              face_id: prev[student.id]?.face_id ?? student.face_id ?? "",
                            },
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={editing[student.id]?.student_number ?? student.student_number ?? ""}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...prev[student.id],
                                name: prev[student.id]?.name ?? student.name,
                                student_number: e.target.value,
                                face_id: prev[student.id]?.face_id ?? student.face_id ?? "",
                              },
                            }))
                          }
                          placeholder="Student number (NIM)"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        />
                        <input
                          value={editing[student.id]?.face_id ?? student.face_id ?? ""}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...prev[student.id],
                                name: prev[student.id]?.name ?? student.name,
                                student_number: prev[student.id]?.student_number ?? student.student_number ?? "",
                                face_id: e.target.value,
                                face_enrolled: prev[student.id]?.face_enrolled ?? student.face_enrolled ?? false,
                              },
                            }))
                          }
                          placeholder="Face ID"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveStudent(student.id)}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => deleteStudent(student.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Enrollments
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {enrolled.map((row) => (
                        <span
                          key={row.id}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                        >
                          {classMap.get(row.class_id) || row.class_id}
                          <button
                            onClick={() => removeEnrollment(row.id)}
                            className="text-red-500"
                          >
                            x
                          </button>
                        </span>
                      ))}
                      {enrolled.length === 0 && (
                        <span className="text-xs text-slate-400">No classes yet.</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        value={selectMap[student.id] || ""}
                        onChange={(e) =>
                          setSelectMap((prev) => ({
                            ...prev,
                            [student.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select class</option>
                        {data.classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => addEnrollment(student.id)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        Add Enrollment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-slate-400">No students found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
