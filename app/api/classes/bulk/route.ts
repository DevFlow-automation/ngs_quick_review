import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BulkClassInput {
  name: string;
  students: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teacherId, classes } = body as {
      teacherId?: string;
      classes?: BulkClassInput[];
    };

    if (!teacherId) {
      return NextResponse.json({ error: "Войдите как администратор" }, { status: 401 });
    }
    const actor = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!actor || actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Импортировать классы может только администратор" },
        { status: 403 }
      );
    }

    if (!Array.isArray(classes) || classes.length === 0) {
      return NextResponse.json({ error: "Нет данных для импорта" }, { status: 400 });
    }

    const existing = await prisma.class.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((c) => c.name));

    let createdCount = 0;
    let skippedCount = 0;

    for (const item of classes) {
      const name = item.name?.trim();
      const students = (item.students || []).map((s) => s.trim()).filter(Boolean);
      if (!name || students.length === 0) continue;

      if (existingNames.has(name)) {
        skippedCount++;
        continue;
      }

      await prisma.class.create({
        data: {
          name,
          students: {
            create: students.slice(0, 60).map((fullName, idx) => ({
              fullName,
              markerId: idx + 1,
            })),
          },
        },
      });
      existingNames.add(name);
      createdCount++;
    }

    return NextResponse.json({ createdCount, skippedCount }, { status: 201 });
  } catch (error) {
    console.error("POST /api/classes/bulk error:", error);
    return NextResponse.json({ error: "Ошибка массового импорта" }, { status: 500 });
  }
}
