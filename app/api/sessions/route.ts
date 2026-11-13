import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let res = "";
  for (let i = 0; i < 5; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        class: { select: { name: true } },
        quiz: { select: { title: true, subject: true } },
        teacher: { select: { fullName: true } },
        _count: { select: { responses: true } },
      },
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Ошибка загрузки сессий" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classId, quizId, teacherId } = body as {
      classId?: string;
      quizId?: string;
      teacherId?: string;
    };

    if (!classId || !quizId) {
      return NextResponse.json({ error: "Выберите класс и тест" }, { status: 400 });
    }

    let code = generateShortCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await prisma.session.findUnique({ where: { code } });
      if (!exists) break;
      code = generateShortCode();
    }

    const session = await prisma.session.create({
      data: {
        code,
        classId,
        quizId,
        teacherId: teacherId || null,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Ошибка запуска сессии" }, { status: 500 });
  }
}
