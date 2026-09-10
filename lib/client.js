window.__ModuleLoader__.load({
  id: '@xiangsam/dsh-context-limit',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    const PAD_PX = 11
    const CSS = [
      '.dshCtxLim_root{position:relative;display:inline-flex;flex:none;align-items:center}',
      '.dshCtxLim_btn{height:28px;min-width:28px;padding:0 8px 0 6px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;line-height:20px}',
      '.dshCtxLim_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshCtxLim_btn[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshCtxLim_btn:disabled{opacity:.55;cursor:default}',
      '.dshCtxLim_glyph{flex:none;display:grid;place-items:center;width:16px;height:16px}',
      '.dshCtxLim_value{font-variant-numeric:tabular-nums;letter-spacing:.01em}',
      '.dshCtxLim_panel{--dsh-ctxlim-pad:' + PAD_PX + 'px;position:absolute;bottom:calc(100% + 10px);right:0;z-index:120;box-sizing:border-box;width:280px;padding:14px 16px 12px;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);border-radius:14px}',
      '.dshCtxLim_title{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}',
      '.dshCtxLim_meta{margin:2px 0 14px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshCtxLim_track{position:relative;height:22px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);cursor:pointer;touch-action:none;user-select:none}',
      '.dshCtxLim_fill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--dsw-alias-state-business-primary,var(--dsw-static-deepseek-500));pointer-events:none}',
      '.dshCtxLim_thumb{position:absolute;top:0;width:22px;height:22px;margin-left:-11px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 1px 2px rgba(0,0,0,.16),0 0 0 1px var(--dsw-alias-border-l2-darkmode-thin,rgba(0,0,0,.06));pointer-events:none}',
      '.dshCtxLim_dot{position:absolute;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:999px;pointer-events:none}',
      '.dshCtxLim_dotOn{background:rgba(255,255,255,.8)}',
      '.dshCtxLim_dotOff{background:var(--dsw-alias-label-dimmed)}',
      '.dshCtxLim_labels{position:relative;height:16px;margin-top:10px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}',
      '.dshCtxLim_labels span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}',
      '.dshCtxLim_labels span[data-active="true"]{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dshCtxLim_hint{margin:10px 0 0;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:11px;line-height:16px}',
      '.dshCtxLim_empty{padding:4px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
    ].join('')

    const TAG_ID = 'dsh-context-limit/ContextLimit.module.css#v4'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(TAG_ID) + ']') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-context-limit'
      tag.dataset.pluginCss = TAG_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function formatWindow(n) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—'
      if (n >= 1000000 && n % 1000000 === 0) return String(n / 1000000) + 'M'
      if (n >= 1000 && n % 1000 === 0) return String(n / 1000) + 'K'
      if (n >= 1000000) return String(Math.round(n / 100000) / 10) + 'M'
      if (n >= 1000) return String(Math.round(n / 100) / 10) + 'K'
      return String(n)
    }

    function indexOfStop(stops, tokens) {
      if (!Array.isArray(stops) || stops.length === 0) return 0
      let best = 0
      let bestDelta = Math.abs(stops[0] - tokens)
      for (let i = 1; i < stops.length; i++) {
        const delta = Math.abs(stops[i] - tokens)
        if (delta < bestDelta) {
          best = i
          bestDelta = delta
        }
      }
      return best
    }

    function unavailable() {
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

    async function readJson(response, label) {
      const type = response.headers.get('content-type') || ''
      if (!response.ok) throw new Error(label + ' HTTP ' + response.status)
      if (type.indexOf('application/json') < 0) throw new Error(label + ' returned ' + (type || 'non-json'))
      return response.json()
    }

    async function getState(sessionId) {
      const response = await fetch('/dsh-context-limit?sessionId=' + encodeURIComponent(sessionId || ''), {
        credentials: 'same-origin',
      })
      return readJson(response, 'get-state')
    }

    async function setLimit(sessionId, tokens) {
      const response = await fetch('/dsh-context-limit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, tokens }),
      })
      return readJson(response, 'set-limit')
    }

    function stopLeft(i, max) {
      if (max <= 0) return '50%'
      return 'calc(var(--dsh-ctxlim-pad) + ' + (i / max) + ' * (100% - 2 * var(--dsh-ctxlim-pad)))'
    }

    function GaugeIcon() {
      return React.createElement(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, className: 'dshCtxLim_glyph' },
        React.createElement('rect', { x: 1.5, y: 6.5, width: 13, height: 3, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.25 }),
        React.createElement('rect', { x: 2.25, y: 7.15, width: 7.2, height: 1.7, rx: 0.85, fill: 'currentColor', opacity: '0.9' }),
      )
    }

    function DiscreteSlider(props) {
      const stops = props.stops
      const index = props.index
      const disabled = props.disabled === true
      const max = Math.max(stops.length - 1, 1)
      const trackRef = React.useRef(null)
      const thumbLeft = stopLeft(index, max)

      function pickFromClientX(clientX) {
        const el = trackRef.current
        if (el === null) return index
        const rect = el.getBoundingClientRect()
        const usable = rect.width - PAD_PX * 2
        if (usable <= 0) return index
        const t = (clientX - rect.left - PAD_PX) / usable
        const next = Math.round(t * max)
        if (next < 0) return 0
        if (next > max) return max
        return next
      }

      const dots = []
      for (let i = 0; i < stops.length; i++) {
        dots.push(React.createElement('span', {
          key: String(stops[i]),
          className: 'dshCtxLim_dot ' + (i <= index ? 'dshCtxLim_dotOn' : 'dshCtxLim_dotOff'),
          style: { left: stopLeft(i, max) },
        }))
      }

      return React.createElement(
        'div',
        {
          ref: trackRef,
          className: 'dshCtxLim_track',
          role: 'slider',
          tabIndex: disabled ? -1 : 0,
          'aria-valuemin': 0,
          'aria-valuemax': max,
          'aria-valuenow': index,
          'aria-valuetext': formatWindow(stops[index]),
          'aria-disabled': disabled,
          onPointerDown: (event) => {
            if (disabled) return
            const el = trackRef.current
            if (el !== null && typeof el.setPointerCapture === 'function') el.setPointerCapture(event.pointerId)
            const next = pickFromClientX(event.clientX)
            if (next !== index) props.onChange(next)
          },
          onPointerMove: (event) => {
            if (disabled || event.buttons === 0) return
            const next = pickFromClientX(event.clientX)
            if (next !== index) props.onChange(next)
          },
          onKeyDown: (event) => {
            if (disabled) return
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault()
              if (index > 0) props.onChange(index - 1)
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (index < max) props.onChange(index + 1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              props.onChange(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              props.onChange(max)
            }
          },
        },
        React.createElement('div', { className: 'dshCtxLim_fill', style: { width: thumbLeft } }),
        dots,
        React.createElement('div', { className: 'dshCtxLim_thumb', style: { left: thumbLeft } }),
      )
    }

    function ContextLimitControl(props) {
      const sessionId = props.sessionId
      const [open, setOpen] = React.useState(false)
      const [state, setState] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const rootRef = React.useRef(null)

      function load() {
        if (typeof sessionId !== 'string' || sessionId.length === 0) return
        getState(sessionId).then(setState, () => setState(unavailable()))
      }

      React.useEffect(() => { load() }, [sessionId])

      React.useEffect(() => {
        if (!open) return
        load()
        const node = rootRef.current
        if (node === null) return
        const doc = node.ownerDocument
        function onPointerDown(event) {
          if (node.contains(event.target)) return
          setOpen(false)
        }
        function onKeyDown(event) {
          if (event.key === 'Escape') setOpen(false)
        }
        doc.addEventListener('pointerdown', onPointerDown)
        doc.addEventListener('keydown', onKeyDown)
        return () => {
          doc.removeEventListener('pointerdown', onPointerDown)
          doc.removeEventListener('keydown', onKeyDown)
        }
      }, [open, sessionId])

      function applyIndex(nextIndex) {
        if (state === null || !state.available || !Array.isArray(state.stops)) return
        const tokens = state.stops[nextIndex]
        if (typeof tokens !== 'number') return
        const auto = nextIndex === state.stops.length - 1
        setBusy(true)
        setLimit(sessionId, auto ? null : tokens).then((next) => {
          setState(next)
          setBusy(false)
        }, () => setBusy(false))
      }

      const loading = state === null
      const available = state !== null && state.available === true && Array.isArray(state.stops) && state.stops.length > 0
      const effective = available ? state.effectiveWindow : null
      const index = available ? indexOfStop(state.stops, effective) : 0
      const label = available ? formatWindow(effective) : '—'
      const modelLine = available ? String(state.model) : ''
      const source = available && state.source === 'openrouter' ? 'OpenRouter' : '模型目录'
      const labels = []
      if (available) {
        const max = Math.max(state.stops.length - 1, 1)
        for (let i = 0; i < state.stops.length; i++) {
          const isFirst = i === 0
          const isLast = i === state.stops.length - 1
          labels.push(React.createElement('span', {
            key: String(state.stops[i]),
            'data-active': i === index ? 'true' : 'false',
            style: isFirst
              ? { left: 0, transform: 'none' }
              : isLast
                ? { left: 'auto', right: 0, transform: 'none' }
                : { left: stopLeft(i, max) },
          }, formatWindow(state.stops[i])))
        }
      }

      return React.createElement(
        'span',
        { ref: rootRef, className: 'dshCtxLim_root' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshCtxLim_btn',
            title: available ? ('上下文长度 ' + label) : '上下文长度',
            'aria-label': available ? ('上下文长度 ' + label) : '上下文长度',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            disabled: sessionId === undefined,
            onClick: () => setOpen((value) => !value),
          },
          React.createElement(GaugeIcon),
          React.createElement('span', { className: 'dshCtxLim_value' }, label),
        ),
        open
          ? React.createElement(
            'div',
            { className: 'dshCtxLim_panel', role: 'dialog', 'aria-label': '上下文长度' },
            React.createElement('div', { className: 'dshCtxLim_title' }, '上下文长度'),
            React.createElement('div', { className: 'dshCtxLim_meta' }, loading ? '读取中…' : (state && state.model ? String(state.model) : (available ? modelLine : '未选择模型'))),
            available
              ? React.createElement(DiscreteSlider, { stops: state.stops, index, disabled: busy, onChange: applyIndex })
              : React.createElement('div', { className: 'dshCtxLim_empty' }, loading ? '正在读取当前模型上下文…' : '无法读取模型上下文（请完全退出并重新打开 DSH Desktop）'),
            available ? React.createElement('div', { className: 'dshCtxLim_labels' }, labels) : null,
            available
              ? React.createElement('div', { className: 'dshCtxLim_hint' }, '最大档位来自' + source + '，上限 ' + formatWindow(state.nativeWindow))
              : null,
          )
          : null,
      )
    }

    const inject = ['slots']
    function apply(ctx) {
      ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
        { name: 'conversation.input.right', id: 'context-limit', order: 40, label: 'Context length' },
        ContextLimitControl,
      ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
