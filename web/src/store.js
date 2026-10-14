import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // Navigation & UI state
  activeView: 'dashboard',
  sidebarCollapsed: false,
  setActiveView: (view) => set({ activeView: view }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Profiles State
  profiles: {},
  activeProfile: null,
  profilesLoading: false,
  profilesError: null,

  // Repositories State
  repos: [],
  reposLoading: false,
  reposError: null,

  // Runners & Workflows State
  runners: [],
  runnersLoading: false,
  runnersError: null,
  workflows: [],
  workflowsLoading: false,
  workflowsError: null,

  // Service Status State
  serviceStatus: null,
  serviceStatusLoading: false,

  // Notifications (Inbox) State
  notifications: [],
  notificationsLoading: false,
  notificationsError: null,
  notificationsUnreadOnly: true,

  // Tools & Skills State
  toolDetails: [],
  toolsLoading: false,
  toolsError: null,
  skillData: null,
  skillsLoading: false,
  skillsError: null,

  // Logs State
  logs: [],
  logsCount: 0,
  logsLoading: false,
  logsError: null,
  logsLevel: 'INFO',
  logsSearch: '',

  // Local LLM State (backend-proxied discovery)
  llmProviders: [],
  llmLoading: false,
  llmError: null,
  selectedProvider: (() => { try { return localStorage.getItem('llm_provider') || '' } catch { return '' } })(),
  selectedModel: (() => { try { return localStorage.getItem('llm_model') || '' } catch { return '' } })(),

  // Selection
  selectedRepo: null,

  // Local LLM Detection
  localLlmStatus: 'checking', // checking, detected, not_detected
  localLlmUrl: '',
  localLlmModel: '',

  // --- Profile Operations ---
  fetchProfiles: async () => {
    set({ profilesLoading: true, profilesError: null });
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      set({
        profiles: data.profiles || {},
        activeProfile: data.active_profile || null,
        profilesLoading: false
      });
      if (data.active_profile) {
        get().fetchRepos();
        get().fetchRunners();
      }
    } catch (err) {
      set({ profilesError: err.message, profilesLoading: false });
    }
  },

  addProfile: async (name, url, token, label) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, token, label })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchProfiles();
        return { success: true };
      }
      return { success: false, error: data.detail || 'Failed to add profile' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  setActiveProfile: async (name) => {
    try {
      const res = await fetch('/api/profiles/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        set({ activeProfile: name, repos: [], runners: [], selectedRepo: null });
        await get().fetchProfiles();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  deleteProfile: async (name) => {
    try {
      const res = await fetch(`/api/profiles/${name}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchProfiles();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  // --- Repository Operations ---
  fetchRepos: async () => {
    const active = get().activeProfile;
    if (!active) return;
    set({ reposLoading: true, reposError: null });
    try {
      const res = await fetch(`/api/repos?profile=${active}`);
      const payload = await res.json();
      if (payload.success) {
        set({ repos: payload.data || [], reposLoading: false });
      } else {
        set({ reposError: payload.error || 'Failed to load repositories', reposLoading: false });
      }
    } catch (err) {
      set({ reposError: err.message, reposLoading: false });
    }
  },

  // --- Runner Operations ---
  fetchRunners: async (owner = null, repo = null) => {
    const active = get().activeProfile;
    if (!active) return;
    set({ runnersLoading: true, runnersError: null });
    try {
      let url = `/api/runners?profile=${active}`;
      if (owner && repo) {
        url += `&owner=${owner}&repo=${repo}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        set({ runners: data.data || [], runnersLoading: false });
      } else {
        set({ runnersError: data.error || 'Failed to load runners', runnersLoading: false });
      }
    } catch (err) {
      set({ runnersError: err.message, runnersLoading: false });
    }
  },

  // --- Workflow Runs ---
  fetchWorkflows: async (owner, repo) => {
    const active = get().activeProfile;
    if (!active) return;
    set({ workflowsLoading: true, workflowsError: null });
    try {
      const res = await fetch(`/api/workflows?profile=${active}&owner=${owner}&repo=${repo}`);
      const data = await res.json();
      if (data.success) {
        set({ workflows: data.data?.action_runs || [], workflowsLoading: false });
      } else {
        set({ workflowsError: data.error || 'Failed to load workflow runs', workflowsLoading: false });
      }
    } catch (err) {
      set({ workflowsError: err.message, workflowsLoading: false });
    }
  },

  // --- Service Status ---
  fetchServiceStatus: async () => {
    set({ serviceStatusLoading: true });
    try {
      const res = await fetch('/api/status');
      set({ serviceStatus: await res.json(), serviceStatusLoading: false });
    } catch {
      set({ serviceStatus: null, serviceStatusLoading: false });
    }
  },

  // --- Notifications (Inbox) ---
  fetchNotifications: async () => {
    const active = get().activeProfile;
    if (!active) return;
    set({ notificationsLoading: true, notificationsError: null });
    try {
      const unread = get().notificationsUnreadOnly;
      const res = await fetch(`/api/notifications?profile=${active}&unread_only=${unread}`);
      const payload = await res.json();
      if (payload.success) {
        set({ notifications: payload.data || [], notificationsLoading: false });
      } else {
        set({ notificationsError: payload.error || 'Failed to load notifications', notificationsLoading: false });
      }
    } catch (err) {
      set({ notificationsError: err.message, notificationsLoading: false });
    }
  },
  setNotificationsUnreadOnly: (value) => {
    set({ notificationsUnreadOnly: value });
    get().fetchNotifications();
  },

  // --- Tools & Skills ---
  fetchTools: async () => {
    set({ toolsLoading: true, toolsError: null });
    try {
      const res = await fetch('/api/capabilities');
      const data = await res.json();
      set({ toolDetails: data.tool_details || [], toolsLoading: false });
    } catch (err) {
      set({ toolsError: err.message, toolsLoading: false });
    }
  },
  fetchSkills: async () => {
    set({ skillsLoading: true, skillsError: null });
    try {
      const res = await fetch('/api/skills');
      set({ skillData: await res.json(), skillsLoading: false });
    } catch (err) {
      set({ skillsError: err.message, skillsLoading: false });
    }
  },

  // --- Logs ---
  fetchLogs: async () => {
    set({ logsLoading: true, logsError: null });
    try {
      const { logsLevel, logsSearch } = get();
      const res = await fetch(`/api/logs?level=${logsLevel}&search=${encodeURIComponent(logsSearch)}&limit=100`);
      const data = await res.json();
      set({ logs: data.logs || [], logsCount: data.count || 0, logsLoading: false });
    } catch (err) {
      set({ logsError: err.message, logsLoading: false });
    }
  },
  setLogsLevel: (level) => {
    set({ logsLevel: level });
    get().fetchLogs();
  },
  setLogsSearch: (search) => set({ logsSearch: search }),

  // --- Select Repository ---
  selectRepo: (repo) => {
    set({ selectedRepo: repo, workflows: [], workflowsError: null });
    if (repo) {
      get().fetchWorkflows(repo.owner.username, repo.name);
    }
  },

  // --- Local LLM Autodiscovery (backend proxy - keys never leave the server) ---
  fetchLlmProviders: async () => {
    set({ llmLoading: true, llmError: null, localLlmStatus: 'checking' });
    try {
      const res = await fetch('/api/llm/discover');
      const data = await res.json();
      const providers = data.providers || [];
      const detected = providers.filter((p) => p.detected);
      const prevProvider = get().selectedProvider;
      const prevModel = get().selectedModel;
      const provider = providers.find((p) => p.id === prevProvider) || detected[0] || providers[0] || null;
      let model = '';
      if (provider) {
        model = provider.models.includes(prevModel) ? prevModel : (provider.models[0] || '');
        try {
          localStorage.setItem('llm_provider', provider.id);
          localStorage.setItem('llm_model', model);
        } catch {
          // ignore storage errors
        }
      }
      const firstModel = detected.length > 0
        ? (detected[0].models[0] || detected[0].name)
        : '';
      set({
        llmProviders: providers,
        selectedProvider: provider ? provider.id : '',
        selectedModel: model,
        llmLoading: false,
        localLlmStatus: detected.length > 0 ? 'detected' : 'not_detected',
        localLlmUrl: detected.length > 0 ? detected[0].url : '',
        localLlmModel: detected.length > 0 ? `${detected[0].name} (${firstModel})` : ''
      });
    } catch (err) {
      set({ llmError: err.message, llmLoading: false, localLlmStatus: 'not_detected' });
    }
  },
  setLlmProvider: (providerId) => {
    const provider = get().llmProviders.find((p) => p.id === providerId);
    const model = provider ? (provider.models[0] || '') : '';
    try {
      localStorage.setItem('llm_provider', providerId);
      localStorage.setItem('llm_model', model);
    } catch {
      // ignore storage errors
    }
    set({ selectedProvider: providerId, selectedModel: model });
  },
  setLlmModel: (model) => {
    try {
      localStorage.setItem('llm_model', model);
    } catch {
      // ignore storage errors
    }
    set({ selectedModel: model });
  },
  detectLocalLlm: async () => {
    await get().fetchLlmProviders();
  }
}))
