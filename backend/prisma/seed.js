/*
  Seed script to insert mock data for demo without Google Classroom.
  Usage:
    - From backend directory:
      node prisma/seed.js
*/
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding mock data...')

  // Create or update a coordinator user for testing
  const coordinator = await prisma.user.upsert({
    where: { email: 'coordinator@example.com' },
    update: { name: 'Coordinator User', role: 'coordinator' },
    create: { email: 'coordinator@example.com', name: 'Coordinator User', role: 'coordinator' }
  })

  // Create a teacher user
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher1@example.com' },
    update: { name: 'Teacher One', role: 'teacher' },
    create: { email: 'teacher1@example.com', name: 'Teacher One', role: 'teacher' }
  })

  // Students
  const studentsData = [
    { email: 'alice@student.com', name: 'Alice Student', cohort: 'Cohort A' },
    { email: 'bob@student.com', name: 'Bob Student', cohort: 'Cohort A' },
    { email: 'carol@student.com', name: 'Carol Student', cohort: 'Cohort B' },
  ]

  for (const s of studentsData) {
    await prisma.student.upsert({
      where: { email: s.email },
      update: { name: s.name, cohort: s.cohort },
      create: { email: s.email, name: s.name, cohort: s.cohort }
    })
    await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: 'student' },
      create: { email: s.email, name: s.name, role: 'student' }
    })
  }

  // Courses
  const course1 = await prisma.course.upsert({
    where: { gcId: 'mock-course-1' },
    update: { name: 'Intro to Web Dev', teacherEmail: teacherUser.email },
    create: { gcId: 'mock-course-1', name: 'Intro to Web Dev', teacherEmail: teacherUser.email }
  })
  const course2 = await prisma.course.upsert({
    where: { gcId: 'mock-course-2' },
    update: { name: 'JavaScript Basics', teacherEmail: teacherUser.email },
    create: { gcId: 'mock-course-2', name: 'JavaScript Basics', teacherEmail: teacherUser.email }
  })

  // Coursework (due dates are near today)
  const today = new Date()
  function daysFromNow(n) {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    d.setHours(23, 59, 0, 0)
    return d
  }

  const cw1 = await prisma.coursework.upsert({
    where: { gcId: 'mock-cw-1' },
    update: { title: 'Landing Page', description: 'Build a simple landing page', dueDate: daysFromNow(-5), courseId: course1.id },
    create: { gcId: 'mock-cw-1', title: 'Landing Page', description: 'Build a simple landing page', dueDate: daysFromNow(-5), courseId: course1.id }
  })
  const cw2 = await prisma.coursework.upsert({
    where: { gcId: 'mock-cw-2' },
    update: { title: 'Form Handling', description: 'Handle form submit and validation', dueDate: daysFromNow(-2), courseId: course1.id },
    create: { gcId: 'mock-cw-2', title: 'Form Handling', description: 'Handle form submit and validation', dueDate: daysFromNow(-2), courseId: course1.id }
  })
  const cw3 = await prisma.coursework.upsert({
    where: { gcId: 'mock-cw-3' },
    update: { title: 'Array Methods', description: 'Map/Filter/Reduce exercises', dueDate: daysFromNow(3), courseId: course2.id },
    create: { gcId: 'mock-cw-3', title: 'Array Methods', description: 'Map/Filter/Reduce exercises', dueDate: daysFromNow(3), courseId: course2.id }
  })

  // Submissions: use studentEmail and states consistent with mapping logic
  const submissions = [
    // Alice: on time for cw1, late for cw2, pending for cw3
    { courseworkId: cw1.id, studentEmail: 'alice@student.com', state: 'TURNED_IN', submittedAt: daysFromNow(-6) }, // on time (submitted before due)
    { courseworkId: cw2.id, studentEmail: 'alice@student.com', state: 'TURNED_IN', submittedAt: daysFromNow(-1) }, // late (after due)
    { courseworkId: cw3.id, studentEmail: 'alice@student.com', state: 'NEW', submittedAt: null },

    // Bob: missing cw1, returned/resubmission for cw2, on time for cw3
    { courseworkId: cw1.id, studentEmail: 'bob@student.com', state: 'CREATED', submittedAt: null },
    { courseworkId: cw2.id, studentEmail: 'bob@student.com', state: 'RETURNED', submittedAt: daysFromNow(-2) },
    { courseworkId: cw3.id, studentEmail: 'bob@student.com', state: 'TURNED_IN', submittedAt: daysFromNow(2) },

    // Carol: late cw1, missing cw2, reclaimed for cw3
    { courseworkId: cw1.id, studentEmail: 'carol@student.com', state: 'TURNED_IN', submittedAt: daysFromNow(-4) }, // late (after due)
    { courseworkId: cw2.id, studentEmail: 'carol@student.com', state: 'NEW', submittedAt: null },
    { courseworkId: cw3.id, studentEmail: 'carol@student.com', state: 'RECLAIMED_BY_STUDENT', submittedAt: daysFromNow(1) },
  ]

  for (const sub of submissions) {
    await prisma.submission.upsert({
      where: { courseworkId_studentEmail: { courseworkId: sub.courseworkId, studentEmail: sub.studentEmail } },
      update: { state: sub.state, submittedAt: sub.submittedAt },
      create: sub
    })
  }

  console.log('Mock data seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
