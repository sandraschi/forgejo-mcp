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
  Webhook,
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
  const { webhookEvents, webhookLoading, webhookError, fetchWebhookEvents } = useAppStore()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [tab, setTab] = useState('logs')

  useEffect(() => {
    fetchLogs()
    fetchWebhookEvents()
  }, [fetchLogs, fetchWebhookEvents])

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
      <div className="flex items-center gap-1 bg-surface-900 border border-surface-800 rounded-lg p-1 w-fit">
        {[
          { id: 'logs', label: 'Server logs' },
          { id: 'webhooks', label: `Webhook deliveries (${webhookEvents.length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`logs-tab-${t.id}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-surface-700 text-surface-100' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'logs' && (
        <>
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
        </>
      )}

      {tab === 'webhooks' && (
        <>
          {webhookLoading && <LoadingRow text="Loading webhook deliveries..." />}
          {webhookError && <ErrorRow message={webhookError} onRetry={fetchWebhookEvents} />}
          {!webhookLoading && !webhookError && webhookEvents.length === 0 && (
            <EmptyRow text="No webhook deliveries yet. Point a repo webhook at POST /api/webhooks/forgejo with FORGEJO_WEBHOOK_SECRET." />
          )}
          <div className="space-y-3">
            {webhookEvents.map((e, i) => (
              <div key={i} className="bg-surface-900 border border-surface-800 rounded-xl p-4 flex items-start gap-3">
                <Webhook className="h-4 w-4 mt-0.5 shrink-0 text-primary-400" />
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-surface-200 break-words">
                    {e.event} {e.repository && <span className="text-surface-400">· {e.repository}</span>}
                  </div>
                  <div className="text-surface-500 mt-1">
                    {e.time}
                    {e.sender && ` · by ${e.sender}`}
                    {e.delivery && ` · ${e.delivery}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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

      <ShutdownCard />
    </div>
  )
}

function ShutdownCard() {
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState('')
  const [failed, setFailed] = useState('')

  const fire = async () => {
    setFailed('')
    try {
      const res = await fetch('/api/shutdown', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'shutting_down') {
        setDone('Shutdown signal accepted — the backend is exiting. Restart it with start.ps1 or the fleet launcher.')
      } else {
        setFailed('Unexpected shutdown response.')
      }
    } catch {
      // A failed fetch right after POST usually means the server already exited.
      setDone('No response — the backend has likely already exited. Restart it with start.ps1 or the fleet launcher.')
    }
  }

  return (
    <div className="bg-surface-900 border border-red-500/30 rounded-xl p-5 space-y-3">
      <h4 className="font-semibold text-sm text-red-300 border-b border-red-500/20 pb-2">DANGER ZONE</h4>
      <p className="text-sm text-surface-400">
        Stop the backend process (orderly exit, in-flight writes flush). The dashboard will go dark until restarted.
      </p>
      {done && <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">{done}</div>}
      {failed && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{failed}</div>}
      {!done && (
        <button
          onClick={() => (armed ? fire() : setArmed(true))}
          onBlur={() => setArmed(false)}
          data-testid="shutdown-backend"
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            armed ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-surface-800 hover:bg-surface-700 text-red-300'
          }`}
        >
          {armed ? 'Click again to confirm shutdown' : 'Shut down backend'}
        </button>
      )}
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
            <Wrench className="h-4 w-4 text-primary-500" /> WRITING FROM THE DASHBOARD
          </h4>
          <ul className="text-sm text-surface-400 space-y-2">
            <li>Repositories header: <strong className="text-surface-200">New</strong> opens the create dialog (private by default).</li>
            <li>Drill-down tabs per repo: <strong className="text-surface-200">Issues</strong> (state filter, open + comment), <strong className="text-surface-200">Pulls</strong> (open, diff viewer, style select, two-click merge), <strong className="text-surface-200">Files</strong> (path + ref reader).</li>
            <li>Merges and shutdowns are two-click: first click arms, second fires. Nothing mutates on a single stray click.</li>
            <li>Settings bottom: Danger Zone stops the backend (orderly exit, restart via start.ps1).</li>
            <li>Logs page, Webhook deliveries tab: the last 50 signed inbound events (configure secret via FORGEJO_WEBHOOK_SECRET).</li>
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

// ── Repository Detail Tabs (Issues / Pulls / Files) ──────────────────────────

const ISSUE_STATES = ['open', 'closed', 'all']
const PR_STATES = ['open', 'closed', 'all']
const MERGE_STYLES = ['merge', 'rebase', 'squash']

function MutationBanner() {
  const { mutationError, mutationOk } = useAppStore()
  if (mutationError) {
    return (
      <div data-testid="mutation-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
        {mutationError}
      </div>
    )
  }
  if (mutationOk) {
    return (
      <div data-testid="mutation-ok" className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg">
        {mutationOk}
      </div>
    )
  }
  return null
}

function IssuesTab() {
  const {
    repoIssues, repoIssuesLoading, repoIssuesError, repoIssuesState,
    setRepoIssuesState, createIssue, commentOnIssue
  } = useAppStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState('')
  const [commentFor, setCommentFor] = useState(null)
  const [commentBody, setCommentBody] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setFormError('Title is required.')
      return
    }
    setFormError('')
    const ok = await createIssue(title.trim(), body)
    if (ok) {
      setTitle('')
      setBody('')
    }
  }

  const sendComment = async (index) => {
    if (!commentBody.trim()) return
    const ok = await commentOnIssue(index, commentBody)
    if (ok) {
      setCommentFor(null)
      setCommentBody('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-surface-300 text-sm">ISSUES ({repoIssues.length})</span>
        <select
          value={repoIssuesState}
          onChange={(e) => setRepoIssuesState(e.target.value)}
          data-testid="issues-state"
          className="bg-surface-950 border border-surface-800 rounded-lg text-sm px-2.5 py-1.5 text-surface-200 focus:outline-none"
        >
          {ISSUE_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <form onSubmit={submit} className="bg-surface-950 border border-surface-800 rounded-lg p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New issue title..."
          data-testid="issue-new-title"
          className="w-full bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Description (markdown, optional)..."
          rows={2}
          data-testid="issue-new-body"
          className="w-full bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        {formError && <div className="text-sm text-red-400">{formError}</div>}
        <button
          type="submit"
          data-testid="issue-create"
          className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold rounded-lg transition-colors"
        >
          Open issue
        </button>
      </form>

      <MutationBanner />
      {repoIssuesLoading && <LoadingRow text="Loading issues..." />}
      {repoIssuesError && <ErrorRow message={repoIssuesError} />}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {repoIssues.map((issue) => (
          <div key={issue.number} className="bg-surface-950 border border-surface-800 rounded-lg p-3 space-y-1.5">
            <div className="text-sm font-medium text-surface-200 break-words">
              #{issue.number} {issue.title}
              <span className="ml-2 text-surface-500">({issue.state}, {issue.comments ?? 0} comments)</span>
            </div>
            {commentFor === issue.number ? (
              <div className="flex items-center gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Write a comment..."
                  data-testid={`issue-comment-input-${issue.number}`}
                  className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={() => sendComment(issue.number)}
                  data-testid={`issue-comment-send-${issue.number}`}
                  className="px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 rounded-lg"
                >
                  Post
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCommentFor(issue.number)}
                data-testid={`issue-comment-open-${issue.number}`}
                className="text-sm text-primary-400 hover:underline"
              >
                Comment
              </button>
            )}
          </div>
        ))}
        {!repoIssuesLoading && repoIssues.length === 0 && (
          <div className="text-sm text-surface-500 italic">No issues found.</div>
        )}
      </div>
    </div>
  )
}

function PullsTab() {
  const {
    repoPulls, repoPullsLoading, repoPullsError, repoPullsState,
    setRepoPullsState, createPr, mergePr, fetchPrDiff
  } = useAppStore()
  const [title, setTitle] = useState('')
  const [head, setHead] = useState('')
  const [base, setBase] = useState('main')
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState('')
  const [diffFor, setDiffFor] = useState(null)
  const [diffText, setDiffText] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [mergeArmed, setMergeArmed] = useState(null)
  const [mergeStyle, setMergeStyle] = useState('merge')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !head.trim() || !base.trim()) {
      setFormError('Title, head, and base are required.')
      return
    }
    setFormError('')
    const ok = await createPr({ title: title.trim(), head: head.trim(), base: base.trim(), body })
    if (ok) {
      setTitle('')
      setHead('')
      setBody('')
    }
  }

  const showDiff = async (index) => {
    if (diffFor === index) {
      setDiffFor(null)
      return
    }
    setDiffFor(index)
    setDiffLoading(true)
    setDiffText(await fetchPrDiff(index))
    setDiffLoading(false)
  }

  const doMerge = async (index) => {
    if (mergeArmed !== index) {
      setMergeArmed(index)
      return
    }
    setMergeArmed(null)
    await mergePr(index, mergeStyle)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-surface-300 text-sm">PULL REQUESTS ({repoPulls.length})</span>
        <select
          value={repoPullsState}
          onChange={(e) => setRepoPullsState(e.target.value)}
          data-testid="pulls-state"
          className="bg-surface-950 border border-surface-800 rounded-lg text-sm px-2.5 py-1.5 text-surface-200 focus:outline-none"
        >
          {PR_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <form onSubmit={submit} className="bg-surface-950 border border-surface-800 rounded-lg p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New PR title..."
          data-testid="pr-new-title"
          className="w-full bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={head}
            onChange={(e) => setHead(e.target.value)}
            placeholder="head branch"
            data-testid="pr-new-head"
            className="bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
          />
          <input
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="base branch"
            data-testid="pr-new-base"
            className="bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
          />
        </div>
        {formError && <div className="text-sm text-red-400">{formError}</div>}
        <button
          type="submit"
          data-testid="pr-create"
          className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold rounded-lg transition-colors"
        >
          Open pull request
        </button>
      </form>

      <MutationBanner />
      {repoPullsLoading && <LoadingRow text="Loading pull requests..." />}
      {repoPullsError && <ErrorRow message={repoPullsError} />}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {repoPulls.map((pr) => (
          <div key={pr.number} className="bg-surface-950 border border-surface-800 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium text-surface-200 break-words">
              #{pr.number} {pr.title}
              <span className="ml-2 text-surface-500">
                {pr.head?.ref} {'\u2794'} {pr.base?.ref} · {pr.state}
                {typeof pr.mergeable === 'boolean' && (pr.mergeable ? ' · mergeable' : ' · conflicted')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => showDiff(pr.number)}
                data-testid={`pr-diff-${pr.number}`}
                className="px-2.5 py-1 bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 rounded-lg"
              >
                {diffFor === pr.number ? 'Hide diff' : 'Diff'}
              </button>
              <select
                value={mergeArmed === pr.number ? mergeStyle : 'merge'}
                onChange={(e) => setMergeStyle(e.target.value)}
                data-testid={`pr-merge-style-${pr.number}`}
                className="bg-surface-900 border border-surface-800 rounded-lg text-sm px-2 py-1 text-surface-200 focus:outline-none"
              >
                {MERGE_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => doMerge(pr.number)}
                onBlur={() => setMergeArmed(null)}
                data-testid={`pr-merge-${pr.number}`}
                className={`px-2.5 py-1 text-sm font-semibold rounded-lg transition-colors ${
                  mergeArmed === pr.number
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-surface-800 hover:bg-surface-700 text-surface-200'
                }`}
              >
                {mergeArmed === pr.number ? 'Confirm merge' : 'Merge'}
              </button>
            </div>
            {diffFor === pr.number && (
              <pre data-testid="pr-diff-view" className="bg-surface-900 p-2.5 rounded font-mono text-sm text-surface-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {diffLoading ? 'Loading diff...' : diffText}
              </pre>
            )}
          </div>
        ))}
        {!repoPullsLoading && repoPulls.length === 0 && (
          <div className="text-sm text-surface-500 italic">No pull requests found.</div>
        )}
      </div>
    </div>
  )
}

function FilesTab() {
  const { filePath, fileRef, fileContent, fileLoading, fileError, setFilePath, setFileRef, fetchFileContent } =
    useAppStore()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchFileContent()
          }}
          placeholder="README.md"
          data-testid="file-path"
          className="bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <input
          value={fileRef}
          onChange={(e) => setFileRef(e.target.value)}
          placeholder="main"
          data-testid="file-ref"
          className="w-24 bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={fetchFileContent}
          data-testid="file-load"
          className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold rounded-lg transition-colors"
        >
          Load
        </button>
      </div>
      {fileLoading && <LoadingRow text="Reading file..." />}
      {fileError && <ErrorRow message={fileError} onRetry={fetchFileContent} />}
      {!fileLoading && !fileError && fileContent && (
        <pre data-testid="file-content" className="bg-surface-950 border border-surface-800 p-3 rounded-lg font-mono text-sm text-surface-300 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-words">
          {fileContent}
        </pre>
      )}
    </div>
  )
}

export function RepoDetail({ workflows, workflowsLoading }) {
  const { selectedRepo } = useAppStore()
  const [tab, setTab] = useState('overview')

  if (!selectedRepo) {
    return (
      <div className="text-center py-12 text-surface-500 text-sm italic">
        Select a repository from the grid to view details.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="font-semibold text-sm text-surface-100 block">{selectedRepo.full_name}</span>
        <a
          href={selectedRepo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-500 hover:underline inline-flex items-center gap-1.5 mt-1 text-sm"
        >
          Open in Forgejo
        </a>
      </div>

      <div className="flex items-center gap-1 bg-surface-950 border border-surface-800 rounded-lg p-1 w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'issues', label: 'Issues' },
          { id: 'pulls', label: 'Pulls' },
          { id: 'files', label: 'Files' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`repo-tab-${t.id}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-surface-700 text-surface-100' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5 text-sm text-surface-400">
          <div className="space-y-2 border-t border-surface-800 pt-3">
            <span className="font-medium text-surface-300 block">Actions workflows runs:</span>
            {workflowsLoading && <div className="text-surface-500">Fetching runs...</div>}
            {workflows.length === 0 && !workflowsLoading && (
              <div className="text-surface-500 italic">No workflow runs found.</div>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {workflows.slice(0, 5).map((run) => (
                <div key={run.id} className="flex items-center justify-between bg-surface-950 p-2 rounded">
                  <span className="truncate max-w-[10rem] font-mono text-sm">{run.title}</span>
                  <span className={`text-sm px-1.5 py-0.5 rounded font-semibold ${
                    run.conclusion === 'success'
                      ? 'bg-green-500/10 text-green-400'
                      : run.conclusion === 'failure'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {run.conclusion || run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-surface-800 pt-3">
            <span className="font-medium text-surface-300 block">Clone Commands:</span>
            <pre className="bg-surface-950 p-2.5 rounded font-mono text-sm text-surface-300 overflow-x-auto select-all">
              git clone {selectedRepo.clone_url}
            </pre>
          </div>
        </div>
      )}

      {tab === 'issues' && <IssuesTab />}
      {tab === 'pulls' && <PullsTab />}
      {tab === 'files' && <FilesTab />}
    </div>
  )
}

export function NewRepoDialog({ open, onClose }) {
  const { createRepo, mutationError, mutationOk } = useAppStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [formError, setFormError] = useState('')

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setFormError('Repository name is required.')
      return
    }
    setFormError('')
    const ok = await createRepo({ name: name.trim(), description, isPrivate })
    if (ok) {
      setName('')
      setDescription('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        data-testid="repo-create-dialog"
        className="bg-surface-900 border border-surface-700 rounded-xl p-6 w-full max-w-md space-y-4"
      >
        <h4 className="font-semibold text-sm text-surface-200">NEW REPOSITORY</h4>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Repository name..."
          data-testid="repo-create-name"
          className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)..."
          data-testid="repo-create-desc"
          className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
        />
        <label className="flex items-center gap-2 text-sm text-surface-300">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            data-testid="repo-create-private"
          />
          Private repository
        </label>
        {formError && <div className="text-sm text-red-400">{formError}</div>}
        {mutationError && <div className="text-sm text-red-400">{mutationError}</div>}
        {mutationOk && <div className="text-sm text-green-400">{mutationOk}</div>}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="repo-create-cancel"
            className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="repo-create-submit"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold rounded-lg"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
