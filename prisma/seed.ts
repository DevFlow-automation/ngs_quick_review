import "dotenv/config";
import { AnswerOption } from "@prisma/client";
import { prisma } from "../lib/prisma";


async function main() {
  // 1. Класс 8-А
  let cls = await prisma.class.findFirst({ where: { name: "8-А" } });
  if (!cls) {
    cls = await prisma.class.create({
      data: { name: "8-А" },
    });
  }

  // 2. Ученики (привязаны к карточкам #1..#6)
  const studentNames = [
    "Алишер Каримов",
    "Малика Усманова",
    "Тимур Рахимов",
    "Зарина Юсупова",
    "Дамир Ахмедов",
    "София Ким",
  ];

  for (let i = 0; i < studentNames.length; i++) {
    const markerId = i + 1;
    await prisma.student.upsert({
      where: {
        classId_markerId: { classId: cls.id, markerId },
      },
      update: { fullName: studentNames[i] },
      create: {
        fullName: studentNames[i],
        markerId,
        classId: cls.id,
      },
    });
  }

  // 3. Тестовый квиз
  let quiz = await prisma.quiz.findFirst({
    where: { title: "Экспресс-опрос: Квадратные уравнения" },
  });

  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        title: "Экспресс-опрос: Квадратные уравнения",
        subject: "Алгебра",
        questions: {
          create: [
            {
              order: 1,
              text: "Чему равен дискриминант уравнения x² - 5x + 6 = 0?",
              optionA: "1",
              optionB: "25",
              optionC: "-1",
              optionD: "49",
              correctOption: AnswerOption.A,
            },
            {
              order: 2,
              text: "Сколько корней имеет уравнение x² + 4x + 4 = 0?",
              optionA: "Два разных корня",
              optionB: "Один корень (кратности 2)",
              optionC: "Корней нет",
              optionD: "Бесконечно много",
              correctOption: AnswerOption.B,
            },
            {
              order: 3,
              text: "Укажите сумму корней уравнения x² - 7x + 10 = 0 по теореме Виета:",
              optionA: "-7",
              optionB: "10",
              optionC: "7",
              optionD: "-10",
              correctOption: AnswerOption.C,
            },
          ],
        },
      },
    });
  }

  // 4. Активная сессия с коротким кодом 8A-01
  await prisma.session.upsert({
    where: { code: "8A-01" },
    update: {
      classId: cls.id,
      quizId: quiz.id,
      status: "ACTIVE",
      currentQuestionIdx: 0,
      revealAnswer: false,
    },
    create: {
      code: "8A-01",
      classId: cls.id,
      quizId: quiz.id,
      status: "ACTIVE",
    },
  });

  console.log("Seed completed: session code = 8A-01");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
