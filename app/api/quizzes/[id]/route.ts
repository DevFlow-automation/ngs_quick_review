import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const teacherId = req.nextUrl.searchParams.get("teacherId");

    if (!teacherId) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const [actor, quiz] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: teacherId } }),
      prisma.quiz.findUnique({ where: { id } }),
    ]);

    if (!quiz) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }
    if (!actor || (actor.role !== "ADMIN" && quiz.teacherId !== actor.id)) {
      return NextResponse.json(
        { error: "Нет прав на удаление этого теста" },
        { status: 403 }
      );
    }

    await prisma.quiz.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/quizzes/[id] error:", error);
    return NextResponse.json({ error: "Ошибка удаления теста" }, { status: 500 });
  }
}
