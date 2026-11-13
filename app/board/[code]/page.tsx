"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Student {
  id: string;
  fullName: string;
  markerId: number;
}

interface Question {
  id: string;
  order: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D" | null;
}

interface SessionResponse {
  studentId: string;
  answer: string;
  isCorrect: boolean | null;
}

interface BoardData {
  code: string;
  status: "ACTIVE" | "FINISHED";
  currentQuestionIdx: number;
  revealAnswer: boolean;
  className: string;
  quizTitle: string;
  students: Student[];
  questions: Question[];
  responses: SessionResponse[];
}

function BoardContent() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let active = true;

    async function fetchBoard() {
      try {
        const res = await fetch(`/api/sessions/${code}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Сессия не найдена");
        const json: BoardData = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    }

    fetchBoard();
    const timer = setInterval(fetchBoard, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-rose-400">Ошибка: {error}</h1>
          <p className="text-slate-400">Проверьте код сессии в адресе.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
        Загрузка доски...
      </div>
    );
  }

  const question = data.questions[data.currentQuestionIdx];
  const responseMap = new Map(data.responses.map((r) => [r.studentId, r]));
  const options: Array<{ key: "A" | "B" | "C" | "D"; text: string }> = question
    ? [
        { key: "A", text: question.optionA },
        { key: "B", text: question.optionB },
        { key: "C", text: question.optionC },
        { key: "D", text: question.optionD },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 flex flex-col justify-between">
      <div>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-8">
          <div>
            <div className="text-sm text-indigo-400 font-semibold uppercase tracking-wider">
              Класс {data.className} • Код: {data.code}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100">{data.quizTitle}</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm">
              Вопрос{" "}
              <span className="font-bold text-indigo-400">
                {data.currentQuestionIdx + 1}
              </span>{" "}
              из {data.questions.length}
            </div>
            <div className="px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-sm text-emerald-300">
              Ответило: <span className="font-bold">{data.responses.length}</span> /{" "}
              {data.students.length}
            </div>
            <Link
              href={`/report/${data.code}`}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition"
            >
              Отчёт
            </Link>
          </div>
        </header>

        {question ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8">
                <h2 className="text-2xl md:text-4xl font-semibold leading-snug text-white">
                  {question.text}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {options.map((opt) => {
                  const isCorrect =
                    data.revealAnswer && question.correctOption === opt.key;
                  const isDimmed =
                    data.revealAnswer && question.correctOption !== opt.key;

                  return (
                    <div
                      key={opt.key}
                      className={`rounded-2xl p-5 border-2 transition flex items-center gap-4 ${
                        isCorrect
                          ? "bg-emerald-950/70 border-emerald-500 text-white"
                          : isDimmed
                          ? "bg-slate-900/40 border-slate-800 text-slate-500"
                          : "bg-slate-900 border-slate-800 text-slate-100"
                      }`}
                    >
                      <span
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${
                          isCorrect
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-slate-800 text-indigo-300"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-lg md:text-xl font-medium">{opt.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Статус класса
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                {data.students.map((st) => {
                  const resp = responseMap.get(st.id);
                  let cardStyle = "bg-slate-950/60 border-slate-800 text-slate-400";
                  let badgeText = "Ожидание";

                  if (resp) {
                    if (data.revealAnswer) {
                      cardStyle = resp.isCorrect
                        ? "bg-emerald-950/60 border-emerald-600 text-emerald-200"
                        : "bg-rose-950/60 border-rose-600 text-rose-200";
                      badgeText = resp.answer;
                    } else {
                      cardStyle = "bg-indigo-950/70 border-indigo-500 text-indigo-100";
                      badgeText = "Принят";
                    }
                  }

                  return (
                    <div
                      key={st.id}
                      className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition ${cardStyle}`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-xs font-mono opacity-60">#{st.markerId}</span>
                        <span className="font-medium truncate">{st.fullName}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-black/30">
                        {badgeText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">Вопросы не найдены</div>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
          Загрузка доски...
        </div>
      }
    >
      <BoardContent />
    </Suspense>
  );
}
