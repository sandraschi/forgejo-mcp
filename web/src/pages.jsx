import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Cpu,
  Download,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Wrench
} from 'lucide-react'
import { useAppStore } from './store'

const CHAT_HISTORY_KEY = 'forgejo-chat-history'
const CHAT_MAX_MESSAGES = 100

function PageShell({ title, children, action }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm tracking-wider text-surface-300">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function LoadingRow({ text }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-surface-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  )
}

function ErrorRow({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message}
      </span>
      {onRetry && (
        <button onClick={onRetry} className="px-2.5 py-1 bg-surface-800 hover:bg-surface-700 rounded text-surface-200 shrink-0">
          Retry
        </button>
      )}
    </div>
  )
}

function EmptyRow({ text, action }) {
  return (
    <div className="text-center py-8 text-sm text-surface-500 space-y-3">
      <div>{text}</div>
      {action}
    </div>
  )
}

// ── Tools ────────────────────────────────────────────────────────────────────

export function ToolsPage() {
  const { toolDetails, toolsLoading, toolsError, fetchTools } = useAppStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const filtered = toolDetails.filter(
    (t) =>
      !query ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <PageShell
      title={`MCP TOOLS (${filtered.length}/${toolDetails.length})`}
      action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              data-testid="search-tools"
              className="bg-surface-900 border border-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
            />
          </div>
          <button onClick={fetchTools} className="p-1.5 rounded bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-100">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {toolsLoading && <LoadingRow text="Loading tool capabilities..." />}
      {toolsError && <ErrorRow message={toolsError} onRetry={fetchTools} />}
      {!toolsLoading && !toolsError && filtered.length === 0 && (
        <EmptyRow text={query ? `No tools match "${query}".` : 'No tools registered.'} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t) => (
          <div
            key={t.name}
            data-testid={`tool-card-${t.name}`}
            className="bg-surface-900 border border-surface-800 rounded-xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-mono text-primary-400 break-all">{t.name}</code>
              <span
                className={`text-sm px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  t.read_only ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {t.read_only ? 'read-only' : 'mutating'}
              </span>
            </div>
            <p className="text-sm text-surface-400">{t.description || 'No description.'}</p>
          </div>
        ))}
      </div>
    </PageShell>
  )
}

// ── Skills ───────────────────────────────────────────────────────────────────

export function SkillsPage() {
  const { skillData, skillsLoading, skillsError, fetchSkills } = useAppStore()

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  return (
    <PageShell
      title="SKILLS"
      action={
        <button onClick={fetchSkills} className="p-1.5 rounded bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-100">
          <RefreshCw className="h-4 w-4" />
        </button>
      }
    >
      {skillsLoading && <LoadingRow text="Loading skills..." />}
      {skillsError && <ErrorRow message={skillsError} onRetry={fetchSkills} />}
      {skillData && (
        <div className="space-y-4">
          {(skillData.skills || []).map((s) => (
            <div key={s.name} className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span className="font-semibold text-sm text-surface-100">{s.name}</span>
              </div>
              <code className="block text-sm font-mono text-surface-500">{s.uri}</code>
              <p className="text-sm text-surface-400">{s.description}</p>
            </div>
          ))}
          {skillData.prompt_text && (
            <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-sm text-surface-300">
                PROMPT: {skillData.prompt} (prepended to skill-first chats)
              </h4>
              <pre className="bg-surface-950 p-3 rounded font-mono text-sm text-surface-300 overflow-x-auto whitespace-pre-wrap">
                {skillData.prompt_text}
              </pre>
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}

// ── Inbox ────────────────────────────────────────────────────────────────────

export function InboxPage() {
  const {
    notifications,
    notificationsLoading,
    notificationsError,
    notificationsUnreadOnly,
    setNotificationsUnreadOnly,
    fetchNotifications,
    activeProfile
  } = useAppStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const filtered = notifications.filter(
    (n) =>
      !query ||
      (n.subject?.title || '').toLowerCase().includes(query.toLowerCase()) ||
      (n.subject?.type || '').toLowerCase().includes(query.toLowerCase())
  )

  if (!activeProfile) {
    return (
      <PageShell title="INBOX">
        <EmptyRow text="Select an active profile in the top bar to read notifications." />
      </PageShell>
    )
  }

  return (
    <PageShell
      title={`INBOX (${filtered.length})`}
      action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads..."
              data-testid="search-inbox"
              className="bg-surface-900 border border-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={notificationsUnreadOnly ? 'unread' : 'all'}
            onChange={(e) => setNotificationsUnreadOnly(e.target.value === 'unread')}
            className="bg-surface-900 border border-surface-800 rounded-lg text-sm px-3 py-1.5 text-surface-200 focus:outline-none"
          >
            <option value="unread">Unread</option>
            <option value="all">All</option>
          </select>
          <button onClick={fetchNotifications} className="p-1.5 rounded bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-100">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {notificationsLoading && <LoadingRow text="Loading notification threads..." />}
      {notificationsError && <ErrorRow message={notificationsError} onRetry={fetchNotifications} />}
      {!notificationsLoading && !notificationsError && filtered.length === 0 && (
        <EmptyRow text={notificationsUnreadOnly ? 'Inbox zero. No unread threads.' : 'No notification threads.'} />
      )}
      <div className="space-y-3">
        {filtered.map((n, i) => (
          <div key={n.id || i} className="bg-surface-900 border border-surface-800 rounded-xl p-4 flex items-start gap-3">
            <Inbox className={`h-4 w-4 mt-0.5 shrink-0 ${n.unread ? 'text-amber-400' : 'text-surface-600'}`} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-surface-200 break-words">
                [{n.subject?.type || '?'}] {n.subject?.title || '(no title)'}
              </div>
              <div className="text-sm text-surface-500 mt-1">
                {n.unread ? 'Unread' : 'Read'} · Updated {n.updated_at || '?'}
                {n.subject?.url && (
                  <>
                    {' · '}
                    <a href={n.subject.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                      Open
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}

// ── Logs ─────────────────────────────────────────────────────────────────────

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

export function LogsPage() {
  const { logs, logsCount, logsLoading, logsError, logsLevel, logsSearch, setLogsLevel, setLogsSearch, fetchLogs } =
    useAppStore()
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const timer = setInterval(fetchLogs, 5000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchLogs])

  return (
    <PageShell
      title={`SERVER LOGS (${logsCount})`}
      action={
        <div className="flex items-center gap-2">
          <input
            value={logsSearch}
            onChange={(e) => setLogsSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchLogs()
            }}
            placeholder="Search logs..."
            data-testid="search-logs"
            className="bg-surface-900 border border-surface-800 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
          />
          <select
            value={logsLevel}
            onChange={(e) => setLogsLevel(e.target.value)}
            data-testid="logs-level"
            className="bg-surface-900 border border-surface-800 rounded-lg text-sm px-3 py-1.5 text-surface-200 focus:outline-none"
          >
            {LOG_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}+
              </option>
            ))}
          </select>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            data-testid="logs-autorefresh"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              autoRefresh
                ? 'bg-primary-500 text-surface-950 border-primary-500'
                : 'bg-surface-900 border-surface-800 text-surface-400'
            }`}
          >
            Auto
          </button>
          <button
            onClick={fetchLogs}
            data-testid="logs-refresh"
            className="p-1.5 rounded bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {logsLoading && <LoadingRow text="Loading logs..." />}
      {logsError && <ErrorRow message={logsError} onRetry={fetchLogs} />}
      {!logsLoading && !logsError && logs.length === 0 && <EmptyRow text="No log records match." />}
      <div className="bg-surface-950 border border-surface-800 rounded-xl p-3 space-y-1 max-h-[60vh] overflow-y-auto font-mono">
        {logs.map((l, i) => (
          <div key={i} className="text-sm text-surface-300 break-words">
            <span className="text-surface-600">{l.time}</span>{' '}
            <span
              className={
                l.level === 'ERROR' || l.level === 'CRITICAL'
                  ? 'text-red-400'
                  : l.level === 'WARNING'
                    ? 'text-amber-400'
                    : 'text-green-400'
              }
            >
              {l.level}
            </span>{' '}
            <span className="text-surface-500">{l.logger}</span> {l.message}
          </div>
        ))}
      </div>
    </PageShell>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const {
    serviceStatus,
    serviceStatusLoading,
    fetchServiceStatus,
    profiles,
    llmProviders,
    llmLoading,
    llmError,
    selectedProvider,
    selectedModel,
    setLlmProvider,
    setLlmModel,
    fetchLlmProviders,
    setActiveView
  } = useAppStore()

  useEffect(() => {
    fetchServiceStatus()
    fetchLlmProviders()
  }, [fetchServiceStatus, fetchLlmProviders])

  const activeProvider = llmProviders.find((p) => p.id === selectedProvider)
  const hasProfiles = Object.keys(profiles).length > 0

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm tracking-wider text-surface-300">SETTINGS</h3>

      {!hasProfiles && (
        <button
          onClick={() => setActiveView('profiles')}
          data-testid="onboarding-cue"
          className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 text-left transition-colors"
        >
          <div className="font-semibold text-sm text-red-300">No Forgejo profile configured — set one up to start</div>
          <div className="text-sm text-surface-400 mt-1">
            Add your instance URL + personal access token on the Profiles page.
          </div>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary-500" /> SERVICE
          </h4>
          {serviceStatusLoading && <LoadingRow text="Loading service status..." />}
          {serviceStatus && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-500">Version</dt>
                <dd className="text-surface-200 font-mono">{serviceStatus.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Uptime</dt>
                <dd className="text-surface-200 font-mono">{Math.round(serviceStatus.uptime_seconds)}s</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">MCP tools</dt>
                <dd className="text-surface-200 font-mono">{serviceStatus.tool_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Profiles</dt>
                <dd className="text-surface-200 font-mono">
                  {serviceStatus.profiles_configured} ({serviceStatus.active_profile || 'none active'})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Ports</dt>
                <dd className="text-surface-200 font-mono">frontend :11132 · backend :11133</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-4">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500" /> LOCAL LLM
          </h4>
          {llmLoading && <LoadingRow text="Probing local providers..." />}
          {llmError && <ErrorRow message={llmError} onRetry={fetchLlmProviders} />}
          {!llmLoading && llmProviders.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-surface-300">
                {p.name} <code className="text-surface-500">({p.url})</code>
              </span>
              <span className={p.detected ? 'text-green-400' : 'text-surface-600'}>
                {p.detected ? `detected (${p.models.length} models)` : 'not found'}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-surface-400 font-medium mb-1">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                data-testid="llm-provider-select"
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
              >
                {llmProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-400 font-medium mb-1">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setLlmModel(e.target.value)}
                data-testid="llm-model-select"
                className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
              >
                {(activeProvider?.models || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {(!activeProvider || activeProvider.models.length === 0) && <option value="">No models</option>}
              </select>
            </div>
          </div>
          <button
            onClick={fetchLlmProviders}
            data-testid="llm-test"
            className="w-full py-2 bg-surface-800 hover:bg-surface-700 rounded-lg text-sm font-medium text-surface-200 transition-colors"
          >
            Rescan local providers
          </button>
          <p className="text-sm text-surface-500">
            Chat runs through the backend proxy — provider endpoints are never called from the browser.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Help ─────────────────────────────────────────────────────────────────────

export function HelpPage() {
  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm tracking-wider text-surface-300">HELP</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary-500" /> GETTING STARTED
          </h4>
          <ol className="text-sm text-surface-400 space-y-2 list-decimal list-inside">
            <li>Create a personal access token on your Forgejo/Codeberg instance (repo + issue scopes).</li>
            <li>Open Profiles and register the instance URL + token, then activate it.</li>
            <li>Browse Repositories, check Actions Runners, read the Inbox.</li>
            <li>Ask the Chat page to triage issues or review PR diffs.</li>
          </ol>
          <p className="text-sm text-surface-500">
            Full onboarding notes: <code className="text-surface-300">docs/ONBOARDING.md</code> in the repo.
            This server speaks Forgejo/Gitea API — for GitHub.com use git-github-mcp.
          </p>
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary-500" /> MCP QUICK REFERENCE
          </h4>
          <ul className="text-sm text-surface-400 space-y-2">
            <li><code className="text-primary-400">forgejo_profiles</code> — list/add/set_active/remove instances.</li>
            <li><code className="text-primary-400">forgejo_repos</code> — list/create/search repos, file_get contents.</li>
            <li><code className="text-primary-400">forgejo_issues</code> — list/create issues, comment on issues + PRs.</li>
            <li><code className="text-primary-400">forgejo_prs</code> — list/create/merge/diff pull requests.</li>
            <li><code className="text-primary-400">forgejo_actions</code> — runners/workflow_runs/notifications.</li>
            <li><code className="text-primary-400">forgejo_status</code> — health snapshot. All tools return dialogic dicts.</li>
          </ul>
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary-500" /> CHAT + LOCAL LLM
          </h4>
          <p className="text-sm text-surface-400">
            The Chat page proxies Ollama (:11434) or LM Studio (:1234) through the backend —
            nothing is sent to the cloud. Pick a provider + model in Settings or Chat, choose a
            personality (Triage, PR Reviewer, Release Notes, Custom), and stream answers.
            History persists locally (100 message cap) and exports to .txt.
          </p>
        </div>
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <h4 className="font-semibold text-sm text-surface-300 border-b border-surface-800 pb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary-500" /> TROUBLESHOOTING
          </h4>
          <ul className="text-sm text-surface-400 space-y-2">
            <li>401s everywhere → expired PAT or wrong forge URL; re-add the profile.</li>
            <li>Empty repos/runners → token lacks scopes, or the instance URL is wrong.</li>
            <li>Chat reports no model → start Ollama/LM Studio, then Rescan in Settings.</li>
            <li>Backend unreachable → <code className="text-surface-300">.\start.ps1</code>, then check <code className="text-surface-300">/health</code> on :11133.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Chat ─────────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'Summarize the open issues in this repo.',
  'Review the latest open PR diff for risks.',
  'Which runners are offline right now?',
  'Draft release notes from recent merged PRs.',
  'What is in my notification inbox?',
  'Explain how profiles switch instances.'
]

export function ChatPage() {
  const {
    skillData,
    skillsLoading,
    fetchSkills,
    llmProviders,
    selectedProvider,
    selectedModel,
    setLlmProvider,
    setLlmModel,
    fetchLlmProviders
  } = useAppStore()

  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.slice(-CHAT_MAX_MESSAGES) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState('')
  const [personality, setPersonality] = useState('triage')
  const [customSystem, setCustomSystem] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchSkills()
    fetchLlmProviders()
  }, [fetchSkills, fetchLlmProviders])

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-CHAT_MAX_MESSAGES)))
    } catch {
      // ignore storage errors
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const triageText = skillData?.prompt_text || ''
  const personalities = [
    { id: 'triage', label: 'Triage Assistant', system: triageText },
    {
      id: 'reviewer',
      label: 'PR Reviewer',
      system: `${triageText}\nYou review pull-request diffs: correctness, edge cases, tests, and style. Be concrete and cite files/lines.`
    },
    {
      id: 'release',
      label: 'Release Notes',
      system: `${triageText}\nYou draft release notes from merged PRs and closed issues: grouped, terse, user-facing.`
    },
    { id: 'custom', label: 'Custom', system: customSystem }
  ]
  const activePersonality = personalities.find((p) => p.id === personality) || personalities[0]

  const sendMessage = async (text) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    if (!selectedModel) {
      setChatError('No model selected. Start Ollama/LM Studio and pick a model above.')
      return
    }
    setChatError('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setStreaming(true)
    try {
      const res = await fetch('/api/llm/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          system: activePersonality.system,
          messages: next.slice(-20).map((m) => ({ role: m.role, content: m.content }))
        })
      })
      if (!res.ok || !res.body) throw new Error(`Chat proxy returned HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistant = ''
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const event = JSON.parse(payload)
            if (event.error) throw new Error(event.error)
            if (event.delta) {
              assistant += event.delta
              const snapshot = assistant
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: 'assistant', content: snapshot }
                return copy
              })
            }
          } catch (e) {
            if (e.message && !e.message.startsWith('{')) throw e
          }
        }
      }
      if (!assistant) throw new Error('Empty reply from provider.')
    } catch (err) {
      setChatError(err.message || 'Chat request failed.')
    } finally {
      setStreaming(false)
    }
  }

  const exportChat = () => {
    const text = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'forgejo-chat-export.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearChat = () => {
    setMessages([])
    setChatError('')
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY)
    } catch {
      // ignore storage errors
    }
  }

  const activeProvider = llmProviders.find((p) => p.id === selectedProvider)

  return (
    <div data-testid="chat-page" className="flex flex-col h-full space-y-4">
      <div data-testid="chat-controls" className="bg-surface-900 border border-surface-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-surface-400 font-medium mb-1">Personality</label>
            <select
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              data-testid="personality-select"
              className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
            >
              {personalities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-400 font-medium mb-1">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              data-testid="llm-provider-select"
              className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
            >
              {llmProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.detected ? '' : ' (not detected)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-surface-400 font-medium mb-1">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setLlmModel(e.target.value)}
              data-testid="llm-model-select"
              className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
            >
              {(activeProvider?.models || []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {(!activeProvider || activeProvider.models.length === 0) && <option value="">No models</option>}
            </select>
          </div>
        </div>
        {personality === 'custom' && (
          <textarea
            value={customSystem}
            onChange={(e) => setCustomSystem(e.target.value)}
            placeholder="Custom system prompt..."
            rows={2}
            className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none"
          />
        )}
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <span className={`h-2 w-2 rounded-full ${activeProvider?.detected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>
            {activeProvider?.detected
              ? `${activeProvider.name} detected · skill-first (${skillData ? 'prompt loaded' : skillsLoading ? 'loading prompt...' : 'prompt unavailable'})`
              : 'No local provider detected — start Ollama or LM Studio, then rescan in Settings.'}
          </span>
        </div>
      </div>

      <div data-testid="chat-messages" className="flex-1 min-h-[30vh] max-h-[50vh] overflow-y-auto space-y-3 bg-surface-900 border border-surface-800 rounded-xl p-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <MessageSquare className="h-8 w-8 mx-auto text-surface-600" />
            <p className="text-sm text-surface-400">
              Ask about your Forgejo instances — triage issues, review diffs, check runners.
            </p>
            <div data-testid="example-prompts" className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage(ex)}
                  disabled={streaming}
                  className="px-3 py-1.5 bg-surface-800 hover:bg-surface-700 rounded-full text-sm text-surface-300 transition-colors disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm whitespace-pre-wrap break-words ${
                m.role === 'user' ? 'bg-primary-500 text-surface-950' : 'bg-surface-800 text-surface-200'
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {chatError && <ErrorRow message={chatError} onRetry={() => messages.length > 0 && sendMessage(messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '')} />}

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="Ask about repos, issues, PRs, runners..."
          data-testid="chat-input"
          disabled={streaming}
          className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-4 py-2.5 text-sm text-surface-200 focus:outline-none focus:border-primary-500 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={streaming || !input.trim()}
          data-testid="chat-send"
          className="p-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-surface-950 transition-colors disabled:opacity-50"
          aria-label="Send"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
        <button
          onClick={exportChat}
          disabled={messages.length === 0}
          data-testid="chat-export"
          title="Export to .txt"
          className="p-2.5 rounded-lg bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-100 transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={clearChat}
          disabled={messages.length === 0}
          data-testid="chat-clear"
          title="Clear chat"
          className="p-2.5 rounded-lg bg-surface-900 border border-surface-800 text-surface-400 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
