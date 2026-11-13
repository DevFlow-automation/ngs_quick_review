import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


type RouteContext = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { code } = await params;
    const isTeacher = req.nextUrl.searchParams.get("role") === "teacher";

    const session = await prisma.session.findUnique({
      where: { code },
      include: {
        class: {
          include: {
            students: { orderBy: { markerId: "asc" } },
          },
        },
        quiz: {
          include: {
            questions: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }

    const currentQuestion = session.quiz.questions[session.currentQuestionIdx] ?? null;

    const responses = currentQuestion
      ? await prisma.response.findMany({
          where: {
            sessionId: session.id,
            questionId: currentQuestion.id,
          },
          select: {
            studentId: true,
            answer: true,
            isCorrect: true,
            scannedAt: true,
          },
        })
      : [];

    const safeQuestions = session.quiz.questions.map((q, idx) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption:
        isTeacher || (session.revealAnswer && idx === session.currentQuestionIdx)
          ? q.correctOption
          : null,
    }));

    return NextResponse.json({
      id: session.id,
      code: session.code,
      status: session.status,
      currentQuestionIdx: session.currentQuestionIdx,
      revealAnswer: session.revealAnswer,
      className: session.class.name,
      quizTitle: session.quiz.title,
      students: session.class.students,
      questions: safeQuestions,
      responses: responses.map((r) => ({
        studentId: r.studentId,
        answer: isTeacher || session.revealAnswer ? r.answer : "SCANNED",
        isCorrect: isTeacher || session.revealAnswer ? r.isCorrect : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/sessions/[code] error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { code } = await params;
    const body = await req.json();

    const session = await prisma.session.findUnique({
      where: { code },
      include: { quiz: { include: { questions: true } } },
    });

    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }

    const maxIdx = Math.max(0, session.quiz.questions.length - 1);
    const dataToUpdate: {
      currentQuestionIdx?: number;
      revealAnswer?: boolean;
      status?: "ACTIVE" | "FINISHED";
    } = {};

    if (typeof body.currentQuestionIdx === "number") {
      dataToUpdate.currentQuestionIdx = Math.max(0, Math.min(maxIdx, body.currentQuestionIdx));
      dataToUpdate.revealAnswer = false;
    }
    if (typeof body.revealAnswer === "boolean") {
      dataToUpdate.revealAnswer = body.revealAnswer;
    }
    if (body.status === "ACTIVE" || body.status === "FINISHED") {
      dataToUpdate.status = body.status;
    }

    if (typeof body.resetQuestionId === "string") {
      await prisma.response.deleteMany({
        where: {
          sessionId: session.id,
          questionId: body.resetQuestionId,
        },
      });
      dataToUpdate.revealAnswer = false;
    }

    if (body.reset === true) {
      await prisma.response.deleteMany({
        where: { sessionId: session.id },
      });
      dataToUpdate.currentQuestionIdx = 0;
      dataToUpdate.revealAnswer = false;
      dataToUpdate.status = "ACTIVE";
    }

    const updated = await prisma.session.update({
      where: { code },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/sessions/[code] error:", error);
    return NextResponse.json({ error: "Ошибка обновления сессии" }, { status: 500 });
  }
}
