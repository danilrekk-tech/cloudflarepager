/** Script embedded into deployed sites so clients can send remarks back to the dashboard. */
export const FEEDBACK_ENDPOINT =
  "https://project--e9f1d004-3641-485c-92ac-12618269d7f3.lovable.app/api/public/feedback";

export function feedbackWidgetScript(token: string, endpoint: string = FEEDBACK_ENDPOINT) {
  return `(function(){
  var TOKEN = ${JSON.stringify(token)};
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var picking = false, target = null;
  var css = document.createElement("style");
  css.textContent = "#pxfb-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;background:#111827;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.3)}"
   + "#pxfb-box{position:fixed;right:20px;bottom:76px;z-index:2147483000;width:300px;background:#fff;color:#111827;border-radius:14px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);font:400 14px/1.4 system-ui,sans-serif;display:none}"
   + "#pxfb-box textarea{width:100%;min-height:80px;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;resize:vertical}"
   + "#pxfb-box input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px;font:inherit;margin-bottom:8px}"
   + "#pxfb-box button{margin-top:8px;border:0;border-radius:8px;padding:9px 14px;font:600 13px system-ui;cursor:pointer}"
   + "#pxfb-send{background:#2563eb;color:#fff}#pxfb-pick{background:#f3f4f6;color:#111827;margin-right:6px}"
   + ".pxfb-target{outline:3px solid #f59e0b !important;outline-offset:2px}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "pxfb-btn"; btn.textContent = "Оставить замечание";
  var box = document.createElement("div");
  box.id = "pxfb-box";
  box.innerHTML = '<input id="pxfb-name" placeholder="Ваше имя (необязательно)">'
    + '<textarea id="pxfb-msg" placeholder="Что нужно изменить?"></textarea>'
    + '<div id="pxfb-sel" style="font:400 11px/1.3 monospace;color:#6b7280;margin-top:6px;word-break:break-all"></div>'
    + '<button id="pxfb-pick">Указать элемент</button><button id="pxfb-send">Отправить</button>';
  document.body.appendChild(btn); document.body.appendChild(box);

  function sel(el){
    if (!el) return "";
    if (el.id) return "#" + el.id;
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== "HTML"){
      var n = el.tagName.toLowerCase(), p = el.parentElement;
      if (p){ var same = Array.prototype.filter.call(p.children, function(c){ return c.tagName === el.tagName; });
        if (same.length > 1) n += ":nth-of-type(" + (same.indexOf(el)+1) + ")"; }
      parts.unshift(n); el = p;
    }
    return parts.join(" > ");
  }
  var pos = { x: 0, y: 0 }, selector = "", label = "";
  btn.onclick = function(){ box.style.display = box.style.display === "block" ? "none" : "block"; };
  box.querySelector("#pxfb-pick").onclick = function(){ picking = true; box.style.display = "none"; };
  document.addEventListener("click", function(e){
    if (!picking) return;
    e.preventDefault(); e.stopPropagation();
    picking = false;
    if (target) target.classList.remove("pxfb-target");
    target = e.target; target.classList.add("pxfb-target");
    selector = sel(target);
    label = (target.textContent || target.getAttribute("alt") || target.tagName).trim().slice(0, 80);
    pos = { x: e.clientX / Math.max(1, window.innerWidth), y: (e.clientY + window.scrollY) / Math.max(1, document.body.scrollHeight) };
    box.querySelector("#pxfb-sel").textContent = selector;
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
        selector: selector, label: label,
        page: location.href, x: pos.x, y: pos.y,
        kind: target && target.tagName === "IMG" ? "image" : selector ? "element" : "note"
      })
    }).then(function(){
      box.querySelector("#pxfb-msg").value = "";
      box.querySelector("#pxfb-sel").textContent = "";
      if (target) target.classList.remove("pxfb-target");
      target = null; selector = ""; label = "";
      box.style.display = "none";
      btn.textContent = "Спасибо! Отправлено";
      setTimeout(function(){ btn.textContent = "Оставить замечание"; }, 2500);
    }).catch(function(){ btn.textContent = "Ошибка отправки"; });
  };
})();`;
}
