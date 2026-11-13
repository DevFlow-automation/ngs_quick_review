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

    const actor = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!actor || actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Удалять классы может только администратор" },
        { status: 403 }
      );
    }

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }

    await prisma.class.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/classes/[id] error:", error);
    return NextResponse.json({ error: "Ошибка удаления класса" }, { status: 500 });
  }
}
