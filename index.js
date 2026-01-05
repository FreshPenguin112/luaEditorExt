(function () {
    /* Full luaEngine injection (per-target Wasmoon engines, Ace editor, robust Wasmoon loader,
     per-target saved scripts, safe startHats patch + async dispatch, `on(hat,fn)` in Lua,
     and a simple `target` wrapper passed to handlers as opts.target). */

    const container = document.querySelector(".injectionDiv");
    const uiEnabled = !!container;

    const EXT_KEY = "luaengine";
    const _queuedStorage = {};
    const luaEngines = new Map(); // tid -> { engine, target, async }
    const queuedHats = new Map(); // tid -> [{hatOpcode, options, target}]
    let loadedBlocksFull = null;
    let stdlibInjected = false;

    function log(...a) {
        console.log("[luaEngine]", ...a);
    }

    // ------------- storage (uses vm.runtime.extensionStorage if available) -------------
    function getExtRoot() {
        if (window.vm?.runtime) {
            window.vm.runtime.extensionStorage =
                window.vm.runtime.extensionStorage || {};
            window.vm.runtime.extensionStorage[EXT_KEY] =
                window.vm.runtime.extensionStorage[EXT_KEY] || {};
            return window.vm.runtime.extensionStorage[EXT_KEY];
        }
        return null;
    }
    function getNamespace(targetId) {
        const root = getExtRoot();
        if (!root) return null;
        root.targets = root.targets || {};
        const id = targetId || "no_target";
        root.targets[id] = root.targets[id] || {};
        return root.targets[id];
    }
    function storageSet(k, v, targetId) {
        const ns = getNamespace(targetId);
        if (ns) ns[k] = v;
        else _queuedStorage[k] = v;
    }
    function storageGet(k, targetId) {
        const ns = getNamespace(targetId);
        if (ns && Object.prototype.hasOwnProperty.call(ns, k)) return ns[k];
        return _queuedStorage[k] ?? null;
    }

    // ---------------- convert Scratch toolbox -> processed-blocks.json (best-effort) ----------------
    function buildProcessedBlocksFromToolbox() {
        const out = {};
        try {
            const workspace = ScratchBlocks.getMainWorkspace();
            for (const cat of workspace.toolbox_.categoryMenu_.categories_) {
                for (const item of cat.contents_) {
                    if (item.nodeName !== "block") continue;
                    const opcode = item.getAttribute("type");
                    if (!opcode) continue;
                    const args = [];
                    for (const child of item.children) {
                        if (child.nodeName === "value")
                            args.push({
                                name: child.getAttribute("name"),
                                type: 1,
                            });
                        else if (child.nodeName === "statement") args.push({});
                    }
                    out[opcode] = [[args], "reporter"];
                }
            }
        } catch (e) {
            log("Could not read toolbox:", e);
        }
        return out;
    }
    function extractArgNamesFromEntry(entry) {
        const names = [];
        function walk(e) {
            if (!e) return;
            if (Array.isArray(e)) return e.forEach(walk);
            if (typeof e === "object") {
                if ("name" in e && typeof e.name === "string") {
                    if (!names.includes(e.name)) names.push(e.name);
                } else if ("field" in e && typeof e.field === "string") {
                    if (!names.includes(e.field)) names.push(e.field);
                } else Object.values(e).forEach(walk);
            }
        }
        if (Array.isArray(entry) && entry.length && Array.isArray(entry[0]))
            walk(entry[0]);
        else walk(entry);
        return names;
    }
    loadedBlocksFull = buildProcessedBlocksFromToolbox();

    // ---------------- small script loader ----------------
    function loadScript(url, timeout = 20000) {
        return new Promise((resolve, reject) => {
            try {
                const exists = Array.from(
                    document.getElementsByTagName("script")
                ).some(
                    (s) => s.src && s.src.split("?")[0] === url.split("?")[0]
                );
                if (exists) return setTimeout(resolve, 0);
                const s = document.createElement("script");
                s.src = url;
                s.async = true;
                s.onload = () => resolve();
                s.onerror = (err) =>
                    reject(
                        new Error("Failed to load " + url + " (" + err + ")")
                    );
                document.head.appendChild(s);
                if (timeout)
                    setTimeout(
                        () => reject(new Error("Timeout loading " + url)),
                        timeout
                    );
            } catch (e) {
                reject(e);
            }
        });
    }

    // ---------------- Ace editor (per-target persistence + completions) ----------------
    let editor = null;
    if (uiEnabled) {
        const edDiv = document.createElement("div");
        edDiv.id = "luaengine-editor";
        edDiv.style.cssText = "position:relative;width:100%;height:100%;";
        container.innerHTML = "";
        container.appendChild(edDiv);

        (async function initAce() {
            try {
                const ACE_URL =
                    "https://cdn.jsdelivr.net/npm/ace-builds@1.22.0/src-min-noconflict/ace.js";
                const LANGTOOLS_URL =
                    "https://cdn.jsdelivr.net/npm/ace-builds@1.22.0/src-min-noconflict/ext-language_tools.js";
                if (!window.ace) await loadScript(ACE_URL);

                editor = ace.edit("luaengine-editor");
                editor.session.setMode("ace/mode/lua");
                editor.setTheme("ace/theme/monokai");
                editor.setOptions({
                    wrap: true,
                    showPrintMargin: false,
                    fontSize: 12,
                });

                await loadScript(LANGTOOLS_URL);
                let langTools;
                try {
                    langTools =
                        ace.require && ace.require("ace/ext/language_tools");
                } catch (_) {
                    langTools = null;
                }
                if (langTools)
                    editor.setOptions({
                        enableBasicAutocompletion: true,
                        enableLiveAutocompletion: true,
                        enableSnippets: true,
                    });

                // Clear editor initially - no global code
                editor.setValue("", -1);

                // Save per-target on change WITHOUT auto-running
                let _luaSaveDebounce = null;
                editor.on("change", () => {
                    const cur2 = window.vm?.editingTarget ?? null;
                    if (!cur2) {
                        // Don't save global code - clear it instead
                        editor.setValue("", -1);
                        return;
                    }
                    const id2 = cur2.id ?? cur2.spriteId ?? String(cur2);
                    storageSet("lua", editor.getValue(), id2);
                });

                // poll editingTarget changes to reload editor
                (function pollEditingTarget() {
                    let lastId = null;
                    setInterval(() => {
                        (async () => {
                            try {
                                const t = window.vm?.editingTarget ?? null;
                                const id = t
                                    ? t.id ?? t.spriteId ?? String(t)
                                    : null;
                                if (id !== lastId) {
                                    lastId = id;
                                    // ensure engine created for this target and wait briefly
                                    try {
                                        if (t) await initLuaForTarget(t).catch(() => {});
                                    } catch (_) {}
                                    if (editor) {
                                        if (id) {
                                            let code = storageGet("lua", id) || "";
                                            try {
                                                const info = luaEngines.get(id);
                                                if (info && info.engine) {
                                                    const saved = await info.engine.global.get("__saved_script").catch(() => null);
                                                    if (typeof saved === "string" && saved.length) code = saved;
                                                }
                                            } catch (_) {}
                                            editor.setValue(code, -1);
                                        } else {
                                            // No target selected - clear editor
                                            editor.setValue("", -1);
                                        }
                                    }
                                }
                            } catch (_) {}
                        })();
                    }, 150);
                })();

                // completer (stdlib + opcodes)
                const stdlibList = [
                    { caption: "move(steps)", value: "move(", meta: "stdlib" },
                    {
                        caption: "say(text, secs)",
                        value: "say(",
                        meta: "stdlib",
                    },
                    { caption: "sleep(ms)", value: "sleep(", meta: "stdlib" },
                    {
                        caption: "call(opcode, args)",
                        value: "call(",
                        meta: "stdlib",
                    },
                    {
                        caption: "printjs(x)",
                        value: "printjs(",
                        meta: "stdlib",
                    },
                    {
                        caption: "inspect_block_args(op)",
                        value: "inspect_block_args(",
                        meta: "stdlib",
                    },
                    { caption: "on(event, fn)", value: "on(", meta: "event" },
                ];
                function buildCompleter() {
                    const opcodeEntries = [];
                    if (loadedBlocksFull) {
                        for (const op of Object.keys(loadedBlocksFull)) {
                            const safe = op.replace(/[^A-Za-z0-9_]/g, "_");
                            opcodeEntries.push({
                                caption: safe + "()",
                                value: safe + "(",
                                meta: "opcode",
                            });
                        }
                    }
                    const completions = stdlibList.concat(opcodeEntries);
                    return {
                        getCompletions: (_ed, _s, _p, prefix, cb) => {
                            const list = completions
                                .filter(
                                    (c) =>
                                        !prefix ||
                                        c.caption
                                            .toLowerCase()
                                            .startsWith(prefix.toLowerCase())
                                )
                                .map((c) => ({
                                    caption: c.caption,
                                    value: c.value,
                                    meta: c.meta,
                                }));
                            cb(null, list);
                        },
                    };
                }
                try {
                    const lt =
                        ace.require && ace.require("ace/ext/language_tools");
                    if (lt) lt.addCompleter(buildCompleter());
                } catch (_) {}
            } catch (e) {
                log("Editor init failed:", e);
            }
        })();
    }

    // ---------------- Wasmoon loader (robust UMD, npm, fetch+eval fallback) ----------------
    async function getWasmoonFactory() {
        const tryResolve = (mod) => {
            if (!mod) return null;
            if (mod.LuaFactory && typeof mod.LuaFactory === "function")
                return new mod.LuaFactory();
            if (
                mod.default &&
                mod.default.LuaFactory &&
                typeof mod.default.LuaFactory === "function"
            )
                return new mod.default.LuaFactory();
            if (typeof mod === "function") {
                try {
                    return new mod();
                } catch (_) {}
            }
            if (typeof mod.createEngine === "function") return mod;
            return null;
        };

        const existing = window.wasmoon || window.Wasmoon || window.WasMoon;
        const r1 = tryResolve(existing);
        if (r1) return r1;

        const UMD = "https://cdn.jsdelivr.net/npm/wasmoon@1.16.0";
        try {
            await loadScript(UMD);
            const after = window.wasmoon || window.Wasmoon || window.WasMoon;
            const r2 = tryResolve(after);
            if (r2) return r2;
        } catch (e) {
            log("Wasmoon UMD load failed:", e && e.message ? e.message : e);
        }

        try {
            await loadScript("https://cdn.jsdelivr.net/npm/wasmoon@1.16.0");
            const after2 = window.wasmoon || window.Wasmoon || window.WasMoon;
            const r3 = tryResolve(after2);
            if (r3) return r3;
        } catch (e) {
            log(
                "Wasmoon npm-bundle load failed:",
                e && e.message ? e.message : e
            );
        }

        try {
            const resp = await fetch(
                "https://cdn.jsdelivr.net/npm/wasmoon@1.16.0"
            );
            if (resp.ok) {
                const code = await resp.text();
                new Function(code)();
                const after3 =
                    window.wasmoon || window.Wasmoon || window.WasMoon;
                const r4 = tryResolve(after3);
                if (r4) return r4;
            }
        } catch (e) {
            log("Wasmoon fetch+eval failed:", e && e.message ? e.message : e);
        }

        throw new Error("Wasmoon factory not found");
    }

    async function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
    async function callOpcode(opcode, args, target) {
        const fn = window.vm?.runtime?.getOpcodeFunction?.(opcode);
        if (!fn) throw new Error("Opcode not found: " + opcode);
        return await fn(args || {}, { target });
    }

    // ---------------- initialize Wasmoon engine for a target ----------------
    async function initLuaForTarget(target) {
        if (!target) throw new Error("target required");
        const tid = target.id ?? target.spriteId ?? String(target);
        if (luaEngines.has(tid)) return luaEngines.get(tid);

        const factory = await getWasmoonFactory();
        const engine = await (factory.createEngine?.() || factory);

        await engine.global.set("js_print", (s) => log(`[lua:${tid}]`, s));
        await engine.global.set("sleep", (ms) => sleep(Number(ms || 0)));
        await engine.global.set("call", async (opcode, args) =>
            callOpcode(opcode, args || {}, target)
        );

        try {
            await engine.global.set("__register_hat_in_js", (hat, delta) => {
                try {
                    window.luaEngine &&
                        window.luaEngine._registerHatForEngine &&
                        window.luaEngine._registerHatForEngine(tid, hat, delta);
                } catch (_) {}
            });
        } catch (_) {}

        await engine.doString(`
      function lua_table_from_js(tbl)
        if type(tbl) ~= 'table' then return tbl end
        local out = {}
        for k,v in pairs(tbl) do
          if type(v) == 'table' then out[k] = lua_table_from_js(v) else out[k] = v end
        end
        return out
      end
    `);

        await engine.doString(`
      __luaHatRegistry = __luaHatRegistry or {}
      __luaHatNextId = __luaHatNextId or 0

      function on(hat, fn)
        if type(hat) ~= 'string' and type(hat) ~= 'number' then
          if type(js_print) == 'function' then js_print('lua on() expected hat string/number, got '..tostring(type(hat))) end
          return function() end
        end
        if type(fn) ~= 'function' then
          if type(js_print) == 'function' then js_print('lua on() expected function for hat '..tostring(hat)..', got '..tostring(type(fn))) end
          return function() end
        end

        hat = tostring(hat)
        __luaHatRegistry[hat] = __luaHatRegistry[hat] or {}
        __luaHatNextId = (__luaHatNextId or 0) + 1
        local id = tostring(__luaHatNextId)
        table.insert(__luaHatRegistry[hat], { id = id, fn = fn })
        if type(js_print) == 'function' then js_print('lua on registered for '..hat..', count='..tostring(#(__luaHatRegistry[hat] or {}))..', id='..id) end
        if type(__register_hat_in_js) == 'function' then pcall(__register_hat_in_js, hat, 1) end

        return function()
          local list = __luaHatRegistry[hat] or {}
          for i = #list, 1, -1 do
            local entry = list[i]
            if type(entry) == 'table' and tostring(entry.id) == id then
              table.remove(list, i)
              if type(__register_hat_in_js) == 'function' then pcall(__register_hat_in_js, hat, -1) end
            end
          end
        end
      end

      function __call_hats(hat, opts)
        hat = tostring(hat)
        --if type(js_print) == 'function' then js_print('lua __call_hats called for '..hat..', handlers='..tostring(#(__luaHatRegistry[hat] or {}))) end

        local ok, snapshot_or_err = pcall(function()
          local list = __luaHatRegistry[hat] or {}
          local snapshot = {}
          for i = 1, #list do
            local entry = list[i]
            if type(entry) == 'table' and type(entry.fn) == 'function' then
              table.insert(snapshot, entry.fn)
            elseif type(entry) == 'function' then
              table.insert(snapshot, entry)
            else
              if type(js_print) == 'function' then js_print('lua hat entry invalid at index '..tostring(i)..' for hat '..hat..', type='..tostring(type(entry))) end
            end
          end
          return snapshot
        end)

        if not ok then
          if type(js_print) == 'function' then js_print('lua __call_hats snapshot failed: '..tostring(snapshot_or_err)) end
          return
        end

        local snapshot = snapshot_or_err
        if #snapshot == 0 then
          return
        end

        local function safe_call(fn, opts)
          if type(xpcall) == 'function' and type(debug) == 'table' and type(debug.traceback) == 'function' then
            local ok2, err = xpcall(function() return fn(opts) end, function(e) return debug.traceback(tostring(e)) end)
            if not ok2 and type(js_print) == 'function' then js_print('lua hat error: '..tostring(err)) end
          else
            local ok2, err = pcall(fn, opts)
            if not ok2 and type(js_print) == 'function' then js_print('lua hat error: '..tostring(err)) end
          end
        end

        for i = 1, #snapshot do
          pcall(safe_call, snapshot[i], opts)
        end
      end

      function __dump_registry_types()
        local out = {}
        for k, v in pairs(__luaHatRegistry or {}) do
          for i = 1, #v do
            local entry = v[i]
            if type(entry) == 'table' then
              table.insert(out, tostring(k)..":"..tostring(i)..":table(id="..tostring(entry.id)..",fn="..tostring(type(entry.fn))..")")
            else
              table.insert(out, tostring(k)..":"..tostring(i)..":"..tostring(type(entry)))
            end
          end
        end
        return table.concat(out, ",")
      end
    `);

        await engine.doString(`function print(s) js_print(s) end`);

        if (loadedBlocksFull) {
            try {
                await engine.global.set("blocks", loadedBlocksFull);
            } catch (_) {}
            await injectOpcodeWrappersIntoLua(engine, loadedBlocksFull);
        }

        try {
            const saved = storageGet("lua", tid);
            if (saved) await engine.global.set("__saved_script", saved);
        } catch (_) {}

        try {
            syncEngineHatIndex({ engine, target });
        } catch (_) {}

        let isAsync = false;
        try {
            const test = engine.doString("return 1");
            isAsync = test && typeof test.then === "function";
        } catch (_) {
            isAsync = false;
        }
        let canSetGlobal = true;
        try {
            const maybe = engine.global.set("__lua_hat_test_set", {});
            if (maybe && typeof maybe.then === "function") {
                await maybe.catch(() => {
                    canSetGlobal = false;
                });
            }
        } catch (e) {
            canSetGlobal = false;
        }

        const info = { engine, target, async: isAsync, canSetGlobal };
        luaEngines.set(tid, info);
        return info;
    }

    async function loadStdlibOnce(engine) {
        if (stdlibInjected) return;
        try {
            await engine.doString(`function print(s) js_print(s) end`);
        } catch (_) {}
        stdlibInjected = true;
    }

    async function injectOpcodeWrappersIntoLua(infoOrEngine, blocksMap) {
        const engine = infoOrEngine.engine || infoOrEngine;
        function sanitizeLuaName(s) {
            const keywords = new Set([
                "and",
                "break",
                "do",
                "else",
                "elseif",
                "end",
                "false",
                "for",
                "function",
                "goto",
                "if",
                "in",
                "local",
                "nil",
                "not",
                "or",
                "repeat",
                "return",
                "then",
                "true",
                "until",
                "while",
            ]);
            let name = String(s).replace(/[^A-Za-z0-9_]/g, "_");
            if (!name || keywords.has(name)) name = "op_" + name;
            return name;
        }

        let src = "-- auto-generated opcode wrappers\n";
        for (const [opcode, entry] of Object.entries(blocksMap)) {
            const argNames = extractArgNamesFromEntry(entry) || [];
            let cat = "misc",
                method = opcode;
            const u = opcode.indexOf("_"),
                d = opcode.indexOf(".");
            if (u !== -1) {
                cat = opcode.slice(0, u);
                method = opcode.slice(u + 1);
            } else if (d !== -1) {
                cat = opcode.slice(0, d);
                method = opcode.slice(d + 1);
            }
            const safeCat = sanitizeLuaName(cat);
            const safeMethod = sanitizeLuaName(method);
            const safeGlobal = sanitizeLuaName(opcode);

            src += `if _G["${safeCat}"] == nil then ${safeCat} = {} end\n`;
            src += `${safeCat}.${safeMethod} = function(...)\n  local p={...}\n  local args={}\n`;
            if (argNames.length) {
                for (let i = 0; i < argNames.length; i++) {
                    const a = String(argNames[i]).replace(/"/g, '\\"');
                    src += `  if #p >= ${i + 1} then args["${a}"] = p[${
                        i + 1
                    }] end\n`;
                }
            } else {
                src += `  for i=1,#p do args["ARG"..i] = p[i] end\n`;
            }
            const escaped = opcode.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            src += `  return call("${escaped}", args)\nend\n`;
            src += `function ${safeGlobal}(...)\n  return ${safeCat}.${safeMethod}(...)\nend\n`;
            src += `_G["${escaped}"] = ${safeCat}.${safeMethod}\n`;
            src += `_G["${safeCat}.${safeMethod}"] = ${safeCat}.${safeMethod}\n\n`;
        }

        try {
            await engine.doString(src);
        } catch (e) {
            log("injectOpcodeWrappersIntoLua failed:", e);
        }
    }

    // ---------------- run/persist script per target ----------------
    async function runScriptForTarget(target, code) {
        if (!target) return;
        const tid = target.id ?? target.spriteId ?? String(target);
        let info;
        try {
            info = await initLuaForTarget(target);
        } catch (e) {
            log("runScriptForTarget init error:", e);
            return;
        }
        const engine = info.engine;
        code =
            typeof code === "string" && code.trim()
                ? code
                : storageGet("lua", tid) || "";
        if (!code) return;
        storageSet("lua", code, tid);
        try {
            await engine.doString(code);
        } catch (e) {
            log(`[luaEngine:${tid}] runtime error:`, e);
        }
        try {
            const info = luaEngines.get(tid);
            if (info) await syncEngineHatIndex(info);
        } catch (_) {}
    }

    function makeTargetWrapper(target) {
        if (!target) return null;
        const tid = target.id ?? target.spriteId ?? String(target);
        const wrapper = {
            id: tid,
            name:
                target.sprite && target.sprite.name
                    ? target.sprite.name
                    : target.name || "",
            x: target.x ?? target._scratch_x ?? 0,
            y: target.y ?? target._scratch_y ?? 0,
        };
        return wrapper;
    }

    function makePlainTargetWrapper(target) {
        if (!target) return null;
        return {
            id: target.id ?? target.spriteId ?? String(target),
            name:
                target.sprite && target.sprite.name
                    ? target.sprite.name
                    : target.name || "",
            x: target.x ?? target._scratch_x ?? 0,
            y: target.y ?? target._scratch_y ?? 0,
        };
    }

    function escapeLuaString(s) {
        return String(s)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n");
    }
    function toLuaLiteral(obj, depth = 0) {
        if (depth > 6) return "{}";
        if (obj === null || obj === undefined) return "nil";
        const t = typeof obj;
        if (t === "number") {
            if (!isFinite(obj)) return "nil";
            return String(obj);
        }
        if (t === "boolean") return obj ? "true" : "false";
        if (t === "string") return `"${escapeLuaString(obj)}"`;
        if (Array.isArray(obj)) {
            const parts = obj.map((v) => toLuaLiteral(v, depth + 1));
            return `{${parts.join(",")}}`;
        }
        if (t === "object") {
            const parts = [];
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                if (typeof v === "function" || typeof v === "symbol") continue;
                const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)
                    ? k
                    : `["${escapeLuaString(k)}"]`;
                parts.push(`${key} = ${toLuaLiteral(v, depth + 1)}`);
            }
            return `{${parts.join(",")}}`;
        }
        return "nil";
    }

    function sanitizeForLua(obj, depth = 0, seen = new WeakSet()) {
        if (depth > 6) return null;
        if (obj === null || obj === undefined) return null;
        const t = typeof obj;
        if (t === "number" || t === "string" || t === "boolean") return obj;
        if (t === "function" || t === "symbol") return null;
        if (seen.has(obj)) return null;
        if (Array.isArray(obj)) {
            seen.add(obj);
            const arr = [];
            for (const v of obj) {
                const s = sanitizeForLua(v, depth + 1, seen);
                arr.push(s === undefined ? null : s);
            }
            return arr;
        }
        if (t === "object") {
            seen.add(obj);
            const out = {};
            for (const k of Object.keys(obj)) {
                try {
                    const v = obj[k];
                    if (typeof v === "function" || typeof v === "symbol")
                        continue;
                    const s = sanitizeForLua(v, depth + 1, seen);
                    if (s !== null && s !== undefined) out[k] = s;
                } catch (_) {}
            }
            return out;
        }
        return null;
    }

    async function dispatchToEngine(
        info,
        hatOpcode,
        options,
        target,
        forceRun = false
    ) {
        try {
            const engine = info.engine;
            const tid =
                info.target && (info.target.id || info.target.spriteId)
                    ? info.target.id ?? info.target.spriteId
                    : (target && (target.id ?? target.spriteId)) || "no_target";

            const optsObj = Object.assign({}, options || {});
            try {
                // Pass full target as a sanitized structured clone (no methods/functions,
                // cycles trimmed) so Lua receives a deep copy it cannot mutate back in JS.
                let sanitizedTarget = null;
                try {
                    sanitizedTarget = sanitizeForLua(target);
                } catch (_) {
                    sanitizedTarget = null;
                }
                if (!sanitizedTarget) sanitizedTarget = makePlainTargetWrapper(target);
                let targetClone = sanitizedTarget;
                try {
                    // Prefer JSON round-trip to ensure a plain POJO without prototype.
                    targetClone = JSON.parse(JSON.stringify(sanitizedTarget));
                } catch (_) {
                    try {
                        if (typeof structuredClone === "function") {
                            targetClone = structuredClone(sanitizedTarget);
                        } else {
                            targetClone = sanitizedTarget;
                        }
                    } catch (_) {
                        targetClone = sanitizedTarget;
                    }
                }
                optsObj.target = targetClone;
            } catch (_) {}

            const sanitizedOpts = sanitizeForLua(optsObj);

            if (info && info.async === false && !forceRun) {
                const q = queuedHats.get(tid) || [];
                q.push({ hatOpcode, options: sanitizedOpts, target: optsObj.target });
                queuedHats.set(tid, q);
                log(
                    `[luaEngine] queued hat ${hatOpcode} for ${tid} (engine is sync); use luaEngine.runQueuedHatsFor("${tid}") to run manually)`
                );
                return;
            }

            let luaOpts = null;
            try {
                const conv = await engine.global.get("lua_table_from_js");
                if (conv) {
                    const convPromise = conv(sanitizedOpts);
                    const timeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("conv timeout")), 200)
                    );
                    try {
                        luaOpts = await Promise.race([convPromise, timeout]);
                    } catch (_) {
                        luaOpts = null;
                    }
                }
            } catch (_) {
                luaOpts = null;
            }

            //log(`[luaEngine] dispatching hat ${hatOpcode} to ${tid}`);

            let usedLiteralFallback = false;
            try {
                // Try to set full options into engine globals. If that's not possible,
                // fall back to injecting a Lua literal for the full sanitized options.
                let setRes;
                const toSet = luaOpts == null ? sanitizedOpts || {} : luaOpts;
                try {
                    if (info && info.canSetGlobal === false) {
                        throw new Error("engine cannot set globals");
                    }
                    setRes = engine.global.set("__lua_hat_opts", toSet);
                } catch (err) {
                    // fallback to literal assignment of the full options
                    try {
                        const literal = toLuaLiteral(toSet);
                        usedLiteralFallback = true;
                        const fallback = engine.doString(`__lua_hat_opts = ${literal}`);
                        if (fallback && typeof fallback.catch === "function") fallback.catch(() => {});
                    } catch (e) {
                        log(`[luaEngine] fallback __lua_hat_opts set failed for ${tid}:`, e);
                    }
                    setRes = undefined;
                }

                if (setRes && typeof setRes.then === "function") {
                    setRes.catch((e) => log(`engine.global.set failed for ${tid}:`, e));
                }
            } catch (setErr) {
                log(`[luaEngine] engine.global.set attempt failed for ${tid}:`, setErr);
            }

            try {
                if (usedLiteralFallback) {
                    //log(`[luaEngine] calling __call_hats via doString for ${tid} (literal fallback used)`);
                    const callRes = engine.doString(
                        `__call_hats(${JSON.stringify(
                            hatOpcode
                        )}, __lua_hat_opts)`
                    );
                    if (callRes && typeof callRes.catch === "function") {
                        callRes.catch(async (e) => {
                            log(`[luaEngine] __call_hats failed for ${tid}:`,e);
                        });
                    }
                } else {
                    let callFn = null;
                    try {
                        callFn = await engine.global.get("__call_hats");
                    } catch (_) {
                        callFn = null;
                    }
                    if (callFn) {
                        try {
                            const res = callFn(
                                hatOpcode,
                                luaOpts == null ? {} : luaOpts
                            );
                            if (res && typeof res.catch === "function") {
                                res.catch(async (e) => {
                                    log(
                                        `[luaEngine] __call_hats failed for ${tid}:`,
                                        e
                                    );
                                });
                            }
                        } catch (err) {
                            const fallback = engine.doString(
                                `__call_hats(${JSON.stringify(
                                    hatOpcode
                                )}, __lua_hat_opts)`
                            );
                            if (
                                fallback &&
                                typeof fallback.catch === "function"
                            ) {
                                fallback.catch((e) =>
                                    log(
                                        `[luaEngine] __call_hats fallback failed for ${tid}:`,
                                        e
                                    )
                                );
                            }
                        }
                    } else {
                        const callRes = engine.doString(
                            `__call_hats(${JSON.stringify(
                                hatOpcode
                            )}, __lua_hat_opts)`
                        );
                        if (callRes && typeof callRes.catch === "function") {
                            callRes.catch(async (e) => {
                                log(
                                    `[luaEngine] __call_hats failed for ${tid}:`,
                                    e
                                );
                            });
                        }
                    }
                }
            } catch (e) {
                log(`[luaEngine] __call_hats invocation error for ${tid}:`, e);
            }
        } catch (e) {
            log("dispatchToEngine error:", e);
        }
    }

    function scheduleDispatch(runtime, hatOpcode, util, options) {
        let resolvedTargets = [];

        try {
            if (options) {
                const maybe =
                    options.target ||
                    options.targetId ||
                    options.sprite ||
                    options.spriteId;

                if (maybe) {
                    if (typeof maybe === "object" && maybe.id) {
                        resolvedTargets = [maybe];
                    } else {
                        const byId =
                            runtime.getTargetById?.(maybe) ||
                            runtime.targets.find((t) => t && t.id === maybe);
                        if (byId) resolvedTargets = [byId];
                    }
                }
            }

            if (!resolvedTargets.length && util?.target?.id) {
                resolvedTargets = [util.target];
            }
        } catch (_) {
            resolvedTargets = [];
        }

        if (!resolvedTargets.length && Array.isArray(runtime.targets)) {
            resolvedTargets = runtime.targets.filter(
                (t) => t && (t.id || t.sprite)
            );
        }

        try {
            if (
                window.luaEngine?.hasHandlersForHat &&
                !window.luaEngine.hasHandlersForHat(hatOpcode)
            ) {
                return;
            }
        } catch (_) {}

        setTimeout(() => {
            (async () => {
                if (!resolvedTargets.length) return;

                for (const t of resolvedTargets) {
                    try {
                        if (!t || !t.id) continue;

                        const tid = t.id ?? t.spriteId ?? String(t);
                        let info = luaEngines.get(tid);

                        if (!info) {
                            initLuaForTarget(t).catch((e) =>
                                log(`initLuaForTarget(${tid}) failed:`, e)
                            );

                            setTimeout(() => {
                                const info2 = luaEngines.get(tid);
                                if (info2) {
                                    dispatchToEngine(
                                        info2,
                                        hatOpcode,
                                        options,
                                        t
                                    );
                                }
                            }, 150);
                        } else {
                            dispatchToEngine(info, hatOpcode, options, t);
                        }
                    } catch (e) {
                        log("dispatch-to-target error:", e);
                    }
                }
            })();
        }, 0);
    }

    function patchStartHatsOnce(runtime) {
        if (!runtime || runtime.__luaEngine_patchedStartHats) return;
        const orig = runtime.startHats.bind(runtime);
        runtime.startHats = function (hatOpcode, util, options) {
            const res = orig(hatOpcode, util, options);
            try {
                scheduleDispatch(runtime, hatOpcode, util, options);
            } catch (_) {}
            return res;
        };
        runtime.__luaEngine_patchedStartHats = true;
    }

    async function onProjectStart() {
        try {
            const b = buildProcessedBlocksFromToolbox();
            if (Object.keys(b).length) loadedBlocksFull = b;

            const runtime = window.vm?.runtime;
            if (!runtime) return;

            patchStartHatsOnce(runtime);

            for (const t of runtime.targets) {
                try {
                    if (!t) continue;
                    const tid = t.id ?? String(t);
                    const code = storageGet("lua", tid) || "";
                    if (code && code.trim())
                        runScriptForTarget(t, code).catch((e) =>
                            log("runScriptForTarget error:", e)
                        );
                    else {
                        initLuaForTarget(t).catch(() => {});
                    }
                } catch (_) {}
            }
        } catch (e) {
            log("onProjectStart error:", e);
        }
    }

    if (window.vm?.runtime && typeof window.vm.runtime.on === "function") {
        window.vm.runtime.on("PROJECT_START", onProjectStart);
        // register PROJECT_STOP_ALL to clear Lua listeners and attempt engine exits
        try {
            const stopHandler = async () => {
                try {
                    log("PROJECT_STOP_ALL: clearing Lua listeners and exiting engines");
                    for (const [tid, info] of luaEngines) {
                        try {
                                if (info && info.engine) {
                                    try {
                                        const p = info.engine.doString('__luaHatRegistry = {}');
                                        if (p && typeof p.catch === 'function') p.catch(() => {});
                                    } catch (_) {}
                                }
                        } catch (_) {}
                        try { queuedHats.delete(tid); } catch (_) {}
                    }
                    try {
                        if (window.luaEngine) {
                            try { queuedHats.clear(); } catch (_) {}
                            try { window.luaEngine._hatIndex = new Map(); } catch (_) {}
                        }
                    } catch (_) {}
                    log("PROJECT_STOP_ALL handler finished");
                } catch (e) {
                    log("PROJECT_STOP_ALL handler error:", e);
                }
            };
            window.vm.runtime.on('PROJECT_STOP_ALL', stopHandler);
        } catch (_) {}
    } else {
        (function pollRuntime() {
            const start = Date.now();
            const poll = setInterval(() => {
                if (
                    window.vm?.runtime &&
                    typeof window.vm.runtime.on === "function"
                ) {
                    clearInterval(poll);
                    window.vm.runtime.on("PROJECT_START", onProjectStart);
                    // also register stop handler when runtime becomes available
                    try {
                        const stopHandler = async () => {
                            try {
                                log("PROJECT_STOP_ALL: clearing Lua listeners and exiting engines");
                                for (const [tid, info] of luaEngines) {
                                    try {
                                        if (info && info.engine) {
                                            try {
                                                const p = info.engine.doString('__luaHatRegistry = {}');
                                                if (p && typeof p.catch === 'function') p.catch(() => {});
                                            } catch (_) {}
                                        }
                                    } catch (_) {}
                                    try { queuedHats.clear(); } catch (_) {}
                                }
                                try {
                                    const map = window.luaEngine && window.luaEngine._hatIndex;
                                    if (map && map instanceof Map) {
                                        for (const [hat, m] of map) {
                                                    try {} catch (_) {}
                                        }
                                    }
                                } catch (_) {}
                                log("PROJECT_STOP_ALL handler finished");
                            } catch (e) {
                                log("PROJECT_STOP_ALL handler error:", e);
                            }
                        };
                        window.vm.runtime.on('PROJECT_STOP_ALL', stopHandler);
                    } catch (_) {}
                } else if (Date.now() - start > 60000) clearInterval(poll);
            }, 500);
        })();
    }

    (function observeEditingTarget() {
            let last = null;
            setInterval(() => {
                (async () => {
                    try {
                        const t = window.vm?.editingTarget ?? null;
                        const id = t ? t.id ?? t.spriteId ?? String(t) : null;
                        if (id && id !== last) {
                            last = id;
                            try {
                                if (t) await initLuaForTarget(t).catch(() => {});
                            } catch (_) {}
                            try {
                                if (editor) {
                                    let code = storageGet("lua", id) || "";
                                    try {
                                        const info = luaEngines.get(id);
                                        if (info && info.engine) {
                                            const saved = await info.engine.global.get("__saved_script").catch(() => null);
                                            if (typeof saved === "string" && saved.length) code = saved;
                                        }
                                    } catch (_) {}
                                    editor.setValue(code, -1);
                                }
                            } catch (_) {}
                        }
                    } catch (_) {}
                })();
            }, 150);
    })();

    window.luaEngine = window.luaEngine || {};
    window.luaEngine._queuedHats = queuedHats;
    window.luaEngine._hatIndex = window.luaEngine._hatIndex || new Map();
    window.luaEngine._registerHatForEngine = function (tid, hat, delta) {
        try {
            if (!hat) return;
            const key = String(hat);
            const map = window.luaEngine._hatIndex;
            let s = map.get(key);
            if (!s) {
                if (delta <= 0) return;
                s = new Map();
                map.set(key, s);
            }
            const prev = s.get(tid) || 0;
            const next = prev + Number(delta || 0);
            if (next <= 0) s.delete(tid);
            else s.set(tid, next);
            if (s.size === 0) map.delete(key);
        } catch (_) {}
    };

    async function syncEngineHatIndex(info) {
        try {
            if (!info || !info.engine) return;
            const tid =
                info.target && (info.target.id ?? info.target.spriteId)
                    ? info.target.id ?? info.target.spriteId
                    : "no_target";
            const engine = info.engine;
            let res = null;
            try {
                const code = `local out={}; for k,v in pairs(__luaHatRegistry or {}) do out[k]=#v end; return out`;
                res = await engine.doString(code);
            } catch (e) {
                res = null;
            }
            if (!res || typeof res !== "object") return;
            for (const [hat, count] of Object.entries(res)) {
                try {
                    const prevMap = window.luaEngine._hatIndex.get(String(hat));
                    const prev =
                        prevMap && prevMap.get(tid) ? prevMap.get(tid) : 0;
                    const delta = Number(count || 0) - Number(prev || 0);
                    if (delta !== 0)
                        window.luaEngine._registerHatForEngine(tid, hat, delta);
                } catch (_) {}
            }
        } catch (_) {}
    }
    window.luaEngine.runQueuedHatsFor = function (tid, opts = {}) {
        const q = queuedHats.get(tid) || [];
        if (!q.length) {
            log(`[luaEngine] no queued hats for ${tid}`);
            return;
        }
        const info = luaEngines.get(tid);
        if (!info) {
            log(`[luaEngine] no engine for ${tid}`);
            return;
        }
        if (info.async === false && !opts.force) {
            log(
                `[luaEngine] engine ${tid} is sync; running queued hats may freeze the page. Pass {force:true} to proceed.`
            );
            return;
        }
        log(`[luaEngine] running ${q.length} queued hats for ${tid}`);
        (function runNext() {
            const item = q.shift();
            if (!item) {
                queuedHats.delete(tid);
                log(`[luaEngine] finished queued hats for ${tid}`);
                return;
            }
            try {
                dispatchToEngine(
                    info,
                    item.hatOpcode,
                    item.options,
                    item.target,
                    !!opts.force
                );
            } catch (e) {
                log(`Error running queued hat for ${tid}:`, e);
            }
            setTimeout(runNext, opts.delay || 50);
        })();
    };

    window.luaEngine.hasHandlersForHat = function (hat) {
        try {
            const s = window.luaEngine._hatIndex.get(String(hat));
            return !!(s && s.size > 0);
        } catch (_) {
            return false;
        }
    };

    window.luaEngine.dumpRegistries = async function () {
        try {
            for (const [tid, info] of luaEngines) {
                try {
                    const engine = info.engine;
                    const dump = await engine.doString(
                        "return __dump_registry_types()"
                    );
                    log("[luaEngine] registry_types for", tid, dump);
                } catch (e) {
                    log("[luaEngine] registry_types failed for", tid, e);
                }
            }
        } catch (e) {
            log("[luaEngine] dumpRegistries error:", e);
        }
    };

    window.luaEngine.syncAllHatIndexes = async function () {
        try {
            for (const [tid, info] of luaEngines) {
                try {
                    await syncEngineHatIndex(info);
                } catch (_) {}
            }
            log("[luaEngine] syncAllHatIndexes done");
        } catch (e) {
            log("[luaEngine] syncAllHatIndexes error:", e);
        }
    };

    window.luaEngine.callHatOnEngine = async function (tid, hat) {
        try {
            const info = luaEngines.get(tid);
            if (!info) {
                log("[luaEngine] no engine for", tid);
                return;
            }
            const engine = info.engine;
            try {
                const res = await engine.doString(
                    `__call_hats(${JSON.stringify(hat)}, {})`
                );
                log("[luaEngine] callHatOnEngine result for", tid, hat, res);
            } catch (e) {
                log("[luaEngine] callHatOnEngine failed for", tid, hat, e);
            }
        } catch (e) {
            log("[luaEngine] callHatOnEngine error:", e);
        }
    };

    window.luaEngine.runFor = async function (tid, code) {
        let info = luaEngines.get(tid);
        if (!info) {
            log(`[luaEngine] no engine for ${tid}, attempting to initialize`);
            try {
                await initLuaForTarget({ id: tid, name: tid });
                info = luaEngines.get(tid);
                if (!info) {
                    log(`[luaEngine] failed to initialize engine for ${tid}`);
                    return;
                }
            } catch (e) {
                log(`[luaEngine] failed to init engine for ${tid}:`, e);
                return;
            }
        }
        try {
            if (typeof info.engine.doString === "function") {
                await info.engine.doString(code);
                log(`[luaEngine] runFor(${tid}) executed`);
            } else if (typeof info.engine.run === "function") {
                await info.engine.run(code);
                log(`[luaEngine] runFor(${tid}) executed via run`);
            } else {
                log(`[luaEngine] engine for ${tid} has no doString/run`);
            }
        } catch (e) {
            log(`[luaEngine] runFor(${tid}) error:`, e);
        }
    };

    (function (Scratch) {
        class luaEngineExtension {
            getInfo() {
                return { id: "luaengine", name: "Lua Editor", blocks: [] };
            }
            async runLua(code) {
                const t = window.vm?.editingTarget;
                if (!t) return null;
                return runScriptForTarget(t, code);
            }
        }
        try {
            Scratch.extensions.register(new luaEngineExtension());
        } catch (_) {}
    })(Scratch);

    log("luaEngine injected (per-target Wasmoon engines, async hat dispatch).");
})();