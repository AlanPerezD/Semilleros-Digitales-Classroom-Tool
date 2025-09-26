import { useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts'

const COLORS = ['#22c55e', '#eab308', '#ef4444']

function ProgressChart({ students }) {
  const data = useMemo(() => {
    if (!students || students.length === 0) return []
    let delivered = 0
    let late = 0
    let missing = 0

    students.forEach(s => {
      delivered += s.progress?.delivered || 0
      late += s.progress?.late || 0
      missing += s.progress?.missing || 0
    })

    return [
      { name: 'Delivered', value: delivered },
      { name: 'Late', value: late },
      { name: 'Missing', value: missing },
    ]
  }, [students])

  if (data.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-600">No data available yet. Try syncing first.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Status Overview</h3>
      <div className="w-full h-80">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ProgressChart
