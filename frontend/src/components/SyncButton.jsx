import { RotateCw } from 'lucide-react'

function SyncButton({ onSync, loading, disabled = false, title }) {
  return (
    <button
      onClick={onSync}
      disabled={loading || disabled}
      title={title}
      className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-white transition-colors duration-200 ${
        loading || disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
      }`}
    >
      <RotateCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync from Classroom'}
    </button>
  )
}

export default SyncButton
