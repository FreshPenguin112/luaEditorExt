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
    const foreverLoops = new Map(); // tid -> { map: Map(id->fn), rafId, running }
    let loadedBlocksFull = null;

    function log(...a) {}

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
        /*const out = {};
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
            console.error("Could not read toolbox:", e);
        }
        return out;*/
        return JSON.parse(`{"control_forever":[[{}],"reporter"],"control_repeat":[[{"name":"TIMES","type":1}],"reporter"],"control_repeatForSeconds":[[{"name":"TIMES","type":1}],"reporter"],"control_if":[[{"name":"CONDITION","type":1}],"reporter"],"control_if_else":[[{"name":"CONDITION","type":1}],"reporter"],"control_try_catch":[[{}],"reporter"],"control_throw_error":[[{"name":"ERROR","type":1}],"reporter"],"control_error":[[],"reporter"],"control_stop":[[],"reporter"],"control_wait":[[{"name":"DURATION","type":1}],"reporter"],"control_waitsecondsoruntil":[[{"name":"DURATION","type":1},{"name":"CONDITION","type":1}],"reporter"],"control_waittick":[[],"reporter"],"control_wait_until":[[{"name":"CONDITION","type":1}],"reporter"],"control_repeat_until":[[{"name":"CONDITION","type":1}],"reporter"],"control_while":[[{"name":"CONDITION","type":1}],"reporter"],"control_for_each":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"control_start_as_clone":[[],"hat"],"control_create_clone_of_menu":[[{"name":"CLONE_OPTION","type":1,"field":"CLONE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"control_create_clone_of":[[{"name":"CLONE_OPTION","type":1}],"reporter"],"control_delete_clones_of":[[{"name":"CLONE_OPTION","type":1}],"reporter"],"control_delete_this_clone":[[],"reporter"],"control_is_clone":[[],"reporter"],"control_stop_sprite_menu":[[{"name":"STOP_OPTION","type":1,"field":"STOP_OPTION","options":[["stage","_stage_"]]}],"reporter"],"control_stop_sprite":[[{"name":"STOP_OPTION","type":1}],"reporter"],"control_run_as_sprite_menu":[[{"name":"RUN_AS_OPTION","type":1,"field":"RUN_AS_OPTION","options":[["Stage","_stage_"]]}],"reporter"],"control_run_as_sprite":[[{"name":"RUN_AS_OPTION","type":1}],"reporter"],"control_inline_stack_output":[[{}],"reporter"],"control_get_counter":[[],"reporter"],"control_incr_counter":[[],"reporter"],"control_decr_counter":[[],"reporter"],"control_set_counter":[[{"name":"VALUE","type":1}],"reporter"],"control_clear_counter":[[],"reporter"],"control_all_at_once":[[{}],"reporter"],"control_new_script":[[{}],"reporter"],"control_backToGreenFlag":[[],"reporter"],"control_if_return_else_return":[[{"name":"boolean","type":1},{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"control_switch":[[{"name":"CONDITION","type":1}],"reporter"],"control_switch_default":[[{"name":"CONDITION","type":1}],"reporter"],"control_case":[[{"name":"CONDITION","type":1}],"reporter"],"control_case_next":[[{"name":"CONDITION","type":1}],"reporter"],"control_exitCase":[[],"reporter"],"control_exitLoop":[[],"reporter"],"control_continueLoop":[[],"reporter"],"control_javascript_command":[[{"name":"JS","type":1}],"reporter"],"event_whentouchingobject":[[{"name":"TOUCHINGOBJECTMENU","type":1}],"hat"],"event_touchingobjectmenu":[[{"name":"TOUCHINGOBJECTMENU","type":1,"field":"TOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"]]}],"reporter"],"event_whenflagclicked":[[],"hat"],"event_whenstopclicked":[[],"hat"],"event_whenthisspriteclicked":[[],"hat"],"event_whenstageclicked":[[],"hat"],"event_whenbroadcastreceived":[[{"name":"BROADCAST_OPTION","type":1,"field":"BROADCAST_OPTION","variableTypes":["broadcast_msg"]}],"hat"],"event_whenbackdropswitchesto":[[{"name":"BACKDROP","type":1,"field":"BACKDROP","options":[["backdrop1","BACKDROP1"]]}],"hat"],"event_whengreaterthan":[[{"name":"WHENGREATERTHANMENU","type":1,"field":"WHENGREATERTHANMENU","options":[["loudness","LOUDNESS"],["timer","TIMER"]]},{"name":"VALUE","type":1}],"hat"],"event_broadcast_menu":[[{"name":"BROADCAST_OPTION","type":1,"field":"BROADCAST_OPTION","variableTypes":["broadcast_msg"]}],"reporter"],"event_broadcast":[[{"name":"BROADCAST_INPUT","type":1}],"reporter"],"event_broadcastandwait":[[{"name":"BROADCAST_INPUT","type":1}],"reporter"],"event_whenkeypressed":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"hat"],"event_whenkeyhit":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"hat"],"event_whenmousescrolled":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["up","up"],["down","down"]]}],"hat"],"event_always":[[],"hat"],"event_whenanything":[[{"name":"ANYTHING","type":1}],"hat"],"event_whenjavascript":[[{"name":"JS","type":1}],"hat"],"looks_sayforsecs":[[{"name":"MESSAGE","type":1},{"name":"SECS","type":1}],"reporter"],"looks_say":[[{"name":"MESSAGE","type":1}],"reporter"],"looks_thinkforsecs":[[{"name":"MESSAGE","type":1},{"name":"SECS","type":1}],"reporter"],"looks_think":[[{"name":"MESSAGE","type":1}],"reporter"],"looks_setFont":[[{"name":"font","type":1},{"name":"size","type":1}],"reporter"],"looks_setColor":[[{"name":"prop","type":1,"field":"prop","options":[["border","BUBBLE_STROKE"],["fill","BUBBLE_FILL"],["text","TEXT_FILL"]]},{"name":"color","type":1}],"reporter"],"looks_setShape":[[{"name":"prop","type":1,"field":"prop","options":[["minimum width","MIN_WIDTH"],["maximum width","MAX_LINE_WIDTH"],["border line width","STROKE_WIDTH"],["padding size","PADDING"],["corner radius","CORNER_RADIUS"],["tail height","TAIL_HEIGHT"],["font pading percent","FONT_HEIGHT_RATIO"],["text length limit","texlim"]]},{"name":"color","type":1}],"reporter"],"looks_show":[[],"reporter"],"looks_hide":[[],"reporter"],"looks_changeVisibilityOfSprite_menu":[[{"name":"VISIBLE_OPTION","type":1,"field":"VISIBLE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"looks_changeVisibilityOfSprite":[[{"name":"VISIBLE_TYPE","type":1,"field":"VISIBLE_TYPE","options":[["show","show"],["hide","hide"]]},{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_changeVisibilityOfSpriteShow":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_changeVisibilityOfSpriteHide":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_hideallsprites":[[],"reporter"],"looks_setTintColor":[[{"name":"color","type":1}],"reporter"],"looks_tintColor":[[],"reporter"],"looks_changeeffectby":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]},{"name":"CHANGE","type":1}],"reporter"],"looks_seteffectto":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]},{"name":"VALUE","type":1}],"reporter"],"looks_cleargraphiceffects":[[],"reporter"],"looks_changesizeby":[[{"name":"CHANGE","type":1}],"reporter"],"looks_setsizeto":[[{"name":"SIZE","type":1}],"reporter"],"looks_size":[[],"reporter"],"looks_changestretchby":[[{"name":"CHANGE","type":1}],"reporter"],"looks_setstretchto":[[{"name":"STRETCH","type":1}],"reporter"],"looks_costume":[[{"name":"COSTUME","type":1,"field":"COSTUME","options":[["costume1","COSTUME1"],["costume2","COSTUME2"]]}],"reporter"],"looks_switchcostumeto":[[{"name":"COSTUME","type":1}],"reporter"],"looks_nextcostume":[[],"reporter"],"looks_previouscostume":[[],"reporter"],"looks_switchbackdropto":[[{"name":"BACKDROP","type":1}],"reporter"],"looks_backdrops":[[{"name":"BACKDROP","type":1,"field":"BACKDROP","options":[["backdrop1","BACKDROP1"]]}],"reporter"],"looks_gotofrontback":[[{"name":"FRONT_BACK","type":1,"field":"FRONT_BACK","options":[["front","front"],["back","back"]]}],"reporter"],"looks_goforwardbackwardlayers":[[{"name":"FORWARD_BACKWARD","type":1,"field":"FORWARD_BACKWARD","options":[["forward","forward"],["backward","backward"]]},{"name":"NUM","type":1}],"reporter"],"looks_goTargetLayer":[[{"name":"FORWARD_BACKWARD","type":1,"field":"FORWARD_BACKWARD","options":[["infront","infront"],["behind","behind"]]},{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_layersSetLayer":[[{"name":"NUM","type":1}],"reporter"],"looks_layersGetLayer":[[],"reporter"],"looks_backdropnumbername":[[{"name":"NUMBER_NAME","type":1,"field":"NUMBER_NAME","options":[["number","number"],["name","name"]]}],"reporter"],"looks_costumenumbername":[[{"name":"NUMBER_NAME","type":1,"field":"NUMBER_NAME","options":[["number","number"],["name","name"]]}],"reporter"],"looks_switchbackdroptoandwait":[[{"name":"BACKDROP","type":1}],"reporter"],"looks_nextbackdrop":[[],"reporter"],"looks_previousbackdrop":[[],"reporter"],"looks_setStretch":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"looks_changeStretch":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"looks_stretchGetX":[[],"reporter"],"looks_stretchGetY":[[],"reporter"],"looks_getSpriteVisible":[[],"reporter"],"looks_getOtherSpriteVisible_menu":[[{"name":"VISIBLE_OPTION","type":1,"field":"VISIBLE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"looks_getOtherSpriteVisible":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_getEffectValue":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]}],"reporter"],"looks_sayHeight":[[],"reporter"],"looks_sayWidth":[[],"reporter"],"looks_stoptalking":[[],"reporter"],"looks_getinputofcostume":[[{"name":"INPUT","type":1},{"name":"COSTUME","type":1}],"reporter"],"looks_getinput_menu":[[{"name":"INPUT","type":1,"field":"INPUT","options":[["width","width"],["height","height"],["rotation center x","rotation center x"],["rotation center y","rotation center y"],["drawing mode","drawing mode"]]}],"reporter"],"motion_movesteps":[[{"name":"STEPS","type":1}],"reporter"],"motion_movebacksteps":[[{"name":"STEPS","type":1}],"reporter"],"motion_moveupdownsteps":[[{"name":"DIRECTION","type":1,"field":"DIRECTION","options":[["up","up"],["down","down"]]},{"name":"STEPS","type":1}],"reporter"],"motion_turnright":[[],"reporter"],"motion_turnleft":[[],"reporter"],"motion_turnrightaroundxy":[[],"reporter"],"motion_turnleftaroundxy":[[],"reporter"],"motion_pointindirection":[[{"name":"DIRECTION","type":1}],"reporter"],"motion_pointtowards_menu":[[{"name":"TOWARDS","type":1,"field":"TOWARDS","options":[["mouse-pointer","_mouse_"],["random direction","_random_"]]}],"reporter"],"motion_turnaround":[[],"reporter"],"motion_pointinrandomdirection":[[],"reporter"],"motion_pointtowardsxy":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_pointtowards":[[{"name":"TOWARDS","type":1}],"reporter"],"motion_goto_menu":[[{"name":"TO","type":1,"field":"TO","options":[["mouse-pointer","_mouse_"],["random position","_random_"]]}],"reporter"],"motion_gotoxy":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_goto":[[{"name":"TO","type":1}],"reporter"],"motion_glidesecstoxy":[[{"name":"SECS","type":1},{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_glidedirectionstepsinseconds":[[{"name":"STEPS","type":1},{"name":"DIRECTION","type":1,"field":"DIRECTION","options":[["forwards","forwards"],["backwards","backwards"],["up","up"],["down","down"]]},{"name":"SECS","type":1}],"reporter"],"motion_glideto_menu":[[{"name":"TO","type":1,"field":"TO","options":[["mouse-pointer","_mouse_"],["random position","_random_"]]}],"reporter"],"motion_glideto":[[{"name":"SECS","type":1},{"name":"TO","type":1}],"reporter"],"motion_changebyxy":[[{"name":"DX","type":1},{"name":"DY","type":1}],"reporter"],"motion_changexby":[[{"name":"DX","type":1}],"reporter"],"motion_setx":[[{"name":"X","type":1}],"reporter"],"motion_changeyby":[[{"name":"DY","type":1}],"reporter"],"motion_sety":[[{"name":"Y","type":1}],"reporter"],"motion_ifonedgebounce":[[],"reporter"],"motion_ifonspritebounce":[[{"name":"SPRITE","type":1}],"reporter"],"motion_ifonxybounce":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_setrotationstyle":[[{"name":"STYLE","type":1,"field":"STYLE","options":[["left-right","left-right"],["up-down","up-down"],["look at","look at"],["don't rotate","don't rotate"],["all around","all around"]]}],"reporter"],"motion_xposition":[[],"reporter"],"motion_yposition":[[],"reporter"],"motion_direction":[[],"reporter"],"motion_scroll_right":[[{"name":"DISTANCE","type":1}],"reporter"],"motion_scroll_up":[[{"name":"DISTANCE","type":1}],"reporter"],"motion_move_sprite_to_scene_side":[[{"name":"ALIGNMENT","type":1,"field":"ALIGNMENT","options":[["bottom-left","bottom-left"],["bottom","bottom"],["bottom-right","bottom-right"],["middle","middle"],["top-left","top-left"],["top","top"],["top-right","top-right"],["left","left"],["right","right"]]}],"reporter"],"motion_align_scene":[[{"name":"ALIGNMENT","type":1,"field":"ALIGNMENT","options":[["bottom-left","bottom-left"],["bottom-right","bottom-right"],["middle","middle"],["top-left","top-left"],["top-right","top-right"]]}],"reporter"],"motion_xscroll":[[],"reporter"],"motion_yscroll":[[],"reporter"],"operator_add":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_subtract":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_multiply":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_divide":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_random":[[{"name":"FROM","type":1},{"name":"TO","type":1}],"reporter"],"operator_lt":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_equals":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_gt":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_gtorequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_ltorequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_notequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_and":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_nand":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_nor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_xor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_xnor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_or":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_not":[[{"name":"OPERAND","type":1}],"reporter"],"operator_join":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1}],"reporter"],"operator_join3":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1},{"name":"STRING3","type":1}],"reporter"],"operator_letter_of":[[{"name":"LETTER","type":1},{"name":"STRING","type":1}],"reporter"],"operator_length":[[{"name":"STRING","type":1}],"reporter"],"operator_contains":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1}],"reporter"],"operator_mod":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_round":[[{"name":"NUM","type":1}],"reporter"],"operator_mathop":[[{"name":"OPERATOR","type":1,"field":"OPERATOR","options":[["abs","abs"],["floor","floor"],["ceiling","ceiling"],["sign","sign"],["sqrt","sqrt"],["sin","sin"],["cos","cos"],["tan","tan"],["asin","asin"],["acos","acos"],["atan","atan"],["ln","ln"],["log","log"],["log2","log2"],["e ^","e ^"],["10 ^","10 ^"]]},{"name":"NUM","type":1}],"reporter"],"operator_advlog":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_regexmatch":[[{"name":"text","type":1},{"name":"reg","type":1},{"name":"regrule","type":1}],"reporter"],"operator_replaceAll":[[{"name":"text","type":1},{"name":"term","type":1},{"name":"res","type":1}],"reporter"],"operator_replaceFirst":[[{"name":"text","type":1},{"name":"term","type":1},{"name":"res","type":1}],"reporter"],"operator_getLettersFromIndexToIndexInText":[[{"name":"INDEX1","type":1},{"name":"INDEX2","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_getLettersFromIndexToIndexInTextFixed":[[{"name":"INDEX1","type":1},{"name":"INDEX2","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_readLineInMultilineText":[[{"name":"LINE","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_newLine":[[],"reporter"],"operator_tabCharacter":[[],"reporter"],"operator_stringify":[[{"name":"ONE","type":1}],"reporter"],"operator_boolify":[[{"name":"ONE","type":1}],"reporter"],"operator_character_to_code":[[{"name":"ONE","type":1}],"reporter"],"operator_code_to_character":[[{"name":"ONE","type":1}],"reporter"],"operator_lerpFunc":[[{"name":"ONE","type":1},{"name":"TWO","type":1},{"name":"AMOUNT","type":1}],"reporter"],"operator_advMath":[[{"name":"ONE","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["^","^"],["root","root"],["log","log"]]},{"name":"TWO","type":1}],"reporter"],"operator_advMathExpanded":[[{"name":"ONE","type":1},{"name":"TWO","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["root","root"],["log","log"]]},{"name":"THREE","type":1}],"reporter"],"operator_power":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_constrainnumber":[[{"name":"inp","type":1},{"name":"min","type":1},{"name":"max","type":1}],"reporter"],"operator_trueBoolean":[[],"reporter"],"operator_falseBoolean":[[],"reporter"],"operator_randomBoolean":[[],"reporter"],"operator_indexOfTextInText":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_lastIndexOfTextInText":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_countAppearTimes":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_textIncludesLetterFrom":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_textStartsOrEndsWith":[[{"name":"TEXT1","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["starts","starts"],["ends","ends"]]},{"name":"TEXT2","type":1}],"reporter"],"operator_toUpperLowerCase":[[{"name":"TEXT","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["uppercase","upper"],["lowercase","lower"]]}],"reporter"],"operator_javascript_output":[[{"name":"JS","type":1}],"reporter"],"operator_javascript_boolean":[[{"name":"JS","type":1}],"reporter"],"sound_sounds_menu":[[{"name":"SOUND_MENU","type":1,"field":"SOUND_MENU","options":[["1","0"],["2","1"],["3","2"],["4","3"],["5","4"],["6","5"],["7","6"],["8","7"],["9","8"],["10","9"],["call a function",null]]}],"reporter"],"sound_play":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_playuntildone":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_stop":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_pause":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_set_stop_fadeout_to":[[{"name":"VALUE","type":1},{"name":"SOUND_MENU","type":1}],"reporter"],"sound_play_at_seconds":[[{"name":"SOUND_MENU","type":1},{"name":"VALUE","type":1}],"reporter"],"sound_play_at_seconds_until_done":[[{"name":"SOUND_MENU","type":1},{"name":"VALUE","type":1}],"reporter"],"sound_stopallsounds":[[],"reporter"],"sound_pauseallsounds":[[],"reporter"],"sound_playallsounds":[[],"reporter"],"sound_seteffectto":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]},{"name":"VALUE","type":1}],"reporter"],"sound_changeeffectby":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]},{"name":"VALUE","type":1}],"reporter"],"sound_cleareffects":[[],"reporter"],"sound_getEffectValue":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]}],"reporter"],"sound_changevolumeby":[[{"name":"VOLUME","type":1}],"reporter"],"sound_setvolumeto":[[{"name":"VOLUME","type":1}],"reporter"],"sound_volume":[[],"reporter"],"sound_isSoundPlaying":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getLength":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getTimePosition":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getSoundVolume":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sensing_touchingobject":[[{"name":"TOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_objecttouchingclonesprite":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1},{"name":"SPRITETOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_objecttouchingobject":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1},{"name":"SPRITETOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_touchingobjectmenu":[[{"name":"TOUCHINGOBJECTMENU","type":1,"field":"TOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"]]}],"reporter"],"sensing_fulltouchingobjectmenu":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1,"field":"FULLTOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"],["this sprite","_myself_"]]}],"reporter"],"sensing_touchingobjectmenusprites":[[{"name":"SPRITETOUCHINGOBJECTMENU","type":1,"field":"SPRITETOUCHINGOBJECTMENU","options":[["this sprite","_myself_"]]}],"reporter"],"sensing_touchingcolor":[[{"name":"COLOR","type":1}],"reporter"],"sensing_coloristouchingcolor":[[{"name":"COLOR","type":1},{"name":"COLOR2","type":1}],"reporter"],"sensing_distanceto":[[{"name":"DISTANCETOMENU","type":1}],"reporter"],"sensing_distancetomenu":[[{"name":"DISTANCETOMENU","type":1,"field":"DISTANCETOMENU","options":[["mouse-pointer","_mouse_"]]}],"reporter"],"sensing_askandwait":[[{"name":"QUESTION","type":1}],"reporter"],"sensing_answer":[[],"reporter"],"sensing_keypressed":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_keyhit":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_mousescrolling":[[{"name":"SCROLL_OPTION","type":1}],"reporter"],"sensing_scrolldirections":[[{"name":"SCROLL_OPTION","type":1,"field":"SCROLL_OPTION","options":[["up","up"],["down","down"]]}],"reporter"],"sensing_keyoptions":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_fingeroptions":[[{"name":"FINGER_OPTION","type":1,"field":"FINGER_OPTION","options":[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]]}],"reporter"],"sensing_mousedown":[[],"reporter"],"sensing_mouseclicked":[[],"reporter"],"sensing_fingerdown":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_fingertapped":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_mousex":[[],"reporter"],"sensing_mousey":[[],"reporter"],"sensing_fingerx":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_fingery":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_setclipboard":[[{"name":"ITEM","type":1}],"reporter"],"sensing_getclipboard":[[],"reporter"],"sensing_setdragmode":[[{"name":"DRAG_MODE","type":1,"field":"DRAG_MODE","options":[["draggable","draggable"],["not draggable","not draggable"]]}],"reporter"],"sensing_getdragmode":[[],"reporter"],"sensing_loudness":[[],"reporter"],"sensing_loud":[[],"reporter"],"sensing_timer":[[],"reporter"],"sensing_resettimer":[[],"reporter"],"sensing_of_object_menu":[[{"name":"OBJECT","type":1,"field":"OBJECT","options":[["Sprite1","Sprite1"],["Stage","_stage_"]]}],"reporter"],"sensing_of":[[{"name":"PROPERTY","type":1,"field":"PROPERTY","options":[["x position","x position"],["y position","y position"],["direction","direction"],["costume #","costume #"],["costume name","costume name"],["size","size"],["volume","volume"],["backdrop #","backdrop #"],["backdrop name","backdrop name"]]},{"name":"OBJECT","type":1}],"reporter"],"sensing_current":[[{"name":"CURRENTMENU","type":1,"field":"CURRENTMENU","options":[["year","YEAR"],["month","MONTH"],["date","DATE"],["day of week","DAYOFWEEK"],["hour","HOUR"],["minute","MINUTE"],["second","SECOND"],["js timestamp","TIMESTAMP"]]}],"reporter"],"sensing_dayssince2000":[[],"reporter"],"sensing_username":[[],"reporter"],"sensing_loggedin":[[],"reporter"],"sensing_userid":[[],"reporter"],"sensing_regextest":[[{"name":"text","type":1},{"name":"reg","type":1},{"name":"regrule","type":1}],"reporter"],"sensing_thing_is_number":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_thing_has_text":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_thing_has_number":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_mobile":[[],"reporter"],"sensing_thing_is_text":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_getspritewithattrib":[[{"name":"var","type":1},{"name":"val","type":1}],"reporter"],"sensing_distanceTo":[[{"name":"x1","type":1},{"name":"y1","type":1},{"name":"x2","type":1},{"name":"y2","type":1}],"reporter"],"sensing_directionTo":[[{"name":"x2","type":1},{"name":"y2","type":1},{"name":"x1","type":1},{"name":"y1","type":1}],"reporter"],"sensing_isUpperCase":[[{"name":"text","type":1}],"reporter"],"sensing_getoperatingsystem":[[],"reporter"],"sensing_getbrowser":[[],"reporter"],"sensing_geturl":[[],"reporter"],"sensing_getxyoftouchingsprite":[[{"name":"XY","type":1,"field":"XY","options":[["x","x"],["y","y"]]},{"name":"SPRITE","type":1}],"reporter"],"data_variable":[[null],"reporter"],"data_setvariableto":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"data_changevariableby":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"data_showvariable":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_hidevariable":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_listcontents":[[null],"reporter"],"data_listindexall":[[{"name":"INDEX","type":1}],"reporter"],"data_listindexrandom":[[{"name":"INDEX","type":1}],"reporter"],"data_addtolist":[[{"name":"ITEM","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_deleteoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_deletealloflist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_shiftlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"INDEX","type":1}],"reporter"],"data_insertatlist":[[{"name":"ITEM","type":1},{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_replaceitemoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"ITEM","type":1}],"reporter"],"data_itemoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_itemnumoflist":[[{"name":"ITEM","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_lengthoflist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listcontainsitem":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"ITEM","type":1}],"reporter"],"data_showlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_hidelist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_reverselist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_itemexistslist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listisempty":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listarray":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_amountinlist":[[{"name":"VALUE","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_filterlistitem":[[],"reporter"],"data_filterlistindex":[[],"reporter"],"data_filterlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"INDEX","type":1},{"name":"ITEM","type":1},{"name":"BOOL","type":1}],"reporter"],"data_arraylist":[[{"name":"VALUE","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listforeachnum":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_listforeachitem":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"pmOperatorsExpansion_shiftLeft":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_shiftRight":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryAnd":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryOr":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryXor":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryNot":[[{"name":"num1","type":"number"}]],"jgJSON_json_validate":[[{"name":"json","type":"string"}]],"jgJSON_getValueFromJSON":[[{"name":"VALUE","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_getTreeValueFromJSON":[[{"name":"VALUE","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_setValueToKeyInJSON":[[{"name":"VALUE","type":"string"},{"name":"KEY","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_json_delete":[[{"name":"json","type":"string"},{"name":"key","type":"string"}]],"jgJSON_json_values":[[{"name":"json","type":"string"}]],"jgJSON_json_keys":[[{"name":"json","type":"string"}]],"jgJSON_json_has":[[{"name":"json","type":"string"},{"name":"key","type":"string"}]],"jgJSON_json_combine":[[{"name":"one","type":"string"},{"name":"two","type":"string"}]],"jgJSON_json_array_validate":[[{"name":"array","type":"string"}]],"jgJSON_json_array_split":[[{"name":"text","type":"string"},{"name":"delimeter","type":"string"}]],"jgJSON_json_array_join":[[{"name":"array","type":"string"},{"name":"delimeter","type":"string"}]],"jgJSON_json_array_push":[[{"name":"array","type":"string"},{"name":"item","type":"string"}]],"jgJSON_json_array_concatLayer1":[[{"name":"array1","type":"string"},{"name":"array2","type":"string"}]],"jgJSON_json_array_concatLayer2":[[{"name":"array1","type":"string"},{"name":"array2","type":"string"},{"name":"array3","type":"string"}]],"jgJSON_json_array_delete":[[{"name":"array","type":"string"},{"name":"index","type":"number"}]],"jgJSON_json_array_reverse":[[{"name":"array","type":"string"}]],"jgJSON_json_array_insert":[[{"name":"array","type":"string"},{"name":"index","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_set":[[{"name":"array","type":"string"},{"name":"index","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_get":[[{"name":"array","type":"string"},{"name":"index","type":"number"}]],"jgJSON_json_array_indexofNostart":[[{"name":"array","type":"string"},{"name":"value","type":"string"}]],"jgJSON_json_array_indexof":[[{"name":"array","type":"string"},{"name":"number","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_length":[[{"name":"array","type":"string"}]],"jgJSON_json_array_contains":[[{"name":"array","type":"string"},{"name":"value","type":"string"}]],"jgJSON_json_array_flat":[[{"name":"array","type":"string"},{"name":"layer","type":"number"}]],"jgJSON_json_array_getrange":[[{"name":"array","type":"string"},{"name":"index1","type":"number"},{"name":"index2","type":"number"}]],"jgJSON_json_array_isempty":[[{"name":"array","type":"string"}]],"jgJSON_json_array_listtoarray":[[{"name":"list","type":"string"}]],"jgJSON_json_array_tolist":[[{"name":"list","type":"string"},{"name":"array","type":"string"}]]}`)
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
                console.error("Editor init failed:", e);
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
            console.error("Wasmoon UMD load failed:", e && e.message ? e.message : e);
        }

        try {
            await loadScript("https://cdn.jsdelivr.net/npm/wasmoon@1.16.0");
            const after2 = window.wasmoon || window.Wasmoon || window.WasMoon;
            const r3 = tryResolve(after2);
            if (r3) return r3;
        } catch (e) {
            console.error(
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
            console.error("Wasmoon fetch+eval failed:", e && e.message ? e.message : e);
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

            await engine.global.set("js_print", (s) => console.log(`[lua:${tid}]`, s));
        await engine.global.set("sleep", (ms) => sleep(Number(ms || 0)));
        await engine.global.set("call", async (opcode, args) =>
            callOpcode(opcode, args || {}, target)
        );
        await engine.global.set("keyDown", (key) => vm.runtime.ioDevices.keyboard.getKeyIsDown(key));
        await engine.global.set("keyHit", (key) => vm.runtime.ioDevices.keyboard.getKeyIsHit(key));
        try {
            await engine.global.set("__register_hat_in_js", (hat, delta) => {
                try {
                    window.luaEngine &&
                        window.luaEngine._registerHatForEngine &&
                        window.luaEngine._registerHatForEngine(tid, hat, delta);
                } catch (_) {}
            });
        } catch (_) {}
        try {
            await engine.global.set("__register_forever_in_js", (fn) => {
                try {
                    let state = foreverLoops.get(tid);
                    if (!state) {
                        state = { map: new Map(), rafId: null, running: false };
                        foreverLoops.set(tid, state);
                    }
                    const id = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
                    state.map.set(id, fn);
                    if (!state.running) {
                        state.running = true;
                        let lastTime = performance.now();
                        const tick = (now) => {
                            try {
                                if (typeof now !== 'number') now = performance.now();
                                let dt = (now - lastTime) / 1000;
                                // cap dt to avoid huge jumps after tab switch or pauses
                                if (!isFinite(dt) || dt <= 0) dt = 0;
                                if (dt > 0.1) dt = 0.1;
                                lastTime = now;
                                const items = Array.from(state.map.values());
                                // Sub-step the dt to improve integration stability (smooth motion on variable frame rates)
                                const STEP = 1 / 60; // base step ~16.66ms
                                const MAX_SUBSTEPS = 5; // avoid spiraling when dt is large
                                const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / STEP)));
                                const subDt = dt / substeps;
                                for (const f of items) {
                                    try {
                                        for (let s = 0; s < substeps; s++) {
                                            const res = f(subDt);
                                            if (res && typeof res.then === 'function') res.catch(e => console.error(`[luaEngine] forever fn error for ${tid}:`, e));
                                        }
                                    } catch (e) {
                                        console.error(`[luaEngine] forever fn error for ${tid}:`, e);
                                    }
                                }
                            } catch (_) {}
                            state.rafId = requestAnimationFrame(tick);
                        };
                        lastTime = performance.now();
                        state.rafId = requestAnimationFrame(tick);
                    }
                    const cancel = () => {
                        try {
                            const s = foreverLoops.get(tid);
                            if (!s) return;
                            s.map.delete(id);
                            if (s.map.size === 0) {
                                try { if (s.rafId != null) cancelAnimationFrame(s.rafId); } catch (_) {}
                                foreverLoops.delete(tid);
                            }
                        } catch (_) {}
                    };
                    return cancel;
                } catch (e) {
                    console.error('register_forever_in_js failed:', e);
                    return () => {};
                }
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

            local function deep_contains_value(tbl, val, seen)
                if seen == nil then seen = {} end
                if type(tbl) ~= 'table' then return tbl == val end
                if seen[tbl] then return false end
                seen[tbl] = true
                for k, v in pairs(tbl) do
                    if type(v) == 'table' then
                        if deep_contains_value(v, val, seen) then return true end
                    else
                        if v == val then return true end
                    end
                end
                return false
            end

            function on(hat, ...)
                if type(hat) ~= 'string' and type(hat) ~= 'number' then
                    if type(js_print) == 'function' then js_print('lua on() expected hat string/number, got '..tostring(type(hat))) end
                    return function() end
                end
                local args = {...}
                if #args == 0 then
                    if type(js_print) == 'function' then js_print('lua on() expected function as last argument') end
                    return function() end
                end
                local last = args[#args]
                if type(last) ~= 'function' then
                    if type(js_print) == 'function' then js_print('lua on() expected function as last argument, got '..tostring(type(last))) end
                    return function() end
                end
                local fn = last
                local matchers = nil
                if #args > 1 then
                    matchers = {}
                    for i = 1, #args - 1 do table.insert(matchers, args[i]) end
                end

                hat = tostring(hat)
                __luaHatRegistry[hat] = __luaHatRegistry[hat] or {}
                __luaHatNextId = (__luaHatNextId or 0) + 1
                local id = tostring(__luaHatNextId)
                table.insert(__luaHatRegistry[hat], { id = id, fn = fn, matchers = matchers })
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

            -- Forever function: run a Lua function every animation frame via JS
            function forever(fn)
                if type(fn) ~= 'function' then
                    if type(js_print) == 'function' then js_print('lua forever() expected function') end
                    return function() end
                end
                if type(__register_forever_in_js) == 'function' then
                    local ok, cancel = pcall(__register_forever_in_js, fn)
                    if ok and type(cancel) == 'function' then
                        return cancel
                    end
                end
                return function() end
            end

            function __call_hats(hat, opts) 
                hat = tostring(hat)
                
                -- Helper to safely get length of either table or userdata array
                local function safe_len(arr)
                    if arr == nil then return 0 end
                    local ok, len = pcall(function() return #arr end)
                    return ok and len or 0
                end
                
                local ok, snapshot_or_err = pcall(function()
                    local list = __luaHatRegistry[hat] or {}
                    local snapshot = {}
                    for i = 1, #list do
                        local entry = list[i]
                        if type(entry) == 'table' and type(entry.fn) == 'function' then
                            table.insert(snapshot, entry)
                        elseif type(entry) == 'function' then
                            table.insert(snapshot, { fn = entry })
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

                local function safe_call(entry, opts)
                    local fn = entry.fn
                    if entry.matchers and type(entry.matchers) == 'table' then
                        local args_len = (opts and opts._args) and safe_len(opts._args) or 0
                        -- Prefer strict positional matching if _args available (handle both table and userdata)
                        if opts ~= nil and opts._args ~= nil and args_len >= #entry.matchers then
                            for i = 1, #entry.matchers do
                                local m = entry.matchers[i]
                                local a = opts._args[i]
                                if m == nil then
                                    -- nil matcher always matches
                                else
                                    if type(a) == 'string' and type(m) == 'string' then
                                        if string.lower(a) ~= string.lower(m) then return end
                                    else
                                        if tostring(a) ~= tostring(m) then return end
                                    end
                                end
                            end
                        elseif opts ~= nil and opts.key ~= nil and #entry.matchers == 1 then
                            -- common case: key-pressed hat provides \`key\` field
                            local m = entry.matchers[1]
                            if type(opts.key) == 'string' and type(m) == 'string' then
                                if string.lower(opts.key) ~= string.lower(m) then return end
                            else
                                if tostring(opts.key) ~= tostring(m) then return end
                            end
                        else
                            for i = 1, #entry.matchers do
                                local m = entry.matchers[i]
                                if not deep_contains_value(opts, m) then
                                    return -- skip this handler
                                end
                            end
                        end
                    end

                    -- If we reach here, the handler matched; call it
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

    // loadStdlibOnce removed (not used)

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
            console.error("injectOpcodeWrappersIntoLua failed:", e);
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
                console.error("runScriptForTarget init error:", e);
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
                console.error(`[luaEngine:${tid}] runtime error:`, e);
        }
        try {
            const info = luaEngines.get(tid);
            if (info) await syncEngineHatIndex(info);
        } catch (_) {}
    }

    // makeTargetWrapper removed (not used)

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

                // Ensure positional args and key are present for Lua matcher logic.
                try {
                    if (!toSet._args || !Array.isArray(toSet._args)) {
                        if (sanitizedOpts && Array.isArray(sanitizedOpts._args)) toSet._args = sanitizedOpts._args.slice();
                        else toSet._args = [];
                    } else {
                        // Fill null/undefined slots from sanitizedOpts._args if available
                        if (sanitizedOpts && Array.isArray(sanitizedOpts._args)) {
                            for (let i = 0; i < sanitizedOpts._args.length; i++) {
                                if (toSet._args[i] == null) toSet._args[i] = sanitizedOpts._args[i];
                            }
                        }
                    }
                    if ((toSet.key === undefined || toSet.key === null) && sanitizedOpts && sanitizedOpts.key) {
                        toSet.key = sanitizedOpts.key;
                    }
                } catch (_) {}
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
                        console.error(`[luaEngine] fallback __lua_hat_opts set failed for ${tid}:`, e);
                    }
                    setRes = undefined;
                }

                if (setRes && typeof setRes.then === "function") {
                    setRes.catch((e) => console.error(`engine.global.set failed for ${tid}:`, e));
                }
            } catch (setErr) {
                console.error(`[luaEngine] engine.global.set attempt failed for ${tid}:`, setErr);
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
                            console.error(`[luaEngine] __call_hats failed for ${tid}:`, e);
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
                                    console.error(
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
                                    console.error(
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
                                console.error(
                                    `[luaEngine] __call_hats failed for ${tid}:`,
                                    e
                                );
                            });
                        }
                    }
                }
            } catch (e) {
                console.error(`[luaEngine] __call_hats invocation error for ${tid}:`, e);
            }
        } catch (e) {
            console.error("dispatchToEngine error:", e);
        }
    }

    function scheduleDispatch(runtime, hatOpcode, util, options) {
        let resolvedTargets = [];

        function buildHatOptions(hat, utilObj, opts) {
            const out = Object.assign({}, utilObj || {}, opts || {});
            let argNames = [];
            try {
                const def = loadedBlocksFull && loadedBlocksFull[hat];
                if (def) argNames = extractArgNamesFromEntry(def) || [];
            } catch (_) {
                argNames = [];
            }
            try {
                out._argNames = argNames;
                out._args = argNames.map((n) =>
                    Object.prototype.hasOwnProperty.call(out, n) ? out[n] : null
                );

                // Try to populate missing arg values from common util shapes
                if (utilObj && utilObj.fields) {
                    for (let i = 0; i < argNames.length; i++) {
                        const n = argNames[i];
                        if (out._args[i] == null) {
                            const fn = utilObj.fields[n] || utilObj.fields[n.toUpperCase()];
                            if (fn != null) {
                                // Field may be an object with `value` or `name` or may be direct
                                if (typeof fn === 'object' && fn !== null) {
                                    out._args[i] = fn.value ?? fn.name ?? fn[0] ?? fn;
                                    out[n] = out._args[i];
                                } else {
                                    out._args[i] = fn;
                                    out[n] = fn;
                                }
                            }
                        }
                    }
                }

                // utilObj.block.fields (some runtimes nest fields here)
                if (utilObj && utilObj.block && utilObj.block.fields) {
                    for (let i = 0; i < argNames.length; i++) {
                        const n = argNames[i];
                        if (out._args[i] == null) {
                            const fn = utilObj.block.fields[n] || utilObj.block.fields[n.toUpperCase()];
                            if (fn != null) {
                                out._args[i] = (typeof fn === 'object' && fn !== null) ? (fn.value ?? fn.name ?? fn) : fn;
                                out[n] = out._args[i];
                            }
                        }
                    }
                }

                // utilObj.args array
                if (utilObj && Array.isArray(utilObj.args)) {
                    for (let i = 0; i < argNames.length && i < utilObj.args.length; i++) {
                        if (out._args[i] == null) {
                            out._args[i] = utilObj.args[i]; out[argNames[i]] = utilObj.args[i];
                        }
                    }
                }

                // Additional heuristic: try to match top-level keys in utilObj to argNames
                // by a sanitized comparison (case-insensitive, remove non-alphanum, and common suffixes)
                try {
                    if (utilObj && argNames && argNames.length) {
                        const sanitize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const stripSuffixes = (s) => s.replace(/(?:option|menu|input|field|value)$/i, '');
                        const topKeys = Object.keys(utilObj || {});
                        for (let i = 0; i < argNames.length; i++) {
                            if (out._args[i] != null) continue;
                            const n = argNames[i];
                            const target = sanitize(n);
                            const targetBase = sanitize(stripSuffixes(n));
                            for (const k of topKeys) {
                                try {
                                    const sk = sanitize(k);
                                    if (sk === target || sk === targetBase) {
                                        let val = utilObj[k];
                                        if (typeof val === 'object' && val !== null) val = val.value ?? val.name ?? val[0] ?? val;
                                        out._args[i] = val;
                                        out[n] = val;
                                        break;
                                    }
                                } catch (_) {}
                            }
                        }
                    }
                } catch (_) {}
            } catch (_) {}
            try {
                // normalize common runtime key fields into `key` for matching (kept for compatibility)
                if (!out.key && utilObj) {
                    if (utilObj.key) out.key = utilObj.key;
                    else if (utilObj.keyOption) out.key = utilObj.keyOption;
                    else if (utilObj.KEY_OPTION) out.key = utilObj.KEY_OPTION;
                    else if (utilObj.keyString) out.key = utilObj.keyString;
                    else if (utilObj.keyName) out.key = utilObj.keyName;
                    else if (utilObj.text) out.key = utilObj.text;
                }
                // also if options used numeric args, ensure _args populated
                if ((!out._args || out._args.length === 0) && Array.isArray(utilObj && utilObj.args)) {
                    out._args = utilObj.args.slice();
                }

                // Ensure positional args from utilObj.args fill missing slots
                // even when out._args already has the correct length but contains nulls.
                if (utilObj && Array.isArray(utilObj.args) && Array.isArray(out._args)) {
                    for (let i = 0; i < utilObj.args.length; i++) {
                        if (out._args[i] == null) {
                            out._args[i] = utilObj.args[i];
                            if (argNames[i]) out[argNames[i]] = utilObj.args[i];
                        }
                    }
                }
            } catch (_) {}
            return out;
        }

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

        // Always schedule dispatch; handlers may be registered after runtime.startHats
        // so skipping here can cause missed events.

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
                                console.error(`initLuaForTarget(${tid}) failed:`, e)
                            );

                            setTimeout(() => {
                                const info2 = luaEngines.get(tid);
                                if (info2) {
                                    const constructed = buildHatOptions(hatOpcode, util, options);
                                    dispatchToEngine(info2, hatOpcode, constructed, t);
                                }
                            }, 150);
                        } else {
                            const constructed = buildHatOptions(hatOpcode, util, options);
                            dispatchToEngine(info, hatOpcode, constructed, t);
                        }
                    } catch (e) {
                        console.error("dispatch-to-target error:", e);
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
                            console.error("runScriptForTarget error:", e)
                        );
                    else {
                        initLuaForTarget(t).catch(() => {});
                    }
                } catch (_) {}
            }
        } catch (e) {
            console.error("onProjectStart error:", e);
        }
    }

    if (window.vm?.runtime && typeof window.vm.runtime.on === "function") {
        window.vm.runtime.on("PROJECT_START", onProjectStart);
        try { onProjectStart().catch(() => {}); } catch (_) {}
        // register PROJECT_STOP_ALL to clear Lua listeners and attempt engine exits
        try {
            const stopHandler = async () => {
                try {
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
                        try {
                            const s = foreverLoops.get(tid);
                            if (s) {
                                try { if (s.rafId != null) cancelAnimationFrame(s.rafId); } catch (_) {}
                                try { s.map.clear(); } catch (_) {}
                                foreverLoops.delete(tid);
                            }
                        } catch (_) {}
                    }
                    try {
                        if (window.luaEngine) {
                            try { queuedHats.clear(); } catch (_) {}
                            try { window.luaEngine._hatIndex = new Map(); } catch (_) {}
                            try { for (const [tid,s] of foreverLoops) { try { if (s.rafId != null) cancelAnimationFrame(s.rafId); } catch(_) {} } foreverLoops.clear(); } catch(_) {}
                        }
                    } catch (_) {}
                    // PROJECT_STOP_ALL cleanup finished
                } catch (e) {
                    console.error("PROJECT_STOP_ALL handler error:", e);
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
                                    try { const s = foreverLoops.get(tid); if (s) { try { if (s.rafId != null) cancelAnimationFrame(s.rafId); } catch(_) {} try { s.map.clear(); } catch(_) {} foreverLoops.delete(tid); } } catch (_) {}
                                }
                                try {
                                    const map = window.luaEngine && window.luaEngine._hatIndex;
                                    if (map && map instanceof Map) {
                                        for (const [hat, m] of map) {
                                                    try {} catch (_) {}
                                        }
                                    }
                                } catch (_) {}
                                try { for (const [tid,s] of foreverLoops) { try { if (s.rafId != null) cancelAnimationFrame(s.rafId); } catch(_) {} } foreverLoops.clear(); } catch(_) {}
                                // PROJECT_STOP_ALL cleanup finished
                            } catch (e) {
                                console.error("PROJECT_STOP_ALL handler error:", e);
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
    window.luaEngine._foreverLoops = foreverLoops;
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
        if (!q.length) return;
        const info = luaEngines.get(tid);
        if (!info) return;
        if (info.async === false && !opts.force) return;
        (function runNext() {
            const item = q.shift();
            if (!item) {
                queuedHats.delete(tid);
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
                console.error(`Error running queued hat for ${tid}:`, e);
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
                    // registry_types dump collected (ignored)
                } catch (e) {
                    console.error("[luaEngine] registry_types failed for", tid, e);
                }
            }
        } catch (e) {
            console.error("[luaEngine] dumpRegistries error:", e);
        }
    };

    window.luaEngine.syncAllHatIndexes = async function () {
        try {
            for (const [tid, info] of luaEngines) {
                try {
                    await syncEngineHatIndex(info);
                } catch (_) {}
            }
            // syncAllHatIndexes completed
        } catch (e) {
            console.error("[luaEngine] syncAllHatIndexes error:", e);
        }
    };

    window.luaEngine.callHatOnEngine = async function (tid, hat) {
        try {
            const info = luaEngines.get(tid);
            if (!info) return;
            const engine = info.engine;
            try {
                const res = await engine.doString(
                    `__call_hats(${JSON.stringify(hat)}, {})`
                );
                // callHatOnEngine result available (ignored)
            } catch (e) {
                console.error("[luaEngine] callHatOnEngine failed for", tid, hat, e);
            }
        } catch (e) {
            console.error("[luaEngine] callHatOnEngine error:", e);
        }
    };

    window.luaEngine.runFor = async function (tid, code) {
        let info = luaEngines.get(tid);
        if (!info) {
            try {
                await initLuaForTarget({ id: tid, name: tid });
                info = luaEngines.get(tid);
                if (!info) {
                    console.error(`[luaEngine] failed to initialize engine for ${tid}`);
                    return;
                }
            } catch (e) {
                console.error(`[luaEngine] failed to init engine for ${tid}:`, e);
                return;
            }
        }
        try {
            if (typeof info.engine.doString === "function") {
                await info.engine.doString(code);
            } else if (typeof info.engine.run === "function") {
                await info.engine.run(code);
            } else {
                // engine has no doString/run
            }
        } catch (e) {
            console.error(`[luaEngine] runFor(${tid}) error:`, e);
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

    // luaEngine injected
})();