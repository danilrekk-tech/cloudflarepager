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
  var picking = false, target = null;
  var css = document.createElement("style");
  css.textContent = "#pxfb-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;background:#111827;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.3)}"
   + "#pxfb-box{position:fixed;right:20px;bottom:76px;z-index:2147483000;width:320px;background:#fff;color:#111827;border-radius:14px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);font:400 14px/1.4 system-ui,sans-serif;display:none}"
   + "#pxfb-box textarea{width:100%;min-height:80px;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;resize:vertical}"
   + "#pxfb-box input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;margin-bottom:8px}"
   + "#pxfb-box button{margin-top:8px;border:0;border-radius:8px;padding:9px 14px;font:600 13px system-ui;cursor:pointer}"
   + "#pxfb-send{background:#2563eb;color:#fff}#pxfb-pick{background:#f3f4f6;color:#111827;margin-right:6px}"
   + "#pxfb-card{display:none;margin-top:8px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#f9fafb}"
   + "#pxfb-card b{display:block;font:600 12px system-ui;color:#111827}"
   + "#pxfb-card small{display:block;font:400 11px/1.35 monospace;color:#6b7280;word-break:break-all;margin-top:3px}"
   + "#pxfb-thumb{max-width:100%;max-height:80px;border-radius:6px;margin-top:6px;display:none}"
   + ".pxfb-target{outline:3px solid #f59e0b !important;outline-offset:2px}"
   + ".pxfb-found{outline:3px solid #2563eb !important;outline-offset:3px;animation:pxfb-pulse 1.2s ease-in-out 3}"
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
    + '<button id="pxfb-pick">Указать элемент</button><button id="pxfb-send">Отправить</button>';
  document.body.appendChild(btn); document.body.appendChild(box);

  function isWidget(el){ return !!(el && el.closest && el.closest("#pxfb-box,#pxfb-btn")); }
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

  var pos = { x: 0, y: 0 }, selector = "", label = "", crumbs = "", html = "";
  btn.onclick = function(){ box.style.display = box.style.display === "block" ? "none" : "block"; };
  box.querySelector("#pxfb-pick").onclick = function(){ picking = true; box.style.display = "none"; btn.textContent = "Кликните по элементу"; };
  document.addEventListener("click", function(e){
    if (!picking || isWidget(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    picking = false; btn.textContent = "Оставить замечание";
    if (target) target.classList.remove("pxfb-target");
    target = e.target; target.classList.add("pxfb-target");
    selector = sel(target);
    label = describe(target);
    crumbs = breadcrumb(target);
    var sec = section(target);
    html = (target.outerHTML || "").replace(/\\s+/g, " ").slice(0, 600);
    pos = { x: e.clientX / Math.max(1, window.innerWidth), y: (e.clientY + window.scrollY) / Math.max(1, document.body.scrollHeight) };
    box.querySelector("#pxfb-card").style.display = "block";
    box.querySelector("#pxfb-title").textContent = label;
    box.querySelector("#pxfb-path").textContent = (sec ? "Секция: " + sec + "\\n" : "") + crumbs;
    var thumb = box.querySelector("#pxfb-thumb");
    if (target.tagName === "IMG" && target.src){ thumb.src = target.src; thumb.style.display = "block"; }
    else thumb.style.display = "none";
    box.style.display = "block";
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
        page: location.href.split("#")[0], x: pos.x, y: pos.y,
        kind: target && target.tagName === "IMG" ? "image" : selector ? "element" : "note"
      })
    }).then(function(){
      box.querySelector("#pxfb-msg").value = "";
      box.querySelector("#pxfb-card").style.display = "none";
      if (target) target.classList.remove("pxfb-target");
      target = null; selector = ""; label = ""; crumbs = ""; html = "";
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

  // Saved callouts and arrows drawn by the owner in the dashboard.
  function drawMarks(){
    var list = (cfg && cfg.annotations) || [];
    var old = document.getElementById("pxfb-marks");
    if (old) old.remove();
    if (!/[#&]pxann=1/.test(location.hash) || !list.length) return;
    var layer = document.createElement("div");
    layer.id = "pxfb-marks";
    layer.style.cssText = "position:absolute;inset:0;z-index:2147482000;pointer-events:none";
    var W = document.documentElement.scrollWidth, H = document.documentElement.scrollHeight;
    var svgNs = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("width", String(W)); svg.setAttribute("height", String(H));
    svg.style.cssText = "position:absolute;left:0;top:0";
    layer.appendChild(svg);
    list.forEach(function(a){
      var d = a.data || {};
      if (a.type === "arrow"){
        var line = document.createElementNS(svgNs, "line");
        line.setAttribute("x1", String(d.x * W)); line.setAttribute("y1", String(d.y * H));
        line.setAttribute("x2", String(d.x2 * W)); line.setAttribute("y2", String(d.y2 * H));
        line.setAttribute("stroke", "#ef4444"); line.setAttribute("stroke-width", "3");
        svg.appendChild(line);
        var head = document.createElementNS(svgNs, "circle");
        head.setAttribute("cx", String(d.x2 * W)); head.setAttribute("cy", String(d.y2 * H));
        head.setAttribute("r", "6"); head.setAttribute("fill", "#ef4444");
        svg.appendChild(head);
      }
      if (d.text){
        var note = document.createElement("div");
        note.textContent = d.text;
        note.style.cssText = "position:absolute;max-width:260px;transform:translate(-50%,-120%);"
          + "background:#ef4444;color:#fff;border-radius:10px;padding:6px 10px;"
          + "font:600 13px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
        note.style.left = (d.x * W) + "px";
        note.style.top = (d.y * H) + "px";
        layer.appendChild(note);
      }
    });
    document.body.appendChild(layer);
  }
  drawMarks();
  window.addEventListener("hashchange", drawMarks);
  }
})();`;
}
