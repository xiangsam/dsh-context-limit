const PRESETS = [64000, 128000, 256000, 272000, 512000, 1000000]
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export const name = 'context-limit'
export const inject = ['llm', 'webServer']

export function apply(ctx) {
  const llm = ctx.llm
  if (llm === undefined || typeof llm.resolveModelInfo !== 'function') return

  const nativeByModel = new Map()
  const limitByModel = new Map()
  const openRouterById = new Map()
  let openRouterLoaded = false
  let openRouterLoading = null

  function modelKey(provider, model) {
    return String(provider) + '\0' + String(model)
  }

  function routeFromSession(session) {
    if (session === undefined || session === null) return null
    if (typeof session.requestHeader === 'function') {
      const header = session.requestHeader()
      const config = header === undefined || header === null ? undefined : header.config
      if (config !== undefined && typeof config.provider === 'string' && typeof config.model === 'string') {
        return { provider: config.provider, model: config.model }
      }
    }
    if (typeof session.requestContext === 'function') {
      const route = session.requestContext()
      if (route !== undefined && typeof route.provider === 'string' && typeof route.model === 'string') {
        return { provider: route.provider, model: route.model }
      }
    }
    return null
  }

  function currentRoute(sessionId, explicit) {
    if (explicit !== undefined && explicit !== null && typeof explicit.provider === 'string' && typeof explicit.model === 'string') {
      return { provider: explicit.provider, model: explicit.model }
    }
    const id = sessionId === undefined || sessionId === null ? '' : String(sessionId)
    if (id.length > 0) {
      const agents = ctx.get('agents')
      const agent = agents === undefined || typeof agents.get !== 'function' ? undefined : agents.get(id)
      const fromAgent = routeFromSession(agent === undefined ? undefined : agent.session)
      if (fromAgent !== null) return fromAgent
      const sessions = ctx.get('sessions')
      const session = sessions === undefined || typeof sessions.get !== 'function' ? undefined : sessions.get(id)
      const fromSession = routeFromSession(session)
      if (fromSession !== null) return fromSession
    }
    const defaults = ctx.get('agentDefaultModel')
    if (defaults !== undefined && typeof defaults.currentSelection === 'function') {
      const selection = defaults.currentSelection()
      if (selection !== undefined && typeof selection.provider === 'string' && typeof selection.model === 'string') {
        return { provider: selection.provider, model: selection.model }
      }
    }
    return null
  }

  function stopsFor(nativeWindow) {
    const stops = []
    for (let i = 0; i < PRESETS.length; i++) {
      if (nativeWindow > PRESETS[i]) stops.push(PRESETS[i])
    }
    stops.push(nativeWindow)
    return stops
  }

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
    openRouterLoading = (async () => {
      try {
        let content = ''
        const web = ctx.get('web')
        if (web !== undefined && typeof web.fetch === 'function') {
          try {
            const result = await web.fetch({ url: OPENROUTER_MODELS_URL })
            content = result && result.body && typeof result.body.content === 'string' ? result.body.content : ''
          } catch (_webError) {
            content = ''
          }
        }
        if (content.length === 0 && typeof fetch === 'function') {
          const response = await fetch(OPENROUTER_MODELS_URL)
          if (response.ok) content = await response.text()
        }
        if (content.length === 0) return
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

  function resolveNative(adapterWindow, model) {
    const fromOpenRouter = lookupOpenRouter(model)
    if (typeof fromOpenRouter === 'number') return fromOpenRouter
    return adapterWindow
  }

  function clampInfo(info) {
    if (info === undefined || info === null || info.context === undefined || info.context === null) return info
    const adapterWindow = info.context.contextWindow
    if (typeof adapterWindow !== 'number' || !Number.isInteger(adapterWindow) || adapterWindow <= 0) return info
    const nativeWindow = resolveNative(adapterWindow, info.id)
    const key = modelKey(info.provider, info.id)
    nativeByModel.set(key, nativeWindow)
    const override = limitByModel.get(key)
    if (override === undefined) {
      if (nativeWindow === adapterWindow) return info
      return Object.assign({}, info, { context: { contextWindow: nativeWindow } })
    }
    const next = Math.min(override, nativeWindow)
    if (next === adapterWindow) return info
    return Object.assign({}, info, { context: { contextWindow: next } })
  }

  const originalResolveModelInfo = typeof llm.resolveModelInfo === 'function' ? llm.resolveModelInfo.bind(llm) : null
  const originalFor = typeof llm.resolveModelInfoFor === 'function' ? llm.resolveModelInfoFor.bind(llm) : null

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
    })
  }

  async function resolveInfo(provider, model) {
    await ensureOpenRouterCatalog()
    if (originalResolveModelInfo !== null) return originalResolveModelInfo(provider, model)
    return llm.resolveModelInfo(provider, model)
  }

  async function catalogWindow(provider, model) {
    if (typeof llm.listModels !== 'function') return undefined
    try {
      const models = await llm.listModels(provider)
      if (!Array.isArray(models)) return undefined
      for (let i = 0; i < models.length; i++) {
        const entry = models[i]
        if (entry !== undefined && entry !== null && entry.id === model && typeof entry.contextWindow === 'number') return entry.contextWindow
      }
    } catch (_error) {}
    return undefined
  }

  async function snapshot(sessionId, explicit) {
    const route = currentRoute(sessionId, explicit)
    if (route === null) {
      return {
        available: false,
        provider: null,
        model: null,
        nativeWindow: null,
        effectiveWindow: null,
        auto: true,
        source: null,
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
        source: null,
        stops: [],
      }
    }
    const infoWindow = info === undefined || info === null || info.context === undefined ? undefined : info.context.contextWindow
    const listedWindow = typeof infoWindow === 'number' ? infoWindow : await catalogWindow(route.provider, route.model)
    const adapterWindow = listedWindow
    const fromOpenRouter = lookupOpenRouter(route.model)
    const native = typeof fromOpenRouter === 'number'
      ? fromOpenRouter
      : (typeof nativeByModel.get(modelKey(route.provider, route.model)) === 'number'
        ? nativeByModel.get(modelKey(route.provider, route.model))
        : adapterWindow)
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
    const key = modelKey(route.provider, route.model)
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

  async function setLimit(sessionId, tokens, explicit) {
    const state = await snapshot(sessionId, explicit)
    if (!state.available || typeof state.provider !== 'string' || typeof state.model !== 'string') return state
    const key = modelKey(state.provider, state.model)
    if (tokens === null || tokens === undefined) {
      limitByModel.delete(key)
      return snapshot(sessionId, explicit)
    }
    if (typeof tokens !== 'number' || !Number.isInteger(tokens) || tokens <= 0) return state
    const next = Math.min(tokens, state.nativeWindow)
    if (next >= state.nativeWindow) limitByModel.delete(key)
    else limitByModel.set(key, next)
    return snapshot(sessionId, explicit)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-context-limit',
    async handler(req, res) {
      try {
        if (req.method === 'GET') {
          const url = new URL(req.url || '/', 'http://127.0.0.1')
          const explicitProvider = url.searchParams.get('provider')
          const explicitModel = url.searchParams.get('model')
          const explicit = explicitProvider && explicitModel ? { provider: explicitProvider, model: explicitModel } : undefined
          const state = await snapshot(url.searchParams.get('sessionId') || '', explicit)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(state))
          return
        }
        if (req.method === 'POST') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          const body = raw.length === 0 ? {} : JSON.parse(raw)
          const explicit = typeof body.provider === 'string' && typeof body.model === 'string'
            ? { provider: body.provider, model: body.model }
            : undefined
          const state = await setLimit(body.sessionId, body.tokens, explicit)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(state))
          return
        }
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'method-not-allowed' }))
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      }
    },
  }))

  ensureOpenRouterCatalog().catch(() => {})
}
