function CourseList({ courses }) {
  return (
    <div className="space-y-4">
      {courses.length === 0 && (
        <div className="card">
          <p className="text-gray-600">No courses found. Try syncing or changing filters.</p>
        </div>
      )}

      {courses.map((course) => (
        <div key={course.id} className="card">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
              <p className="text-sm text-gray-500">Teacher: {course.teacherEmail}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{course.courseworks?.length || 0}</p>
              <p className="text-xs text-gray-500">assignments</p>
            </div>
          </div>

          {course.courseworks && course.courseworks.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Recent assignments</p>
              <ul className="space-y-2">
                {course.courseworks.slice(0, 3).map(cw => (
                  <li key={cw.id} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate mr-4">{cw.title}</span>
                    <span className="text-gray-500">{cw.submissions?.length || 0} submissions</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default CourseList
