import { useState, useEffect } from 'react'

function FilterPanel({ filters, onFiltersChange }) {
  const [localFilters, setLocalFilters] = useState(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const apply = () => onFiltersChange(localFilters)
  const reset = () => onFiltersChange({ cohort: '', teacher: '', status: '' })

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Filters</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Cohort</label>
        <input
          type="text"
          value={localFilters.cohort}
          onChange={e => setLocalFilters({ ...localFilters, cohort: e.target.value })}
          placeholder="e.g., Cohort A"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Teacher email</label>
        <input
          type="email"
          value={localFilters.teacher}
          onChange={e => setLocalFilters({ ...localFilters, teacher: e.target.value })}
          placeholder="teacher@example.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          value={localFilters.status}
          onChange={e => setLocalFilters({ ...localFilters, status: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All</option>
          <option value="delivered">Delivered (on time) high</option>
          <option value="late">Late high</option>
          <option value="missing">Missing high</option>
        </select>
      </div>

      <div className="flex items-center space-x-3 pt-2">
        <button className="btn-primary" onClick={apply}>Apply</button>
        <button className="btn-secondary" onClick={reset}>Reset</button>
      </div>
    </div>
  )
}

export default FilterPanel
