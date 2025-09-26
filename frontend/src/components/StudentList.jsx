function ProgressBar({ label, value, color = 'bg-primary-600' }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function StudentList({ students, onStudentSelect, selectedStudent }) {
  return (
    <div className="space-y-4">
      {students.length === 0 && (
        <div className="card">
          <p className="text-gray-600">No students found. Try syncing or changing filters.</p>
        </div>
      )}

      {students.map((student) => (
        <div
          key={student.email}
          className={`card cursor-pointer ${selectedStudent?.email === student.email ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => onStudentSelect?.(student)}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{student.name || student.email}</h3>
              <p className="text-sm text-gray-500">{student.email}</p>
              {student.cohort && (
                <p className="text-xs text-gray-400 mt-1">Cohort: {student.cohort}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{student.progress?.deliveredPercentage ?? 0}%</p>
              <p className="text-xs text-gray-500">delivered</p>
            </div>
          </div>

          <div className="mt-4">
            <ProgressBar label="Delivered on time" value={student.progress?.deliveredPercentage ?? 0} color="bg-green-500" />
            <ProgressBar label="Late" value={student.progress?.latePercentage ?? 0} color="bg-yellow-500" />
            <ProgressBar label="Missing" value={student.progress?.missingPercentage ?? 0} color="bg-red-500" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default StudentList
