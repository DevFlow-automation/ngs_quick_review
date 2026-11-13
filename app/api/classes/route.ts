import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        students: { orderBy: { markerId: "asc" } },
      },
    });
    return NextResponse.json(classes);
  } catch (error) {
    console.error("GET /api/classes error:", error);
    return NextResponse.json({ error: "Ошибка загрузки классов" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, students, teacherId } = body as {
      name?: string;
      students?: string[];
      teacherId?: string;
    };

    if (!teacherId) {
      return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
    }
    const actor = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!actor || actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Добавлять классы может только администратор" },
        { status: 403 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Укажите название класса (например, 7-Б)" },
        { status: 400 }
      );
    }

    const cleanNames = (Array.isArray(students) ? students : [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (cleanNames.length === 0) {
      return NextResponse.json({ error: "Добавьте хотя бы одного ученика" }, { status: 400 });
    }
    if (cleanNames.length > 60) {
      return NextResponse.json({ error: "Максимум 60 учеников в одном классе" }, { status: 400 });
    }

    const created = await prisma.class.create({
      data: {
        name: name.trim(),
        students: {
          create: cleanNames.map((fullName, idx) => ({
            fullName,
            markerId: idx + 1,
          })),
        },
      },
      include: {
        students: { orderBy: { markerId: "asc" } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/classes error:", error);
    return NextResponse.json(
      { error: "Не удалось создать класс (возможно, такое название уже есть)" },
      { status: 400 }
    );
  }
}
