const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/auth/google/callback`
);

const scopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly'
];

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// RBAC middleware
const requireRole = (roles = []) => (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.length > 0 && !allowed.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  next();
};

// Routes

// Auth routes
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

// Invitation management (Coordinator only)
app.get('/api/invitations', requireAuth, requireRole('coordinator'), async (req, res) => {
  try {
    const invites = await prisma.invitation.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(invites);
  } catch (error) {
    console.error('List invitations error:', error);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

app.post('/api/invitations', requireAuth, requireRole('coordinator'), async (req, res) => {
  try {
    const { email, role, cohort } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: 'email and role are required' });
    }
    const allowedRoles = ['student', 'teacher', 'coordinator'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const invite = await prisma.invitation.upsert({
      where: { email },
      update: { role, cohort: cohort || null },
      create: { email, role, cohort: cohort || null }
    });
    res.status(201).json(invite);
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

app.delete('/api/invitations/:id', requireAuth, requireRole('coordinator'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await prisma.invitation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Store or update user in database
    let user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name,
        token: JSON.stringify(tokens) // In production, encrypt this
      },
      create: {
        email: profile.email,
        name: profile.name,
        role: 'student', // Default role, can be updated later
        token: JSON.stringify(tokens)
      }
    });

    // Apply invitation if exists: set role and optional cohort for students
    try {
      const invite = await prisma.invitation.findUnique({ where: { email: user.email } });
      if (invite) {
        if (invite.role && invite.role !== user.role) {
          user = await prisma.user.update({ where: { id: user.id }, data: { role: invite.role } });
        }
        if (invite.role === 'student') {
          await prisma.student.upsert({
            where: { email: user.email },
            update: { cohort: invite.cohort || undefined },
            create: { email: user.email, name: user.name || user.email, cohort: invite.cohort || undefined }
          });
        }
        // one-time invite
        await prisma.invitation.delete({ where: { email: user.email } }).catch(() => {});
      }
    } catch (e) {
      console.warn('Invitation apply error:', e.message);
    }

    // Store user in session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    res.redirect(process.env.FRONTEND_URL);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out successfully' });
});

app.get('/auth/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.user.id } });
    const hasToken = !!(user && user.token);
    res.json({ ...req.session.user, hasToken });
  } catch (e) {
    res.json(req.session.user);
  }
});

// API routes
app.get('/api/sync', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id }
    });

    if (!user.token) {
      return res.status(400).json({ error: 'No Google token found' });
    }

    const tokens = JSON.parse(user.token);
    oauth2Client.setCredentials(tokens);

    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    // Fetch courses
    const coursesRes = await classroom.courses.list({ pageSize: 50 });
    const courses = coursesRes.data.courses || [];

    console.log(`Found ${courses.length} courses`);

    for (const course of courses) {
      // Try to resolve primary teacher email
      let teacherEmail = 'unknown';
      try {
        const teachersRes = await classroom.courses.teachers.list({ courseId: course.id });
        const teachers = teachersRes.data.teachers || [];
        if (teachers.length > 0) {
          // Use first teacher as primary
          teacherEmail = teachers[0]?.profile?.emailAddress || 'unknown';
        }
      } catch (err) {
        console.log(`Could not fetch teachers for course ${course.name}:`, err.message);
      }

      // Store course
      await prisma.course.upsert({
        where: { gcId: course.id },
        update: {
          name: course.name,
          teacherEmail
        },
        create: {
          gcId: course.id,
          name: course.name,
          teacherEmail
        }
      });

      // Fetch students for this course
      try {
        const studentsRes = await classroom.courses.students.list({
          courseId: course.id
        });
        const students = studentsRes.data.students || [];

        for (const student of students) {
          await prisma.student.upsert({
            where: { email: student.profile.emailAddress },
            update: {
              name: student.profile.name.fullName,
              gcUserId: student.userId
            },
            create: {
              email: student.profile.emailAddress,
              name: student.profile.name.fullName,
              cohort: course.name, // Use course name as cohort for now
              gcUserId: student.userId
            }
          });
        }
      } catch (error) {
        console.log(`Could not fetch students for course ${course.name}:`, error.message);
      }

      // Fetch coursework
      try {
        const courseworkRes = await classroom.courses.courseWork.list({
          courseId: course.id,
          pageSize: 50
        });
        const courseworks = courseworkRes.data.courseWork || [];

        for (const coursework of courseworks) {
          const dbCoursework = await prisma.coursework.upsert({
            where: { gcId: coursework.id },
            update: {
              title: coursework.title,
              description: coursework.description,
              dueDate: coursework.dueDate ? new Date(
                coursework.dueDate.year,
                coursework.dueDate.month - 1,
                coursework.dueDate.day
              ) : null
            },
            create: {
              gcId: coursework.id,
              title: coursework.title,
              description: coursework.description,
              dueDate: coursework.dueDate ? new Date(
                coursework.dueDate.year,
                coursework.dueDate.month - 1,
                coursework.dueDate.day
              ) : null,
              courseId: (await prisma.course.findUnique({ where: { gcId: course.id } })).id
            }
          });

          // Fetch submissions for this coursework
          try {
            const submissionsRes = await classroom.courses.courseWork.studentSubmissions.list({
              courseId: course.id,
              courseWorkId: coursework.id
            });
            const submissions = submissionsRes.data.studentSubmissions || [];

            for (const submission of submissions) {
              // Resolve Classroom userId to student email
              const studentRecord = await prisma.student.findFirst({ where: { gcUserId: submission.userId } });
              if (!studentRecord) {
                // If we cannot map, skip this submission (could log)
                continue;
              }

              await prisma.submission.upsert({
                where: {
                  courseworkId_studentEmail: {
                    courseworkId: dbCoursework.id,
                    studentEmail: studentRecord.email
                  }
                },
                update: {
                  state: submission.state,
                  submittedAt: submission.updateTime ? new Date(submission.updateTime) : null
                },
                create: {
                  courseworkId: dbCoursework.id,
                  studentEmail: studentRecord.email,
                  state: submission.state,
                  submittedAt: submission.updateTime ? new Date(submission.updateTime) : null
                }
              });
            }
          } catch (error) {
            console.log(`Could not fetch submissions for coursework ${coursework.title}:`, error.message);
          }
        }
      } catch (error) {
        console.log(`Could not fetch coursework for course ${course.name}:`, error.message);
      }
    }

    res.json({ 
      message: 'Sync completed successfully',
      coursesCount: courses.length
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

app.get('/api/courses', requireAuth, async (req, res) => {
  try {
    const { teacher } = req.query;
    const sessionUser = req.session.user;
    let where = {};
    if (sessionUser.role === 'teacher') {
      where.teacherEmail = sessionUser.email;
    } else if (sessionUser.role === 'coordinator') {
      if (teacher) where.teacherEmail = teacher;
    } else if (sessionUser.role === 'student') {
      // Students: in MVP we return empty list for courses
      return res.json([]);
    }
    
    const courses = await prisma.course.findMany({
      where,
      include: {
        courseworks: {
          include: {
            submissions: true
          }
        }
      }
    });
    
    res.json(courses);
  } catch (error) {
    console.error('Courses fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const { cohort, teacher } = req.query;
    const sessionUser = req.session.user;
    let where = {};
    
    if (cohort) {
      where.cohort = cohort;
    }
    
    // Role-based visibility
    if (sessionUser.role === 'student') {
      where.email = sessionUser.email;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        submissions: {
          include: {
            coursework: {
              include: {
                course: true
              }
            }
          }
        }
      }
    });

    // Calculate progress metrics for each student
    const studentsWithProgress = students.map(student => {
      // If teacher filter provided, only consider submissions from that teacher's courses
      let submissions = student.submissions;
      if (sessionUser.role === 'teacher') {
        submissions = submissions.filter(s => s.coursework?.course?.teacherEmail === sessionUser.email);
      } else if (teacher) {
        submissions = submissions.filter(s => s.coursework?.course?.teacherEmail === teacher);
      }
      const totalSubmissions = submissions.length;
      
      if (totalSubmissions === 0) {
        return {
          ...student,
          progress: {
            delivered: 0,
            late: 0,
            missing: 0,
            resubmission: 0,
            deliveredPercentage: 0,
            latePercentage: 0,
            missingPercentage: 0
          }
        };
      }

      const delivered = submissions.filter(s => 
        s.state === 'TURNED_IN' && 
        s.submittedAt && 
        s.coursework.dueDate && 
        new Date(s.submittedAt) <= new Date(s.coursework.dueDate)
      ).length;

      const late = submissions.filter(s => 
        s.state === 'TURNED_IN' && 
        s.submittedAt && 
        s.coursework.dueDate && 
        new Date(s.submittedAt) > new Date(s.coursework.dueDate)
      ).length;

      const missing = submissions.filter(s => 
        s.state === 'NEW' || s.state === 'CREATED' || !s.submittedAt
      ).length;

      const resubmission = submissions.filter(s => 
        s.state === 'RECLAIMED_BY_STUDENT' || s.state === 'RETURNED'
      ).length;

      return {
        ...student,
        progress: {
          delivered,
          late,
          missing,
          resubmission,
          deliveredPercentage: Math.round((delivered / totalSubmissions) * 100),
          latePercentage: Math.round((late / totalSubmissions) * 100),
          missingPercentage: Math.round((missing / totalSubmissions) * 100)
        }
      };
    });

    res.json(studentsWithProgress);
  } catch (error) {
    console.error('Students fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const { studentEmail, cohort, teacher } = req.query;
    
    let where = {};
    if (studentEmail) where.studentEmail = studentEmail;
    
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        coursework: {
          include: {
            course: true
          }
        },
        student: true
      }
    });

    // Group by student and calculate metrics
    const progressByStudent = {};
    
    submissions.forEach(submission => {
      const email = submission.studentEmail;
      if (!progressByStudent[email]) {
        progressByStudent[email] = {
          student: submission.student,
          submissions: [],
          coursework: []
        };
      }
      progressByStudent[email].submissions.push(submission);
      progressByStudent[email].coursework.push(submission.coursework);
    });

    res.json(progressByStudent);
  } catch (error) {
    console.error('Progress fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Developer auth helpers (impersonation) - enable only when DEV_AUTH=true
if (process.env.DEV_AUTH === 'true') {
  // Simple HTML dev console
  app.get('/dev', (req, res) => {
    res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dev Auth Console</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 24px; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      label { display: block; font-size: 12px; color: #374151; margin-top: 8px; }
      input, select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; }
      button { background: #2563eb; color: white; padding: 8px 12px; border: 0; border-radius: 6px; cursor: pointer; margin-top: 12px; }
      a { color: #2563eb; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Dev Auth Console</h1>

    <div class="card">
      <h3>Login / Impersonate</h3>
      <form method="post" action="/dev/login">
        <label>Email</label>
        <input name="email" placeholder="user@example.com" required />
        <label>Name</label>
        <input name="name" placeholder="Optional name" />
        <label>Role</label>
        <select name="role">
          <option value="student">student</option>
          <option value="teacher">teacher</option>
          <option value="coordinator">coordinator</option>
        </select>
        <label>Cohort (students only)</label>
        <input name="cohort" placeholder="Cohort A" />
        <button type="submit">Login</button>
      </form>
    </div>

    <div class="card">
      <h3>Switch Role</h3>
      <form method="post" action="/dev/role">
        <label>Role</label>
        <select name="role">
          <option value="student">student</option>
          <option value="teacher">teacher</option>
          <option value="coordinator">coordinator</option>
        </select>
        <button type="submit">Switch</button>
      </form>
    </div>

    <div class="card">
      <h3>Session</h3>
      <p><a href="/dev/me">/dev/me</a> — current session</p>
      <p><a href="/dev/logout">/dev/logout</a> — clear session</p>
    </div>

    <p>Open the frontend at <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" target="_blank">Frontend</a></p>
  </body>
}</html>`);
  });
  // Impersonate a user by email/role for local testing
  app.post('/dev/login', async (req, res) => {
    try {
      const { email, name, role = 'student', cohort } = req.body || {};
      if (!email) return res.status(400).json({ error: 'email required' });
      const allowed = ['student', 'teacher', 'coordinator'];
      if (!allowed.includes(role)) return res.status(400).json({ error: 'invalid role' });

      let user = await prisma.user.upsert({
        where: { email },
        update: { name: name || email, role },
        create: { email, name: name || email, role }
      });

      if (role === 'student') {
        await prisma.student.upsert({
          where: { email },
          update: { name: name || email, cohort: cohort || undefined },
          create: { email, name: name || email, cohort: cohort || undefined }
        });
      }

      // Set session
      req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
      res.json({ user: req.session.user, dev: true });
    } catch (e) {
      console.error('Dev login error:', e);
      res.status(500).json({ error: 'Dev login failed' });
    }
  });

  // Switch current session role quickly
  app.post('/dev/role', requireAuth, async (req, res) => {
    try {
      const { role } = req.body || {};
      const allowed = ['student', 'teacher', 'coordinator'];
      if (!allowed.includes(role)) return res.status(400).json({ error: 'invalid role' });
      const user = await prisma.user.update({ where: { id: req.session.user.id }, data: { role } });
      req.session.user.role = user.role;
      res.json({ user: req.session.user, dev: true });
    } catch (e) {
      console.error('Dev role switch error:', e);
      res.status(500).json({ error: 'Dev role switch failed' });
    }
  });

  app.get('/dev/me', (req, res) => {
    res.json({ user: req.session.user || null, dev: true });
  });

  app.get('/dev/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ message: 'Dev logged out', dev: true });
    });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
