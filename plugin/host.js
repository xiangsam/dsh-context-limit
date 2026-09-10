return {
  name: 'context-limit',
  apply(ctx) {
    const llm = ctx.get('llm')
    if (llm === undefined || typeof llm.resolveModelInfo !== 'function') return

    const PRESETS = [64000, 128000, 256000, 272000, 512000, 1000000]
    const nativeByModel = new Map()
    const limitByModel = new Map()
    const openRouterById = new Map()
    let openRouterLoaded = false
    let openRouterLoading = null

    function lookupOpenRouter(model) {
      const id = String(model)
      const direct = openRouterById.get(id) ?? openRouterById.get(id.toLowerCase())
      if (typeof direct === 'number') return direct
      const tail = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id
      for (const [key, value] of openRouterById) {
        const keyTail = key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key
        if (key === id || key.endsWith('/' + id) || keyTail === id || keyTail === tail) return value
      }
      return undefined
    }

    async function ensureOpenRouterCatalog() {
      if (openRouterLoaded) return
      if (openRouterLoading !== null) {
        await openRouterLoading
        return
      }
      const web = ctx.get('web')
      if (web === undefined || typeof web.fetch !== 'function') {
        openRouterLoaded = true
        return
      }
      openRouterLoading = (async () => {
        try {
          const result = await web.fetch({ url: 'https://openrouter.ai/api/v1/models' })
          const content = result && result.body && typeof result.body.content === 'string' ? result.body.content : ''
          const parsed = JSON.parse(content)
          const rows = parsed && Array.isArray(parsed.data) ? parsed.data : []
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            if (row === undefined || row === null || typeof row.id !== 'string') continue
            const windowSize = row.context_length ?? row.context_window
            if (typeof windowSize === 'number' && Number.isInteger(windowSize) && windowSize > 0) {
              openRouterById.set(row.id, windowSize)
              openRouterById.set(row.id.toLowerCase(), windowSize)
            }
          }
        } catch (error) {
          console.error('context-limit: OpenRouter catalog lookup failed', error)
        } finally {
          openRouterLoaded = true
          openRouterLoading = null
        }
      })()
      await openRouterLoading
    }

    function modelKey(provider, model) {
      return String(provider) + '\0' + String(model)
    }

    function currentRoute(sessionId) {
      if (typeof sessionId !== 'string' || sessionId.length === 0) return null
      const sessions = ctx.get('sessions')
      const session = sessions === undefined ? undefined : sessions.get(sessionId)
      if (session !== undefined && typeof session.requestHeader === 'function') {
        const header = session.requestHeader()
        const config = header === undefined || header === null ? undefined : header.config
        if (config !== undefined && typeof config.provider === 'string' && typeof config.model === 'string') {
          return { provider: config.provider, model: config.model }
        }
      }
      if (session !== undefined && typeof session.requestContext === 'function') {
        const route = session.requestContext()
        if (route !== undefined && typeof route.provider === 'string' && typeof route.model === 'string') {
          return { provider: route.provider, model: route.model }
        }
      }
      const defaults = ctx.get('agentDefaultModel')
      if (defaults === undefined || typeof defaults.currentSelection !== 'function') return null
      const selection = defaults.currentSelection()
      if (selection === undefined || typeof selection.provider !== 'string' || typeof selection.model !== 'string') return null
      return { provider: selection.provider, model: selection.model }
    }

    function stopsFor(nativeWindow) {
      const stops = []
      for (let i = 0; i < PRESETS.length; i++) {
        if (nativeWindow > PRESETS[i]) stops.push(PRESETS[i])
      }
      stops.push(nativeWindow)
      return stops
    }

    function clampInfo(info) {
      if (info === undefined || info === null || info.context === undefined || info.context === null) return info
      const adapterWindow = info.context.contextWindow
      if (typeof adapterWindow !== 'number' || !Number.isInteger(adapterWindow) || adapterWindow <= 0) return info
      const fromOpenRouter = lookupOpenRouter(info.id)
      const nativeWindow = typeof fromOpenRouter === 'number' ? fromOpenRouter : adapterWindow
      const key = modelKey(info.provider, info.id)
      nativeByModel.set(key, nativeWindow)
      const override = limitByModel.get(key)
      const next = override === undefined ? nativeWindow : Math.min(override, nativeWindow)
      if (next === adapterWindow) return info
      return Object.assign({}, info, { context: { contextWindow: next } })
    }

    const originalResolveModelInfo = typeof llm.resolveModelInfo === 'function'
      ? llm.resolveModelInfo.bind(llm)
      : null
    const originalFor = typeof llm.resolveModelInfoFor === 'function'
      ? llm.resolveModelInfoFor.bind(llm)
      : null

    if (originalFor !== null) {
      ctx.effect(() => {
        try {
          llm.resolveModelInfoFor = async function wrappedResolveModelInfoFor(registration, model, signal) {
            await ensureOpenRouterCatalog()
            const info = await originalFor(registration, model, signal)
            return clampInfo(info)
          }
        } catch (error) {
          console.error('context-limit: skip wrapping resolveModelInfoFor', error)
          return () => {}
        }
        return () => {
          try {
            delete llm.resolveModelInfoFor
          } catch (_error) {
            try {
              llm.resolveModelInfoFor = originalFor
            } catch (_restoreError) {}
          }
        }
      }, 'context-limit: wrap resolveModelInfoFor')
    }

    async function resolveInfo(provider, model) {
      await ensureOpenRouterCatalog()
      if (originalResolveModelInfo !== null) return originalResolveModelInfo(provider, model)
      return llm.resolveModelInfo(provider, model)
    }

    async function snapshot(sessionId) {
      const route = currentRoute(sessionId)
      if (route === null) {
        return {
          available: false,
          provider: null,
          model: null,
          nativeWindow: null,
          effectiveWindow: null,
          auto: true,
          stops: [],
        }
      }
      let info
      try {
        info = await resolveInfo(route.provider, route.model)
      } catch (_error) {
        return {
          available: false,
          provider: route.provider,
          model: route.model,
          nativeWindow: null,
          effectiveWindow: null,
          auto: true,
          stops: [],
        }
      }
      const key = modelKey(route.provider, route.model)
      const fromOpenRouter = lookupOpenRouter(route.model)
      const adapterWindow = info === undefined || info === null || info.context === undefined ? undefined : info.context.contextWindow
      const native = typeof fromOpenRouter === 'number'
        ? fromOpenRouter
        : (typeof nativeByModel.get(key) === 'number' ? nativeByModel.get(key) : adapterWindow)
      if (typeof native !== 'number') {
        return {
          available: false,
          provider: route.provider,
          model: route.model,
          nativeWindow: null,
          effectiveWindow: null,
          auto: true,
          source: null,
          stops: [],
        }
      }
      nativeByModel.set(key, native)
      const override = limitByModel.get(key)
      const auto = override === undefined || override >= native
      const effectiveWindow = auto ? native : Math.min(override, native)
      return {
        available: true,
        provider: route.provider,
        model: route.model,
        nativeWindow: native,
        effectiveWindow: effectiveWindow,
        auto: auto,
        source: typeof fromOpenRouter === 'number' ? 'openrouter' : 'adapter',
        stops: stopsFor(native),
      }
    }

    harness.handle('get-state', async (args) => {
      const sessionId = args === undefined || args === null ? undefined : args.sessionId
      return snapshot(typeof sessionId === 'string' ? sessionId : '')
    })

    harness.handle('set-limit', async (args) => {
      const sessionId = args === undefined || args === null ? undefined : args.sessionId
      const tokens = args === undefined || args === null ? undefined : args.tokens
      const state = await snapshot(typeof sessionId === 'string' ? sessionId : '')
      if (!state.available || typeof state.provider !== 'string' || typeof state.model !== 'string') return state
      const key = modelKey(state.provider, state.model)
      if (tokens === null || tokens === undefined) {
        limitByModel.delete(key)
        return snapshot(sessionId)
      }
      if (typeof tokens !== 'number' || !Number.isInteger(tokens) || tokens <= 0) return state
      const next = Math.min(tokens, state.nativeWindow)
      if (next >= state.nativeWindow) limitByModel.delete(key)
      else limitByModel.set(key, next)
      return snapshot(sessionId)
    })
  },
}
