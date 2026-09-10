return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const css = [
      '.dshCtxLim_root{position:relative;display:inline-flex;flex:none;align-items:center}',
      '.dshCtxLim_btn{height:28px;min-width:28px;padding:0 8px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;line-height:20px}',
      '.dshCtxLim_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshCtxLim_btn[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshCtxLim_btn:disabled{opacity:.55;cursor:default}',
      '.dshCtxLim_glyph{flex:none;display:grid;place-items:center}',
      '.dshCtxLim_value{font-variant-numeric:tabular-nums}',
      '.dshCtxLim_panel{position:absolute;bottom:calc(100% + 8px);right:0;z-index:120;box-sizing:border-box;width:292px;padding:12px 14px 10px;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-secondary);border-radius:12px}',
      '.dshCtxLim_title{margin:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}',
      '.dshCtxLim_meta{margin:2px 0 12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshCtxLim_track{position:relative;height:28px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);cursor:pointer;touch-action:none;user-select:none}',
      '.dshCtxLim_fill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--dsw-static-deepseek-500);pointer-events:none}',
      '.dshCtxLim_thumb{position:absolute;top:0;width:28px;height:28px;margin-left:-14px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);pointer-events:none}',
      '.dshCtxLim_dot{position:absolute;top:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:999px;pointer-events:none}',
      '.dshCtxLim_dotOn{background:rgba(255,255,255,.72)}',
      '.dshCtxLim_dotOff{background:var(--dsw-alias-label-dimmed)}',
      '.dshCtxLim_labels{display:flex;justify-content:space-between;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}',
      '.dshCtxLim_labels span[data-active="true"]{color:var(--dsw-alias-label-primary);font-weight:500}',
      '.dshCtxLim_hint{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      '.dshCtxLim_empty{padding:4px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
    ].join('')
    styles.insert(css)

    function formatWindow(n) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—'
      if (n >= 1000000 && n % 1000000 === 0) return String(n / 1000000) + 'M'
      if (n >= 1000 && n % 1000 === 0) return String(n / 1000) + 'K'
      if (n >= 1000000) {
        const value = Math.round(n / 100000) / 10
        return String(value) + 'M'
      }
      if (n >= 1000) {
        const value = Math.round(n / 100) / 10
        return String(value) + 'K'
      }
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

    function RulerIcon() {
      return React.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, className: 'dshCtxLim_glyph' },
        React.createElement('rect', {
          x: 1.5,
          y: 6,
          width: 13,
          height: 4,
          rx: 2,
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        React.createElement('path', {
          d: 'M5 6v2.2M8 6v2.2M11 6v2.2',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        }),
      )
    }

    function DiscreteSlider(props) {
      const stops = props.stops
      const index = props.index
      const disabled = props.disabled === true
      const max = Math.max(stops.length - 1, 1)
      const pct = stops.length <= 1 ? 100 : (index / max) * 100
      const trackRef = React.useRef(null)

      function pickFromClientX(clientX) {
        const el = trackRef.current
        if (el === null) return index
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0) return index
        const t = (clientX - rect.left) / rect.width
        const next = Math.round(t * max)
        if (next < 0) return 0
        if (next > max) return max
        return next
      }

      function onPointerDown(event) {
        if (disabled) return
        const el = trackRef.current
        if (el !== null && typeof el.setPointerCapture === 'function') el.setPointerCapture(event.pointerId)
        const next = pickFromClientX(event.clientX)
        if (next !== index) props.onChange(next)
      }

      function onPointerMove(event) {
        if (disabled || event.buttons === 0) return
        const next = pickFromClientX(event.clientX)
        if (next !== index) props.onChange(next)
      }

      function onKeyDown(event) {
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
      }

      const dots = []
      for (let i = 0; i < stops.length; i++) {
        const left = stops.length <= 1 ? 50 : (i / max) * 100
        const on = i <= index
        dots.push(React.createElement('span', {
          key: String(stops[i]),
          className: 'dshCtxLim_dot ' + (on ? 'dshCtxLim_dotOn' : 'dshCtxLim_dotOff'),
          style: { left: left + '%' },
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
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onKeyDown: onKeyDown,
        },
        React.createElement('div', { className: 'dshCtxLim_fill', style: { width: pct + '%' } }),
        dots,
        React.createElement('div', { className: 'dshCtxLim_thumb', style: { left: pct + '%' } }),
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
        host.call('get-state', { sessionId: sessionId }).then(function (next) {
          setState(next)
        }, function () {
          setState({
            available: false,
            provider: null,
            model: null,
            nativeWindow: null,
            effectiveWindow: null,
            auto: true,
            stops: [],
          })
        })
      }

      React.useEffect(function () {
        load()
      }, [sessionId])

      React.useEffect(function () {
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
        return function () {
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
        host.call('set-limit', {
          sessionId: sessionId,
          tokens: auto ? null : tokens,
        }).then(function (next) {
          setState(next)
          setBusy(false)
        }, function () {
          setBusy(false)
        })
      }

      const loading = state === null
      const available = state !== null && state.available === true && Array.isArray(state.stops) && state.stops.length > 0
      const effective = available ? state.effectiveWindow : null
      const index = available ? indexOfStop(state.stops, effective) : 0
      const label = available ? formatWindow(effective) : '—'
      const modelLine = available ? String(state.model) : ''

      const labels = []
      if (available) {
        for (let i = 0; i < state.stops.length; i++) {
          labels.push(React.createElement('span', {
            key: String(state.stops[i]),
            'data-active': i === index ? 'true' : 'false',
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
            onClick: function () {
              setOpen(function (value) { return !value })
            },
          },
          React.createElement(RulerIcon),
          React.createElement('span', { className: 'dshCtxLim_value' }, label),
        ),
        open
          ? React.createElement(
            'div',
            { className: 'dshCtxLim_panel', role: 'dialog', 'aria-label': '上下文长度' },
            React.createElement('div', { className: 'dshCtxLim_title' }, '上下文长度'),
            React.createElement('div', { className: 'dshCtxLim_meta' }, loading ? '读取中…' : (available ? modelLine : '未选择模型')),
            available
              ? React.createElement(DiscreteSlider, {
                stops: state.stops,
                index: index,
                disabled: busy,
                onChange: applyIndex,
              })
              : React.createElement('div', { className: 'dshCtxLim_empty' }, loading ? '正在读取当前模型上下文…' : '当前模型未公布上下文容量'),
            available ? React.createElement('div', { className: 'dshCtxLim_labels' }, labels) : null,
            available
              ? React.createElement(
                'div',
                { className: 'dshCtxLim_hint' },
                '最大档位来自' + (state.source === 'openrouter' ? 'OpenRouter' : '模型目录') + '，上限 ' + formatWindow(state.nativeWindow),
              )
              : null,
          )
          : null,
      )
    }

    slots.inject('conversation.input.right', function () {
      return slots.register(
        { name: 'conversation.input.right', id: 'context-limit', order: 40, label: 'Context length' },
        ContextLimitControl,
      )
    })
  },
}
