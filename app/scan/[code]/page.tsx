"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Script from "next/script";
import Link from "next/link";

declare global {
  interface Window {
    AR?: {
      Detector: new (opts?: { dictionaryName?: string; maxHammingDistance?: number }) => {
        detect: (imageData: ImageData) => Array<{
          id: number;
          corners: Array<{ x: number; y: number }>;
        }>;
      };
    };
  }
}

interface Student {
  id: string;
  fullName: string;
  markerId: number;
}

interface Question {
  id: string;
  order: number;
  text: string;
  correctOption: "A" | "B" | "C" | "D" | null;
}

interface TeacherSession {
  code: string;
  currentQuestionIdx: number;
  revealAnswer: boolean;
  className: string;
  students: Student[];
  questions: Question[];
  responses: Array<{ studentId: string; answer: string; isCorrect: boolean | null }>;
}

type AnswerLetter = "A" | "B" | "C" | "D";

function getAnswerFromCorners(corners: Array<{ x: number; y: number }>): AnswerLetter | null {
  const dx = corners[1].x - corners[0].x;
  const dy = corners[1].y - corners[0].y;
  let deg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (deg < 0) deg += 360;

  const deadZone = 12;
  if (
    Math.abs(deg - 45) < deadZone ||
    Math.abs(deg - 135) < deadZone ||
    Math.abs(deg - 225) < deadZone ||
    Math.abs(deg - 315) < deadZone
  ) {
    return null;
  }

  if (deg >= 315 || deg < 45) return "A";
  if (deg >= 45 && deg < 135) return "D";
  if (deg >= 135 && deg < 225) return "C";
  return "B";
}

function ScanContent() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [arReady, setArReady] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [localScans, setLocalScans] = useState<Record<number, AnswerLetter>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stabilityRef = useRef(new Map<number, AnswerLetter[]>());
  const lockedRef = useRef(new Map<number, AnswerLetter>());
  const pendingBatchRef = useRef(new Map<number, AnswerLetter>());

  const loadSession = useCallback(async () => {
    if (!code) return;
    const res = await fetch(`/api/sessions/${code}?role=teacher`, { cache: "no-store" });
    if (!res.ok) return;
    const data: TeacherSession = await res.json();
    setSession(data);

    const studentById = new Map(data.students.map((s) => [s.id, s]));
    const restored: Record<number, AnswerLetter> = {};
    lockedRef.current.clear();
    stabilityRef.current.clear();

    data.responses.forEach((r) => {
      const st = studentById.get(r.studentId);
      if (st && (r.answer === "A" || r.answer === "B" || r.answer === "C" || r.answer === "D")) {
        restored[st.markerId] = r.answer;
        lockedRef.current.set(st.markerId, r.answer);
      }
    });
    setLocalScans(restored);
  }, [code]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const currentQuestion = session?.questions[session.currentQuestionIdx] ?? null;

  useEffect(() => {
    if (!code || !currentQuestion) return;
    const timer = setInterval(async () => {
      if (pendingBatchRef.current.size === 0) return;
      const scans = Array.from(pendingBatchRef.current.entries()).map(([markerId, answer]) => ({
        markerId,
        answer,
      }));
      pendingBatchRef.current.clear();

      try {
        await fetch(`/api/sessions/${code}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: currentQuestion.id, scans }),
        });
      } catch {
        scans.forEach((s) => pendingBatchRef.current.set(s.markerId, s.answer));
      }
    }, 500);

    return () => clearInterval(timer);
  }, [code, currentQuestion]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    if (!window.AR) {
      setStatusMsg("Детектор ещё загружается...");
      return;
    }
    setStatusMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);

      const detector = new window.AR.Detector({
        dictionaryName: "ARUCO_MIP_36h12",
        maxHammingDistance: 4,
      });

      const studentByMarker = new Map(
        (session?.students ?? []).map((s) => [s.markerId, s])
      );

      const tick = () => {
        if (!streamRef.current || !canvasRef.current || !videoRef.current) return;
        const vid = videoRef.current;
        const cvs = canvasRef.current;
        const ctx = cvs.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        if (vid.readyState >= vid.HAVE_ENOUGH_DATA) {
          if (cvs.width !== vid.videoWidth || cvs.height !== vid.videoHeight) {
            cvs.width = vid.videoWidth;
            cvs.height = vid.videoHeight;
          }
          ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
          const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
          const markers = detector.detect(imgData);

          markers.forEach((m) => {
            const answer = getAnswerFromCorners(m.corners);
            const student = studentByMarker.get(m.id);

            ctx.lineWidth = 3;
            ctx.strokeStyle = answer ? "#10b981" : "#f59e0b";
            ctx.beginPath();
            m.corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
            ctx.closePath();
            ctx.stroke();

            const cx = m.corners.reduce((s, c) => s + c.x, 0) / 4;
            const cy = m.corners.reduce((s, c) => s + c.y, 0) / 4;
            const label = student
              ? `#${m.id} ${student.fullName.split(" ")[0]} • ${answer || "?"}`
              : `#${m.id} • ${answer || "?"}`;

            ctx.font = "bold 14px sans-serif";
            const w = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.fillRect(cx - w / 2 - 8, cy - 13, w + 16, 24);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, cx, cy - 1);

            if (!answer || lockedRef.current.has(m.id)) return;

            const win = stabilityRef.current.get(m.id) || [];
            win.push(answer);
            if (win.length > 4) win.shift();
            stabilityRef.current.set(m.id, win);

            if (win.length === 4 && win.every((a) => a === answer)) {
              lockedRef.current.set(m.id, answer);
              pendingBatchRef.current.set(m.id, answer);
              setLocalScans((prev) => ({ ...prev, [m.id]: answer }));
            }
          });
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setStatusMsg(`Ошибка камеры: ${(err as Error).message}`);
    }
  };

  async function updateSession(payload: { currentQuestionIdx?: number; revealAnswer?: boolean }) {
    if (!code) return;
    stopCamera();
    await fetch(`/api/sessions/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadSession();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-2xl mx-auto space-y-4">
      <Script
        src="https://cdn.jsdelivr.net/npm/js-aruco2@2.0.0/src/cv.js"
        strategy="afterInteractive"
        onLoad={() => setCvReady(true)}
      />
      {cvReady && (
        <Script
          src="https://cdn.jsdelivr.net/npm/js-aruco2@2.0.0/src/aruco.js"
          strategy="afterInteractive"
          onLoad={() => setArReady(true)}
        />
      )}

      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="text-xs text-indigo-400 font-semibold">
            Сканер учителя • {session?.className ?? "..."} ({code})
          </div>
          <div className="text-sm font-medium text-slate-200">
            {currentQuestion
              ? `Вопрос ${session!.currentQuestionIdx + 1}/${session!.questions.length}`
              : "Загрузка..."}
          </div>
        </div>
        <Link
          href={`/report/${code}`}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium"
        >
          Отчёт
        </Link>
      </header>

      {currentQuestion && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <p className="text-sm text-slate-200 font-medium">{currentQuestion.text}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={session!.currentQuestionIdx === 0}
              onClick={() => updateSession({ currentQuestionIdx: session!.currentQuestionIdx - 1 })}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-medium disabled:opacity-40"
            >
              ← Назад
            </button>
            <button
              type="button"
              onClick={() => updateSession({ revealAnswer: !session!.revealAnswer })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                session!.revealAnswer ? "bg-emerald-600" : "bg-amber-600"
              }`}
            >
              {session!.revealAnswer ? "Скрыть ответ" : "Показать ответ на доске"}
            </button>
            <button
              type="button"
              disabled={session!.currentQuestionIdx >= session!.questions.length - 1}
              onClick={() => updateSession({ currentQuestionIdx: session!.currentQuestionIdx + 1 })}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium disabled:opacity-40 ml-auto"
            >
              Следующий →
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative min-h-[260px] flex items-center justify-center">
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="w-full h-auto block" />
        {!cameraActive && (
          <button
            type="button"
            disabled={!arReady}
            onClick={startCamera}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm disabled:opacity-50"
          >
            {arReady ? "Включить камеру" : "Загрузка детектора..."}
          </button>
        )}
      </div>

      {cameraActive && (
        <button
          type="button"
          onClick={stopCamera}
          className="w-full py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-sm font-medium"
        >
          Остановить камеру
        </button>
      )}

      {statusMsg && <div className="text-xs text-rose-400">{statusMsg}</div>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
        <div className="text-xs text-slate-400 mb-2">
          Принято карточек: {Object.keys(localScans).length} / {session?.students.length ?? 0}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(localScans).map(([markerId, ans]) => (
            <span
              key={markerId}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono"
            >
              #{markerId}: <strong className="text-emerald-400">{ans}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
          Загрузка сканера...
        </div>
      }
    >
      <ScanContent />
    </Suspense>
  );
}
