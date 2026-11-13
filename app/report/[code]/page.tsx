"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface QuestionStat {
  questionId: string;
  order: number;
  text: string;
  correctOption: string;
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number;
}

interface StudentRow {
  studentId: string;
  fullName: string;
  markerId: number;
  correctCount: number;
  answeredCount: number;
  scorePercent: number;
  answers: Array<{
    questionId: string;
    answer: string | null;
    isCorrect: boolean | null;
  }>;
}

interface ReportData {
  code: string;
  className: string;
  quizTitle: string;
  totalQuestions: number;
  studentMatrix: StudentRow[];
  questionStats: QuestionStat[];
}

function ReportContent() {
  const { code } = useParams<{ code: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/sessions/${code}/report`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d));
  }, [code]);

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Формирование отчёта...
      </div>
    );
  }

  const rows = onlyGaps
    ? report.studentMatrix.filter((s) => s.scorePercent < 70)
    : report.studentMatrix;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-indigo-600 font-semibold">
            Класс {report.className} • Сессия {report.code}
          </div>
          <h1 className="text-2xl font-bold">{report.quizTitle} — Отчёт по пробелам</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/board/${report.code}`}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium hover:bg-slate-100"
          >
            На доску
          </Link>
          <Link
            href={`/scan/${report.code}`}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            К сканеру
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Понимание по вопросам</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.questionStats.map((q) => (
            <div key={q.questionId} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Вопрос #{q.order} (Верно: {q.correctOption})</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    q.accuracyPercent >= 70
                      ? "bg-emerald-100 text-emerald-800"
                      : q.accuracyPercent >= 40
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {q.accuracyPercent}%
                </span>
              </div>
              <p className="text-sm text-slate-800 line-clamp-2">{q.text}</p>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    q.accuracyPercent >= 70 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${q.accuracyPercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Матрица результатов</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={onlyGaps}
              onChange={(e) => setOnlyGaps(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <span>Показать только с пробелами (&lt; 70%)</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Карточка</th>
                <th className="px-4 py-3 font-medium">Ученик</th>
                {report.questionStats.map((q) => (
                  <th key={q.questionId} className="px-4 py-3 font-medium text-center">
                    В{q.order}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-right">Итог</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((st) => (
                <tr key={st.studentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500">#{st.markerId}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{st.fullName}</td>
                  {st.answers.map((a) => (
                    <td key={a.questionId} className="px-4 py-3 text-center">
                      {a.answer ? (
                        <span
                          className={`inline-block w-7 h-7 leading-7 rounded-lg text-xs font-bold ${
                            a.isCorrect
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {a.answer}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold">
                    {st.scorePercent}% ({st.correctCount}/{report.totalQuestions})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 text-slate-500 flex items-center justify-center">
          Формирование отчёта...
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
