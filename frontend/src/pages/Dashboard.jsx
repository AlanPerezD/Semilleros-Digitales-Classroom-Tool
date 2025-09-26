import { useState, useEffect } from 'react'
import axios from 'axios'
import Header from '../components/Header'
import FilterPanel from '../components/FilterPanel'
import StudentList from '../components/StudentList'
import CourseList from '../components/CourseList'
import ProgressChart from '../components/ProgressChart'
import SyncButton from '../components/SyncButton'
import LoadingSpinner from '../components/LoadingSpinner'
import { Users, BookOpen, BarChart3 } from 'lucide-react'

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('students')
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    cohort: '',
    teacher: '',
    status: ''
  })
  const [selectedStudent, setSelectedStudent] = useState(null)

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'students') {
        await loadStudents()
      } else if (activeTab === 'courses') {
        await loadCourses()
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStudents = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.cohort) params.append('cohort', filters.cohort)
      if (filters.teacher) params.append('teacher', filters.teacher)
      
      const response = await axios.get(`/api/students?${params}`)
      setStudents(response.data)
    } catch (error) {
      console.error('Error loading students:', error)
    }
  }

  const loadCourses = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.teacher) params.append('teacher', filters.teacher)
      
      const response = await axios.get(`/api/courses?${params}`)
      setCourses(response.data)
    } catch (error) {
      console.error('Error loading courses:', error)
    }
  }

  const handleSync = async () => {
    setLoading(true)
    try {
      await axios.get('/api/sync')
      await loadData()
      alert('Sync completed successfully!')
    } catch (error) {
      console.error('Sync error:', error)
      alert('Sync failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student => {
    if (filters.status) {
      const progress = student.progress
      switch (filters.status) {
        case 'delivered':
          return progress.deliveredPercentage > 70
        case 'late':
          return progress.latePercentage > 20
        case 'missing':
          return progress.missingPercentage > 30
        default:
          return true
      }
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={onLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <SyncButton 
            onSync={handleSync} 
            loading={loading}
            disabled={!user?.hasToken}
            title={!user?.hasToken ? 'Sync is disabled because this session has no Google token. Login with Google to sync.' : ''}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'students'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4 mr-2" />
            Students
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'courses'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Courses
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters */}
          <div className="lg:col-span-1">
            <FilterPanel filters={filters} onFiltersChange={setFilters} />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {!user?.hasToken && (
              <div className="mb-4 p-4 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                This session was started via dev impersonation or without Google OAuth, so there is no Google token available. Sync is disabled. You can still browse any mock or previously synced data. To sync fresh data from Google Classroom, log out and sign in with Google.
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                {activeTab === 'students' && (
                  <StudentList 
                    students={filteredStudents} 
                    onStudentSelect={setSelectedStudent}
                    selectedStudent={selectedStudent}
                  />
                )}
                {activeTab === 'courses' && (
                  <CourseList courses={courses} />
                )}
                {activeTab === 'analytics' && (
                  <ProgressChart students={students} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
