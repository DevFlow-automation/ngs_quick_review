"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Teacher {
  id: string;
  fullName: string;
  subject: string;
  role: "TEACHER" | "ADMIN";
}

interface Student {
  id: string;
  fullName: string;
  markerId: number;
}

interface ClassItem {
  id: string;
  name: string;
  students: Student[];
}

interface QuizItem {
  id: string;
  title: string;
  subject: string | null;
  isShared: boolean;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  _count: { questions: number };
}

interface SessionItem {
  id: string;
  code: string;
  status: "ACTIVE" | "FINISHED";
  teacherId: string | null;
  createdAt: string;
  class: { name: string };
  quiz: { title: string; subject: string | null };
  teacher: { fullName: string } | null;
  _count: { responses: number };
}

interface DraftQuestion {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
}

function emptyQuestion(): DraftQuestion {
  return {
    text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
  };
}

function parseBulkQuestions(raw: string): DraftQuestion[] {
  const blocks = raw
    .trim()
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const parsed: DraftQuestion[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 5) continue;

    const questionText = lines[0].replace(/^\d+[.)]\s*/, "").trim();
    const opts: Record<"A" | "B" | "C" | "D", string> = {
      A: "",
      B: "",
      C: "",
      D: "",
    };
    let correct: "A" | "B" | "C" | "D" = "A";
    const keys: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

    for (let i = 1; i <= 4; i++) {
      let line = lines[i] || "";
      const isMarked = /(\*|\+)$/.test(line);
      if (isMarked) {
        correct = keys[i - 1];
        line = line.replace(/(\*|\+)$/, "").trim();
      }
      line = line.replace(/^[A-Da-dА-Да-д][).:\]]\s*/, "").trim();
      opts[keys[i - 1]] = line;
    }

    parsed.push({
      text: questionText,
      optionA: opts.A,
      optionB: opts.B,
      optionC: opts.C,
      optionD: opts.D,
      correctOption: correct,
    });
  }

  return parsed;
}

export default function HomePage() {
  const [tab, setTab] = useState<"launch" | "quiz" | "classes">("launch");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [showNewTeacher, setShowNewTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherSubject, setNewTeacherSubject] = useState("");
  const [newTeacherPin, setNewTeacherPin] = useState("");

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [createdSessionCode, setCreatedSessionCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [quizTitle, setQuizTitle] = useState("");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizShared, setQuizShared] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  const [newClassName, setNewClassName] = useState("");
  const [newClassStudents, setNewClassStudents] = useState("");

  const loadAll = useCallback(
    async (teacherId?: string) => {
      const [tRes, cRes, qRes, sRes] = await Promise.all([
        fetch("/api/teachers", { cache: "no-store" }),
        fetch("/api/classes", { cache: "no-store" }),
        fetch(`/api/quizzes${teacherId ? `?teacherId=${teacherId}` : ""}`, {
          cache: "no-store",
        }),
        fetch("/api/sessions", { cache: "no-store" }),
      ]);

      if (tRes.ok) {
        const tData: Teacher[] = await tRes.json();
        setTeachers(tData);
        if (tData.length > 0 && !selectedTeacherId) setSelectedTeacherId(tData[0].id);
      }
      if (cRes.ok) {
        const cData: ClassItem[] = await cRes.json();
        setClasses(cData);
        if (cData.length > 0 && !selectedClassId) setSelectedClassId(cData[0].id);
      }
      if (qRes.ok) {
        const qData: QuizItem[] = await qRes.json();
        setQuizzes(qData);
        if (qData.length > 0 && !selectedQuizId) setSelectedQuizId(qData[0].id);
      }
      if (sRes.ok) {
        setSessions(await sRes.json());
      }
    },
    [selectedClassId, selectedQuizId, selectedTeacherId]
  );

  useEffect(() => {
    let saved: Teacher | null = null;
    try {
      const raw = localStorage.getItem("school_plickers_teacher");
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (saved) setCurrentTeacher(saved);
    loadAll(saved?.id);
  }, [loadAll]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", teacherId: selectedTeacherId, pinCode: loginPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Ошибка входа");
      return;
    }
    setCurrentTeacher(data);
    setLoginPin("");
    try {
      localStorage.setItem("school_plickers_teacher", JSON.stringify(data));
    } catch {}
    loadAll(data.id);
  }

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: newTeacherName,
        subject: newTeacherSubject,
        pinCode: newTeacherPin,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Ошибка регистрации");
      return;
    }
    setCurrentTeacher(data);
    setShowNewTeacher(false);
    setNewTeacherName("");
    setNewTeacherSubject("");
    setNewTeacherPin("");
    try {
      localStorage.setItem("school_plickers_teacher", JSON.stringify(data));
    } catch {}
    loadAll(data.id);
  }

  function handleLogout() {
    setCurrentTeacher(null);
    try {
      localStorage.removeItem("school_plickers_teacher");
    } catch {}
    loadAll();
  }

  async function handleLaunchSession() {
    setStatusMsg(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: selectedClassId,
        quizId: selectedQuizId,
        teacherId: currentTeacher?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Ошибка запуска");
      return;
    }
    setCreatedSessionCode(data.code);
    loadAll(currentTeacher?.id);
  }

  async function handleDeleteSession(code: string) {
    if (!currentTeacher) return;
    setStatusMsg(null);
    const res = await fetch(`/api/sessions/${code}?teacherId=${currentTeacher.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Не удалось удалить опрос");
      return;
    }
    if (createdSessionCode === code) setCreatedSessionCode(null);
    loadAll(currentTeacher.id);
  }

  async function handleDeleteQuiz(id: string) {
    if (!currentTeacher) return;
    setStatusMsg(null);
    const res = await fetch(`/api/quizzes/${id}?teacherId=${currentTeacher.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Не удалось удалить тест");
      return;
    }
    if (selectedQuizId === id) setSelectedQuizId("");
    loadAll(currentTeacher.id);
  }

  function handleParseBulk() {
    const parsed = parseBulkQuestions(bulkText);
    if (parsed.length === 0) {
      setStatusMsg(
        "Не удалось распознать вопросы. Проверьте формат: 1 строка вопроса + 4 строки A) B) C) D)."
      );
      return;
    }
    setStatusMsg(`Распознано вопросов: ${parsed.length}`);
    setQuestions(parsed);
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: quizTitle,
        subject: quizSubject || currentTeacher?.subject,
        teacherId: currentTeacher?.id,
        isShared: quizShared,
        questions,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Ошибка сохранения теста");
      return;
    }
    setQuizTitle("");
    setBulkText("");
    setQuestions([emptyQuestion()]);
    setSelectedQuizId(data.id);
    setTab("launch");
    setStatusMsg("Тест сохранён!");
    loadAll(currentTeacher?.id);
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const students = newClassStudents.split("\n");
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClassName,
        students,
        teacherId: currentTeacher?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Ошибка создания класса");
      return;
    }
    setNewClassName("");
    setNewClassStudents("");
    setSelectedClassId(data.id);
    setStatusMsg(`Класс ${data.name} создан (${data.students.length} уч.)`);
    loadAll(currentTeacher?.id);
  }

  const isAdmin = currentTeacher?.role === "ADMIN";
  const selectedQuizObj = quizzes.find((q) => q.id === selectedQuizId);
  const canDeleteSelectedQuiz =
    Boolean(currentTeacher) &&
    Boolean(selectedQuizObj) &&
    (isAdmin || selectedQuizObj?.teacherId === currentTeacher?.id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              Q
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">NGS Quick Review</h1>
              <p className="text-xs text-slate-500">Быстрая проверка знаний по ArUco-карточкам</p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl text-sm">
            <button
              type="button"
              onClick={() => setTab("launch")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                tab === "launch" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"
              }`}
            >
              Запуск опроса
            </button>
            <button
              type="button"
              onClick={() => setTab("quiz")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                tab === "quiz" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"
              }`}
            >
              Создать тест
            </button>
            <button
              type="button"
              onClick={() => setTab("classes")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
                tab === "classes" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"
              }`}
            >
              Классы
            </button>
            <Link
              href="/cards"
              className="px-3.5 py-1.5 rounded-lg font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Карточки
            </Link>
          </nav>

          <div className="text-sm">
            {currentTeacher ? (
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                  {currentTeacher.fullName} ({isAdmin ? "Админ" : currentTeacher.subject})
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-slate-500 hover:text-rose-600"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Гостевой режим</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {!currentTeacher && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            {!showNewTeacher ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <form onSubmit={handleLogin} className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-medium text-slate-700">Профиль учителя:</span>
                  {teachers.length > 0 ? (
                    <>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} ({t.subject})
                          </option>
                        ))}
                      </select>
                      <input
                        type="password"
                        placeholder="PIN-код"
                        value={loginPin}
                        onChange={(e) => setLoginPin(e.target.value)}
                        className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium"
                      >
                        Войти
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Пока нет профилей</span>
                  )}
                </form>
                <button
                  type="button"
                  onClick={() => setShowNewTeacher(true)}
                  className="text-sm text-indigo-600 font-medium hover:underline"
                >
                  + Новый учитель
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateTeacher} className="flex flex-wrap items-end gap-3">
                <label className="text-xs">
                  <span className="block text-slate-600 mb-1">ФИО учителя</span>
                  <input
                    required
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="Например: Анна Петрова"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-slate-600 mb-1">Предмет</span>
                  <input
                    required
                    value={newTeacherSubject}
                    onChange={(e) => setNewTeacherSubject(e.target.value)}
                    placeholder="Физика"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-slate-600 mb-1">PIN-код (4 цифры)</span>
                  <input
                    required
                    value={newTeacherPin}
                    onChange={(e) => setNewTeacherPin(e.target.value)}
                    placeholder="1234"
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTeacher(false)}
                  className="px-3 py-1.5 text-sm text-slate-500"
                >
                  Отмена
                </button>
              </form>
            )}
          </section>
        )}

        {statusMsg && (
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm">
            {statusMsg}
          </div>
        )}

        {tab === "launch" && (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-lg">Запустить быстрый опрос на уроке</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">1. Выберите класс</span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.students.length} уч.)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-600">2. Выберите тест</span>
                    {canDeleteSelectedQuiz && selectedQuizObj && (
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(selectedQuizObj.id)}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Удалить тест
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedQuizId}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                  >
                    {quizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q._count.questions} вопр.)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={!selectedClassId || !selectedQuizId}
                  onClick={handleLaunchSession}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm disabled:opacity-50"
                >
                  Запустить опрос
                </button>
              </div>

              {createdSessionCode && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-emerald-700 font-semibold uppercase">
                      Сессия создана! Код:
                    </div>
                    <div className="text-2xl font-mono font-bold text-emerald-950">
                      {createdSessionCode}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/board/${createdSessionCode}`}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
                    >
                      Открыть доску
                    </Link>
                    <Link
                      href={`/scan/${createdSessionCode}`}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium"
                    >
                      Открыть сканер
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 font-semibold">Недавние опросы</div>
              <div className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const canDelete =
                    Boolean(currentTeacher) &&
                    (isAdmin || s.teacherId === currentTeacher?.id);
                  return (
                    <div
                      key={s.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100">
                            {s.code}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {s.class.name} — {s.quiz.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Ответов в базе: {s._count.responses}
                          {s.teacher ? ` • ${s.teacher.fullName}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <Link
                          href={`/board/${s.code}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100"
                        >
                          Доска
                        </Link>
                        <Link
                          href={`/scan/${s.code}`}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Сканер
                        </Link>
                        <Link
                          href={`/report/${s.code}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Отчёт
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s.code)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {tab === "quiz" && (
          <form onSubmit={handleSaveQuiz} className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-lg">Новый тест</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Название темы</span>
                  <input
                    required
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="Например: Закон Ома (экспресс)"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Предмет</span>
                  <input
                    value={quizSubject}
                    onChange={(e) => setQuizSubject(e.target.value)}
                    placeholder={currentTeacher?.subject || "Физика"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={quizShared}
                  onChange={(e) => setQuizShared(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Сделать тест общим для других учителей школы</span>
              </label>
            </div>

            <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-indigo-950">Умная вставка из Word / Telegram</h3>
                  <p className="text-xs text-indigo-700">
                    Разделяйте вопросы пустой строкой. Поставьте <code>*</code> в конце правильного варианта.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleParseBulk}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Распознать текст
                </button>
              </div>
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`1. Чему равна сила тока при напряжении 12В и сопротивлении 4 Ом?\nA) 3 А *\nB) 48 А\nC) 8 А\nD) 16 А`}
                className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-sm font-mono"
              />
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-indigo-600">Вопрос #{idx + 1}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <input
                    required
                    value={q.text}
                    onChange={(e) => {
                      const next = [...questions];
                      next[idx] = { ...q, text: e.target.value };
                      setQuestions(next);
                    }}
                    placeholder="Текст вопроса"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(["A", "B", "C", "D"] as const).map((letter) => {
                      const field = `option${letter}` as
                        | "optionA"
                        | "optionB"
                        | "optionC"
                        | "optionD";
                      return (
                        <div key={letter} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...questions];
                              next[idx] = { ...q, correctOption: letter };
                              setQuestions(next);
                            }}
                            title="Нажмите, чтобы отметить правильный ответ"
                            className={`w-9 h-9 rounded-lg font-bold text-sm shrink-0 transition ${
                              q.correctOption === letter
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {letter}
                          </button>
                          <input
                            required
                            value={q[field]}
                            onChange={(e) => {
                              const next = [...questions];
                              next[idx] = { ...q, [field]: e.target.value };
                              setQuestions(next);
                            }}
                            placeholder={`Вариант ${letter}`}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setQuestions([...questions, emptyQuestion()])}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
              >
                + Добавить вопрос
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
              >
                Сохранить тест ({questions.length} вопр.)
              </button>
            </div>
          </form>
        )}

        {tab === "classes" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {isAdmin ? (
              <form
                onSubmit={handleCreateClass}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 h-fit"
              >
                <h2 className="font-semibold text-lg">Добавить класс (из Excel / списка)</h2>
                <label className="block text-sm">
                  <span className="text-slate-600 block mb-1">Название класса</span>
                  <input
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Например: 7-Б"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600 block mb-1">
                    Список учеников (каждый с новой строки — номера карточек присвоятся автоматически)
                  </span>
                  <textarea
                    required
                    rows={8}
                    value={newClassStudents}
                    onChange={(e) => setNewClassStudents(e.target.value)}
                    placeholder={"Иван Иванов\nАлия Смирнова\nРустам Каримов"}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm"
                >
                  Создать класс и раздать номера карточек
                </button>
              </form>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit text-sm text-slate-600">
                Добавлять новые классы и учеников может только <strong>администратор</strong>. Войдите в профиль с правами администратора.
              </div>
            )}

            <div className="space-y-4">
              {classes.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <span className="text-xs text-slate-500">{c.students.length} учеников</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {c.students.map((st) => (
                      <div key={st.id} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-mono font-bold text-indigo-600 mr-1.5">
                          #{st.markerId}
                        </span>
                        <span>{st.fullName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
