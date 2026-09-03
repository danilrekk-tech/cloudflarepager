/** Script embedded into deployed sites so clients can send remarks back to the dashboard. */
export const FEEDBACK_ENDPOINT =
  "https://project--e9f1d004-3641-485c-92ac-12618269d7f3.lovable.app/api/public/feedback";

export function feedbackWidgetScript(token: string, endpoint: string = FEEDBACK_ENDPOINT) {
  return `(function(){
  var TOKEN = ${JSON.stringify(token)};
  var ENDPOINT = ${JSON.stringify(endpoint)};
  fetch(ENDPOINT + "?token=" + encodeURIComponent(TOKEN))
    .then(function(r){ return r.json(); })
    .then(function(cfg){ if (cfg && cfg.enabled) start(cfg); })
    .catch(function(){});

  function start(cfg){
  var picking = false, marking = false, target = null;
  var css = document.createElement("style");
  css.textContent = "#pxfb-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;background:#111827;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.3)}"
   + "#pxfb-box{position:fixed;right:20px;bottom:76px;z-index:2147483000;width:340px;max-height:80vh;overflow:auto;background:#fff;color:#111827;border-radius:14px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);font:400 14px/1.4 system-ui,sans-serif;display:none}"
   + "#pxfb-box textarea{width:100%;min-height:80px;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;resize:vertical}"
   + "#pxfb-box input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;margin-bottom:8px}"
   + "#pxfb-box button{margin-top:8px;border:0;border-radius:8px;padding:9px 12px;font:600 13px system-ui;cursor:pointer}"
   + "#pxfb-send{background:#2563eb;color:#fff;width:100%}"
   + "#pxfb-pick,#pxfb-mark{background:#f3f4f6;color:#111827;margin-right:6px}"
   + "#pxfb-mark.on{background:#fde68a}"
   + "#pxfb-card{display:none;margin-top:8px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#f9fafb}"
   + "#pxfb-card b{display:block;font:600 12px system-ui;color:#111827}"
   + "#pxfb-card small{display:block;font:400 11px/1.35 monospace;color:#6b7280;word-break:break-all;margin-top:3px;white-space:pre-wrap}"
   + "#pxfb-thumb{max-width:100%;max-height:80px;border-radius:6px;margin-top:6px;display:none}"
   + "#pxfb-hint{font:400 12px/1.4 system-ui;color:#6b7280;margin-top:6px}"
   + ".pxfb-target{outline:3px solid #f59e0b !important;outline-offset:2px}"
   + ".pxfb-found{outline:3px solid #2563eb !important;outline-offset:3px;animation:pxfb-pulse 1.2s ease-in-out 3}"
   + "#pxfb-rect{position:absolute;z-index:2147482900;background:rgba(250,204,21,.32);border:2px solid #f59e0b;border-radius:4px;pointer-events:none;display:none}"
   + "#pxfb-veil{position:fixed;inset:0;z-index:2147482800;cursor:crosshair;background:rgba(17,24,39,.06);display:none}"
   + "#pxfb-tip{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483100;background:#111827;color:#fff;border-radius:999px;padding:8px 16px;font:600 13px system-ui;display:none}"
   + "@keyframes pxfb-pulse{50%{outline-color:#f59e0b}}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "pxfb-btn"; btn.textContent = "Оставить замечание";
  var box = document.createElement("div");
  box.id = "pxfb-box";
  box.innerHTML = '<input id="pxfb-name" placeholder="Ваше имя (необязательно)">'
    + '<textarea id="pxfb-msg" placeholder="Что нужно изменить?"></textarea>'
    + '<div id="pxfb-card"><b id="pxfb-title">Элемент не выбран</b>'
    + '<small id="pxfb-path"></small><img id="pxfb-thumb"></div>'
    + '<button id="pxfb-pick">Указать элемент</button>'
    + '<button id="pxfb-mark">Выделить маркером</button>'
    + '<div id="pxfb-hint">Можно просто выделить текст на странице мышью — он подставится сюда как «заменить текст».</div>'
    + '<button id="pxfb-send">Отправить</button>';
  var rect = document.createElement("div"); rect.id = "pxfb-rect";
  var veil = document.createElement("div"); veil.id = "pxfb-veil";
  var tip = document.createElement("div"); tip.id = "pxfb-tip";
  document.body.appendChild(btn); document.body.appendChild(box);
  document.body.appendChild(rect); document.body.appendChild(veil); document.body.appendChild(tip);

  function isWidget(el){ return !!(el && el.closest && el.closest("#pxfb-box,#pxfb-btn,#pxfb-tip")); }
  function sel(el){
    if (!el) return "";
    if (el.id) return "#" + el.id;
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== "HTML"){
      var n = el.tagName.toLowerCase(), p = el.parentElement;
      if (p){ var same = Array.prototype.filter.call(p.children, function(c){ return c.tagName === el.tagName; });
        if (same.length > 1) n += ":nth-of-type(" + (same.indexOf(el)+1) + ")"; }
      parts.unshift(n);
      if (el.id){ parts[0] = "#" + el.id; break; }
      el = p;
    }
    return parts.join(" > ");
  }
  function describe(el){
    var t = el.tagName.toLowerCase();
    var cls = (el.getAttribute("class")||"").trim().split(/\\s+/).filter(Boolean).slice(0,2).join(".");
    var name = t + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
    var txt = (el.textContent||"").replace(/\\s+/g," ").trim();
    if (t === "img") return "Картинка «" + (el.getAttribute("alt") || el.getAttribute("src")||"").split("/").pop() + "» (" + name + ")";
    if (t === "a") return "Ссылка «" + txt.slice(0,50) + "» → " + (el.getAttribute("href")||"без ссылки");
    if (t === "button") return "Кнопка «" + txt.slice(0,50) + "»";
    if (/^h[1-6]$/.test(t)) return "Заголовок «" + txt.slice(0,60) + "»";
    if (txt) return "Текст «" + txt.slice(0,60) + "» (" + name + ")";
    return "Блок " + name;
  }
  function breadcrumb(el){
    var out = [], n = el;
    while (n && n.nodeType === 1 && n.tagName !== "HTML" && out.length < 6){
      var t = n.tagName.toLowerCase();
      var cls = (n.getAttribute("class")||"").trim().split(/\\s+/).filter(Boolean)[0];
      out.unshift(t + (n.id ? "#" + n.id : cls ? "." + cls : ""));
      n = n.parentElement;
    }
    return out.join(" › ");
  }
  function section(el){
    var n = el;
    while (n && n.nodeType === 1){
      if (n.id) return "#" + n.id;
      var t = n.tagName.toLowerCase();
      if (t === "section" || t === "header" || t === "footer" || t === "nav" || t === "main" || t === "aside"){
        var h = n.querySelector("h1,h2,h3");
        return t + (h ? " «" + (h.textContent||"").replace(/\\s+/g," ").trim().slice(0,40) + "»" : "");
      }
      n = n.parentElement;
    }
    return "";
  }
  function docSize(){
    return { W: Math.max(1, document.documentElement.scrollWidth), H: Math.max(1, document.documentElement.scrollHeight) };
  }

  var pos = { x: 0, y: 0 }, area = { w: 0, h: 0 }, selector = "", label = "", crumbs = "", html = "", picked = "", kind = "note";
  function openBox(){ box.style.display = "block"; }
  function showCard(title, extra){
    box.querySelector("#pxfb-card").style.display = "block";
    box.querySelector("#pxfb-title").textContent = title;
    box.querySelector("#pxfb-path").textContent = extra || "";
  }
  function resetCard(){
    box.querySelector("#pxfb-card").style.display = "none";
    box.querySelector("#pxfb-thumb").style.display = "none";
    if (target) target.classList.remove("pxfb-target");
    target = null; selector = ""; label = ""; crumbs = ""; html = ""; picked = ""; kind = "note";
    area = { w: 0, h: 0 }; pos = { x: 0, y: 0 };
    rect.style.display = "none";
  }

  btn.onclick = function(){ box.style.display = box.style.display === "block" ? "none" : "block"; };
  box.querySelector("#pxfb-pick").onclick = function(){
    picking = true; marking = false; veil.style.display = "none";
    box.style.display = "none"; tip.style.display = "block"; tip.textContent = "Кликните по элементу";
  };

  // --- Marker mode: drag a rectangle over the area that needs fixing ---
  var markBtn = box.querySelector("#pxfb-mark");
  markBtn.onclick = function(){
    marking = !marking; picking = false;
    markBtn.classList.toggle("on", marking);
    veil.style.display = marking ? "block" : "none";
    tip.style.display = marking ? "block" : "none";
    tip.textContent = "Обведите мышью область, которую нужно поправить";
    if (marking) box.style.display = "none";
  };
  var mStart = null;
  veil.addEventListener("mousedown", function(e){
    if (!marking) return;
    mStart = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
    rect.style.display = "block";
    rect.style.left = mStart.x + "px"; rect.style.top = mStart.y + "px";
    rect.style.width = "0px"; rect.style.height = "0px";
  });
  veil.addEventListener("mousemove", function(e){
    if (!marking || !mStart) return;
    var x = e.clientX + window.scrollX, y = e.clientY + window.scrollY;
    rect.style.left = Math.min(x, mStart.x) + "px";
    rect.style.top = Math.min(y, mStart.y) + "px";
    rect.style.width = Math.abs(x - mStart.x) + "px";
    rect.style.height = Math.abs(y - mStart.y) + "px";
  });
  veil.addEventListener("mouseup", function(e){
    if (!marking || !mStart) return;
    var x = e.clientX + window.scrollX, y = e.clientY + window.scrollY;
    var left = Math.min(x, mStart.x), top = Math.min(y, mStart.y);
    var w = Math.abs(x - mStart.x), h = Math.abs(y - mStart.y);
    mStart = null;
    marking = false; markBtn.classList.remove("on");
    veil.style.display = "none"; tip.style.display = "none";
    if (w < 8 || h < 8){ rect.style.display = "none"; box.style.display = "block"; return; }
    var s = docSize();
    kind = "area"; pos = { x: left / s.W, y: top / s.H }; area = { w: w / s.W, h: h / s.H };
    var under = document.elementFromPoint(
      Math.min(window.innerWidth - 2, left + w / 2 - window.scrollX),
      Math.min(window.innerHeight - 2, top + h / 2 - window.scrollY)
    );
    if (under && !isWidget(under)){
      selector = sel(under); crumbs = breadcrumb(under);
      html = (under.outerHTML || "").replace(/\\s+/g, " ").slice(0, 600);
      label = "Выделенная область: " + describe(under);
    } else {
      selector = ""; crumbs = ""; html = "";
      label = "Выделенная область страницы";
    }
    showCard(label, "Размер области: " + Math.round(w) + "×" + Math.round(h) + " px" + (crumbs ? "\\n" + crumbs : ""));
    box.style.display = "block";
    box.querySelector("#pxfb-msg").focus();
  });

  // --- Element picking ---
  document.addEventListener("click", function(e){
    if (!picking || isWidget(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    picking = false; tip.style.display = "none";
    if (target) target.classList.remove("pxfb-target");
    target = e.target; target.classList.add("pxfb-target");
    kind = target.tagName === "IMG" ? "image" : "element";
    selector = sel(target);
    label = describe(target);
    crumbs = breadcrumb(target);
    var sec = section(target);
    html = (target.outerHTML || "").replace(/\\s+/g, " ").slice(0, 600);
    var s = docSize();
    pos = { x: (e.clientX + window.scrollX) / s.W, y: (e.clientY + window.scrollY) / s.H };
    area = { w: 0, h: 0 };
    showCard(label, (sec ? "Секция: " + sec + "\\n" : "") + crumbs);
    var thumb = box.querySelector("#pxfb-thumb");
    if (target.tagName === "IMG" && target.src){ thumb.src = target.src; thumb.style.display = "block"; }
    else thumb.style.display = "none";
    box.style.display = "block";
  }, true);

  // --- Text selection: mark the exact text that should be replaced ---
  document.addEventListener("mouseup", function(e){
    if (picking || marking || isWidget(e.target)) return;
    setTimeout(function(){
      var s = window.getSelection && window.getSelection();
      if (!s || s.isCollapsed) return;
      var text = String(s).replace(/\\s+/g, " ").trim();
      if (text.length < 2) return;
      var node = s.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (!el || isWidget(el)) return;
      if (target) target.classList.remove("pxfb-target");
      target = el; target.classList.add("pxfb-target");
      kind = "text"; picked = text.slice(0, 1000);
      selector = sel(el); crumbs = breadcrumb(el);
      html = (el.outerHTML || "").replace(/\\s+/g, " ").slice(0, 600);
      label = "Заменить текст: «" + picked.slice(0, 80) + "»";
      var r = el.getBoundingClientRect(), d = docSize();
      pos = { x: (r.left + window.scrollX) / d.W, y: (r.top + window.scrollY) / d.H };
      area = { w: r.width / d.W, h: r.height / d.H };
      rect.style.display = "block";
      rect.style.left = (r.left + window.scrollX) + "px";
      rect.style.top = (r.top + window.scrollY) + "px";
      rect.style.width = r.width + "px";
      rect.style.height = r.height + "px";
      showCard(label, crumbs);
      box.querySelector("#pxfb-msg").placeholder = "На какой текст заменить?";
      openBox();
    }, 0);
  }, true);

  box.querySelector("#pxfb-send").onclick = function(){
    var msg = box.querySelector("#pxfb-msg").value.trim();
    if (!msg) return;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: TOKEN, message: msg,
        author: box.querySelector("#pxfb-name").value.trim(),
        selector: selector, label: label, breadcrumb: crumbs, html: html,
        page: location.href.split("#")[0], x: pos.x, y: pos.y, w: area.w, h: area.h,
        selectedText: picked, kind: kind
      })
    }).then(function(){
      box.querySelector("#pxfb-msg").value = "";
      box.querySelector("#pxfb-msg").placeholder = "Что нужно изменить?";
      resetCard();
      box.style.display = "none";
      btn.textContent = "Спасибо! Отправлено";
      setTimeout(function(){ btn.textContent = "Оставить замечание"; }, 2500);
    }).catch(function(){ btn.textContent = "Ошибка отправки"; });
  };

  // Deep link from the dashboard: #pxfb=<selector> highlights the element.
  function highlight(){
    var m = /[#&]pxfb=([^&]+)/.exec(location.hash);
    if (!m) return;
    var s = "";
    try { s = decodeURIComponent(m[1]); } catch(e){ return; }
    var el = null; try { el = document.querySelector(s); } catch(e){}
    if (!el) { btn.textContent = "Элемент не найден"; return; }
    el.classList.add("pxfb-found");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function(){ el.classList.remove("pxfb-found"); }, 6000);
  }
  setTimeout(highlight, 500);
  window.addEventListener("hashchange", highlight);
  }
})();`;
}
