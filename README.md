# 上下文长度标尺（DSH 插件）

> **不要**把 `plugin/host.js` / `plugin/client.js` 当成正式 profile 插件去 `dsh plugin add` 或写进 `cordis.patch.yml`。那两份文件是 `cordis_define` 的 function body，当作 Node 模块加载会直接让 DSH 起不来。正式插件走 `lib/`（`package.json` 的 `main`/`exports`），两者不要混用。

## 安装（正式 profile 插件）

已发布到 GitHub Packages：`@xiangsam/dsh-context-limit`。GitHub Packages 的安装需要认证：

```bash
npm login --registry=https://npm.pkg.github.com
npm config set @xiangsam:registry https://npm.pkg.github.com
dsh plugin --profile web add "@xiangsam/dsh-context-limit@0.1.0"
```

从本仓库源码安装（改完 `lib/` 后重跑即可，`link:` 方式生效）：

```bash
dsh plugin --profile web add "$(pwd)"
```

已在 dsh `0.1.5-alpha.2` 上验证：loader 行 `context-limit` 正常激活，`GET/POST /dsh-context-limit` 返回当前模型窗口与设置结果。

## 这次 DSH 起不来，实际是什么

`~/Library/Logs/DSH Desktop/harness.log` 里最近一次启动失败是：

```
dsh: plugin tree failed to load: dsh: 2 entries did not activate
@linxin666/dsh-client-ui-task-board: pending (waiting for service: apiProxy)
@linxin666/dsh-remote-web-ui: pending (waiting for service: apiProxy)
```

随后 Desktop 进入 `desktop-safe-mode`，第三方 web bundle 被挡住（这是那次的历史现场，与当前状态无关）。

这两行来自 `@linxin666/dsh-web-ui-all`，硬 `inject: ['apiProxy', …]`。`apiProxy` 没挂上时整个 plugin tree 超时。那次故障与本仓库插件无关；本仓库的 `lib/` 版本现已通过 `dsh plugin add` 正常装进 web profile。

## 这份插件如果当正式插件装，为什么也会让 DSH 起不来

上一版 Host 有三处启动期硬伤：

1. **文件不是合法模块**  
   以 `return { apply(ctx) { … } }` 开头，这是动态 Cordis 的 function body。Node 顶层 `return` 是 `SyntaxError`。Loader 一旦 import 它，启动树直接失败。

2. **`inject: ['llm']` 会把启动树停住**  
   和上面 `apiProxy` 同一类故障：服务还没提供（或装在错误的 fiber）时，插件一直 `pending`，超过激活期限就报 `plugin tree failed to load`。

3. **裸取 `llm.resolveModelInfoFor` 再调用，会丢掉 `this`**  
   正式插件里这是 class 方法。`const fn = llm.resolveModelInfoFor; fn(...)` 会变成 `this === undefined`，后续 `resolveModelInfo` / `prepareCall` 全部炸掉。动态沙箱的 method wrapper 会绑 `this`，所以只在 `cordis_run` 里碰巧能跑。

已改为：不声明 `inject`，`ctx.get('llm')` 缺失则直接 return；`bind(llm)` 保留 `this`；包装失败只记日志，不抛出。

## 行为

- 入口在 composer 右侧工具行（模型选择左侧），显示当前有效窗口，例如 `256K` / `1M`
- 点击图标上拉弹出标尺：蓝色已选段 + 白色滑块，风格对齐 DSH token
- 常见档位：`64K`、`128K`、`256K`、`272K`、`512K`、`1M`
- 只展示不超过当前模型上限的档位；最后一档永远是该模型的原生最大值（自适应）
- 生效点：压缩阈值、token 压力、下一次请求的 `request/context`

## 动态用法（cordis_define）

只通过 `cordis_define` + `cordis_run` 启用（进程内、不改 profile）。浏览器半需要授权一次。重启 DSH 后动态包消失。
