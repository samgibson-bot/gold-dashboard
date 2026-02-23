import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SkillInfo } from '@/screens/admin/types'
import { adminQueryKeys } from '@/screens/admin/admin-queries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SkillsResponse = {
  ok: boolean
  error?: string
  skills?: Array<SkillInfo>
}

type SkillDetailResponse = {
  ok: boolean
  error?: string
  skill?: {
    name: string
    path: string
    frontmatter: Record<string, unknown>
    body: string
    raw: string
  }
}

export const Route = createFileRoute('/admin/skills')({
  component: SkillsPage,
})

function SkillsPage() {
  const queryClient = useQueryClient()
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showInstallForm, setShowInstallForm] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: adminQueryKeys.skills,
    queryFn: async function fetchSkills() {
      const res = await fetch('/api/admin/skills')
      if (!res.ok) throw new Error('Failed to fetch skills')
      return (await res.json()) as SkillsResponse
    },
    refetchInterval: 30_000,
  })

  const readMutation = useMutation({
    mutationFn: async function readSkill(name: string) {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'read', name }),
      })
      if (!res.ok) throw new Error('Failed to read skill')
      return (await res.json()) as SkillDetailResponse
    },
    onSuccess: function onReadSuccess(result) {
      if (result.skill) {
        setSkillContent(result.skill.raw)
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: async function createSkill(params: {
      name: string
      content: string
    }) {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...params }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error ?? 'Failed to create skill')
      }
    },
    onSuccess: function onCreateSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills })
      setShowInstallForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async function updateSkill(params: {
      name: string
      content: string
    }) {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...params }),
      })
      if (!res.ok) throw new Error('Failed to update skill')
    },
    onSuccess: function onUpdateSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills })
      setIsEditing(false)
      if (selectedSkill) {
        readMutation.mutate(selectedSkill)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async function deleteSkill(name: string) {
      const res = await fetch('/api/admin/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', name }),
      })
      if (!res.ok) throw new Error('Failed to delete skill')
    },
    onSuccess: function onDeleteSuccess() {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.skills })
      setSelectedSkill(null)
      setSkillContent(null)
      setDeleteConfirm(null)
    },
  })

  const skills = data?.skills ?? []
  const filteredSkills = searchFilter.trim()
    ? skills.filter(function matchSearch(s) {
        const q = searchFilter.toLowerCase()
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        )
      })
    : skills

  function handleView(name: string) {
    setSelectedSkill(name)
    setIsEditing(false)
    readMutation.mutate(name)
  }

  function handleStartEdit() {
    if (skillContent) {
      setEditContent(skillContent)
      setIsEditing(true)
    }
  }

  function handleSave() {
    if (selectedSkill && editContent) {
      updateMutation.mutate({ name: selectedSkill, content: editContent })
    }
  }

  function handleCloseDetail() {
    setSelectedSkill(null)
    setSkillContent(null)
    setIsEditing(false)
  }

  function handleInstallSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const content = String(formData.get('content') ?? '')
    if (name && content) {
      createMutation.mutate({ name, content })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-primary-950">Skills</h1>
          <p className="text-sm text-primary-500 mt-0.5">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} installed
          </p>
        </div>
        <Button
          size="sm"
          onClick={function handleInstall() {
            setShowInstallForm(true)
          }}
        >
          Install Skill
        </Button>
      </div>

      {showInstallForm ? (
        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
          <h2 className="text-sm font-medium text-primary-900 mb-3">
            Install New Skill
          </h2>
          <form onSubmit={handleInstallSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-primary-600">Skill Name</span>
              <input
                name="name"
                required
                pattern="[a-z0-9][a-z0-9-]*"
                placeholder="my-skill"
                className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface"
              />
            </label>
            <label className="block">
              <span className="text-xs text-primary-600">SKILL.md Content</span>
              <textarea
                name="content"
                rows={12}
                required
                placeholder={`---\nname: my-skill\ndescription: What this skill does\nversion: 1.0.0\ntrigger: /my-skill [args]\n---\n\n# My Skill\n\nInstructions for the skill...`}
                className="mt-1 block w-full text-sm border border-primary-200 rounded-md px-2 py-1 bg-surface font-mono"
              />
            </label>
            {createMutation.error ? (
              <div className="text-xs text-red-600">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create'}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={function handleCancel() {
                  setShowInstallForm(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {skills.length > 3 ? (
        <div>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchFilter}
            onChange={function handleSearch(e) {
              setSearchFilter(e.target.value)
            }}
            className="w-full text-sm bg-surface border border-primary-200 rounded-md px-3 py-1.5 outline-none focus:border-primary-400 transition-colors"
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-primary-500">Loading skills...</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-sm text-primary-500">
          {searchFilter ? 'No matching skills' : 'No skills installed'}
        </div>
      ) : (
        <div className="border border-primary-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-primary-50 border-b border-primary-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Trigger
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Version
                </th>
                <th className="px-3 py-2 text-left font-medium text-primary-700">
                  Agent
                </th>
                <th className="px-3 py-2 text-right font-medium text-primary-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filteredSkills.map(function renderSkill(skill) {
                return (
                  <tr
                    key={skill.name}
                    className={cn(
                      selectedSkill === skill.name && 'bg-primary-50',
                    )}
                  >
                    <td className="px-3 py-2 text-primary-900">
                      <div className="font-medium">{skill.name}</div>
                      {skill.description ? (
                        <div className="text-xs text-primary-500 truncate max-w-[250px]">
                          {skill.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-primary-700">
                      {skill.trigger ? (
                        <code className="text-xs bg-primary-100 px-1.5 py-0.5 rounded font-mono">
                          {skill.trigger}
                        </code>
                      ) : (
                        <span className="text-primary-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-primary-500 tabular-nums">
                      {skill.version || (
                        <span className="text-primary-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-primary-500">
                      {skill.agent || (
                        <span className="text-primary-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={function handleViewClick() {
                          handleView(skill.name)
                        }}
                        className="text-xs text-primary-600 hover:text-primary-900"
                      >
                        View
                      </button>
                      {deleteConfirm === skill.name ? (
                        <>
                          <button
                            onClick={function handleConfirmDelete() {
                              deleteMutation.mutate(skill.name)
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={function handleCancelDelete() {
                              setDeleteConfirm(null)
                            }}
                            className="text-xs text-primary-500"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={function handleDelete() {
                            setDeleteConfirm(skill.name)
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedSkill && skillContent !== null ? (
        <div className="border border-primary-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
            <h2 className="text-sm font-medium text-primary-900">
              {selectedSkill}
              <span className="text-primary-400 font-normal ml-2">
                SKILL.md
              </span>
            </h2>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={function handleCancelEdit() {
                      setIsEditing(false)
                    }}
                    className="text-xs text-primary-500 hover:text-primary-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-primary-600 hover:text-primary-900"
                >
                  Edit
                </button>
              )}
              <button
                onClick={handleCloseDetail}
                className="text-xs text-primary-500 hover:text-primary-700"
              >
                Close
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={function handleEditChange(e) {
                  setEditContent(e.target.value)
                }}
                className="w-full h-[450px] text-xs font-mono bg-primary-50 border border-primary-200 rounded p-3 resize-none outline-none focus:border-primary-400"
              />
            ) : (
              <pre className="text-xs text-primary-800 whitespace-pre-wrap font-mono">
                {skillContent}
              </pre>
            )}
          </div>
        </div>
      ) : selectedSkill && readMutation.isPending ? (
        <div className="text-sm text-primary-500">Loading skill content...</div>
      ) : null}
    </div>
  )
}
