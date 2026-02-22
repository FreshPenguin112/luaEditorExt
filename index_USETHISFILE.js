(function () {
  let container = document.querySelector(".injectionDiv");
  let uiEnabled = !!container;
  try {
    window.jsEngine = window.jsEngine || {};
    window.jsEngine.engines = new Map();
    window.jsEngine._sanitizeBailouts = window.jsEngine._sanitizeBailouts || 0;
    window.jsEngine.getSanitizeBailouts = function () {
      return window.jsEngine._sanitizeBailouts || 0;
    };
    window.jsEngine.getSanitizeConfig = function () {
      return { maxDepth: 6, maxNodes: 3000, maxKeys: 200, maxArray: 500 };
    };
  } catch (_) {}

  const EXT_KEY = "jsengine";
  const _queuedStorage = {};
  const jsEngines = new Map();
  const queuedHats = new Map();
  const foreverLoops = new Map();
  const renderInterp = {
    enabled: false,
    speed: 30,
    rafId: null,
    map: new Map(),
  };

  function startRenderInterpolationLoop() {
    if (renderInterp.rafId != null) return;
    let last = performance.now();
    const tick = (now) => {
      try {
        if (!renderInterp.enabled) {
          renderInterp.rafId = null;
          return;
        }
        if (typeof now !== "number") now = performance.now();
        const dt = Math.max(0, (now - last) / 1000);
        last = now;
        const speed = Number(renderInterp.speed) || 30;
        const alpha = 1 - Math.exp(-speed * dt);
        for (const [tid, s] of renderInterp.map) {
          try {
            const logical = s.logical || { x: 0, y: 0 };
            const visual = s.visual || { x: logical.x, y: logical.y };

            visual.x += (logical.x - visual.x) * alpha;
            visual.y += (logical.y - visual.y) * alpha;
            s.visual = visual;

            try {
              const info = jsEngines.get(tid);
              if (info && info.target) {
                const t = info.target;
                if (typeof t.setXY === "function") {
                  t.setXY(visual.x, visual.y);
                } else if ("x" in t) {
                  t.x = visual.x;
                }
              }
            } catch (_) {}
          } catch (_) {}
        }
      } catch (_) {}
      renderInterp.rafId = requestAnimationFrame(tick);
    };
    last = performance.now();
    renderInterp.rafId = requestAnimationFrame(tick);
  }

  function stopRenderInterpolationLoop() {
    try {
      if (renderInterp.rafId != null) {
        try {
          cancelAnimationFrame(renderInterp.rafId);
        } catch (_) {}
        renderInterp.rafId = null;
      }
    } catch (_) {}
  }
  let loadedBlocksFull = null;

  function log(...a) {}
  function getExtRoot() {
    if (window.vm?.runtime) {
      window.vm.runtime.extensionStorage = window.vm.runtime.extensionStorage || {};
      window.vm.runtime.extensionStorage[EXT_KEY] = window.vm.runtime.extensionStorage[EXT_KEY] || {};
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
  function buildProcessedBlocksFromToolbox() {
    return JSON.parse(
      `{"control_forever":[[{}],"reporter"],"control_repeat":[[{"name":"TIMES","type":1}],"reporter"],"control_repeatForSeconds":[[{"name":"TIMES","type":1}],"reporter"],"control_if":[[{"name":"CONDITION","type":1}],"reporter"],"control_if_else":[[{"name":"CONDITION","type":1}],"reporter"],"control_try_catch":[[{}],"reporter"],"control_throw_error":[[{"name":"ERROR","type":1}],"reporter"],"control_error":[[],"reporter"],"control_stop":[[],"reporter"],"control_wait":[[{"name":"DURATION","type":1}],"reporter"],"control_waitsecondsoruntil":[[{"name":"DURATION","type":1},{"name":"CONDITION","type":1}],"reporter"],"control_waittick":[[],"reporter"],"control_wait_until":[[{"name":"CONDITION","type":1}],"reporter"],"control_repeat_until":[[{"name":"CONDITION","type":1}],"reporter"],"control_while":[[{"name":"CONDITION","type":1}],"reporter"],"control_for_each":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"control_start_as_clone":[[],"hat"],"control_create_clone_of_menu":[[{"name":"CLONE_OPTION","type":1,"field":"CLONE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"control_create_clone_of":[[{"name":"CLONE_OPTION","type":1}],"reporter"],"control_delete_clones_of":[[{"name":"CLONE_OPTION","type":1}],"reporter"],"control_delete_this_clone":[[],"reporter"],"control_is_clone":[[],"reporter"],"control_stop_sprite_menu":[[{"name":"STOP_OPTION","type":1,"field":"STOP_OPTION","options":[["stage","_stage_"]]}],"reporter"],"control_stop_sprite":[[{"name":"STOP_OPTION","type":1}],"reporter"],"control_run_as_sprite_menu":[[{"name":"RUN_AS_OPTION","type":1,"field":"RUN_AS_OPTION","options":[["Stage","_stage_"]]}],"reporter"],"control_run_as_sprite":[[{"name":"RUN_AS_OPTION","type":1}],"reporter"],"control_inline_stack_output":[[{}],"reporter"],"control_get_counter":[[],"reporter"],"control_incr_counter":[[],"reporter"],"control_decr_counter":[[],"reporter"],"control_set_counter":[[{"name":"VALUE","type":1}],"reporter"],"control_clear_counter":[[],"reporter"],"control_all_at_once":[[{}],"reporter"],"control_new_script":[[{}],"reporter"],"control_backToGreenFlag":[[],"reporter"],"control_if_return_else_return":[[{"name":"boolean","type":1},{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"control_switch":[[{"name":"CONDITION","type":1}],"reporter"],"control_switch_default":[[{"name":"CONDITION","type":1}],"reporter"],"control_case":[[{"name":"CONDITION","type":1}],"reporter"],"control_case_next":[[{"name":"CONDITION","type":1}],"reporter"],"control_exitCase":[[],"reporter"],"control_exitLoop":[[],"reporter"],"control_continueLoop":[[],"reporter"],"control_javascript_command":[[{"name":"JS","type":1}],"reporter"],"event_whentouchingobject":[[{"name":"TOUCHINGOBJECTMENU","type":1}],"hat"],"event_touchingobjectmenu":[[{"name":"TOUCHINGOBJECTMENU","type":1,"field":"TOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"]]}],"reporter"],"event_whenflagclicked":[[],"hat"],"event_whenstopclicked":[[],"hat"],"event_whenthisspriteclicked":[[],"hat"],"event_whenstageclicked":[[],"hat"],"event_whenbroadcastreceived":[[{"name":"BROADCAST_OPTION","type":1,"field":"BROADCAST_OPTION","variableTypes":["broadcast_msg"]}],"hat"],"event_whenbackdropswitchesto":[[{"name":"BACKDROP","type":1,"field":"BACKDROP","options":[["backdrop1","BACKDROP1"]]}],"hat"],"event_whengreaterthan":[[{"name":"WHENGREATERTHANMENU","type":1,"field":"WHENGREATERTHANMENU","options":[["loudness","LOUDNESS"],["timer","TIMER"]]},{"name":"VALUE","type":1}],"hat"],"event_broadcast_menu":[[{"name":"BROADCAST_OPTION","type":1,"field":"BROADCAST_OPTION","variableTypes":["broadcast_msg"]}],"reporter"],"event_broadcast":[[{"name":"BROADCAST_INPUT","type":1}],"reporter"],"event_broadcastandwait":[[{"name":"BROADCAST_INPUT","type":1}],"reporter"],"event_whenkeypressed":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"hat"],"event_whenkeyhit":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"hat"],"event_whenmousescrolled":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["up","up"],["down","down"]]}],"hat"],"event_always":[[],"hat"],"event_whenanything":[[{"name":"ANYTHING","type":1}],"hat"],"event_whenjavascript":[[{"name":"JS","type":1}],"hat"],"looks_sayforsecs":[[{"name":"MESSAGE","type":1},{"name":"SECS","type":1}],"reporter"],"looks_say":[[{"name":"MESSAGE","type":1}],"reporter"],"looks_thinkforsecs":[[{"name":"MESSAGE","type":1},{"name":"SECS","type":1}],"reporter"],"looks_think":[[{"name":"MESSAGE","type":1}],"reporter"],"looks_setFont":[[{"name":"font","type":1},{"name":"size","type":1}],"reporter"],"looks_setColor":[[{"name":"prop","type":1,"field":"prop","options":[["border","BUBBLE_STROKE"],["fill","BUBBLE_FILL"],["text","TEXT_FILL"]]},{"name":"color","type":1}],"reporter"],"looks_setShape":[[{"name":"prop","type":1,"field":"prop","options":[["minimum width","MIN_WIDTH"],["maximum width","MAX_LINE_WIDTH"],["border line width","STROKE_WIDTH"],["padding size","PADDING"],["corner radius","CORNER_RADIUS"],["tail height","TAIL_HEIGHT"],["font pading percent","FONT_HEIGHT_RATIO"],["text length limit","texlim"]]},{"name":"color","type":1}],"reporter"],"looks_show":[[],"reporter"],"looks_hide":[[],"reporter"],"looks_changeVisibilityOfSprite_menu":[[{"name":"VISIBLE_OPTION","type":1,"field":"VISIBLE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"looks_changeVisibilityOfSprite":[[{"name":"VISIBLE_TYPE","type":1,"field":"VISIBLE_TYPE","options":[["show","show"],["hide","hide"]]},{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_changeVisibilityOfSpriteShow":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_changeVisibilityOfSpriteHide":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_hideallsprites":[[],"reporter"],"looks_setTintColor":[[{"name":"color","type":1}],"reporter"],"looks_tintColor":[[],"reporter"],"looks_changeeffectby":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]},{"name":"CHANGE","type":1}],"reporter"],"looks_seteffectto":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]},{"name":"VALUE","type":1}],"reporter"],"looks_cleargraphiceffects":[[],"reporter"],"looks_changesizeby":[[{"name":"CHANGE","type":1}],"reporter"],"looks_setsizeto":[[{"name":"SIZE","type":1}],"reporter"],"looks_size":[[],"reporter"],"looks_changestretchby":[[{"name":"CHANGE","type":1}],"reporter"],"looks_setstretchto":[[{"name":"STRETCH","type":1}],"reporter"],"looks_costume":[[{"name":"COSTUME","type":1,"field":"COSTUME","options":[["costume1","COSTUME1"],["costume2","COSTUME2"]]}],"reporter"],"looks_switchcostumeto":[[{"name":"COSTUME","type":1}],"reporter"],"looks_nextcostume":[[],"reporter"],"looks_previouscostume":[[],"reporter"],"looks_switchbackdropto":[[{"name":"BACKDROP","type":1}],"reporter"],"looks_backdrops":[[{"name":"BACKDROP","type":1,"field":"BACKDROP","options":[["backdrop1","BACKDROP1"]]}],"reporter"],"looks_gotofrontback":[[{"name":"FRONT_BACK","type":1,"field":"FRONT_BACK","options":[["front","front"],["back","back"]]}],"reporter"],"looks_goforwardbackwardlayers":[[{"name":"FORWARD_BACKWARD","type":1,"field":"FORWARD_BACKWARD","options":[["forward","forward"],["backward","backward"]]},{"name":"NUM","type":1}],"reporter"],"looks_goTargetLayer":[[{"name":"FORWARD_BACKWARD","type":1,"field":"FORWARD_BACKWARD","options":[["infront","infront"],["behind","behind"]]},{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_layersSetLayer":[[{"name":"NUM","type":1}],"reporter"],"looks_layersGetLayer":[[],"reporter"],"looks_backdropnumbername":[[{"name":"NUMBER_NAME","type":1,"field":"NUMBER_NAME","options":[["number","number"],["name","name"]]}],"reporter"],"looks_costumenumbername":[[{"name":"NUMBER_NAME","type":1,"field":"NUMBER_NAME","options":[["number","number"],["name","name"]]}],"reporter"],"looks_switchbackdroptoandwait":[[{"name":"BACKDROP","type":1}],"reporter"],"looks_nextbackdrop":[[],"reporter"],"looks_previousbackdrop":[[],"reporter"],"looks_setStretch":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"looks_changeStretch":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"looks_stretchGetX":[[],"reporter"],"looks_stretchGetY":[[],"reporter"],"looks_getSpriteVisible":[[],"reporter"],"looks_getOtherSpriteVisible_menu":[[{"name":"VISIBLE_OPTION","type":1,"field":"VISIBLE_OPTION","options":[["myself","_myself_"]]}],"reporter"],"looks_getOtherSpriteVisible":[[{"name":"VISIBLE_OPTION","type":1}],"reporter"],"looks_getEffectValue":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["color","COLOR"],["fisheye","FISHEYE"],["whirl","WHIRL"],["pixelate","PIXELATE"],["mosaic","MOSAIC"],["brightness","BRIGHTNESS"],["ghost","GHOST"],["saturation","SATURATION"],["red","RED"],["green","GREEN"],["blue","BLUE"],["opaque","OPAQUE"]]}],"reporter"],"looks_sayHeight":[[],"reporter"],"looks_sayWidth":[[],"reporter"],"looks_stoptalking":[[],"reporter"],"looks_getinputofcostume":[[{"name":"INPUT","type":1},{"name":"COSTUME","type":1}],"reporter"],"looks_getinput_menu":[[{"name":"INPUT","type":1,"field":"INPUT","options":[["width","width"],["height","height"],["rotation center x","rotation center x"],["rotation center y","rotation center y"],["drawing mode","drawing mode"]]}],"reporter"],"motion_movesteps":[[{"name":"STEPS","type":1}],"reporter"],"motion_movebacksteps":[[{"name":"STEPS","type":1}],"reporter"],"motion_moveupdownsteps":[[{"name":"DIRECTION","type":1,"field":"DIRECTION","options":[["up","up"],["down","down"]]},{"name":"STEPS","type":1}],"reporter"],"motion_turnright":[[],"reporter"],"motion_turnleft":[[],"reporter"],"motion_turnrightaroundxy":[[],"reporter"],"motion_turnleftaroundxy":[[],"reporter"],"motion_pointindirection":[[{"name":"DIRECTION","type":1}],"reporter"],"motion_pointtowards_menu":[[{"name":"TOWARDS","type":1,"field":"TOWARDS","options":[["mouse-pointer","_mouse_"],["random direction","_random_"]]}],"reporter"],"motion_turnaround":[[],"reporter"],"motion_pointinrandomdirection":[[],"reporter"],"motion_pointtowardsxy":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_pointtowards":[[{"name":"TOWARDS","type":1}],"reporter"],"motion_goto_menu":[[{"name":"TO","type":1,"field":"TO","options":[["mouse-pointer","_mouse_"],["random position","_random_"]]}],"reporter"],"motion_gotoxy":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_goto":[[{"name":"TO","type":1}],"reporter"],"motion_glidesecstoxy":[[{"name":"SECS","type":1},{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_glidedirectionstepsinseconds":[[{"name":"STEPS","type":1},{"name":"DIRECTION","type":1,"field":"DIRECTION","options":[["forwards","forwards"],["backwards","backwards"],["up","up"],["down","down"]]},{"name":"SECS","type":1}],"reporter"],"motion_glideto_menu":[[{"name":"TO","type":1,"field":"TO","options":[["mouse-pointer","_mouse_"],["random position","_random_"]]}],"reporter"],"motion_glideto":[[{"name":"SECS","type":1},{"name":"TO","type":1}],"reporter"],"motion_changebyxy":[[{"name":"DX","type":1},{"name":"DY","type":1}],"reporter"],"motion_changexby":[[{"name":"DX","type":1}],"reporter"],"motion_setx":[[{"name":"X","type":1}],"reporter"],"motion_changeyby":[[{"name":"DY","type":1}],"reporter"],"motion_sety":[[{"name":"Y","type":1}],"reporter"],"motion_ifonedgebounce":[[],"reporter"],"motion_ifonspritebounce":[[{"name":"SPRITE","type":1}],"reporter"],"motion_ifonxybounce":[[{"name":"X","type":1},{"name":"Y","type":1}],"reporter"],"motion_setrotationstyle":[[{"name":"STYLE","type":1,"field":"STYLE","options":[["left-right","left-right"],["up-down","up-down"],["look at","look at"],["don't rotate","don't rotate"],["all around","all around"]]}],"reporter"],"motion_xposition":[[],"reporter"],"motion_yposition":[[],"reporter"],"motion_direction":[[],"reporter"],"motion_scroll_right":[[{"name":"DISTANCE","type":1}],"reporter"],"motion_scroll_up":[[{"name":"DISTANCE","type":1}],"reporter"],"motion_move_sprite_to_scene_side":[[{"name":"ALIGNMENT","type":1,"field":"ALIGNMENT","options":[["bottom-left","bottom-left"],["bottom","bottom"],["bottom-right","bottom-right"],["middle","middle"],["top-left","top-left"],["top","top"],["top-right","top-right"],["left","left"],["right","right"]]}],"reporter"],"motion_align_scene":[[{"name":"ALIGNMENT","type":1,"field":"ALIGNMENT","options":[["bottom-left","bottom-left"],["bottom-right","bottom-right"],["middle","middle"],["top-left","top-left"],["top-right","top-right"]]}],"reporter"],"motion_xscroll":[[],"reporter"],"motion_yscroll":[[],"reporter"],"operator_add":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_subtract":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_multiply":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_divide":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_random":[[{"name":"FROM","type":1},{"name":"TO","type":1}],"reporter"],"operator_lt":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_equals":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_gt":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_gtorequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_ltorequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_notequal":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_and":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_nand":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_nor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_xor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_xnor":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_or":[[{"name":"OPERAND1","type":1},{"name":"OPERAND2","type":1}],"reporter"],"operator_not":[[{"name":"OPERAND","type":1}],"reporter"],"operator_join":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1}],"reporter"],"operator_join3":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1},{"name":"STRING3","type":1}],"reporter"],"operator_letter_of":[[{"name":"LETTER","type":1},{"name":"STRING","type":1}],"reporter"],"operator_length":[[{"name":"STRING","type":1}],"reporter"],"operator_contains":[[{"name":"STRING1","type":1},{"name":"STRING2","type":1}],"reporter"],"operator_mod":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_round":[[{"name":"NUM","type":1}],"reporter"],"operator_mathop":[[{"name":"OPERATOR","type":1,"field":"OPERATOR","options":[["abs","abs"],["floor","floor"],["ceiling","ceiling"],["sign","sign"],["sqrt","sqrt"],["sin","sin"],["cos","cos"],["tan","tan"],["asin","asin"],["acos","acos"],["atan","atan"],["ln","ln"],["log","log"],["log2","log2"],["e ^","e ^"],["10 ^","10 ^"]]},{"name":"NUM","type":1}],"reporter"],"operator_advlog":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_regexmatch":[[{"name":"text","type":1},{"name":"reg","type":1},{"name":"regrule","type":1}],"reporter"],"operator_replaceAll":[[{"name":"text","type":1},{"name":"term","type":1},{"name":"res","type":1}],"reporter"],"operator_replaceFirst":[[{"name":"text","type":1},{"name":"term","type":1},{"name":"res","type":1}],"reporter"],"operator_getLettersFromIndexToIndexInText":[[{"name":"INDEX1","type":1},{"name":"INDEX2","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_getLettersFromIndexToIndexInTextFixed":[[{"name":"INDEX1","type":1},{"name":"INDEX2","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_readLineInMultilineText":[[{"name":"LINE","type":1},{"name":"TEXT","type":1}],"reporter"],"operator_newLine":[[],"reporter"],"operator_tabCharacter":[[],"reporter"],"operator_stringify":[[{"name":"ONE","type":1}],"reporter"],"operator_boolify":[[{"name":"ONE","type":1}],"reporter"],"operator_character_to_code":[[{"name":"ONE","type":1}],"reporter"],"operator_code_to_character":[[{"name":"ONE","type":1}],"reporter"],"operator_lerpFunc":[[{"name":"ONE","type":1},{"name":"TWO","type":1},{"name":"AMOUNT","type":1}],"reporter"],"operator_advMath":[[{"name":"ONE","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["^","^"],["root","root"],["log","log"]]},{"name":"TWO","type":1}],"reporter"],"operator_advMathExpanded":[[{"name":"ONE","type":1},{"name":"TWO","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["root","root"],["log","log"]]},{"name":"THREE","type":1}],"reporter"],"operator_power":[[{"name":"NUM1","type":1},{"name":"NUM2","type":1}],"reporter"],"operator_constrainnumber":[[{"name":"inp","type":1},{"name":"min","type":1},{"name":"max","type":1}],"reporter"],"operator_trueBoolean":[[],"reporter"],"operator_falseBoolean":[[],"reporter"],"operator_randomBoolean":[[],"reporter"],"operator_indexOfTextInText":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_lastIndexOfTextInText":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_countAppearTimes":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_textIncludesLetterFrom":[[{"name":"TEXT1","type":1},{"name":"TEXT2","type":1}],"reporter"],"operator_textStartsOrEndsWith":[[{"name":"TEXT1","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["starts","starts"],["ends","ends"]]},{"name":"TEXT2","type":1}],"reporter"],"operator_toUpperLowerCase":[[{"name":"TEXT","type":1},{"name":"OPTION","type":1,"field":"OPTION","options":[["uppercase","upper"],["lowercase","lower"]]}],"reporter"],"operator_javascript_output":[[{"name":"JS","type":1}],"reporter"],"operator_javascript_boolean":[[{"name":"JS","type":1}],"reporter"],"sound_sounds_menu":[[{"name":"SOUND_MENU","type":1,"field":"SOUND_MENU","options":[["1","0"],["2","1"],["3","2"],["4","3"],["5","4"],["6","5"],["7","6"],["8","7"],["9","8"],["10","9"],["call a function",null]]}],"reporter"],"sound_play":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_playuntildone":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_stop":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_pause":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_set_stop_fadeout_to":[[{"name":"VALUE","type":1},{"name":"SOUND_MENU","type":1}],"reporter"],"sound_play_at_seconds":[[{"name":"SOUND_MENU","type":1},{"name":"VALUE","type":1}],"reporter"],"sound_play_at_seconds_until_done":[[{"name":"SOUND_MENU","type":1},{"name":"VALUE","type":1}],"reporter"],"sound_stopallsounds":[[],"reporter"],"sound_pauseallsounds":[[],"reporter"],"sound_playallsounds":[[],"reporter"],"sound_seteffectto":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]},{"name":"VALUE","type":1}],"reporter"],"sound_changeeffectby":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]},{"name":"VALUE","type":1}],"reporter"],"sound_cleareffects":[[],"reporter"],"sound_getEffectValue":[[{"name":"EFFECT","type":1,"field":"EFFECT","options":[["pitch","PITCH"],["pan left/right","PAN"]]}],"reporter"],"sound_changevolumeby":[[{"name":"VOLUME","type":1}],"reporter"],"sound_setvolumeto":[[{"name":"VOLUME","type":1}],"reporter"],"sound_volume":[[],"reporter"],"sound_isSoundPlaying":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getLength":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getTimePosition":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sound_getSoundVolume":[[{"name":"SOUND_MENU","type":1}],"reporter"],"sensing_touchingobject":[[{"name":"TOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_objecttouchingclonesprite":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1},{"name":"SPRITETOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_objecttouchingobject":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1},{"name":"SPRITETOUCHINGOBJECTMENU","type":1}],"reporter"],"sensing_touchingobjectmenu":[[{"name":"TOUCHINGOBJECTMENU","type":1,"field":"TOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"]]}],"reporter"],"sensing_fulltouchingobjectmenu":[[{"name":"FULLTOUCHINGOBJECTMENU","type":1,"field":"FULLTOUCHINGOBJECTMENU","options":[["mouse-pointer","_mouse_"],["edge","_edge_"],["this sprite","_myself_"]]}],"reporter"],"sensing_touchingobjectmenusprites":[[{"name":"SPRITETOUCHINGOBJECTMENU","type":1,"field":"SPRITETOUCHINGOBJECTMENU","options":[["this sprite","_myself_"]]}],"reporter"],"sensing_touchingcolor":[[{"name":"COLOR","type":1}],"reporter"],"sensing_coloristouchingcolor":[[{"name":"COLOR","type":1},{"name":"COLOR2","type":1}],"reporter"],"sensing_distanceto":[[{"name":"DISTANCETOMENU","type":1}],"reporter"],"sensing_distancetomenu":[[{"name":"DISTANCETOMENU","type":1,"field":"DISTANCETOMENU","options":[["mouse-pointer","_mouse_"]]}],"reporter"],"sensing_askandwait":[[{"name":"QUESTION","type":1}],"reporter"],"sensing_answer":[[],"reporter"],"sensing_keypressed":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_keyhit":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_mousescrolling":[[{"name":"SCROLL_OPTION","type":1}],"reporter"],"sensing_scrolldirections":[[{"name":"SCROLL_OPTION","type":1,"field":"SCROLL_OPTION","options":[["up","up"],["down","down"]]}],"reporter"],"sensing_keyoptions":[[{"name":"KEY_OPTION","type":1,"field":"KEY_OPTION","options":[["space","space"],["up arrow","up arrow"],["down arrow","down arrow"],["right arrow","right arrow"],["left arrow","left arrow"],["any","any"],["a","a"],["b","b"],["c","c"],["d","d"],["e","e"],["f","f"],["g","g"],["h","h"],["i","i"],["j","j"],["k","k"],["l","l"],["m","m"],["n","n"],["o","o"],["p","p"],["q","q"],["r","r"],["s","s"],["t","t"],["u","u"],["v","v"],["w","w"],["x","x"],["y","y"],["z","z"],["0","0"],["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"]]}],"reporter"],"sensing_fingeroptions":[[{"name":"FINGER_OPTION","type":1,"field":"FINGER_OPTION","options":[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"]]}],"reporter"],"sensing_mousedown":[[],"reporter"],"sensing_mouseclicked":[[],"reporter"],"sensing_fingerdown":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_fingertapped":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_mousex":[[],"reporter"],"sensing_mousey":[[],"reporter"],"sensing_fingerx":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_fingery":[[{"name":"FINGER_OPTION","type":1}],"reporter"],"sensing_setclipboard":[[{"name":"ITEM","type":1}],"reporter"],"sensing_getclipboard":[[],"reporter"],"sensing_setdragmode":[[{"name":"DRAG_MODE","type":1,"field":"DRAG_MODE","options":[["draggable","draggable"],["not draggable","not draggable"]]}],"reporter"],"sensing_getdragmode":[[],"reporter"],"sensing_loudness":[[],"reporter"],"sensing_loud":[[],"reporter"],"sensing_timer":[[],"reporter"],"sensing_resettimer":[[],"reporter"],"sensing_of_object_menu":[[{"name":"OBJECT","type":1,"field":"OBJECT","options":[["Sprite1","Sprite1"],["Stage","_stage_"]]}],"reporter"],"sensing_of":[[{"name":"PROPERTY","type":1,"field":"PROPERTY","options":[["x position","x position"],["y position","y position"],["direction","direction"],["costume #","costume #"],["costume name","costume name"],["size","size"],["volume","volume"],["backdrop #","backdrop #"],["backdrop name","backdrop name"]]},{"name":"OBJECT","type":1}],"reporter"],"sensing_current":[[{"name":"CURRENTMENU","type":1,"field":"CURRENTMENU","options":[["year","YEAR"],["month","MONTH"],["date","DATE"],["day of week","DAYOFWEEK"],["hour","HOUR"],["minute","MINUTE"],["second","SECOND"],["js timestamp","TIMESTAMP"]]}],"reporter"],"sensing_dayssince2000":[[],"reporter"],"sensing_username":[[],"reporter"],"sensing_loggedin":[[],"reporter"],"sensing_userid":[[],"reporter"],"sensing_regextest":[[{"name":"text","type":1},{"name":"reg","type":1},{"name":"regrule","type":1}],"reporter"],"sensing_thing_is_number":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_thing_has_text":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_thing_has_number":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_mobile":[[],"reporter"],"sensing_thing_is_text":[[{"name":"TEXT1","type":1}],"reporter"],"sensing_getspritewithattrib":[[{"name":"var","type":1},{"name":"val","type":1}],"reporter"],"sensing_distanceTo":[[{"name":"x1","type":1},{"name":"y1","type":1},{"name":"x2","type":1},{"name":"y2","type":1}],"reporter"],"sensing_directionTo":[[{"name":"x2","type":1},{"name":"y2","type":1},{"name":"x1","type":1},{"name":"y1","type":1}],"reporter"],"sensing_isUpperCase":[[{"name":"text","type":1}],"reporter"],"sensing_getoperatingsystem":[[],"reporter"],"sensing_getbrowser":[[],"reporter"],"sensing_geturl":[[],"reporter"],"sensing_getxyoftouchingsprite":[[{"name":"XY","type":1,"field":"XY","options":[["x","x"],["y","y"]]},{"name":"SPRITE","type":1}],"reporter"],"data_variable":[[null],"reporter"],"data_setvariableto":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"data_changevariableby":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"},{"name":"VALUE","type":1}],"reporter"],"data_showvariable":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_hidevariable":[[{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_listcontents":[[null],"reporter"],"data_listindexall":[[{"name":"INDEX","type":1}],"reporter"],"data_listindexrandom":[[{"name":"INDEX","type":1}],"reporter"],"data_addtolist":[[{"name":"ITEM","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_deleteoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_deletealloflist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_shiftlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"INDEX","type":1}],"reporter"],"data_insertatlist":[[{"name":"ITEM","type":1},{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_replaceitemoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"ITEM","type":1}],"reporter"],"data_itemoflist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_itemnumoflist":[[{"name":"ITEM","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_lengthoflist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listcontainsitem":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"ITEM","type":1}],"reporter"],"data_showlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_hidelist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_reverselist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_itemexistslist":[[{"name":"INDEX","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listisempty":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listarray":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_amountinlist":[[{"name":"VALUE","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_filterlistitem":[[],"reporter"],"data_filterlistindex":[[],"reporter"],"data_filterlist":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"INDEX","type":1},{"name":"ITEM","type":1},{"name":"BOOL","type":1}],"reporter"],"data_arraylist":[[{"name":"VALUE","type":1},{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]}],"reporter"],"data_listforeachnum":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"data_listforeachitem":[[{"name":"LIST","type":1,"field":"LIST","variableTypes":["list"]},{"name":"VARIABLE","type":1,"field":"VARIABLE"}],"reporter"],"pmOperatorsExpansion_shiftLeft":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_shiftRight":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryAnd":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryOr":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryXor":[[{"name":"num1","type":"number"},{"name":"num2","type":"number"}]],"pmOperatorsExpansion_binnaryNot":[[{"name":"num1","type":"number"}]],"jgJSON_json_validate":[[{"name":"json","type":"string"}]],"jgJSON_getValueFromJSON":[[{"name":"VALUE","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_getTreeValueFromJSON":[[{"name":"VALUE","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_setValueToKeyInJSON":[[{"name":"VALUE","type":"string"},{"name":"KEY","type":"string"},{"name":"JSON","type":"string"}]],"jgJSON_json_delete":[[{"name":"json","type":"string"},{"name":"key","type":"string"}]],"jgJSON_json_values":[[{"name":"json","type":"string"}]],"jgJSON_json_keys":[[{"name":"json","type":"string"}]],"jgJSON_json_has":[[{"name":"json","type":"string"},{"name":"key","type":"string"}]],"jgJSON_json_combine":[[{"name":"one","type":"string"},{"name":"two","type":"string"}]],"jgJSON_json_array_validate":[[{"name":"array","type":"string"}]],"jgJSON_json_array_split":[[{"name":"text","type":"string"},{"name":"delimeter","type":"string"}]],"jgJSON_json_array_join":[[{"name":"array","type":"string"},{"name":"delimeter","type":"string"}]],"jgJSON_json_array_push":[[{"name":"array","type":"string"},{"name":"item","type":"string"}]],"jgJSON_json_array_concatLayer1":[[{"name":"array1","type":"string"},{"name":"array2","type":"string"}]],"jgJSON_json_array_concatLayer2":[[{"name":"array1","type":"string"},{"name":"array2","type":"string"},{"name":"array3","type":"string"}]],"jgJSON_json_array_delete":[[{"name":"array","type":"string"},{"name":"index","type":"number"}]],"jgJSON_json_array_reverse":[[{"name":"array","type":"string"}]],"jgJSON_json_array_insert":[[{"name":"array","type":"string"},{"name":"index","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_set":[[{"name":"array","type":"string"},{"name":"index","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_get":[[{"name":"array","type":"string"},{"name":"index","type":"number"}]],"jgJSON_json_array_indexofNostart":[[{"name":"array","type":"string"},{"name":"value","type":"string"}]],"jgJSON_json_array_indexof":[[{"name":"array","type":"string"},{"name":"number","type":"number"},{"name":"value","type":"string"}]],"jgJSON_json_array_length":[[{"name":"array","type":"string"}]],"jgJSON_json_array_contains":[[{"name":"array","type":"string"},{"name":"value","type":"string"}]],"jgJSON_json_array_flat":[[{"name":"array","type":"string"},{"name":"layer","type":"number"}]],"jgJSON_json_array_getrange":[[{"name":"array","type":"string"},{"name":"index1","type":"number"},{"name":"index2","type":"number"}]],"jgJSON_json_array_isempty":[[{"name":"array","type":"string"}]],"jgJSON_json_array_listtoarray":[[{"name":"list","type":"string"}]],"jgJSON_json_array_tolist":[[{"name":"list","type":"string"},{"name":"array","type":"string"}]]}`
    );
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
    if (Array.isArray(entry) && entry.length && Array.isArray(entry[0])) walk(entry[0]);
    else walk(entry);
    return names;
  }
  loadedBlocksFull = buildProcessedBlocksFromToolbox();
  try {
    createPageOpcodeWrappers(loadedBlocksFull);
  } catch (_) {}
  function loadScript(url, timeout = 20000) {
    return new Promise((resolve, reject) => {
      try {
        const exists = Array.from(document.getElementsByTagName("script")).some(
          (s) => s.src && s.src.split("?")[0] === url.split("?")[0]
        );
        if (exists) return setTimeout(resolve, 0);
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (err) => reject(new Error("Failed to load " + url + " (" + err + ")"));
        document.head.appendChild(s);
        if (timeout) setTimeout(() => reject(new Error("Timeout loading " + url)), timeout);
      } catch (e) {
        reject(e);
      }
    });
  }
  let editor = null;

  async function createEditor() {
    try {
      if (!container) return;

      let edDiv = container.querySelector("#jsengine-editor");
      if (!edDiv) {
        edDiv = document.createElement("div");
        edDiv.id = "jsengine-editor";
        edDiv.style.width = "100%";
        edDiv.style.height = "100%";
        edDiv.style.boxSizing = "border-box";

        container.innerHTML = "";
        container.appendChild(edDiv);
      }

      const loadAce = () => {
        try {
          if (!window.ace) return false;
          const langTools = ace.require && ace.require("ace/ext/language_tools");
          editor = ace.edit("jsengine-editor");
          editor.session.setMode("ace/mode/javascript");
          editor.setTheme("ace/theme/monokai");
          editor.setOptions({
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
          });
          editor.session.setUseWorker(true);
          window.ace__session = editor.session;
          try {
            editor.session.off && editor.session.off("changeMode");
          } catch (_) {}

          editor.session.on("changeMode", function (e, session) {
            try {
              if ("ace/mode/javascript" === session.getMode().$id) {
                if (!!session.$worker) {
                  const baseOpts = {
                    esversion: 13,
                    module: true,
                    browser: true,
                    devel: true,
                    asi: true,
                    "-W033": true,
                  };
                  const extraGlobals = session.$aceGlobals || (editor && editor._aceGlobals) || {};
                  const predef = Object.keys(extraGlobals || {});
                  try {
                    if (typeof session.$worker.call === "function") {
                      session.$worker.call(
                        "setOptions",
                        Object.assign({}, baseOpts, { globals: extraGlobals, predef })
                      );
                    } else if (typeof session.$worker.send === "function") {
                      session.$worker.send("setOptions", [
                        Object.assign({}, baseOpts, { globals: extraGlobals, predef }),
                      ]);
                    }
                  } catch (_) {}
                }
              }
            } catch (_) {}
          });
          editor.session.on("changeAnnotation", function () {
            try {
              const ann = editor.session.getAnnotations() || [];
              const doc = editor.session.getDocument();
              const filtered = ann.filter((a) => {
                if (!a || a.type !== "error" || !a.text) return true;
                if (/missing\s*;?\s*before\s*statement/i.test(a.text)) {
                  const line = (doc.getLine(a.row) || "").trim();
                  if (/\bawait\b/.test(line) && !/\basync\b/.test(line)) return false;
                }
                return true;
              });
              if (filtered.length !== ann.length) editor.session.setAnnotations(filtered);
            } catch (_) {}
          });
          editor.setValue("", -1);
          editor.on("change", () => {
            try {
              const cur2 = window.vm?.editingTarget ?? null;
              if (!cur2) {
                editor.setValue("", -1);
                return;
              }
              const id2 = cur2.id ?? cur2.spriteId ?? String(cur2);
              storageSet("js", editor.getValue(), id2);
            } catch (_) {}
          });
          const stdlibList = [
            { caption: "move(steps)", value: "move(", meta: "stdlib" },
            { caption: "say(text, secs)", value: "say(", meta: "stdlib" },
            { caption: "sleep(ms)", value: "sleep(", meta: "stdlib" },
            { caption: "call(opcode, args)", value: "call(", meta: "stdlib" },
            { caption: "print(x)", value: "print(", meta: "stdlib" },
            { caption: "inspect_block_args(op)", value: "inspect_block_args(", meta: "stdlib" },
          ];
          const blockList = [];
          try {
            if (typeof loadedBlocksFull === "object" && loadedBlocksFull) {
              for (const op of Object.keys(loadedBlocksFull))
                blockList.push({ caption: op + "()", value: op + "(", meta: "opcode" });
            }
          } catch (_) {}

          if (langTools && langTools.addCompleter) {
            langTools.addCompleter({
              getCompletions: function (editorInst, session, pos, prefix, callback) {
                try {
                  if (!prefix || prefix.length < 1) return callback(null, []);
                  const list = []
                    .concat(stdlibList, blockList)
                    .map((e) => ({ caption: e.caption, value: e.value, meta: e.meta }));
                  callback(null, list);
                } catch (e) {
                  callback(null, []);
                }
              },
            });
          }

          const aceGlobals = {};
          const addGlobalName = (entry) => {
            try {
              const s = entry && (entry.caption || entry.value || "");
              const name = String(s).replace(/\(.*/, "").trim();
              if (name) aceGlobals[name] = true;
            } catch (_) {}
          };
          stdlibList.forEach(addGlobalName);
          blockList.forEach(addGlobalName);

          editor._aceGlobals = aceGlobals;
          editor.session.$aceGlobals = aceGlobals;

          if (editor.session.$worker) {
            try {
              const opts = {
                esversion: 13,
                module: true,
                browser: true,
                esnext: true,
                globals: aceGlobals,
                predef: Object.keys(aceGlobals),
              };
              if (typeof editor.session.$worker.call === "function")
                editor.session.$worker.call("setOptions", opts);
              else if (typeof editor.session.$worker.send === "function")
                editor.session.$worker.send("setOptions", [opts]);
            } catch (_) {}
          }

          return true;
        } catch (e) {
          console.error("[jsEngine] ace init failed", e);
          return false;
        }
      };

      if (!loadAce()) {
        try {
          const s1 = document.createElement("script");
          s1.src = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.43.3/ace.js";
          s1.onload = () => {
            try {
              const s2 = document.createElement("script");
              s2.src = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.43.3/ext-language_tools.min.js";
              document.head.appendChild(s2);
            } catch (_) {}
            setTimeout(loadAce, 250);
          };
          document.head.appendChild(s1);
        } catch (e) {
          console.error("[jsEngine] ace inject failed", e);
        }
      }

      try {
        let waited = 0;
        const maxWait = 3000;
        while (!editor && waited < maxWait) {
          await sleep(100);
          waited += 100;
        }
      } catch (_) {}
      try {
        if (!editor) return;
        const t = window.vm?.editingTarget ?? null;
        const id = t ? t.id ?? t.spriteId ?? String(t) : null;
        if (id) {
          let code = storageGet("js", id) || "";
          try {
            const info = jsEngines.get(id);
            if (info && info.engine && info.engine.global && typeof info.engine.global.get === "function") {
              const saved = await info.engine.global.get("__saved_script").catch(() => null);
              if (typeof saved === "string" && saved.length) code = saved;
            }
          } catch (_) {}
          try {
            editor.setValue(code, -1);
          } catch (_) {}
        }
      } catch (_) {}
    } catch (e) {
      console.error("[jsEngine] ace setup failed", e);
    }
  }
  if (uiEnabled) createEditor().catch(() => {});
  try {
    const observer = new MutationObserver((mutations) => {
      try {
        const found = document.querySelector(".injectionDiv");
        if (found && !container) {
          container = found;
          uiEnabled = true;
          createEditor().catch(() => {});
        } else if (!found && container) {
          container = null;
          uiEnabled = false;
          try {
            if (editor) {
              try {
                editor.destroy && editor.destroy();
              } catch (_) {}
              try {
                const node = document.getElementById("jsengine-editor");
                if (node && node.parentNode) node.parentNode.removeChild(node);
              } catch (_) {}
              editor = null;
            }
          } catch (_) {}
        }
      } catch (_) {}
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch (_) {}

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForRuntimeTarget(tid, timeoutMs = 2000, intervalMs = 50) {
    return new Promise((resolve) => {
      if (!tid) return resolve(null);
      const start = Date.now();
      const check = () => {
        try {
          if (window.vm && window.vm.runtime && Array.isArray(window.vm.runtime.targets)) {
            const found = window.vm.runtime.targets.find(
              (tt) => String(tt.id) === String(tid) || String(tt.spriteId) === String(tid)
            );
            if (found) return resolve(found);
          }
        } catch (_) {}
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, intervalMs);
      };
      check();
    });
  }
  function callOpcode(opcode, args, target) {
    return (async () => {
      try {
        let resolvedTarget = null;
        try {
          const tid = target && (target.id ?? target.spriteId ?? String(target));
          if (tid && window.vm && window.vm.runtime && Array.isArray(window.vm.runtime.targets)) {
            console.log(tid);
            resolvedTarget =
              window.vm.runtime.targets.find(
                (tt) => String(tt.id) === String(tid) || String(tt.spriteId) === String(tid)
              ) || null;
          }

          if (!resolvedTarget && target && (target.id || target.spriteId)) {
            const tid = target.id ?? target.spriteId ?? String(target);
            resolvedTarget = await waitForRuntimeTarget(tid, 2000, 50);
          }
        } catch (_) {
          resolvedTarget = null;
        }
        try {
          if (!resolvedTarget && window.vm) {
            if (window.vm.editingTarget && typeof window.vm.editingTarget.setXY === "function") {
              resolvedTarget = window.vm.editingTarget;
            } else if (
              window.vm.runtime &&
              Array.isArray(window.vm.runtime.targets) &&
              window.vm.runtime.targets.length > 0
            ) {
              resolvedTarget = window.vm.runtime.targets[0];
            }
          }
        } catch (_) {}
        try {
          if (args === null || args === undefined) {
            args = {};
          } else if (typeof args !== "object" || Array.isArray(args)) {
            if (Array.isArray(args)) {
              const tmp = {};
              for (let i = 0; i < args.length; i++) tmp["ARG" + (i + 1)] = args[i];
              args = tmp;
            } else {
              let mapped = false;
              try {
                const defEntry =
                  typeof loadedBlocksFull === "object" && loadedBlocksFull && loadedBlocksFull[opcode]
                    ? loadedBlocksFull[opcode]
                    : null;
                const argNames = defEntry ? extractArgNamesFromEntry(defEntry) || [] : [];
                if (argNames && argNames.length > 0) {
                  const first = argNames[0];
                  let val = args;
                  try {
                    const defs = Array.isArray(defEntry) && Array.isArray(defEntry[0]) ? defEntry[0] : [];
                    const firstDef = defs[0];
                    if (firstDef && firstDef.type === 1) {
                      const n = Number(val);
                      val = Number.isFinite(n) ? n : val;
                    }
                  } catch (_) {}
                  const tmp = {};
                  tmp[first] = val;
                  args = tmp;
                  mapped = true;
                }
              } catch (_) {}
              if (!mapped) args = { ARG1: args };
            }
          }
        } catch (_) {}

        const fn = window.vm?.runtime?.getOpcodeFunction?.(opcode);
        try {
          window.jsEngine = window.jsEngine || {};
          window.jsEngine._callLog = window.jsEngine._callLog || [];
          window.jsEngine._callLog.push({
            opcode,
            hasFn: !!fn,
            args: args || {},
            targetId:
              (resolvedTarget && (resolvedTarget.id ?? resolvedTarget.spriteId ?? String(resolvedTarget))) ||
              null,
            resolvedFrom: !!resolvedTarget,
            t: performance.now(),
          });
        } catch (_) {}
        if (!fn) {
          const err = new Error("Opcode not found: " + opcode);
          console.error("[jsEngine] callOpcode: no opcode function for", opcode);
          throw err;
        }
        if (!resolvedTarget) {
          const err = new Error("No runtime target available for opcode call: " + opcode);
          console.error("[jsEngine] callOpcode: no runtime target for", opcode);
          throw err;
        }
        const res = fn(args || {}, { target: resolvedTarget });
        try {
          if (res && typeof res.then === "function") {
            res
              .then((v) => {
                try {
                  window.jsEngine._callLog.push({ opcode, result: v });
                } catch (_) {}
              })
              .catch((e) => {
                try {
                  window.jsEngine._callLog.push({ opcode, error: String(e) });
                } catch (_) {}
              });
          } else {
            window.jsEngine._callLog.push({ opcode, result: res });
          }
        } catch (_) {}
        return res;
      } catch (e) {
        console.error("[jsEngine] callOpcode error for", opcode, e);
        throw e;
      }
    })();
  }
  async function createJSEngineForTarget(tid, target) {
    const engine = {
      _globals: {},
      global: {
        set: async (name, val) => {
          try {
            engine._globals[name] = val;
          } catch (_) {}
          return undefined;
        },
        get: async (name) => {
          try {
            return engine._globals[name];
          } catch (_) {
            return undefined;
          }
        },
      },

      doString: async (code) => {
        try {
          const names = Object.keys(engine._globals || {});
          const vals = names.map((k) => engine._globals[k]);
          const fn = new Function(...names, "global", "tid", "target", '"use strict";\n' + String(code));
          let currentTarget = target;
          try {
            const info = jsEngines.get(tid);
            if (info && info.target && typeof info.target.setXY === "function") currentTarget = info.target;
          } catch (_) {}
          if (
            (!currentTarget || typeof currentTarget.setXY !== "function") &&
            window.vm &&
            window.vm.runtime &&
            Array.isArray(window.vm.runtime.targets)
          ) {
            try {
              const found = window.vm.runtime.targets.find(
                (tt) => String(tt.id) === String(tid) || String(tt.spriteId) === String(tid)
              );
              if (found) currentTarget = found;
            } catch (_) {}
          }
          return fn(...vals, engine._globals, tid, currentTarget);
        } catch (e) {
          console.error("[jsEngine] doString error:", e, code);
          throw e;
        }
      },
    };
    engine._hatRegistry = engine._hatRegistry || {};
    engine._hatNextId = engine._hatNextId || 0;

    const matches = (matchers, opts) => {
      if (!matchers || matchers.length === 0) return true;
      try {
        const args = opts && opts._args ? opts._args : null;
        if (args && args.length >= matchers.length) {
          for (let i = 0; i < matchers.length; i++) {
            const m = matchers[i];
            const a = args[i];
            if (m == null) continue;
            if (typeof a === "string" && typeof m === "string") {
              if (String(a).toLowerCase() !== String(m).toLowerCase()) return false;
            } else {
              if (String(a) !== String(m)) return false;
            }
          }
          return true;
        }

        const deepContains = (obj, val, seen) => {
          if (!seen) seen = new Set();
          if (obj === val) return true;
          if (obj && typeof obj === "object" && !seen.has(obj)) {
            seen.add(obj);
            for (const k in obj) {
              try {
                if (deepContains(obj[k], val, seen)) return true;
              } catch (_) {}
            }
          }
          return false;
        };
        for (let i = 0; i < matchers.length; i++) {
          const m = matchers[i];
          if (!deepContains(opts, m)) return false;
        }
        return true;
      } catch (_) {
        return false;
      }
    };
    await engine.global.set("js_table_from_js", (tbl) => tbl);
    await engine.global.set("print", (s) => console.log(`[js:${tid}]`, s));
    await engine.global.set("on", (hat, ...args) => {
      try {
        const last = args[args.length - 1];
        if (typeof last !== "function") return () => {};
        const fn = last;
        const matchers = args.length > 1 ? args.slice(0, -1) : null;
        engine._hatNextId = (engine._hatNextId || 0) + 1;
        const id = String(engine._hatNextId);
        engine._hatRegistry[hat] = engine._hatRegistry[hat] || [];
        engine._hatRegistry[hat].push({ id, fn, matchers });

        try {
          const reg = engine._globals["__register_hat_in_js"];
          if (typeof reg === "function") reg(hat, 1);
        } catch (_) {}
        return () => {
          const list = engine._hatRegistry[hat] || [];
          for (let i = list.length - 1; i >= 0; i--) {
            if (String(list[i].id) === id) {
              list.splice(i, 1);
              try {
                const reg = engine._globals["__register_hat_in_js"];
                if (typeof reg === "function") reg(hat, -1);
              } catch (_) {}
              break;
            }
          }
        };
      } catch (e) {
        console.error("[jsEngine] on failed", e);
        return () => {};
      }
    });
    await engine.global.set("__call_hats", (hat, opts) => {
      try {
        const list = engine._hatRegistry[hat] || [];
        const snapshot = list.slice();
        for (let i = 0; i < snapshot.length; i++) {
          try {
            const entry = snapshot[i];
            if (!entry || typeof entry.fn !== "function") continue;
            if (entry.matchers && !matches(entry.matchers, opts || {})) continue;
            try {
              entry.fn(opts);
            } catch (e) {
              console.error("[jsEngine] hat error", e);
            }
          } catch (_) {}
        }
      } catch (e) {
        console.error("[jsEngine] __call_hats failed", e);
      }
    });
    await engine.global.set("__dump_registry_types", () => {
      try {
        const out = [];
        for (const k in engine._hatRegistry) {
          const arr = engine._hatRegistry[k] || [];
          for (let i = 0; i < arr.length; i++) {
            const entry = arr[i];
            out.push(
              String(k) +
                ":" +
                String(i + 1) +
                ":" +
                (entry && entry.fn ? "table(id=" + String(entry.id) + ",fn=function)" : String(typeof entry))
            );
          }
        }
        return out.join(",");
      } catch (_) {
        return "";
      }
    });
    await engine.global.set("forever", (fn) => {
      try {
        const reg = engine._globals["__register_forever_in_js"];
        if (typeof reg === "function") return reg(fn);
      } catch (e) {
        console.error("[jsEngine] forever register failed", e);
      }
      return () => {};
    });
    await engine.global.set("foreverFixed", (fn, fps) => {
      try {
        const reg = engine._globals["__register_forever_fixed_in_js"];
        if (typeof reg === "function") return reg(fn, fps || 60);
      } catch (e) {
        console.error("[jsEngine] foreverFixed register failed", e);
      }
      return () => {};
    });
    window.jsEngine.engines.set(tid, engine)
    return engine;
  }
  async function initEngineForTarget(target) {
    if (!target) throw new Error("target required");
    const tid = target.id ?? target.spriteId ?? String(target);
    try {
      const rt =
        window.vm && window.vm.runtime && Array.isArray(window.vm.runtime.targets)
          ? window.vm.runtime.targets.find((tt) => String(tt.id) === String(tid))
          : null;
      if (rt) target = rt;
    } catch (_) {}
    if (jsEngines.has(tid)) return jsEngines.get(tid);
    const engine = await createJSEngineForTarget(tid, target);

    await engine.global.set("js_print", (s) => console.log(`[js:${tid}]`, s));
    await engine.global.set("sleep", (ms) => sleep(Number(ms || 0)));
    await engine.global.set(
      "call",
      async (opcode, args) => await callOpcode(opcode, args || {}, { id: tid })
    );
    await engine.global.set("keyDown", (key) => {
      try {
        window.jsEngine = window.jsEngine || {};
        window.jsEngine._keyQueries = window.jsEngine._keyQueries || [];
        const q = { key: String(key), t: Date.now() };
        try {
          const kb = vm && vm.runtime && vm.runtime.ioDevices && vm.runtime.ioDevices.keyboard;
          if (!kb || typeof kb.getKeyIsDown !== "function") {
            q.info = "no_keyboard_device";
            q.result = false;
            window.jsEngine._keyQueries.push(q);
            if (window.jsEngine._keyQueries.length > 200) window.jsEngine._keyQueries.shift();
            return false;
          }

          let res = false;
          try {
            res = !!kb.getKeyIsDown(key);
          } catch (_) {
            res = false;
          }
          if (!res && typeof key === "string" && key.length === 1) {
            try {
              res = !!kb.getKeyIsDown(key.toUpperCase());
            } catch (_) {
              res = res;
            }
          }
          if (!res && key === " ") {
            try {
              res = !!kb.getKeyIsDown("space");
            } catch (_) {
              res = res;
            }
          }
          q.result = !!res;
          window.jsEngine._keyQueries.push(q);
          if (window.jsEngine._keyQueries.length > 200) window.jsEngine._keyQueries.shift();
          return !!res;
        } catch (e) {
          q.info = "error_calling_keyboard";
          q.err = String(e);
          q.result = false;
          window.jsEngine._keyQueries.push(q);
          if (window.jsEngine._keyQueries.length > 200) window.jsEngine._keyQueries.shift();
          return false;
        }
      } catch (_) {
        return false;
      }
    });
    await engine.global.set("keyHit", (key) => {
      try {
        const kb = vm && vm.runtime && vm.runtime.ioDevices && vm.runtime.ioDevices.keyboard;
        if (!kb || typeof kb.getKeyIsHit !== "function") return false;
        return !!kb.getKeyIsHit(key);
      } catch (_) {
        return false;
      }
    });
    const resolveTarget = () => {
      try {
        const info = jsEngines.get(tid);
        if (info && info.target && typeof info.target.setXY === "function") return info.target;
      } catch (_) {}
      try {
        const targets = window.vm && window.vm.runtime && window.vm.runtime.targets;
        if (Array.isArray(targets)) {
          const found = targets.find(
            (tt) => String(tt.id) === String(tid) || String(tt.spriteId) === String(tid)
          );
          if (found) return found;
        }
      } catch (_) {}
      return target;
    };
    try {
      if (typeof loadedBlocksFull === "object" && loadedBlocksFull !== null) {
        for (const op of Object.keys(loadedBlocksFull)) {
          try {
            const fn = window.vm?.runtime?.getOpcodeFunction?.(op);
            const safe = op.replace(/[^A-Za-z0-9_]/g, "_");
            if (typeof fn === "function") {
              await engine.global.set(safe, async (...p) => {
                const maybeArgs = p.length === 1 ? p[0] : p;

                let argsObj = {};

                let defEntry = null;
                let argNames = [];
                let defs = [];
                try {
                  defEntry =
                    typeof loadedBlocksFull === "object" && loadedBlocksFull && loadedBlocksFull[op]
                      ? loadedBlocksFull[op]
                      : null;
                  argNames = defEntry ? extractArgNamesFromEntry(defEntry) || [] : [];
                  defs = Array.isArray(defEntry) && Array.isArray(defEntry[0]) ? defEntry[0] : [];
                } catch (_) {
                  defEntry = null;
                  argNames = [];
                  defs = [];
                }
                try {
                  if (maybeArgs === null || maybeArgs === undefined) {
                    argsObj = {};
                  } else if (typeof maybeArgs !== "object" || Array.isArray(maybeArgs)) {
                    if (Array.isArray(maybeArgs)) {
                      for (let i = 0; i < maybeArgs.length; i++) {
                        const name = argNames && argNames[i] ? argNames[i] : "ARG" + (i + 1);
                        let v = maybeArgs[i];
                        const def = defs && defs[i] ? defs[i] : null;
                        if (def && def.type === 1) {
                          const n = Number(v);
                          if (Number.isFinite(n)) v = n;
                        }
                        argsObj[name] = v;
                      }
                    } else {
                      let mapped = false;
                      try {
                        if (argNames && argNames.length > 0) {
                          const first = argNames[0];
                          let val = maybeArgs;
                          try {
                            const firstDef = defs[0];
                            if (firstDef && firstDef.type === 1) {
                              const n = Number(val);
                              val = Number.isFinite(n) ? n : val;
                            }
                          } catch (_) {}
                          argsObj[first] = val;
                          mapped = true;
                        }
                      } catch (_) {}
                      if (!mapped) argsObj = { ARG1: maybeArgs };
                    }
                  } else {
                    argsObj = Object.assign({}, maybeArgs);
                    try {
                      for (let i = 0; i < argNames.length; i++) {
                        const n = argNames[i];
                        const def = defs && defs[i] ? defs[i] : null;
                        if (def && def.type === 1 && Object.prototype.hasOwnProperty.call(argsObj, n)) {
                          const v = argsObj[n];
                          const num = Number(v);
                          if (Number.isFinite(num)) argsObj[n] = num;
                        }
                      }
                    } catch (_) {}
                  }
                } catch (_) {
                  argsObj = {};
                }
                let resolved = null;
                try {
                  const info = jsEngines.get(tid);
                  if (info && info.target && typeof info.target.setXY === "function") resolved = info.target;
                } catch (_) {
                  resolved = null;
                }
                try {
                  if (
                    (!resolved || typeof resolved.setXY !== "function") &&
                    window.vm &&
                    window.vm.runtime &&
                    Array.isArray(window.vm.runtime.targets)
                  ) {
                    const found = window.vm.runtime.targets.find(
                      (tt) => String(tt.id) === String(tid) || String(tt.spriteId) === String(tid)
                    );
                    if (found) resolved = found;
                  }
                } catch (_) {}
                if (!resolved) {
                  try {
                    resolved = await waitForRuntimeTarget(tid, 1000, 50);
                  } catch (_) {
                    resolved = null;
                  }
                }
                if (!resolved) {
                  throw new Error("No runtime target available for opcode: " + op);
                }
                try {
                  const res = fn(argsObj || {}, { target: resolved });
                  if (res && typeof res.then === "function") return await res;
                  return res;
                } catch (e) {
                  console.error("[jsEngine] direct opcode call failed for", op, e);
                  throw e;
                }
              });
            } else {
              await engine.global.set(safe, () => {
                throw new Error("Opcode not found: " + op);
              });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      await injectOpcodeWrappersIntoEngine(engine, loadedBlocksFull);
    } catch (_) {}
    try {
      await engine.global.set("fast_setx", (x) => {
        try {
          const nx = Number(x);

          try {
            const rs = renderInterp.map.get(tid) || { logical: { x: 0, y: 0 }, visual: { x: 0, y: 0 } };
            rs.logical.x = nx;
            renderInterp.map.set(tid, rs);
          } catch (_) {}

          let wroteTarget = false;
          if (!renderInterp.enabled) {
            const actual = resolveTarget();
            if (actual && typeof actual.setXY === "function") {
              actual.setXY(nx, typeof actual.y === "number" ? actual.y : 0);
              wroteTarget = true;
            } else if (actual && typeof actual.setXY === "undefined" && "x" in actual) {
              actual.x = nx;
              wroteTarget = true;
            }
          }
          try {
            if (window.jsEngine && window.jsEngine.forceImmediateRender) {
              const r = window.vm && window.vm.renderer;
              if (r) {
                try {
                  if (typeof r.draw === "function") r.draw();
                } catch (_) {}
                try {
                  if (typeof r.redraw === "function") r.redraw();
                } catch (_) {}
                try {
                  if (typeof r.updateDrawableProperties === "function") r.updateDrawableProperties();
                } catch (_) {}
                try {
                  if (typeof r._draw === "function") r._draw();
                } catch (_) {}
              }
            }
          } catch (_) {}
          try {
            if (window.jsEngine && window.jsEngine._pushDiag) {
              const rs2 = renderInterp.map.get(tid) || { logical: { x: NaN }, visual: { x: NaN } };
              const actual2 = resolveTarget();
              window.jsEngine._pushDiag({
                tid: String(tid),
                op: "fast_setx",
                arg: nx,
                logical: Number(rs2.logical.x),
                targetX: actual2
                  ? typeof actual2.x === "number"
                    ? actual2.x
                    : typeof actual2.getX === "function"
                    ? actual2.getX()
                    : null
                  : null,
                wroteTarget: !!wroteTarget,
              });
            }
          } catch (_) {}
        } catch (_) {}
      });
      await engine.global.set("fast_changexby", (dx) => {
        try {
          const delta = Number(dx);
          const rs = renderInterp.map.get(tid) || { logical: { x: 0, y: 0 }, visual: { x: 0, y: 0 } };
          const actual = resolveTarget();
          const curx =
            typeof rs.logical.x === "number"
              ? rs.logical.x
              : actual && typeof actual.x === "number"
              ? actual.x
              : actual && typeof actual.getX === "function"
              ? actual.getX()
              : 0;
          const ny =
            actual && typeof actual.y === "number"
              ? actual.y
              : actual && typeof actual.getY === "function"
              ? actual.getY()
              : 0;
          const nx = curx + delta;
          try {
            rs.logical.x = nx;
            renderInterp.map.set(tid, rs);
          } catch (_) {}

          let wroteTarget = false;
          if (!renderInterp.enabled) {
            const actual2 = actual || resolveTarget();
            if (actual2 && typeof actual2.setXY === "function") {
              actual2.setXY(nx, ny);
              wroteTarget = true;
            } else if (actual2 && "x" in actual2) {
              actual2.x = nx;
              wroteTarget = true;
            }
          }
          try {
            if (window.jsEngine && window.jsEngine.forceImmediateRender) {
              const r = window.vm && window.vm.renderer;
              if (r) {
                try {
                  if (typeof r.draw === "function") r.draw();
                } catch (_) {}
                try {
                  if (typeof r.redraw === "function") r.redraw();
                } catch (_) {}
                try {
                  if (typeof r.updateDrawableProperties === "function") r.updateDrawableProperties();
                } catch (_) {}
                try {
                  if (typeof r._draw === "function") r._draw();
                } catch (_) {}
              }
            }
          } catch (_) {}
          try {
            if (window.jsEngine && window.jsEngine._pushDiag) {
              const rs2 = renderInterp.map.get(tid) || { logical: { x: NaN }, visual: { x: NaN } };
              window.jsEngine._pushDiag({
                tid: String(tid),
                op: "fast_changexby",
                arg: delta,
                logical: Number(rs2.logical.x),
                targetX: (function () {
                  const a = resolveTarget();
                  return a
                    ? typeof a.x === "number"
                      ? a.x
                      : typeof a.getX === "function"
                      ? a.getX()
                      : null
                    : null;
                })(),
                wroteTarget: !!wroteTarget,
              });
            }
          } catch (_) {}
        } catch (_) {}
      });
      await engine.global.set("fast_xposition", () => {
        try {
          const a = resolveTarget();
          if (a && typeof a.x === "number") return a.x;
          if (a && typeof a.getX === "function") return a.getX();
          return 0;
        } catch (_) {
          return 0;
        }
      });

      try {
        await engine.global.set("set_forever_debug", (v) => {
          try {
            window.jsEngine = window.jsEngine || {};
            window.jsEngine.foreverDebug = !!v;
          } catch (_) {}
        });
      } catch (_) {}
    } catch (_) {}

    try {
      await engine.global.set("__register_hat_in_js", (hat, delta) => {
        try {
          window.jsEngine &&
            window.jsEngine._registerHatForEngine &&
            window.jsEngine._registerHatForEngine(tid, hat, delta);
        } catch (_) {}
      });
    } catch (_) {}
    try {
      window.jsEngine = window.jsEngine || {};
      if (!window.jsEngine.setRenderInterpolation) {
        window.jsEngine.setRenderInterpolation = (enabled, speed) => {
          try {
            renderInterp.enabled = !!enabled;
            renderInterp.speed = Number(speed) || renderInterp.speed;
            if (renderInterp.enabled) startRenderInterpolationLoop();
            else stopRenderInterpolationLoop();
            window.jsEngine.renderInterpolationEnabled = !!enabled;
            window.jsEngine.renderInterpolationSpeed = renderInterp.speed;
          } catch (_) {}
        };

        window.jsEngine._diags = window.jsEngine._diags || [];
        window.jsEngine._pushDiag = (obj) => {
          try {
            window.jsEngine._diags = window.jsEngine._diags || [];
            window.jsEngine._diags.push(Object.assign({ t: performance.now() }, obj));
            if (window.jsEngine._diags.length > 5000) window.jsEngine._diags.shift();
          } catch (_) {}
        };
        window.jsEngine.getDiagnostics = (tid) => {
          try {
            if (!tid) return (window.jsEngine._diags || []).slice(-1000);
            const sid = String(tid);
            return (window.jsEngine._diags || []).filter((d) => d.tid === sid).slice(-1000);
          } catch (_) {
            return [];
          }
        };

        window.jsEngine.useForeverWorkers =
          window.jsEngine.useForeverWorkers !== undefined ? window.jsEngine.useForeverWorkers : true;
        const defaultBatch = window.jsEngine && window.jsEngine.useForeverWorkers === false ? 32 : 120;
        const defaultTimeBudget = window.jsEngine && window.jsEngine.useForeverWorkers === false ? 2 : 4;
        window.jsEngine.foreverBatchSteps = Number.isFinite(window.jsEngine.foreverBatchSteps)
          ? window.jsEngine.foreverBatchSteps
          : defaultBatch;
        window.jsEngine.foreverTimeBudgetMs = Number.isFinite(window.jsEngine.foreverTimeBudgetMs)
          ? window.jsEngine.foreverTimeBudgetMs
          : defaultTimeBudget;
        window.jsEngine.foreverMainThreadIntervalMs = Number.isFinite(
          window.jsEngine.foreverMainThreadIntervalMs
        )
          ? window.jsEngine.foreverMainThreadIntervalMs
          : Math.round(1000 / 60);

        if (!window.jsEngine.runRenderTrace) {
          window.jsEngine.runRenderTrace = async (tidOrTarget, durationMs = 1000) => {
            try {
              let tid = tidOrTarget;
              if (tidOrTarget && typeof tidOrTarget === "object")
                tid = tidOrTarget.id ?? tidOrTarget.spriteId ?? String(tidOrTarget);
              tid = String(tid);
              let info = jsEngines.get(tid);
              if (!info) {
                try {
                  const targets = window.vm && window.vm.runtime && window.vm.runtime.targets;
                  if (Array.isArray(targets)) {
                    const t = targets.find((tt) => String(tt.id) === tid);
                    if (t) info = { target: t };
                  }
                } catch (_) {}
              }

              if (!info) {
                console.warn("[jsEngine] runRenderTrace: no engine or target for tid", tidOrTarget);
                return null;
              }

              const samples = [];
              const end = performance.now() + durationMs;
              await new Promise((resolve) => {
                function frame(now) {
                  try {
                    const rs = renderInterp.map.get(tid);

                    let logicalX = Number(rs && rs.logical && rs.logical.x);
                    let visualX = Number(rs && rs.visual && rs.visual.x);

                    const target = info.target;
                    const targetX =
                      typeof target.x === "number"
                        ? target.x
                        : typeof target.getX === "function"
                        ? target.getX()
                        : NaN;
                    if (!Number.isFinite(logicalX)) {
                      if (typeof target.getLogicalX === "function") logicalX = Number(target.getLogicalX());
                      else if (typeof target.x === "number") logicalX = Number(target.x);
                      else if (typeof target.getX === "function") logicalX = Number(target.getX());
                      else logicalX = NaN;
                    }
                    if (!Number.isFinite(visualX)) {
                      visualX = Number.isFinite(targetX) ? targetX : logicalX;
                    }

                    samples.push({ t: now, logicalX, visualX, targetX });
                  } catch (_) {}
                  if (performance.now() < end) requestAnimationFrame(frame);
                  else resolve();
                }
                requestAnimationFrame(frame);
              });
              const deltas = samples.map((s) => ({
                deltaVisTarget: Number(s.visualX) - Number(s.targetX),
                deltaLogicalTarget: Number(s.logicalX) - Number(s.targetX),
              }));
              const safeAbs = (v) => (Number.isFinite(v) ? Math.abs(v) : 0);
              const stats = {
                samples: samples.length,
                maxDeltaVisTarget: Math.max(...deltas.map((d) => safeAbs(d.deltaVisTarget)), 0),
                maxDeltaLogicalTarget: Math.max(...deltas.map((d) => safeAbs(d.deltaLogicalTarget)), 0),
                meanDeltaVisTarget:
                  deltas.reduce((a, b) => a + safeAbs(b.deltaVisTarget), 0) / Math.max(1, deltas.length),
                meanDeltaLogicalTarget:
                  deltas.reduce((a, b) => a + safeAbs(b.deltaLogicalTarget), 0) / Math.max(1, deltas.length),
              };

              console.group("[jsEngine] runRenderTrace", tid);
              console.log("samples", samples.length, "durationMs", durationMs);
              console.table(samples.slice(0, 20));
              console.log("stats", stats);
              console.groupEnd();
              return { samples, stats };
            } catch (e) {
              console.error("[jsEngine] runRenderTrace failed:", e);
              return null;
            }
          };
        }
        try {
          window.jsEngine.inspectOpcode = function (opcode) {
            try {
              const s = String(opcode);
              let cat = "misc",
                method = s;
              const u = s.indexOf("_"),
                d = s.indexOf(".");
              if (u !== -1) {
                cat = s.slice(0, u);
                method = s.slice(u + 1);
              } else if (d !== -1) {
                cat = s.slice(0, d);
                method = s.slice(d + 1);
              }
              const safe = s.replace(/[^A-Za-z0-9_]/g, "_");
              const safeCat = cat.replace(/[^A-Za-z0-9_]/g, "_");
              const safeMethod = method.replace(/[^A-Za-z0-9_]/g, "_");
              return {
                opcode: s,
                safeGlobal: safe,
                safeCat,
                safeMethod,
                hasLiteralGlobal: typeof globalThis[s] === "function",
                hasSafeGlobal: typeof globalThis[safe] === "function",
                hasCatMethod:
                  (globalThis[safeCat] && typeof globalThis[safeCat][safeMethod] === "function") || false,
                lastWrapperCalls: (window.jsEngine && window.jsEngine._lastWrapperCalls) || [],
                lastGeneratedSrc: (window.jsEngine && window.jsEngine._lastGeneratedWrapperSource) || "",
                callLog: (window.jsEngine && window.jsEngine._callLog) || [],
              };
            } catch (e) {
              return { error: String(e) };
            }
          };

          window.jsEngine.testCall = async function (opcode, args, tid) {
            try {
              const t =
                typeof tid === "object"
                  ? tid
                  : tid
                  ? window.vm &&
                    window.vm.runtime &&
                    window.vm.runtime.targets &&
                    window.vm.runtime.targets.find((tt) => String(tt.id) === String(tid))
                  : window.vm
                  ? window.vm.editingTarget
                  : null;
              const res = await callOpcode(opcode, args || {}, t || null);
              if (res && typeof res.then === "function") return await res;
              return res;
            } catch (e) {
              throw e;
            }
          };

          window.jsEngine.getOpcodeFn = function (opcode) {
            try {
              return (
                window.vm &&
                window.vm.runtime &&
                window.vm.runtime.getOpcodeFunction &&
                window.vm.runtime.getOpcodeFunction(opcode)
              );
            } catch (_) {
              return null;
            }
          };
        } catch (_) {}
      }
    } catch (_) {}
    try {
      await engine.global.set("__register_forever_in_js", (fn) => {
        try {
          const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
          let state = foreverLoops.get(tid);
          if (!state) {
            state = { map: new Map() };
            foreverLoops.set(tid, state);
          }
          state.map.set(id, {
            fn,
            worker: null,
            url: null,
            accumulator: 0,
            intervalId: null,
            _stopMainLoop: null,
          });
          const onTick = (data) => {
            try {
              if (!data || data.cmd !== "tick") return;
              let dt = Math.max(0, Number(data.dt) || 0);
              const STEP = 1 / 240;
              const MAX_SUBSTEPS = 1000;
              const BATCH_STEPS =
                window.jsEngine && Number.isFinite(window.jsEngine.foreverBatchSteps)
                  ? Number(window.jsEngine.foreverBatchSteps)
                  : 120;
              const TIME_BUDGET_MS =
                window.jsEngine && Number.isFinite(window.jsEngine.foreverTimeBudgetMs)
                  ? Number(window.jsEngine.foreverTimeBudgetMs)
                  : window.jsEngine && Number.isFinite(window.jsEngine.foreverTimeBudgetMs)
                  ? Number(window.jsEngine.foreverTimeBudgetMs)
                  : 4;

              const entry = state.map.get(id);
              if (!entry) return;

              if (!entry.accumulator) entry.accumulator = 0;
              entry.accumulator += dt;
              if (window.jsEngine && window.jsEngine.foreverDebug) {
                try {
                  const px =
                    typeof target.x === "number"
                      ? target.x
                      : typeof target.getX === "function"
                      ? target.getX()
                      : NaN;
                  console.log(
                    `[jsEngine][${tid}] [${id}] tick dt=${dt.toFixed(4)} acc=${entry.accumulator.toFixed(
                      4
                    )} preX=${Number(px).toFixed(3)}`
                  );
                } catch (_) {}
              }
              let fullSteps = Math.floor(entry.accumulator / STEP);
              if (fullSteps > MAX_SUBSTEPS) fullSteps = MAX_SUBSTEPS;

              try {
                if (
                  window.jsEngine &&
                  window.jsEngine._pushDiag &&
                  (fullSteps > 20 || entry.accumulator > STEP * 10)
                ) {
                  window.jsEngine._pushDiag({
                    tid: String(tid),
                    op: "batch",
                    id,
                    fullSteps,
                    accumulator: entry.accumulator,
                  });
                }
              } catch (_) {}
              const processBatch = (stepsToRun) => {
                const t0 = performance.now();
                let ran = 0;
                while (ran < stepsToRun) {
                  try {
                    const res = fn(STEP);
                    if (res && typeof res.then === "function")
                      res.catch((e) => console.error(`[jsEngine] forever fn error for ${tid}:`, e));
                  } catch (e) {
                    console.error(`[jsEngine] forever fn error for ${tid}:`, e);
                  }
                  entry.accumulator -= STEP;
                  ran++;

                  if (performance.now() - t0 > TIME_BUDGET_MS) break;
                }
                return { ran, time: performance.now() - t0 };
              };

              const runBatches = (remaining) => {
                if (remaining <= 0) return;
                const toRun = Math.min(remaining, BATCH_STEPS);
                const result = processBatch(toRun);
                remaining -= result.ran;

                if (remaining > 0 && remaining <= MAX_SUBSTEPS) {
                  setTimeout(() => runBatches(remaining), 0);
                }
              };

              if (fullSteps > 0) runBatches(fullSteps);
              if (entry.accumulator > 0) {
                const rem = Math.min(entry.accumulator, STEP);
                try {
                  const res = fn(rem);
                  if (res && typeof res.then === "function")
                    res.catch((e) => console.error(`[jsEngine] forever fn error for ${tid}:`, e));
                } catch (e) {
                  console.error(`[jsEngine] forever fn error for ${tid}:`, e);
                }
                entry.accumulator -= rem;
                if (entry.accumulator < 0) entry.accumulator = 0;
              }
              if (window.jsEngine && window.jsEngine.foreverDebug) {
                try {
                  const px2 =
                    typeof target.x === "number"
                      ? target.x
                      : typeof target.getX === "function"
                      ? target.getX()
                      : NaN;
                  console.log(
                    `[jsEngine][${tid}] [${id}] post acc=${entry.accumulator.toFixed(4)} postX=${Number(
                      px2
                    ).toFixed(3)}`
                  );
                } catch (_) {}
              }
            } catch (_) {}
          };
          if (window.jsEngine && window.jsEngine.useForeverWorkers === false) {
            try {
              const entry = state.map.get(id);
              let running = true;
              let last = performance.now();
              const schedule = () => {
                try {
                  if (!running) return;
                  const now = performance.now();
                  let dt = (now - last) / 1000;
                  if (!isFinite(dt) || dt <= 0) dt = 0;
                  if (dt > 0.1) dt = 0.1;
                  last = now;
                  onTick({ cmd: "tick", dt });
                } catch (_) {}

                const mainInterval =
                  window.jsEngine && Number.isFinite(window.jsEngine.foreverMainThreadIntervalMs)
                    ? Number(window.jsEngine.foreverMainThreadIntervalMs)
                    : Math.round(1000 / 60);
                entry.intervalId = setTimeout(schedule, mainInterval);
              };
              const mainInterval =
                window.jsEngine && Number.isFinite(window.jsEngine.foreverMainThreadIntervalMs)
                  ? Number(window.jsEngine.foreverMainThreadIntervalMs)
                  : Math.round(1000 / 60);
              entry.intervalId = setTimeout(schedule, mainInterval);
              entry._stopMainLoop = () => {
                running = false;
              };
            } catch (_) {}
          } else {
            const workerSrc = `
                            let last = performance.now();
                            function tick() {
                                try {
                                    const now = performance.now();
                                    let dt = (now - last) / 1000;
                                    if (!isFinite(dt) || dt <= 0) dt = 0;
                                    if (dt > 0.1) dt = 0.1;
                                    last = now;
                                    postMessage({ cmd: 'tick', dt });
                                } catch (e) {}
                            }
                            let running = true;
                            function scheduleNext() {
                                try {
                                    if (!running) return;
                                    tick();
                                    setTimeout(scheduleNext, 0);
                                } catch(e) {  }
                            }
                            scheduleNext();
                            onmessage = function(e) {
                                try {
                                    if (e.data && e.data.cmd === 'stop') { running = false; close(); }
                                } catch(_) {}
                            };
                        `;
            const blob = new Blob([workerSrc], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            const entry = state.map.get(id);
            entry.worker = worker;
            entry.url = url;
            worker.onmessage = (ev) => {
              try {
                onTick(ev.data);
              } catch (_) {}
            };
          }

          const cancel = () => {
            try {
              const s = foreverLoops.get(tid);
              if (!s) return;
              const entry = s.map.get(id);
              if (!entry) return;
              try {
                if (entry._stopMainLoop) entry._stopMainLoop();
              } catch (_) {}
              try {
                if (entry.intervalId) clearTimeout(entry.intervalId);
              } catch (_) {}
              try {
                if (entry.worker) entry.worker.postMessage({ cmd: "stop" });
              } catch (_) {}
              try {
                if (entry.worker) entry.worker.terminate();
              } catch (_) {}
              try {
                if (entry.url) URL.revokeObjectURL(entry.url);
              } catch (_) {}
              s.map.delete(id);
              if (s.map.size === 0) {
                foreverLoops.delete(tid);
              }
            } catch (_) {}
          };

          return cancel;
        } catch (e) {
          console.error("register_forever_in_js failed:", e);
          return () => {};
        }
      });
    } catch (_) {}
    try {
      await engine.global.set("__register_forever_fixed_in_js", (fn, fps) => {
        try {
          const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
          const fpsN = Number(fps) > 0 ? Number(fps) : 60;
          const intervalMs = Math.max(1, Math.round(1000 / fpsN));
          const workerSrc = `
                        let last = performance.now();
                        function tick() {
                            try {
                                const now = performance.now();
                                let dt = (now - last) / 1000;
                                if (!isFinite(dt) || dt <= 0) dt = 0;
                                if (dt > 0.1) dt = 0.1;
                                last = now;
                                postMessage({ cmd: 'tick', dt });
                            } catch (e) {}
                        }
                        let interval = setInterval(tick, ${intervalMs});
                        onmessage = function(e) {
                            try {
                                if (e.data && e.data.cmd === 'stop') { try { clearInterval(interval); } catch(_) {} close(); }
                            } catch(_) {}
                        };
                    `;
          let state = foreverLoops.get(tid);
          if (!state) {
            state = { map: new Map() };
            foreverLoops.set(tid, state);
          }
          state.map.set(id, {
            fn,
            worker: null,
            url: null,
            accumulator: 0,
            intervalId: null,
            _stopMainLoop: null,
          });

          const STEP = 1 / 240;
          const MAX_SUBSTEPS = 1000;

          const processTick = (dt) => {
            try {
              const entry = state.map.get(id);
              if (!entry) return;
              entry.accumulator = entry.accumulator || 0;
              entry.accumulator += Math.max(0, Number(dt) || 0);

              let fullSteps = Math.floor(entry.accumulator / STEP);
              if (fullSteps > MAX_SUBSTEPS) fullSteps = MAX_SUBSTEPS;

              try {
                if (
                  window.jsEngine &&
                  window.jsEngine._pushDiag &&
                  (fullSteps > 20 || entry.accumulator > STEP * 10)
                ) {
                  window.jsEngine._pushDiag({
                    tid: String(tid),
                    op: "batch_fixed",
                    id,
                    fullSteps,
                    accumulator: entry.accumulator,
                  });
                }
              } catch (_) {}
              const BATCH_STEPS =
                window.jsEngine && Number.isFinite(window.jsEngine.foreverBatchSteps)
                  ? Number(window.jsEngine.foreverBatchSteps)
                  : 120;
              const TIME_BUDGET_MS =
                window.jsEngine && Number.isFinite(window.jsEngine.foreverTimeBudgetMs)
                  ? Number(window.jsEngine.foreverTimeBudgetMs)
                  : 4;

              const processBatch = (stepsToRun) => {
                const t0 = performance.now();
                let ran = 0;
                while (ran < stepsToRun) {
                  try {
                    const res = fn(STEP);
                    if (res && typeof res.then === "function")
                      res.catch((e) => console.error(`[jsEngine] forever fn error for ${tid}:`, e));
                  } catch (e) {
                    console.error(`[jsEngine] forever fn error for ${tid}:`, e);
                  }
                  entry.accumulator -= STEP;
                  ran++;
                  if (performance.now() - t0 > TIME_BUDGET_MS) break;
                }
                return { ran, time: performance.now() - t0 };
              };

              const runBatches = (remaining) => {
                if (remaining <= 0) return;
                const toRun = Math.min(remaining, BATCH_STEPS);
                const result = processBatch(toRun);
                remaining -= result.ran;
                if (remaining > 0 && remaining <= MAX_SUBSTEPS) {
                  setTimeout(() => runBatches(remaining), 0);
                }
              };

              if (fullSteps > 0) runBatches(fullSteps);
              if (entry.accumulator > 0) {
                const rem = Math.min(entry.accumulator, STEP);
                try {
                  const res = fn(rem);
                  if (res && typeof res.then === "function")
                    res.catch((e) => console.error(`[jsEngine] forever fn error for ${tid}:`, e));
                } catch (e) {
                  console.error(`[jsEngine] forever fn error for ${tid}:`, e);
                }
                entry.accumulator -= rem;
                if (entry.accumulator < 0) entry.accumulator = 0;
              }
            } catch (_) {}
          };

          if (window.jsEngine && window.jsEngine.useForeverWorkers === false) {
            try {
              const entry = state.map.get(id);
              let last = performance.now();
              let running = true;
              const tick = () => {
                if (!running) return;
                try {
                  const now = performance.now();
                  let dt = (now - last) / 1000;
                  if (!isFinite(dt) || dt <= 0) dt = 0;
                  if (dt > 0.1) dt = 0.1;
                  last = now;
                  processTick(dt);
                } catch (_) {}
              };

              entry.intervalId = null;
              const scheduleMainTick = () => {
                if (!running) return;
                const start = performance.now();
                try {
                  tick();
                } catch (_) {}
                const elapsed = performance.now() - start;

                try {
                  if (window.jsEngine && window.jsEngine._pushDiag && elapsed > Math.max(1, intervalMs)) {
                    window.jsEngine._pushDiag({ tid: String(tid), op: "long_tick", id, elapsed });
                  }
                } catch (_) {}

                entry.intervalId = setTimeout(scheduleMainTick, Math.max(0, intervalMs - elapsed));
              };
              entry.intervalId = setTimeout(scheduleMainTick, intervalMs);
              entry._stopMainLoop = () => {
                running = false;
                try {
                  if (entry.intervalId) clearTimeout(entry.intervalId);
                } catch (_) {}
              };
            } catch (_) {}
          } else {
            const blob = new Blob([workerSrc], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);

            const entry = state.map.get(id);
            entry.worker = worker;
            entry.url = url;

            worker.onmessage = (ev) => {
              try {
                const data = ev.data;
                if (!data || data.cmd !== "tick") return;
                let dt = Math.max(0, Number(data.dt) || 0);
                processTick(dt);
              } catch (_) {}
            };
          }

          const cancel = () => {
            try {
              const s = foreverLoops.get(tid);
              if (!s) return;
              const entry = s.map.get(id);
              if (!entry) return;
              try {
                if (entry._stopMainLoop) entry._stopMainLoop();
              } catch (_) {}
              try {
                if (entry.intervalId) clearInterval(entry.intervalId);
              } catch (_) {}
              try {
                if (entry.worker) entry.worker.postMessage({ cmd: "stop" });
              } catch (_) {}
              try {
                if (entry.worker) entry.worker.terminate();
              } catch (_) {}
              try {
                if (entry.url) URL.revokeObjectURL(entry.url);
              } catch (_) {}
              s.map.delete(id);
              if (s.map.size === 0) {
                foreverLoops.delete(tid);
              }
            } catch (_) {}
          };

          return cancel;
        } catch (e) {
          console.error("register_forever_fixed_in_js failed:", e);
          return () => {};
        }
      });
    } catch (_) {}
    await engine.global.set("js_table_from_js", (tbl) => tbl);
    try {
      await engine.global.set("print", (...args) => {
        try {
          console.log(`[js:${tid}]`, ...args);
        } catch (_) {}
      });
    } catch (_) {}

    if (loadedBlocksFull) {
      try {
        await engine.global.set("blocks", loadedBlocksFull);
      } catch (_) {}
    }

    try {
      const saved = storageGet("js", tid);
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
      const maybe = engine.global.set("__hat_test_set", {});
      if (maybe && typeof maybe.then === "function") {
        await maybe.catch(() => {
          canSetGlobal = false;
        });
      }
    } catch (e) {
      canSetGlobal = false;
    }

    const info = { engine, target, async: isAsync, canSetGlobal };
    jsEngines.set(tid, info);
    return info;
  }
  async function injectOpcodeWrappersIntoEngine(infoOrEngine, blocksMap) {
    const engine = infoOrEngine.engine || infoOrEngine;
    function sanitizeName(s) {
      const keywords = new Set([
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "else",
        "export",
        "extends",
        "finally",
        "for",
        "function",
        "if",
        "import",
        "in",
        "instanceof",
        "let",
        "new",
        "return",
        "switch",
        "this",
        "throw",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "with",
        "yield",
        "await",
        "null",
        "true",
        "false",
        "undefined",
      ]);
      let name = String(s).replace(/[^A-Za-z0-9_]/g, "_");
      if (!name || keywords.has(name) || /^[0-9]/.test(name)) name = "op_" + name;
      return name;
    }

    const lines = ["// auto-generated opcode wrappers"];
    for (const [opcode, entry] of Object.entries(blocksMap)) {
      let argNames = extractArgNamesFromEntry(entry) || [];

      try {
        if (
          (!argNames || argNames.length === 0) &&
          typeof loadedBlocksFull === "object" &&
          loadedBlocksFull &&
          loadedBlocksFull[opcode]
        ) {
          argNames = extractArgNamesFromEntry(loadedBlocksFull[opcode]) || argNames;
        }
      } catch (_) {}

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
      const safeCat = sanitizeName(cat);
      const safeMethod = sanitizeName(method);
      const safeGlobal = sanitizeName(opcode);

      lines.push(`if (typeof globalThis["${safeCat}"] === "undefined") globalThis["${safeCat}"] = {};`);
      lines.push(`globalThis["${safeCat}"]["${safeMethod}"] = function(...p) {`);
      lines.push(`  const args = {};`);

      lines.push(
        `  const _defs = (typeof blocks === 'object' && blocks && Array.isArray(blocks[${JSON.stringify(
          opcode
        )}]) && Array.isArray(blocks[${JSON.stringify(opcode)}][0])) ? blocks[${JSON.stringify(
          opcode
        )}][0] : [];`
      );
      if (argNames.length) {
        for (let i = 0; i < argNames.length; i++) {
          const a = String(argNames[i]).replace(/"/g, '\\"');
          lines.push(`  if (p.length >= ${i + 1}) {`);
          lines.push(`    try {`);
          lines.push(`      const _def = (_defs && _defs[${i}]) || null;`);
          lines.push(`      let _val = p[${i}];`);

          lines.push(
            `      if (_def && _def.type === 1) { const _n = Number(_val); _val = Number.isFinite(_n) ? _n : _val; }`
          );
          lines.push(`      args["${a}"] = _val;`);
          lines.push(`    } catch(_) { args["${a}"] = p[${i}]; }`);
          lines.push(`  }`);
        }
      } else {
        lines.push(`  for (let i=0;i<p.length;i++) args["ARG"+(i+1)] = p[i];`);
      }

      lines.push(
        `  try{ window.jsEngine = window.jsEngine || {}; window.jsEngine._lastWrapperCalls = window.jsEngine._lastWrapperCalls || []; window.jsEngine._lastWrapperCalls.push({opcode: "${opcode}", args: Object.assign({}, args)}); } catch(_) {}`
      );
      const escaped = opcode.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      lines.push(`  return call("${escaped}", args);`);
      lines.push(`};`);
      src += `function ${safeGlobal}(...)\n  return ${safeCat}.${safeMethod}(...)\nend\n`;
      lines.push(`globalThis["${escaped}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push(`globalThis["${safeCat}.${safeMethod}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push(`globalThis["${safeGlobal}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push("");
    }

    try {
      const src = lines.join("\n") + "\n";
      await engine.doString(src);
    } catch (e) {
      console.error("injectOpcodeWrappersIntoEngine failed:", e);
    }
  }
  async function injectOpcodeWrappersIntoEngine_refactored(infoOrEngine, blocksMap) {
    const engine = infoOrEngine.engine || infoOrEngine;

    function sanitizeName(s) {
      const keywords = new Set([
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "else",
        "export",
        "extends",
        "finally",
        "for",
        "function",
        "if",
        "import",
        "in",
        "instanceof",
        "let",
        "new",
        "return",
        "switch",
        "this",
        "throw",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "with",
        "yield",
        "await",
        "null",
        "true",
        "false",
        "undefined",
      ]);
      let name = String(s).replace(/[^A-Za-z0-9_]/g, "_");
      if (!name || keywords.has(name) || /^[0-9]/.test(name)) name = "op_" + name;
      return name;
    }

    const lines = ["// auto-generated opcode wrappers"];

    for (const [opcode, entry] of Object.entries(blocksMap)) {
      let argNames = extractArgNamesFromEntry(entry) || [];

      try {
        if (
          (!argNames || argNames.length === 0) &&
          typeof loadedBlocksFull === "object" &&
          loadedBlocksFull &&
          loadedBlocksFull[opcode]
        ) {
          argNames = extractArgNamesFromEntry(loadedBlocksFull[opcode]) || argNames;
        }
      } catch (_) {}

      let cat = "misc";
      let method = opcode;
      const u = opcode.indexOf("_");
      const d = opcode.indexOf(".");
      if (u !== -1) {
        cat = opcode.slice(0, u);
        method = opcode.slice(u + 1);
      } else if (d !== -1) {
        cat = opcode.slice(0, d);
        method = opcode.slice(d + 1);
      }
      const safeCat = sanitizeName(cat);
      const safeMethod = sanitizeName(method);
      const safeGlobal = sanitizeName(opcode);
      const escaped = opcode.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

      lines.push(`if (typeof globalThis["${safeCat}"] === "undefined") globalThis["${safeCat}"] = {};`);
      lines.push(`globalThis["${safeCat}"]["${safeMethod}"] = function(...p) {`);
      lines.push(`  const args = {};`);
      lines.push(
        `  const _defs = (typeof blocks === 'object' && blocks && Array.isArray(blocks[${JSON.stringify(
          opcode
        )}]) && Array.isArray(blocks[${JSON.stringify(opcode)}][0])) ? blocks[${JSON.stringify(
          opcode
        )}][0] : [];`
      );

      if (argNames.length) {
        for (let i = 0; i < argNames.length; i++) {
          const a = String(argNames[i]).replace(/"/g, '\\"');
          lines.push(`  if (p.length >= ${i + 1}) {`);
          lines.push(`    try {`);
          lines.push(`      const _def = (_defs && _defs[${i}]) || null;`);
          lines.push(`      let _val = p[${i}];`);
          lines.push(
            `      if (_def && _def.type === 1) { const _n = Number(_val); _val = Number.isFinite(_n) ? _n : _val; }`
          );
          lines.push(`      args["${a}"] = _val;`);
          lines.push(`    } catch(_) { args["${a}"] = p[${i}]; }`);
          lines.push(`  }`);
        }
      } else {
        lines.push(`  for (let i=0;i<p.length;i++) args["ARG"+(i+1)] = p[i];`);
      }

      lines.push(
        `  try{ window.jsEngine = window.jsEngine || {}; window.jsEngine._lastWrapperCalls = window.jsEngine._lastWrapperCalls || []; window.jsEngine._lastWrapperCalls.push({opcode: ${JSON.stringify(
          opcode
        )}, args: Object.assign({}, args)}); } catch(_) {}`
      );

      lines.push(`  return call("${escaped}", args);`);
      lines.push(`};`);

      lines.push(`globalThis["${escaped}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push(`globalThis["${safeCat}.${safeMethod}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push(`globalThis["${safeGlobal}"] = globalThis["${safeCat}"]["${safeMethod}"];`);
      lines.push("");
    }

    const src = lines.join("\n") + "\n";

    try {
      try {
        window.jsEngine = window.jsEngine || {};
        window.jsEngine._lastGeneratedWrapperSource = src;
      } catch (_) {}
      await engine.doString(src);
    } catch (e) {
      console.error("injectOpcodeWrappersIntoEngine failed (refactor):", e);
    }
  }

  try {
    injectOpcodeWrappersIntoEngine = injectOpcodeWrappersIntoEngine_refactored;
  } catch (_) {}
  function createPageOpcodeWrappers(blocksMap) {
    try {
      if (!blocksMap || typeof blocksMap !== "object") return;
      window.jsEngine = window.jsEngine || {};
      window.jsEngine._lastGeneratedPageWrappers = window.jsEngine._lastGeneratedPageWrappers || {};
      for (const [opcode, entry] of Object.entries(blocksMap)) {
        try {
          let argNames = extractArgNamesFromEntry(entry) || [];
          let defs = Array.isArray(entry) && entry.length && Array.isArray(entry[0]) ? entry[0] : [];
          try {
            if (
              (!argNames || argNames.length === 0) &&
              typeof loadedBlocksFull === "object" &&
              loadedBlocksFull &&
              loadedBlocksFull[opcode]
            ) {
              argNames = extractArgNamesFromEntry(loadedBlocksFull[opcode]) || argNames;
              defs =
                Array.isArray(loadedBlocksFull[opcode]) &&
                loadedBlocksFull[opcode].length &&
                Array.isArray(loadedBlocksFull[opcode][0])
                  ? loadedBlocksFull[opcode][0]
                  : defs;
            }
          } catch (_) {}
          let cat = "misc",
            method = opcode;
          const u = opcode.indexOf("_");
          const d = opcode.indexOf(".");
          if (u !== -1) {
            cat = opcode.slice(0, u);
            method = opcode.slice(u + 1);
          } else if (d !== -1) {
            cat = opcode.slice(0, d);
            method = opcode.slice(d + 1);
          }
          const sanitizeName = (s) => String(s).replace(/[^A-Za-z0-9_]/g, "_") || "op";
          const safeCat = sanitizeName(cat);
          const safeMethod = sanitizeName(method);
          const safeGlobal = sanitizeName(opcode);
          if (typeof globalThis[safeCat] !== "object" || globalThis[safeCat] === null)
            globalThis[safeCat] = {};
          const existing = globalThis[safeCat][safeMethod];
          const wrapper = function (...p) {
            console.log(argNames);
            try {
              let args = {};

              if (p.length === 1 && p[0] && typeof p[0] === "object" && !Array.isArray(p[0])) {
                args = Object.assign({}, p[0]);
              } else {
                args = {};
                for (let i = 0; i < (argNames && argNames.length ? argNames.length : p.length); i++) {
                  const n = argNames && argNames[i] ? argNames[i] : "ARG" + (i + 1);
                  let v = p[i];
                  try {
                    const def = defs && defs[i] ? defs[i] : null;
                    if (def && def.type === 1) {
                      const nval = Number(v);
                      v = Number.isFinite(nval) ? nval : v;
                    }
                  } catch (_) {}
                  if (typeof n === "string") args[n] = v;
                }
              }
              try {
                if (defs && Array.isArray(defs)) {
                  for (let i = 0; i < defs.length; i++) {
                    const def = defs[i];
                    const name = argNames && argNames[i] ? argNames[i] : "ARG" + (i + 1);
                    if (def && def.type === 1 && Object.prototype.hasOwnProperty.call(args, name)) {
                      const nn = Number(args[name]);
                      if (Number.isFinite(nn)) args[name] = nn;
                    }
                  }
                }
              } catch (_) {}
              try {
                if (
                  argNames &&
                  argNames.length &&
                  !argNames.some((n) => Object.prototype.hasOwnProperty.call(args, n))
                ) {
                  for (let i = 0; i < (argNames.length && p ? argNames.length : 0); i++) {
                    if (i >= (p ? p.length : 0)) break;
                    const name = argNames[i];
                    if (!Object.prototype.hasOwnProperty.call(args, name)) {
                      let v = p[i];
                      try {
                        const def = defs && defs[i] ? defs[i] : null;
                        if (def && def.type === 1) {
                          const nval = Number(v);
                          v = Number.isFinite(nval) ? nval : v;
                        }
                      } catch (_) {}
                      args[name] = v;
                    }
                  }
                }
              } catch (_) {}
              let targetObj = null;
              try {
                if (window.vm && window.vm.editingTarget) targetObj = window.vm.editingTarget;
                else if (window.vm && window.vm.runtime && Array.isArray(window.vm.runtime.targets)) {
                  targetObj =
                    window.vm.runtime.targets.find((tt) => !tt.isStage) ||
                    window.vm.runtime.targets[0] ||
                    null;
                }
              } catch (_) {}

              try {
                window.jsEngine._lastWrapperCalls = window.jsEngine._lastWrapperCalls || [];
                window.jsEngine._lastWrapperCalls.push({
                  opcode,
                  args: Object.assign({}, args),
                  target: (targetObj && (targetObj.id ?? targetObj.spriteId ?? String(targetObj))) || null,
                  t: performance.now(),
                });
              } catch (_) {}

              return window.jsEngine.testCall(opcode, args, targetObj);
            } catch (e) {
              console.error("[jsEngine] page wrapper call failed for", opcode, e);
              throw e;
            }
          };
          try {
            globalThis[safeCat][safeMethod] = wrapper;
          } catch (_) {}
          try {
            globalThis[safeGlobal] = wrapper;
          } catch (_) {}
          try {
            globalThis[`${safeCat}.${safeMethod}`] = wrapper;
          } catch (_) {}
          try {
            globalThis[opcode] = wrapper;
          } catch (_) {}

          window.jsEngine._lastGeneratedPageWrappers[opcode] = {
            safeCat,
            safeMethod,
            safeGlobal,
            argNames,
            defs,
          };
        } catch (_) {}
      }
    } catch (e) {
      console.error("[jsEngine] createPageOpcodeWrappers failed:", e);
    }
  }
  async function runScriptForTarget(target, code) {
    if (!target) return;
    const tid = target.id ?? target.spriteId ?? String(target);
    let info;
    try {
      info = await initEngineForTarget(target);
    } catch (e) {
      console.error("runScriptForTarget init error:", e);
      return;
    }
    const engine = info.engine;
    code = typeof code === "string" && code.trim() ? code : storageGet("js", tid) || "";
    if (!code) return;
    storageSet("js", code, tid);
    try {
      const wrapped =
        "(async function(){\n" +
        code +
        '\n})().catch(function(e){ console.error("[jsEngine:' +
        tid +
        '] runtime error:", e); throw e; });';
      await engine.doString(wrapped);
    } catch (e) {
      console.error(`[jsEngine:${tid}] runtime error:`, e);
    }
    try {
      const info = jsEngines.get(tid);
      if (info) await syncEngineHatIndex(info);
    } catch (_) {}
  }
  function makePlainTargetWrapper(target) {
    if (!target) return null;
    return {
      id: target.id ?? target.spriteId ?? String(target),
      name: target.sprite && target.sprite.name ? target.sprite.name : target.name || "",
      x: target.x ?? target._scratch_x ?? 0,
      y: target.y ?? target._scratch_y ?? 0,
    };
  }

  function toJSLiteral(obj) {
    try {
      const s = sanitizeForJS(obj);
      return JSON.stringify(s);
    } catch (_) {
      return "null";
    }
  }

  function sanitizeForJS(obj, depth = 0, seen = new WeakSet(), state = { nodes: 0 }) {
    const MAX_DEPTH = 6;
    const MAX_NODES = 3000;
    const MAX_KEYS = 200;
    const MAX_ARRAY = 500;
    const logEvent = (ev, info) => {
      try {
        window.jsEngine = window.jsEngine || {};
        window.jsEngine._sanitizeLogs = window.jsEngine._sanitizeLogs || {};
        const c = (window.jsEngine._sanitizeLogs[ev] = (window.jsEngine._sanitizeLogs[ev] || 0) + 1);

        if (c <= 6 && window.jsEngine && window.jsEngine.sanitizeLogEnabled !== false) {
          const short =
            Object.prototype.toString.call(info) === "[object Object]"
              ? Object.assign({}, info)
              : { info: String(info) };
          try {
            short.snippet =
              typeof info === "object" && info && info.constructor && info.constructor.name
                ? info.constructor.name
                : typeof info;
          } catch (_) {}
          console.warn("[jsEngine][sanitizeForJS]", ev, short);
        }
      } catch (_) {}
    };

    if (state.nodes > MAX_NODES) {
      try {
        window.jsEngine = window.jsEngine || {};
        window.jsEngine._sanitizeBailouts = (window.jsEngine._sanitizeBailouts || 0) + 1;
      } catch (_) {}
      logEvent("nodes_cap", { nodes: state.nodes, max: MAX_NODES });
      return null;
    }
    state.nodes++;

    if (depth > MAX_DEPTH) {
      logEvent("depth_cap", { depth, max: MAX_DEPTH });
      return null;
    }
    if (obj === null || obj === undefined) return null;
    const t = typeof obj;
    if (t === "number" || t === "string" || t === "boolean") return obj;
    if (t === "function" || t === "symbol") return null;
    if (seen.has(obj)) {
      logEvent("cycle_detected", { type: t });
      return null;
    }
    try {
      if (obj && typeof obj === "object") {
        if (
          Object.prototype.hasOwnProperty.call(obj, "isStage") ||
          Object.prototype.hasOwnProperty.call(obj, "sprite") ||
          Object.prototype.hasOwnProperty.call(obj, "spriteId")
        ) {
          logEvent("target_fastpath", { keys: Object.keys(obj).slice(0, 6) });
          return makePlainTargetWrapper(obj);
        }

        try {
          if (typeof Window !== "undefined" && obj instanceof Window) {
            logEvent("dom_skipped");
            return null;
          }
        } catch (_) {}
        try {
          if (typeof Node !== "undefined" && obj instanceof Node) {
            logEvent("dom_skipped");
            return null;
          }
        } catch (_) {}
        try {
          if (typeof WorkerGlobalScope !== "undefined" && obj instanceof WorkerGlobalScope) {
            logEvent("worker_skipped");
            return null;
          }
        } catch (_) {}
      }
    } catch (e) {
      logEvent("fastpath_error", { err: String(e) });
    }

    if (Array.isArray(obj)) {
      seen.add(obj);
      const arr = [];
      const len = Math.min(obj.length, MAX_ARRAY);
      for (let i = 0; i < len; i++) {
        try {
          const s = sanitizeForJS(obj[i], depth + 1, seen, state);
          arr.push(s === undefined ? null : s);
        } catch (err) {
          arr.push(null);
          logEvent("array_item_error", { index: i, err: String(err) });
        }
      }
      if (obj.length > len) {
        logEvent("array_truncated", { originalLength: obj.length, kept: len });
        arr.push(`...(${obj.length - len} items omitted)`);
      }
      return arr;
    }

    if (t === "object") {
      seen.add(obj);
      const out = {};
      const keys = Object.keys(obj);
      const limit = Math.min(keys.length, MAX_KEYS);
      for (let i = 0; i < limit; i++) {
        const k = keys[i];
        try {
          const v = obj[k];
          if (typeof v === "function" || typeof v === "symbol") continue;
          const s = sanitizeForJS(v, depth + 1, seen, state);
          if (s !== null && s !== undefined) out[k] = s;
        } catch (err) {
          logEvent("object_key_error", { key: k, err: String(err) });
        }
      }
      if (keys.length > limit) {
        logEvent("object_truncated", { originalKeys: keys.length, kept: limit });
        out.__omitted_keys = keys.length - limit;
      }
      return out;
    }
    logEvent("unknown_type", { type: t });
    return null;
  }

  async function dispatchToEngine(info, hatOpcode, options, target, forceRun = false) {
    try {
      const engine = info.engine;
      const tid =
        info.target && (info.target.id || info.target.spriteId)
          ? info.target.id ?? info.target.spriteId
          : (target && (target.id ?? target.spriteId)) || "no_target";

      const optsObj = Object.assign({}, options || {});
      try {
        let sanitizedTarget = null;
        try {
          sanitizedTarget = sanitizeForJS(target);
        } catch (_) {
          sanitizedTarget = null;
        }
        if (!sanitizedTarget) sanitizedTarget = makePlainTargetWrapper(target);
        let targetClone = sanitizedTarget;
        try {
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

      const sanitizedOpts = sanitizeForJS(optsObj);

      if (info && info.async === false && !forceRun) {
        const q = queuedHats.get(tid) || [];
        q.push({ hatOpcode, options: sanitizedOpts, target: optsObj.target });
        queuedHats.set(tid, q);
        return;
      }

      let engineOpts = null;
      try {
        const conv = await engine.global.get("js_table_from_js");
        if (conv) {
          const convPromise = conv(sanitizedOpts);
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("conv timeout")), 200)
          );
          try {
            engineOpts = await Promise.race([convPromise, timeout]);
          } catch (_) {
            engineOpts = null;
          }
        }
      } catch (_) {
        engineOpts = null;
      }
      let usedLiteralFallback = false;
      try {
        let setRes;
        const toSet = engineOpts == null ? sanitizedOpts || {} : engineOpts;
        try {
          if (!toSet._args || !Array.isArray(toSet._args)) {
            if (sanitizedOpts && Array.isArray(sanitizedOpts._args))
              toSet._args = sanitizedOpts._args.slice();
            else toSet._args = [];
          } else {
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
          setRes = engine.global.set("__hat_opts", toSet);
        } catch (err) {
          try {
            const literal = toJSLiteral(toSet);
            usedLiteralFallback = true;
            const fallback = engine.doString(`__hat_opts = ${literal}`);
            if (fallback && typeof fallback.catch === "function") fallback.catch(() => {});
          } catch (e) {
            console.error(`[jsEngine] fallback __hat_opts set failed for ${tid}:`, e);
          }
          setRes = undefined;
        }

        if (setRes && typeof setRes.then === "function") {
          setRes.catch((e) => console.error(`engine.global.set failed for ${tid}:`, e));
        }
      } catch (setErr) {
        console.error(`[jsEngine] engine.global.set attempt failed for ${tid}:`, setErr);
      }

      try {
        if (usedLiteralFallback) {
          const callRes = engine.doString(`__call_hats(${JSON.stringify(hatOpcode)}, __hat_opts)`);
          if (callRes && typeof callRes.catch === "function") {
            callRes.catch(async (e) => {
              console.error(`[jsEngine] __call_hats failed for ${tid}:`, e);
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
              const res = callFn(hatOpcode, engineOpts == null ? {} : engineOpts);
              if (res && typeof res.catch === "function") {
                res.catch(async (e) => {
                  console.error(`[jsEngine] __call_hats failed for ${tid}:`, e);
                });
              }
            } catch (err) {
              const fallback = engine.doString(`__call_hats(${JSON.stringify(hatOpcode)}, __hat_opts)`);
              if (fallback && typeof fallback.catch === "function") {
                fallback.catch((e) => console.error(`[jsEngine] __call_hats fallback failed for ${tid}:`, e));
              }
            }
          } else {
            const callRes = engine.doString(`__call_hats(${JSON.stringify(hatOpcode)}, __hat_opts)`);
            if (callRes && typeof callRes.catch === "function") {
              callRes.catch(async (e) => {
                console.error(`[jsEngine] __call_hats failed for ${tid}:`, e);
              });
            }
          }
        }
      } catch (e) {
        console.error(`[jsEngine] __call_hats invocation error for ${tid}:`, e);
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
        out._args = argNames.map((n) => (Object.prototype.hasOwnProperty.call(out, n) ? out[n] : null));
        if (utilObj && utilObj.fields) {
          for (let i = 0; i < argNames.length; i++) {
            const n = argNames[i];
            if (out._args[i] == null) {
              const fn = utilObj.fields[n] || utilObj.fields[n.toUpperCase()];
              if (fn != null) {
                if (typeof fn === "object" && fn !== null) {
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
        if (utilObj && utilObj.block && utilObj.block.fields) {
          for (let i = 0; i < argNames.length; i++) {
            const n = argNames[i];
            if (out._args[i] == null) {
              const fn = utilObj.block.fields[n] || utilObj.block.fields[n.toUpperCase()];
              if (fn != null) {
                out._args[i] = typeof fn === "object" && fn !== null ? fn.value ?? fn.name ?? fn : fn;
                out[n] = out._args[i];
              }
            }
          }
        }
        if (utilObj && Array.isArray(utilObj.args)) {
          for (let i = 0; i < argNames.length && i < utilObj.args.length; i++) {
            if (out._args[i] == null) {
              out._args[i] = utilObj.args[i];
              out[argNames[i]] = utilObj.args[i];
            }
          }
        }
        try {
          if (utilObj && argNames && argNames.length) {
            const sanitize = (s) =>
              String(s || "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");
            const stripSuffixes = (s) => s.replace(/(?:option|menu|input|field|value)$/i, "");
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
                    if (typeof val === "object" && val !== null) val = val.value ?? val.name ?? val[0] ?? val;
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
        if (!out.key && utilObj) {
          if (utilObj.key) out.key = utilObj.key;
          else if (utilObj.keyOption) out.key = utilObj.keyOption;
          else if (utilObj.KEY_OPTION) out.key = utilObj.KEY_OPTION;
          else if (utilObj.keyString) out.key = utilObj.keyString;
          else if (utilObj.keyName) out.key = utilObj.keyName;
          else if (utilObj.text) out.key = utilObj.text;
        }

        if ((!out._args || out._args.length === 0) && Array.isArray(utilObj && utilObj.args)) {
          out._args = utilObj.args.slice();
        }
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
        const maybe = options.target || options.targetId || options.sprite || options.spriteId;

        if (maybe) {
          if (typeof maybe === "object" && maybe.id) {
            resolvedTargets = [maybe];
          } else {
            const byId = runtime.getTargetById?.(maybe) || runtime.targets.find((t) => t && t.id === maybe);
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
      resolvedTargets = runtime.targets.filter((t) => t && (t.id || t.sprite));
    }
    setTimeout(() => {
      (async () => {
        if (!resolvedTargets.length) return;

        for (const t of resolvedTargets) {
          try {
            if (!t || !t.id) continue;

            const tid = t.id ?? t.spriteId ?? String(t);
            let info = jsEngines.get(tid);

            if (!info) {
              initEngineForTarget(t).catch((e) => console.error(`initEngineForTarget(${tid}) failed:`, e));

              setTimeout(() => {
                const info2 = jsEngines.get(tid);
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
    if (!runtime || runtime.__jsEngine_patchedStartHats) return;
    const orig = runtime.startHats.bind(runtime);
    runtime.startHats = function (hatOpcode, util, options) {
      const res = orig(hatOpcode, util, options);
      try {
        scheduleDispatch(runtime, hatOpcode, util, options);
      } catch (_) {}
      return res;
    };
    runtime.__jsEngine_patchedStartHats = true;
  }

  async function onProjectStart() {
    try {
      const b = buildProcessedBlocksFromToolbox();
      if (Object.keys(b).length) {
        loadedBlocksFull = b;
        try {
          createPageOpcodeWrappers(loadedBlocksFull);
        } catch (_) {}
      }

      const runtime = window.vm?.runtime;
      if (!runtime) return;

      patchStartHatsOnce(runtime);

      for (const t of runtime.targets) {
        try {
          if (!t) continue;
          const tid = t.id ?? String(t);
          const code = storageGet("js", tid) || "";
          if (code && code.trim())
            runScriptForTarget(t, code).catch((e) => console.error("runScriptForTarget error:", e));
          else {
            initEngineForTarget(t).catch(() => {});
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error("onProjectStart error:", e);
    }
  }

  if (window.vm?.runtime && typeof window.vm.runtime.on === "function") {
    window.vm.runtime.on("PROJECT_START", onProjectStart);
    try {
      onProjectStart().catch(() => {});
    } catch (_) {}

    try {
      const stopHandler = async () => {
        try {
          for (const [tid, info] of jsEngines) {
            try {
              if (info && info.engine) {
                try {
                  if (info.engine._hatRegistry) info.engine._hatRegistry = {};
                } catch (_) {}
              }
            } catch (_) {}
            try {
              queuedHats.delete(tid);
            } catch (_) {}
            try {
              renderInterp.map.delete(tid);
            } catch (_) {}
            try {
              const s = foreverLoops.get(tid);
              if (s) {
                try {
                  for (const [id, entry] of s.map) {
                    try {
                      if (entry.worker) {
                        try {
                          entry.worker.postMessage({ cmd: "stop" });
                        } catch (_) {}
                        entry.worker.terminate();
                      }
                    } catch (_) {}
                    try {
                      if (entry.url) URL.revokeObjectURL(entry.url);
                    } catch (_) {}
                  }
                } catch (_) {}
                try {
                  s.map.clear();
                } catch (_) {}
                foreverLoops.delete(tid);
              }
            } catch (_) {}
          }
          try {
            if (window.jsEngine) {
              try {
                queuedHats.clear();
              } catch (_) {}
              try {
                window.jsEngine._hatIndex = new Map();
              } catch (_) {}
              try {
                for (const [tid, s] of foreverLoops) {
                  try {
                    for (const [id, entry] of s.map) {
                      try {
                        if (entry.worker) {
                          try {
                            entry.worker.postMessage({ cmd: "stop" });
                          } catch (_) {}
                          entry.worker.terminate();
                        }
                      } catch (_) {}
                      try {
                        if (entry.url) URL.revokeObjectURL(entry.url);
                      } catch (_) {}
                    }
                  } catch (_) {}
                }
                try {
                  foreverLoops.clear();
                } catch (_) {}
              } catch (_) {}
            }
          } catch (_) {}
        } catch (e) {
          console.error("PROJECT_STOP_ALL handler error:", e);
        }
      };
      window.vm.runtime.on("PROJECT_STOP_ALL", stopHandler);
    } catch (_) {}
  } else {
    (function pollRuntime() {
      const start = Date.now();
      const poll = setInterval(() => {
        if (window.vm?.runtime && typeof window.vm.runtime.on === "function") {
          clearInterval(poll);
          window.vm.runtime.on("PROJECT_START", onProjectStart);

          try {
            const stopHandler = async () => {
              try {
                for (const [tid, info] of jsEngines) {
                  try {
                    if (info && info.engine) {
                      try {
                        try {
                          if (info.engine._hatRegistry) info.engine._hatRegistry = {};
                        } catch (_) {}
                      } catch (_) {}
                    }
                  } catch (_) {}
                  try {
                    queuedHats.clear();
                  } catch (_) {}
                  try {
                    const s = foreverLoops.get(tid);
                    if (s) {
                      try {
                        for (const [id, entry] of s.map) {
                          try {
                            if (entry.worker) {
                              try {
                                entry.worker.postMessage({ cmd: "stop" });
                              } catch (_) {}
                              entry.worker.terminate();
                            }
                          } catch (_) {}
                          try {
                            if (entry.url) URL.revokeObjectURL(entry.url);
                          } catch (_) {}
                        }
                      } catch (_) {}
                      try {
                        s.map.clear();
                      } catch (_) {}
                      foreverLoops.delete(tid);
                    }
                  } catch (_) {}
                }
                try {
                  const map = window.jsEngine && window.jsEngine._hatIndex;
                  if (map && map instanceof Map) {
                    for (const [hat, m] of map) {
                      try {
                      } catch (_) {}
                    }
                  }
                } catch (_) {}
                try {
                  for (const [tid, s] of foreverLoops) {
                    try {
                      for (const [id, entry] of s.map) {
                        try {
                          if (entry.worker) {
                            try {
                              entry.worker.postMessage({ cmd: "stop" });
                            } catch (_) {}
                            entry.worker.terminate();
                          }
                        } catch (_) {}
                        try {
                          if (entry.url) URL.revokeObjectURL(entry.url);
                        } catch (_) {}
                      }
                    } catch (_) {}
                  }
                  try {
                    foreverLoops.clear();
                  } catch (_) {}
                } catch (_) {}
              } catch (e) {
                console.error("PROJECT_STOP_ALL handler error:", e);
              }
            };
            window.vm.runtime.on("PROJECT_STOP_ALL", stopHandler);
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
              if (t) await initEngineForTarget(t).catch(() => {});
            } catch (_) {}
            try {
              if (editor) {
                let code = storageGet("js", id) || "";
                try {
                  const info = jsEngines.get(id);
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

  window.jsEngine = window.jsEngine || {};
  window.jsEngine._queuedHats = queuedHats;
  window.jsEngine._foreverLoops = foreverLoops;
  window.jsEngine._hatIndex = window.jsEngine._hatIndex || new Map();
  window.jsEngine._registerHatForEngine = function (tid, hat, delta) {
    try {
      if (!hat) return;
      const key = String(hat);
      const map = window.jsEngine._hatIndex;
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
        const dumpFn = await engine.global.get("__dump_registry_types").catch(() => null);
        if (dumpFn && typeof dumpFn === "function") {
          res = await dumpFn();
        } else if (engine._hatRegistry && typeof engine._hatRegistry === "object") {
          res = {};
          for (const [hat, arr] of Object.entries(engine._hatRegistry)) {
            res[hat] = Array.isArray(arr)
              ? arr.length
              : arr && typeof arr === "object"
              ? Object.keys(arr).length
              : 0;
          }
        } else {
          res = null;
        }
      } catch (e) {
        res = null;
      }
      if (!res || typeof res !== "object") return;
      for (const [hat, count] of Object.entries(res)) {
        try {
          const prevMap = window.jsEngine._hatIndex.get(String(hat));
          const prev = prevMap && prevMap.get(tid) ? prevMap.get(tid) : 0;
          const delta = Number(count || 0) - Number(prev || 0);
          if (delta !== 0) window.jsEngine._registerHatForEngine(tid, hat, delta);
        } catch (_) {}
      }
    } catch (_) {}
  }
  window.jsEngine.runQueuedHatsFor = function (tid, opts = {}) {
    const q = queuedHats.get(tid) || [];
    if (!q.length) return;
    const info = jsEngines.get(tid);
    if (!info) return;
    if (info.async === false && !opts.force) return;
    (function runNext() {
      const item = q.shift();
      if (!item) {
        queuedHats.delete(tid);
        return;
      }
      try {
        dispatchToEngine(info, item.hatOpcode, item.options, item.target, !!opts.force);
      } catch (e) {
        console.error(`Error running queued hat for ${tid}:`, e);
      }
      setTimeout(runNext, opts.delay || 50);
    })();
  };

  window.jsEngine.hasHandlersForHat = function (hat) {
    try {
      const s = window.jsEngine._hatIndex.get(String(hat));
      return !!(s && s.size > 0);
    } catch (_) {
      return false;
    }
  };

  window.jsEngine.dumpRegistries = async function () {
    try {
      for (const [tid, info] of jsEngines) {
        try {
          const engine = info.engine;
          let dump = null;
          try {
            const fn = await engine.global.get("__dump_registry_types").catch(() => null);
            if (fn && typeof fn === "function") {
              dump = await fn();
            } else if (engine._hatRegistry && typeof engine._hatRegistry === "object") {
              dump = {};
              for (const [hat, arr] of Object.entries(engine._hatRegistry)) {
                dump[hat] = Array.isArray(arr)
                  ? arr.length
                  : arr && typeof arr === "object"
                  ? Object.keys(arr).length
                  : 0;
              }
            }
          } catch (e) {
            dump = null;
          }
        } catch (e) {
          console.error("[jsEngine] registry_types failed for", tid, e);
        }
      }
    } catch (e) {
      console.error("[jsEngine] dumpRegistries error:", e);
    }
  };

  window.jsEngine.syncAllHatIndexes = async function () {
    try {
      for (const [tid, info] of jsEngines) {
        try {
          await syncEngineHatIndex(info);
        } catch (_) {}
      }
    } catch (e) {
      console.error("[jsEngine] syncAllHatIndexes error:", e);
    }
  };

  window.jsEngine.callHatOnEngine = async function (tid, hat) {
    try {
      const info = jsEngines.get(tid);
      if (!info) return;
      const engine = info.engine;
      try {
        const res = await engine.doString(`__call_hats(${JSON.stringify(hat)}, {})`);
      } catch (e) {
        console.error("[jsEngine] callHatOnEngine failed for", tid, hat, e);
      }
    } catch (e) {
      console.error("[jsEngine] callHatOnEngine error:", e);
    }
  };

  window.jsEngine.runFor = async function (tid, code) {
    let info = jsEngines.get(tid);
    if (!info) {
      try {
        await initEngineForTarget({ id: tid, name: tid });
        info = jsEngines.get(tid);
        if (!info) {
          console.error(`[jsEngine] failed to initialize engine for ${tid}`);
          return;
        }
      } catch (e) {
        console.error(`[jsEngine] failed to init engine for ${tid}:`, e);
        return;
      }
    }
    try {
      if (typeof info.engine.doString === "function") {
        const wrapped =
          "(async function(){\n" +
          code +
          '\n})().catch(function(e){ console.error("[jsEngine:' +
          tid +
          '] runtime error:", e); throw e; });';
        await info.engine.doString(wrapped);
      } else if (typeof info.engine.run === "function") {
        await info.engine.run(code);
      } else {
      }
    } catch (e) {
      console.error(`[jsEngine] runFor(${tid}) error:`, e);
    }
  };

  (function (Scratch) {
    class jsEngineExtension {
      getInfo() {
        return { id: "jsengine", name: "JS Editor", blocks: [] };
      }
      async runJS(code) {
        const t = window.vm?.editingTarget;
        if (!t) return null;
        return runScriptForTarget(t, code);
      }
    }
    try {
      Scratch.extensions.register(new jsEngineExtension());
    } catch (_) {}
  })(Scratch);
})();
