"use client";

import { useEffect, useState } from "react";
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
      Dictionary?: new (name: string) => {
        codeList: string[];
        generateSVG: (id: number) => string;
      };
    };
  }
}

export default function CardsPage() {
  const [cvReady, setCvReady] = useState(false);
  const [arReady, setArReady] = useState(false);
  const [startId, setStartId] = useState(1);
  const [endId, setEndId] = useState(10);
  const [layout, setLayout] = useState<"two" | "one">("two");
  const [cards, setCards] = useState<Array<{ id: number; svg: string }>>([]);

  useEffect(() => {
    if (window.AR?.Dictionary) {
      setCvReady(true);
      setArReady(true);
      return;
    }
    const check = setInterval(() => {
      if (window.AR?.Dictionary) {
        setCvReady(true);
        setArReady(true);
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!arReady || !window.AR?.Dictionary) return;
    const dict = new window.AR.Dictionary("ARUCO_MIP_36h12");
    const maxId = dict.codeList.length - 1;
    const from = Math.max(0, Math.min(maxId, startId));
    const to = Math.max(from, Math.min(maxId, Math.min(from + 59, endId)));

    const list: Array<{ id: number; svg: string }> = [];
    for (let id = from; id <= to; id++) {
      list.push({ id, svg: dict.generateSVG(id) });
    }
    setCards(list);
  }, [arReady, startId, endId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Script
        src="https://cdn.jsdelivr.net/npm/js-aruco2@2.0.0/src/cv.js"
        strategy="afterInteractive"
        onReady={() => setCvReady(true)}
      />
      {cvReady && (
        <Script
          src="https://cdn.jsdelivr.net/npm/js-aruco2@2.0.0/src/aruco.js"
          strategy="afterInteractive"
          onReady={() => setArReady(true)}
        />
      )}

      <style jsx global>{`
        .aruco-svg-wrap svg {
          width: 100%;
          height: 100%;
          display: block;
          shape-rendering: crispEdges;
        }
        @media print {
          body {
            background: #ffffff !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px dashed #cbd5e1 !important;
          }
        }
      `}</style>

      <header className="print:hidden bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-100"
            >
              ← Назад
            </Link>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Генератор ArUco-карточек</h1>
              <p className="text-xs text-slate-500">Словарь ARUCO_MIP_36h12 • Матовая бумага</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">С ID:</span>
              <input
                type="number"
                min={0}
                max={249}
                value={startId}
                onChange={(e) => setStartId(Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">По ID:</span>
              <input
                type="number"
                min={0}
                max={249}
                value={endId}
                onChange={(e) => setEndId(Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as "two" | "one")}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
            >
              <option value="two">2 на лист A4</option>
              <option value="one">1 крупная на лист A4</option>
            </select>
            <button
              type="button"
              disabled={cards.length === 0}
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:opacity-50"
            >
              Печать / PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 print:p-0">
        <div className="print:hidden mb-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          Печатайте на <strong>матовой</strong> бумаге (без глянцевой ламинации, чтобы не было бликов). Один комплект карточек #1–#40 подходит для всех классов школы.
        </div>

        {!arReady ? (
          <div className="py-20 text-center text-slate-500">Загрузка генератора...</div>
        ) : (
          <div
            className={`grid gap-6 print:gap-4 ${
              layout === "one" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 print:grid-cols-2"
            }`}
          >
            {cards.map((card) => (
              <div
                key={card.id}
                className="print-card bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center relative aspect-square max-w-[400px] w-full mx-auto shadow-sm"
              >
                <span className="absolute top-2.5 left-3.5 text-xs font-mono text-slate-400">
                  #{card.id}
                </span>
                <span className="absolute top-2.5 right-3.5 text-xs font-mono text-slate-400">
                  #{card.id}
                </span>

                <div className="text-2xl font-bold text-slate-800 mb-2 select-none">A</div>

                <div className="flex items-center justify-center w-full gap-2">
                  <div className="text-2xl font-bold text-slate-800 -rotate-90 select-none">D</div>
                  <div
                    className="aruco-svg-wrap w-52 h-52 sm:w-60 sm:h-60 p-3 bg-white"
                    dangerouslySetInnerHTML={{ __html: card.svg }}
                  />
                  <div className="text-2xl font-bold text-slate-800 rotate-90 select-none">B</div>
                </div>

                <div className="text-2xl font-bold text-slate-800 rotate-180 mt-2 select-none">C</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
