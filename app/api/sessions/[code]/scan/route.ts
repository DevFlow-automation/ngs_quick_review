import { NextRequest, NextResponse } from "next/server";
import { AnswerOption } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ code: string }> };

interface ScanItem {
  markerId: number;
  answer: AnswerOption;
}

const VALID_ANSWERS = new Set<string>(["A", "B", "C", "D"]);

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { questionId, scans } = body as { questionId?: string; scans?: ScanItem[] };

    if (!questionId || !Array.isArray(scans) || scans.length === 0) {
      return NextResponse.json(
        { error: "Необходимо передать questionId и непустой массив scans" },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { code },
      include: {
        class: { include: { students: true } },
        quiz: { include: { questions: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }
    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Сессия уже завершена" }, { status: 409 });
    }

    const question = session.quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: "Вопрос не принадлежит этому квизу" }, { status: 400 });
    }

    const markerToStudent = new Map(
      session.class.students.map((s) => [s.markerId, s])
    );

    const upserts = [];
    const ignoredMarkerIds: number[] = [];

    for (const item of scans) {
      if (!VALID_ANSWERS.has(item.answer)) continue;
      const student = markerToStudent.get(Number(item.markerId));
      if (!student) {
        ignoredMarkerIds.push(item.markerId);
        continue;
      }

      const isCorrect = item.answer === question.correctOption;

      upserts.push(
        prisma.response.upsert({
          where: {
            sessionId_questionId_studentId: {
              sessionId: session.id,
              questionId: question.id,
              studentId: student.id,
            },
          },
          update: {
            answer: item.answer,
            isCorrect,
          },
          create: {
            sessionId: session.id,
            questionId: question.id,
            studentId: student.id,
            answer: item.answer,
            isCorrect,
          },
        })
      );
    }

    if (upserts.length > 0) {
      await prisma.$transaction(upserts);
    }

    return NextResponse.json({
      saved: upserts.length,
      ignoredMarkerIds,
    });
  } catch (error) {
    console.error("POST /api/sessions/[code]/scan error:", error);
    return NextResponse.json({ error: "Ошибка сохранения сканов" }, { status: 500 });
  }
}
