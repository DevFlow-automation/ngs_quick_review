import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { code } = await params;

    const session = await prisma.session.findUnique({
      where: { code },
      include: {
        class: { include: { students: { orderBy: { markerId: "asc" } } } },
        quiz: { include: { questions: { orderBy: { order: "asc" } } } },
        responses: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }

    const totalQuestions = session.quiz.questions.length;
    const responseMap = new Map(
      session.responses.map((r) => [`${r.studentId}_${r.questionId}`, r])
    );

    const studentMatrix = session.class.students.map((student) => {
      let correctCount = 0;
      let answeredCount = 0;

      const answers = session.quiz.questions.map((q) => {
        const resp = responseMap.get(`${student.id}_${q.id}`);
        if (resp) {
          answeredCount++;
          if (resp.isCorrect) correctCount++;
        }
        return {
          questionId: q.id,
          answer: resp?.answer ?? null,
          isCorrect: resp?.isCorrect ?? null,
        };
      });

      const scorePercent =
        totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      return {
        studentId: student.id,
        fullName: student.fullName,
        markerId: student.markerId,
        correctCount,
        answeredCount,
        scorePercent,
        answers,
      };
    });

    const questionStats = session.quiz.questions.map((q) => {
      const qResponses = session.responses.filter((r) => r.questionId === q.id);
      const correct = qResponses.filter((r) => r.isCorrect).length;
      const total = qResponses.length;
      return {
        questionId: q.id,
        order: q.order,
        text: q.text,
        correctOption: q.correctOption,
        answeredCount: total,
        correctCount: correct,
        accuracyPercent: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });

    return NextResponse.json({
      code: session.code,
      className: session.class.name,
      quizTitle: session.quiz.title,
      totalQuestions,
      studentMatrix,
      questionStats,
    });
  } catch (error) {
    console.error("GET /api/sessions/[code]/report error:", error);
    return NextResponse.json({ error: "Ошибка формирования отчёта" }, { status: 500 });
  }
}
