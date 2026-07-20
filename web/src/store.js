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

  // --- Select Repository ---
  selectRepo: (repo) => {
    set({ selectedRepo: repo, workflows: [], workflowsError: null });
    if (repo) {
      get().fetchWorkflows(repo.owner.username, repo.name);
    }
  },

  // --- Local LLM Autodiscovery ---
  detectLocalLlm: async () => {
    set({ localLlmStatus: 'checking' });
    const ports = [11434, 1234, 8000]; // Ollama, LM Studio, vLLM
    
    for (const port of ports) {
      try {
        // Use proxy or direct fetch to check port. Direct fetch from browser is fine for local dev
        const url = `http://127.0.0.1:${port}`;
        // Ollama specific check
        if (port === 11434) {
          const res = await fetch(`${url}/api/tags`, { mode: 'cors' });
          if (res.ok) {
            const data = await res.json();
            const models = data.models || [];
            const modelName = models.length > 0 ? models[0].name : 'Llama/Gemma';
            set({ 
              localLlmStatus: 'detected', 
              localLlmUrl: url,
              localLlmModel: `Ollama (${modelName})`
            });
            return;
          }
        } else {
          // Standard check (general health or root)
          const res = await fetch(url, { mode: 'no-cors' });
          set({ 
            localLlmStatus: 'detected', 
            localLlmUrl: url,
            localLlmModel: port === 1234 ? 'LM Studio' : 'vLLM/Local'
          });
          return;
        }
      } catch (e) {
        // Continue scanning next port
      }
    }
    set({ localLlmStatus: 'not_detected', localLlmUrl: '', localLlmModel: '' });
  }
}))
