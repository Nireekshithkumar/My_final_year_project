import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import ThemeToggle from '../components/ThemeToggle'

export default function Dashboard() {
  const [pipelines, setPipelines] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const loadPipelines = async () => {
      try {
        const { data } = await api.get('/pipelines/')
        setPipelines(data)
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login')
          return
        }
        setError('Unable to load pipelines right now.')
      }
    }

    loadPipelines()
  }, [navigate])

  const create = async () => {
    if (!name.trim()) return

    try {
      const { data } = await api.post('/pipelines/', { name })
      navigate(`/pipeline/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the pipeline.')
    }
  }

  const deletePipeline = async (id) => {
    try {
      await api.delete(`/pipelines/${id}/`)
      setPipelines((current) => current.filter((pipeline) => pipeline.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to delete the pipeline.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Pipelines</h1>
        <ThemeToggle />
      </div>

      <div className="flex gap-3 mb-8">
        <input
          className="border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-4 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Pipeline name..."
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          onClick={create}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
        >
          + New Pipeline
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pipelines.map((pipeline) => (
          <div key={pipeline.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{pipeline.name}</h2>
              <p className="text-sm text-gray-400">{new Date(pipeline.created_at).toLocaleDateString()}</p>
              <span className={`text-xs font-medium px-2 py-1 rounded-full mt-1 inline-block ${
                pipeline.graph?.status === 'success' ? 'bg-green-100 text-green-700' :
                pipeline.graph?.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                pipeline.graph?.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {pipeline.graph?.status || 'idle'}
              </span>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => navigate(`/pipeline/${pipeline.id}`)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition"
              >
                Open
              </button>
              <button
                onClick={() => deletePipeline(pipeline.id)}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 text-sm py-2 rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}