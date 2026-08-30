export type Patch = {
  selector: string;
  kind: "text" | "image";
  value: string;
};

export const NAV_STUB_MESSAGE = "Раздел в разработке";

/** Runtime script embedded into every generated site. */
export function runtimeScript(patches: Patch[], navStub: boolean) {
  return `(function(){
  var P = ${JSON.stringify(patches)};
  var NAV = ${navStub ? "true" : "false"};
  function apply(){
    P.forEach(function(p){
      var els = [];
      try { els = Array.prototype.slice.call(document.querySelectorAll(p.selector)); } catch(e){}
      els.forEach(function(el){
        if (p.kind === "image") {
          if (el.tagName === "IMG") { if (el.getAttribute("src") !== p.value) el.setAttribute("src", p.value); }
          else { el.style.backgroundImage = "url(" + p.value + ")"; }
        } else if (el.textContent !== p.value) { el.textContent = p.value; }
      });
    });
  }
  function stub(){
    if (!NAV) return;
    document.addEventListener("click", function(e){
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      var external = /^(https?:|mailto:|tel:)/i.test(href);
      var anchor = href.charAt(0) === "#" && href.length > 1 && document.querySelector(href);
      if (external || anchor) return;
      e.preventDefault();
      toast();
    }, true);
  }
  function toast(){
    var t = document.createElement("div");
    t.textContent = ${JSON.stringify(NAV_STUB_MESSAGE)};
    t.setAttribute("style","position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 20px;border-radius:999px;font:500 14px/1.2 system-ui,sans-serif;z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .2s");
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.style.opacity = "1"; });
    setTimeout(function(){ t.style.opacity = "0"; setTimeout(function(){ t.remove(); }, 300); }, 1800);
  }
  function boot(){ apply(); stub(); var mo = new MutationObserver(function(){ apply(); }); mo.observe(document.documentElement,{childList:true,subtree:true}); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();`;
}

/** Script only used inside the in-app preview iframe: enables click-to-edit. */
export const EDITOR_SCRIPT = `(function(){
  function selectorFor(el){
    if (el.id) return "#" + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== "HTML"){
      var name = el.tagName.toLowerCase();
      var parent = el.parentElement;
      if (parent){
        var same = Array.prototype.filter.call(parent.children, function(c){ return c.tagName === el.tagName; });
        if (same.length > 1) name += ":nth-of-type(" + (same.indexOf(el) + 1) + ")";
      }
      parts.unshift(name);
      if (el.id){ parts[0] = "#" + CSS.escape(el.id); break; }
      el = parent;
    }
    return parts.join(" > ");
  }
  var style = document.createElement("style");
  style.textContent = "[data-px-hover]{outline:2px dashed #f59e0b !important;outline-offset:2px;cursor:pointer}";
  document.head.appendChild(style);
  var last = null;
  function editable(el){
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === "IMG") return el;
    if (el.children.length === 0 && (el.textContent || "").trim().length > 0) return el;
    return null;
  }
  document.addEventListener("mouseover", function(e){
    var el = editable(e.target);
    if (last && last !== el) last.removeAttribute("data-px-hover");
    if (el){ el.setAttribute("data-px-hover",""); last = el; }
  }, true);
  document.addEventListener("click", function(e){
    var el = editable(e.target);
    e.preventDefault(); e.stopPropagation();
    if (!el) return;
    parent.postMessage({
      source: "pixelift-editor",
      selector: selectorFor(el),
      kind: el.tagName === "IMG" ? "image" : "text",
      value: el.tagName === "IMG" ? el.getAttribute("src") : el.textContent
    }, "*");
  }, true);
})();`;
