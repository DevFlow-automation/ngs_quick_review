import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const teachers = await prisma.teacher.findMany({
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        subject: true,
        role: true,
      },
    });
    return NextResponse.json(teachers);
  } catch (error) {
    console.error("GET /api/teachers error:", error);
    return NextResponse.json({ error: "Ошибка загрузки учителей" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Вход по PIN-коду
    if (body.action === "login") {
      const { teacherId, pinCode } = body as { teacherId?: string; pinCode?: string };
      if (!teacherId || !pinCode) {
        return NextResponse.json({ error: "Укажите учителя и PIN" }, { status: 400 });
      }
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.pinCode !== String(pinCode).trim()) {
        return NextResponse.json({ error: "Неверный PIN-код" }, { status: 401 });
      }
      return NextResponse.json({
        id: teacher.id,
        fullName: teacher.fullName,
        subject: teacher.subject,
        role: teacher.role,
      });
    }

    // Регистрация нового учителя
    const { fullName, subject, pinCode, role } = body as {
      fullName?: string;
      subject?: string;
      pinCode?: string;
      role?: "TEACHER" | "ADMIN";
    };

    if (!fullName?.trim() || !subject?.trim() || !pinCode?.trim()) {
      return NextResponse.json(
        { error: "Заполните ФИО, предмет и PIN-код" },
        { status: 400 }
      );
    }

    const created = await prisma.teacher.create({
      data: {
        fullName: fullName.trim(),
        subject: subject.trim(),
        pinCode: pinCode.trim(),
        role: role === "ADMIN" ? "ADMIN" : "TEACHER",
      },
      select: {
        id: true,
        fullName: true,
        subject: true,
        role: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/teachers error:", error);
    return NextResponse.json({ error: "Ошибка сохранения учителя" }, { status: 500 });
  }
}
