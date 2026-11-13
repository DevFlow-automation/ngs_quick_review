import { NextRequest, NextResponse } from "next/server";
import { AnswerOption } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface QuestionInput {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: AnswerOption;
}

const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

export async function GET(req: NextRequest) {
  try {
    const teacherId = req.nextUrl.searchParams.get("teacherId");

    const quizzes = await prisma.quiz.findMany({
      where: teacherId
        ? { OR: [{ teacherId }, { isShared: true }, { teacherId: null }] }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json(quizzes);
  } catch (error) {
    console.error("GET /api/quizzes error:", error);
    return NextResponse.json({ error: "Ошибка загрузки квизов" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, subject, teacherId, isShared, questions } = body as {
      title?: string;
      subject?: string;
      teacherId?: string;
      isShared?: boolean;
      questions?: QuestionInput[];
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "Укажите название теста" }, { status: 400 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Добавьте хотя бы один вопрос" }, { status: 400 });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (
        !q.text?.trim() ||
        !q.optionA?.trim() ||
        !q.optionB?.trim() ||
        !q.optionC?.trim() ||
        !q.optionD?.trim() ||
        !VALID_OPTIONS.has(q.correctOption)
      ) {
        return NextResponse.json(
          { error: `Проверьте заполнение вопроса №${i + 1}` },
          { status: 400 }
        );
      }
    }

    const created = await prisma.quiz.create({
      data: {
        title: title.trim(),
        subject: subject?.trim() || null,
        teacherId: teacherId || null,
        isShared: Boolean(isShared),
        questions: {
          create: questions.map((q, idx) => ({
            order: idx + 1,
            text: q.text.trim(),
            optionA: q.optionA.trim(),
            optionB: q.optionB.trim(),
            optionC: q.optionC.trim(),
            optionD: q.optionD.trim(),
            correctOption: q.correctOption,
          })),
        },
      },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/quizzes error:", error);
    return NextResponse.json({ error: "Ошибка создания квиза" }, { status: 500 });
  }
}
