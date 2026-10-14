import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  GitFork,
  Play,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cpu,
  Inbox,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Terminal,
  Wrench
} from 'lucide-react'
import { useAppStore } from './store'
import { ChatPage, HelpPage, InboxPage, LogsPage, NewRepoDialog, RepoDetail, SettingsPage, SkillsPage, ToolsPage } from './pages'

// EXPERIMENTAL light mode (invert hack). Not fleet standard - see index.css.
// Toggling `.dark` off the root flips the invert filter; persisted so the
// choice survives reloads. Delete this + the CSS block to revert.
const THEME_KEY = 'forgejo-light-mode'

// Webapp constants: backend version/docs are served same-origin via the vite
// proxy (see vite.config.js), so docs links stay relative and work from any host.
const APP_VERSION = '0.2.0'
const DOCS_PATH = '/docs'

export default function App() {
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !light)
    try {
      localStorage.setItem(THEME_KEY, light ? '1' : '0')
    } catch {
      // ignore storage errors
    }
  }, [light])

  const {
    activeView,
    sidebarCollapsed,
    profiles,
    activeProfile,
    profilesLoading,
    repos,
    reposLoading,
    reposError,
    runners,
    runnersLoading,
    runnersError,
    workflows,
    workflowsLoading,
    selectedRepo,
    serviceStatus,
    recentLogs,
    localLlmStatus,
    localLlmUrl,
    localLlmModel,
    setActiveView,
    setSidebarCollapsed,
    fetchProfiles,
    addProfile,
    setActiveProfile,
    deleteProfile,
    selectRepo,
    detectLocalLlm,
    fetchRepos,
    fetchRunners,
    fetchServiceStatus,
    fetchRecentLogs
  } = useAppStore()

  // Profile Form State
  const [profName, setProfName] = useState('')
  const [profUrl, setProfUrl] = useState('')
  const [profToken, setProfToken] = useState('')
  const [profLabel, setProfLabel] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [showNewRepo, setShowNewRepo] = useState(false)

  useEffect(() => {
    fetchProfiles()
    detectLocalLlm()
    fetchServiceStatus()
    fetchRecentLogs()
  }, [fetchProfiles, detectLocalLlm, fetchServiceStatus, fetchRecentLogs])

  const handleAddProfile = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    if (!profName || !profUrl || !profToken || !profLabel) {
      setFormError('All fields are required.')
      return
    }
    const res = await addProfile(profName, profUrl, profToken, profLabel)
    if (res.success) {
      setFormSuccess('Profile added successfully!')
      setProfName('')
      setProfUrl('')
      setProfToken('')
      setProfLabel('')
    } else {
      setFormError(res.error || 'Failed to add profile.')
    }
  }

  // Find active profile details
  const activeProfileData = activeProfile ? profiles[activeProfile] : null

  return (
    <div className="flex h-screen bg-surface-950 text-surface-100 overflow-hidden font-sans">
      {/* --- Sidebar --- */}
      <aside
        className={`bg-surface-900 border-r border-surface-800 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Header & Collapse Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-surface-800 h-16 shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <GitFork className="h-6 w-6 text-primary-500 animate-pulse" />
              <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-primary-400 to-amber-500 bg-clip-text text-transparent">
                FORGEJO MCP
              </span>
            </div>
          )}
          {sidebarCollapsed && (
            <GitFork className="h-6 w-6 text-primary-500 mx-auto" />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-testid="sidebar-toggle"
            className="p-1.5 rounded bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-100 transition-colors focus:outline-none"
            aria-label="Toggle Sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'inbox', label: 'Inbox', icon: Inbox },
            { id: 'profiles', label: 'Profiles', icon: Users },
            { id: 'repositories', label: 'Repositories', icon: GitFork },
            { id: 'runners', label: 'Actions Runners', icon: Play },
            { id: 'tools', label: 'Tools', icon: Wrench },
            { id: 'skills', label: 'Skills', icon: Sparkles },
            { id: 'chat', label: 'Chat', icon: MessageSquare },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'logs', label: 'Logs', icon: Terminal },
            { id: 'help', label: 'Help', icon: CircleHelp },
            { id: 'apidocs', label: 'API Docs', icon: BookOpen }
          ].map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-500 text-surface-950 font-semibold shadow-lg shadow-primary-500/25'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-surface-800 text-sm text-surface-500 shrink-0">
          {!sidebarCollapsed && (
            <div className="flex flex-col gap-1">
              <div>Version {APP_VERSION}</div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${activeProfile ? 'bg-green-500' : 'bg-red-500 animate-ping'}`} />
                <span>{activeProfile ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* --- Main Application Area --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Fixed Topbar */}
        <header className="bg-surface-900 border-b border-surface-800 h-16 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold capitalize text-surface-200">
              {activeView === 'apidocs' ? 'API Documentation' : activeView}
            </h2>

            {/* Active profile badge in topbar */}
            {activeProfileData && (
              <div className="hidden sm:flex items-center gap-2 bg-surface-800 border border-surface-700 px-3 py-1 rounded-full text-sm text-surface-300">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span>Instance: <strong>{activeProfileData.label}</strong></span>
                <span className="text-surface-500">({activeProfileData.url})</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Day mode toggle */}
            <button
              type="button"
              onClick={() => setLight((v) => !v)}
              className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-100 transition-colors"
              title={light ? "Switch to dark (experimental light mode)" : "Switch to light (experimental, ugly)"}
              aria-label="Toggle light mode (experimental)"
            >
              {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Local LLM Autodiscovery Status */}
            <div className="flex items-center gap-2 bg-surface-850 px-3 py-1 rounded-lg border border-surface-800 text-sm">
              <Cpu className="h-4 w-4 text-amber-500" />
              {localLlmStatus === 'detected' ? (
                <span className="text-green-400">AI: {localLlmModel}</span>
              ) : localLlmStatus === 'checking' ? (
                <span className="text-surface-500">Scanning local LLM...</span>
              ) : (
                <span className="text-surface-400 hover:text-amber-300 cursor-pointer" onClick={detectLocalLlm} title="Click to rescan">
                  GPU Opportunity Available
                </span>
              )}
            </div>

            {/* Profile Dropdown Switcher */}
            <div className="flex items-center gap-2">
              <select
                value={activeProfile || ''}
                onChange={(e) => setActiveProfile(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg text-sm px-3 py-1.5 text-surface-200 focus:outline-none focus:border-primary-500"
              >
                <option value="" disabled>Select Profile...</option>
                {Object.entries(profiles).map(([name, p]) => (
                  <option key={name} value={name}>{p.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => window.open(DOCS_PATH, '_blank')}
              className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-100 transition-colors"
              title="Pop Out API Docs"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* --- Dynamic Page Body --- */}
        <main className="flex-1 overflow-y-auto p-6 bg-surface-950">

          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">

              {/* Hero */}
              <div
                data-testid="dashboard-hero"
                className="bg-gradient-to-r from-surface-900 via-surface-900 to-primary-950/40 border border-surface-800 rounded-xl px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${serviceStatus ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div className="min-w-0">
                      <h2 className="font-bold text-base text-surface-100 leading-tight">Forgejo Companion</h2>
                      <p className="text-sm text-surface-400 mt-1 leading-relaxed">
                        The self-hosted GitHub alternative (a Gitea fork — Codeberg.org runs it), managed
                        here: repositories, issues, pull requests, runners, inbox, plus local-LLM chat.
                        New? Add a profile, then hit <strong className="text-surface-300">Triage inbox</strong> below.
                        No forge yet? Codeberg.org is free.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-400 shrink-0">
                    <code className="font-mono bg-surface-950 border border-surface-800 px-2 py-1 rounded">v{APP_VERSION}</code>
                    <code className="font-mono bg-surface-950 border border-surface-800 px-2 py-1 rounded">:11132/:11133</code>
                    {serviceStatus && (
                      <span className="text-surface-500">up {Math.round(serviceStatus.uptime_seconds)}s · {serviceStatus.tool_count} tools</span>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface-900 border border-surface-800 p-4 rounded-xl shadow-lg">
                  <div className="text-sm text-surface-500 font-medium">ACTIVE PROFILE</div>
                  <div className="text-lg font-bold text-surface-200 mt-1 truncate">
                    {activeProfileData ? activeProfileData.label : 'None Configured'}
                  </div>
                  <div className="text-sm text-surface-400 mt-1 truncate">
                    {activeProfileData ? activeProfileData.url : 'Set a profile to start'}
                  </div>
                </div>

                <div className="bg-surface-900 border border-surface-800 p-4 rounded-xl shadow-lg">
                  <div className="text-sm text-surface-500 font-medium">REPOSITORIES</div>
                  <div className="text-2xl font-bold text-primary-500 mt-1">
                    {reposLoading ? '...' : repos.length}
                  </div>
                  <div className="text-sm text-surface-400 mt-1">
                    {activeProfile ? 'Loaded from profile' : 'N/A'}
                  </div>
                </div>

                <div className="bg-surface-900 border border-surface-800 p-4 rounded-xl shadow-lg">
                  <div className="text-sm text-surface-500 font-medium">ONLINE RUNNERS</div>
                  <div className="text-2xl font-bold text-green-500 mt-1">
                    {runnersLoading ? '...' : runners.filter(r => r.status === 'online').length}
                  </div>
                  <div className="text-sm text-surface-400 mt-1">
                    Total runners: {runners.length}
                  </div>
                </div>

                <div className="bg-surface-900 border border-surface-800 p-4 rounded-xl shadow-lg">
                  <div className="text-sm text-surface-500 font-medium">LOCAL COPILOT</div>
                  <div className="text-lg font-bold text-amber-500 mt-1 truncate">
                    {localLlmStatus === 'detected' ? localLlmModel : 'Disabled'}
                  </div>
                  <div className="text-sm text-surface-400 mt-1 truncate">
                    {localLlmStatus === 'detected' ? localLlmUrl : 'No local engine running'}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-quick-actions">
                <button
                  onClick={() => setShowNewRepo(true)}
                  data-testid="quick-action-new-repo"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" /> New repository
                </button>
                <button
                  onClick={() => setActiveView('inbox')}
                  data-testid="quick-action-inbox"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-900 hover:bg-surface-800 border border-surface-800 text-sm text-surface-200 rounded-lg transition-colors"
                >
                  <Inbox className="h-4 w-4" /> Triage inbox
                </button>
                <button
                  onClick={() => setActiveView('repositories')}
                  data-testid="quick-action-repos"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-900 hover:bg-surface-800 border border-surface-800 text-sm text-surface-200 rounded-lg transition-colors"
                >
                  <GitFork className="h-4 w-4" /> Review PRs
                </button>
                <button
                  onClick={() => setActiveView('chat')}
                  data-testid="quick-action-chat"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-900 hover:bg-surface-800 border border-surface-800 text-sm text-surface-200 rounded-lg transition-colors"
                >
                  <MessageSquare className="h-4 w-4" /> Ask chat
                </button>
                <button
                  onClick={detectLocalLlm}
                  data-testid="quick-action-rescan"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-900 hover:bg-surface-800 border border-surface-800 text-sm text-surface-200 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Rescan LLM
                </button>
              </div>

              {/* GPU Opportunity Banner */}
              {localLlmStatus === 'not_detected' && (
                <div
                  data-testid="onboarding-cue"
                  className="bg-gradient-to-r from-amber-500/10 to-primary-600/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-sm text-surface-400 truncate">
                      <strong className="text-amber-400 font-semibold">No local LLM detected.</strong>
                      <span> Install Ollama or LM Studio (ports 11434/1234) — the dashboard binds automatically for free code summarization and PR reviews.</span>
                    </p>
                  </div>
                  <button
                    onClick={() => window.open('https://ollama.com', '_blank')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-surface-950 text-sm font-semibold rounded-lg shrink-0 transition-colors"
                  >
                    Download Ollama
                  </button>
                </div>
              )}

              {/* Status Details / Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Instance Info */}
                <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg space-y-4">
                  <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2">
                    INSTANCE CONNECTION HEALTH
                  </h3>

                  {activeProfileData ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-400">Endpoint URL</span>
                        <code className="text-sm text-primary-400 bg-surface-950 px-2.5 py-1 rounded">{activeProfileData.url}</code>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-400">Active Profile Key</span>
                        <code className="text-sm text-surface-300 bg-surface-950 px-2.5 py-1 rounded">{activeProfile}</code>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-surface-400">Connection Status</span>
                        <div className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span>Connected (HTTP 200)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-surface-500 text-sm">
                      No active instance configured. Navigate to "Profiles" to add one.
                    </div>
                  )}
                </div>

                {/* Recent Logs Preview */}
                <div
                  data-testid="dashboard-recent-logs"
                  className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg space-y-3"
                >
                  <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2 flex items-center justify-between">
                    <span>RECENT WARNINGS</span>
                    <button
                      onClick={() => setActiveView('logs')}
                      data-testid="recent-logs-view-all"
                      className="text-sm text-primary-400 hover:underline font-normal"
                    >
                      View all
                    </button>
                  </h3>
                  {recentLogs.length === 0 && (
                    <div className="text-sm text-surface-500 italic py-2">All quiet — no warnings or errors.</div>
                  )}
                  <div className="space-y-1.5">
                    {recentLogs.map((l, i) => (
                      <div key={i} className="text-sm text-surface-400 break-words">
                        <span className={l.level === 'INFO' ? 'text-green-400' : 'text-amber-400'}>
                          {l.level}
                        </span>{' '}
                        <span className="text-surface-500">{l.time}</span>{' '}
                        {l.message.slice(0, 90)}{l.message.length > 90 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profiles Page */}
          {activeView === 'profiles' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Configured Profiles list */}
              <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
                <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2">
                  CONFIGURED PROFILES
                </h3>

                {profilesLoading && <div className="text-center py-6 text-sm text-surface-500">Loading profiles...</div>}

                {Object.keys(profiles).length === 0 && !profilesLoading && (
                  <div className="text-center py-8 text-sm text-surface-500">
                    No profiles configured. Use the form on the right to register your first connection profile.
                  </div>
                )}

                <div className="space-y-3">
                  {Object.entries(profiles).map(([name, p]) => {
                    const isActive = name === activeProfile
                    return (
                      <div
                        key={name}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-surface-850 border-primary-500/50 shadow-md shadow-primary-500/5'
                            : 'bg-surface-900 border-surface-800 hover:border-surface-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-surface-200">{p.label}</span>
                            {isActive && (
                              <span className="text-[10px] bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded font-semibold border border-primary-500/20">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-surface-500 truncate max-w-xs sm:max-w-md">{p.url}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <button
                              onClick={() => setActiveProfile(name)}
                              className="px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-100 text-sm font-semibold rounded transition-colors"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => deleteProfile(name)}
                            className="p-1.5 bg-surface-800 hover:bg-red-500/20 hover:text-red-400 text-surface-400 rounded transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Add Profile Form */}
              <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg space-y-4 h-fit">
                <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2">
                  ADD NEW PROFILE
                </h3>

                <form onSubmit={handleAddProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm text-surface-400 font-medium mb-1.5">Profile Key Slug</label>
                    <input
                      type="text"
                      placeholder="e.g. local-dev"
                      data-testid="profile-key"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-surface-400 font-medium mb-1.5">Display Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Local Server"
                      data-testid="profile-label"
                      value={profLabel}
                      onChange={(e) => setProfLabel(e.target.value)}
                      className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-surface-400 font-medium mb-1.5">Instance Base URL</label>
                    <input
                      type="text"
                      placeholder="e.g. http://localhost:3000 or https://codeberg.org"
                      data-testid="profile-url"
                      value={profUrl}
                      onChange={(e) => setProfUrl(e.target.value)}
                      className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-surface-400 font-medium mb-1.5">Personal Access Token (PAT)</label>
                    <input
                      type="password"
                      placeholder="Enter Forgejo API Token"
                      data-testid="profile-token"
                      value={profToken}
                      onChange={(e) => setProfToken(e.target.value)}
                      className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  {formError && (
                    <div className="flex items-center gap-1.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="flex items-center gap-1.5 text-sm text-green-400 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    data-testid="profile-add"
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary-500 hover:bg-primary-600 text-surface-950 font-bold rounded-lg text-sm tracking-wider transition-colors shadow-lg shadow-primary-500/25"
                  >
                    <Plus className="h-4 w-4" />
                    REGISTER PROFILE
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Repositories Page */}
          {activeView === 'repositories' && (
            <div className="space-y-6">

              {!activeProfile && (
                <div className="bg-surface-900 border border-surface-800 rounded-xl p-8 text-center text-sm text-surface-500">
                  Select an active profile in the top bar to view repositories.
                </div>
              )}

              {activeProfile && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Repo Grid */}
                  <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg lg:col-span-2 space-y-4">
                    <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2 flex items-center justify-between">
                      <span>REPOSITORIES ({repos.length})</span>
                      <span className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowNewRepo(true)}
                          data-testid="repo-create-open"
                          title="New repository"
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary-500 hover:bg-primary-600 text-surface-950 text-sm font-semibold"
                        >
                          <Plus className="h-3.5 w-3.5" /> New
                        </button>
                        <button onClick={fetchRepos} className="p-1 rounded bg-surface-850 hover:bg-surface-800 text-surface-400">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </h3>

                    {reposLoading && <div className="text-center py-6 text-sm text-surface-500">Loading repositories...</div>}
                    {reposError && <div className="text-sm text-red-400 text-center py-4 bg-red-500/5 rounded">{reposError}</div>}

                    {!reposLoading && repos.length === 0 && (
                      <div className="text-center py-8 text-sm text-surface-500">No repositories found.</div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                      {repos.map((r) => {
                        const isSelected = selectedRepo?.id === r.id
                        return (
                          <div
                            key={r.id}
                            onClick={() => selectRepo(r)}
                            className={`p-4 rounded-xl border cursor-pointer text-left transition-all ${
                              isSelected
                                ? 'bg-surface-850 border-primary-500'
                                : 'bg-surface-900 border-surface-800 hover:border-surface-700'
                            }`}
                          >
                            <span className="font-semibold text-sm tracking-wider text-surface-200 block truncate">{r.name}</span>
                            <span className="text-[10px] text-surface-500 block truncate">Owner: @{r.owner.username}</span>
                            <span className="text-sm text-surface-400 mt-2 line-clamp-2 min-h-[2rem]">
                              {r.description || 'No description provided.'}
                            </span>
                            <div className="flex items-center gap-2 mt-3 text-[10px] text-surface-500">
                              <span>Stars: {r.stars_count || 0}</span>
                              <span>Forks: {r.forks_count || 0}</span>
                              <span className="ml-auto">{r.private ? '🔒 Private' : '🌐 Public'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Detail Panel */}
                  <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg space-y-4 h-fit">
                    <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2">
                      REPOSITORY DRILL-DOWN
                    </h3>

                    <RepoDetail workflows={workflows} workflowsLoading={workflowsLoading} />
                  </div>

                </div>
              )}
              <NewRepoDialog open={showNewRepo} onClose={() => setShowNewRepo(false)} />
            </div>
          )}

          {/* Runners Page */}
          {activeView === 'runners' && (
            <div className="space-y-6">

              {!activeProfile && (
                <div className="bg-surface-900 border border-surface-800 rounded-xl p-8 text-center text-sm text-surface-500">
                  Select an active profile in the top bar to inspect runners.
                </div>
              )}

              {activeProfile && (
                <div className="space-y-6">
                  {/* Runners Listing */}
                  <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 shadow-lg space-y-4">
                    <h3 className="font-semibold text-sm tracking-wider text-surface-300 border-b border-surface-800 pb-2 flex items-center justify-between">
                      <span>CONNECTED ACTIONS RUNNERS</span>
                      <button onClick={fetchRunners} className="p-1 rounded bg-surface-850 hover:bg-surface-800 text-surface-400">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </h3>

                    {runnersLoading && <div className="text-center py-6 text-sm text-surface-500">Loading runner agents...</div>}
                    {runnersError && <div className="text-sm text-red-400 text-center py-4 bg-red-500/5 rounded">{runnersError}</div>}

                    {!runnersLoading && runners.length === 0 && (
                      <div className="text-center py-8 text-sm text-surface-500">
                        No runners configured on instance. Make sure you register a `forgejo-runner` to the instance.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {runners.map((r) => (
                        <div key={r.id} className="bg-surface-850 border border-surface-800 rounded-xl p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm tracking-wider text-surface-200">{r.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {r.status}
                            </span>
                          </div>

                          <div className="text-[10px] text-surface-500 space-y-1 mt-1 border-t border-surface-800 pt-2">
                            <div>Agent ID: <code className="text-surface-300">{r.id}</code></div>
                            <div>Version: <code className="text-surface-300">{r.version}</code></div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {r.agent_labels?.map((l, i) => (
                                <span key={i} className="bg-surface-800 text-surface-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                  {l}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inbox Page */}
          {activeView === 'inbox' && <InboxPage />}

          {/* Tools Page */}
          {activeView === 'tools' && <ToolsPage />}

          {/* Skills Page */}
          {activeView === 'skills' && <SkillsPage />}

          {/* Chat Page */}
          {activeView === 'chat' && <ChatPage />}

          {/* Settings Page */}
          {activeView === 'settings' && <SettingsPage />}

          {/* Logs Page */}
          {activeView === 'logs' && <LogsPage />}

          {/* Help Page */}
          {activeView === 'help' && <HelpPage />}

          {/* API Docs Page */}
          {activeView === 'apidocs' && (
            <div className="bg-surface-900 border border-surface-800 rounded-xl shadow-lg h-[80vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-surface-800 bg-surface-850 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-sm text-surface-400">
                  <BookOpen className="h-4 w-4 text-primary-500" />
                   <span>FastAPI Swagger Introspection (Backend :11133)</span>
                </div>
                <button
                  onClick={() => window.open(DOCS_PATH, '_blank')}
                  className="text-sm text-primary-500 hover:text-primary-400 font-semibold inline-flex items-center gap-1.5"
                >
                  Open in New Tab <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <iframe
                src="/docs"
                className="flex-1 w-full border-none"
                title="FastAPI Swagger UI"
              />
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
