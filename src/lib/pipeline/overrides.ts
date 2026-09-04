export type Patch =
  | { kind: "text"; selector: string; value: string }
  | { kind: "image"; selector: string; value: string }
  | { kind: "link"; selector: string; value: string; newTab?: boolean }
  | { kind: "logo"; selector: string; value: string; width: number; x: number; y: number }
  | {
      kind: "size";
      selector: string;
      value: string;
      width?: string;
      height?: string;
      fit?: string;
    };

export type PatchSet = {
  id: string;
  name: string;
  createdAt: string;
  patches: Patch[];
};

export type Slot = {
  selector: string;
  kind: "text" | "image" | "link";
  label: string;
  value: string;
  width: number;
  height: number;
  natural?: { w: number; h: number } | undefined;
  broken?: boolean | undefined;
};

export const NAV_STUB_MESSAGE = "Раздел в разработке";

export function patchKey(p: Patch) {
  return `${p.kind}::${p.selector}`;
}

export function upsertPatch(patches: Patch[], next: Patch) {
  return [...patches.filter((p) => patchKey(p) !== patchKey(next)), next];
}

/** Runtime script embedded into every generated site. */
export function runtimeScript(patches: Patch[], navStub: boolean) {
  return `(function(){
  var P = ${JSON.stringify(patches)};
  var NAV = ${navStub ? "true" : "false"};
  function q(sel){ try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch(e){ return []; } }
  function apply(){
    P.forEach(function(p){
      q(p.selector).forEach(function(el){
        if (p.kind === "image") {
          if (el.tagName === "IMG") { if (el.getAttribute("src") !== p.value) el.setAttribute("src", p.value); }
          else if (el.tagName === "svg" || el.querySelector && el.querySelector("svg")) {
            if (!el.hasAttribute("data-px-img")) {
              var img = document.createElement("img");
              img.src = p.value; img.style.cssText = "max-width:100%;max-height:100%;display:block";
              el.innerHTML = ""; el.appendChild(img); el.setAttribute("data-px-img","");
            }
          }
          else { el.style.backgroundImage = "url(" + p.value + ")"; el.style.backgroundSize = el.style.backgroundSize || "cover"; el.style.backgroundPosition = "center"; }
        } else if (p.kind === "text") {
          if (el.textContent !== p.value) el.textContent = p.value;
        } else if (p.kind === "link") {
          if (el.getAttribute("data-px-link") === p.value) return;
          el.setAttribute("data-px-link", p.value);
          el.style.cursor = "pointer";
          el.addEventListener("click", function(ev){
            ev.preventDefault(); ev.stopPropagation();
            if (!p.value) { toast(); return; }
            if (p.newTab) window.open(p.value, "_blank", "noopener"); else window.location.href = p.value;
          });
        } else if (p.kind === "size") {
          if (p.width) { el.style.width = p.width; el.style.maxWidth = "100%"; }
          if (p.height) el.style.height = p.height;
          if (p.fit) { el.style.objectFit = p.fit; el.style.backgroundSize = p.fit === "contain" ? "contain" : "cover"; }
        } else if (p.kind === "logo") {
          var id = "pxlogo-" + btoa(unescape(encodeURIComponent(p.selector + p.x + p.y))).replace(/[^a-z0-9]/gi,"");
          if (document.getElementById(id)) return;
          var cs = getComputedStyle(el);
          if (cs.position === "static") el.style.position = "relative";
          var l = document.createElement("img");
          l.id = id; l.src = p.value;
          l.style.cssText = "position:absolute;left:" + p.x + "%;top:" + p.y + "%;width:" + p.width + "px;transform:translate(-50%,-50%);z-index:50;pointer-events:none";
          el.appendChild(l);
        }
      });
    });
  }
  function stub(){
    if (!NAV) return;
    document.addEventListener("click", function(e){
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      if (a.hasAttribute("data-px-link")) return;
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

/**
 * Script only used inside the in-app preview iframe: click-to-edit, slot
 * inventory (including broken/empty image placeholders) and logo placement.
 */
export const EDITOR_SCRIPT = `(function(){
  var MODE = "select"; // select | logo
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
  var IMGHINT = /(logo|icon|image|img|photo|picture|avatar|thumb|hero|banner|cover|bg|background|media|illustration)/i;
  function isImageish(el){
    if (el.tagName === "IMG" || el.tagName === "PICTURE" || el.tagName === "svg") return true;
    if (el.tagName === "DIV" || el.tagName === "SPAN" || el.tagName === "FIGURE" || el.tagName === "I" || el.tagName === "A"){
      var cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
      var cls = (el.getAttribute("class") || "") + " " + (el.getAttribute("data-icon") || "");
      if (IMGHINT.test(cls) && el.children.length <= 1 && (el.textContent||"").trim().length < 24) return true;
    }
    return false;
  }
  function isClickable(el){
    if (el.tagName === "A" || el.tagName === "BUTTON") return true;
    var role = el.getAttribute("role");
    if (role === "button" || role === "link" || role === "tab") return true;
    if (el.hasAttribute("onclick") || el.hasAttribute("data-href")) return true;
    var cls = el.getAttribute("class") || "";
    return /(card|tile|item|tab|btn|button|nav|menu)/i.test(cls) && el.getBoundingClientRect().height > 40;
  }
  function editable(el){
    if (!el || el.nodeType !== 1) return null;
    var node = el;
    while (node && node.nodeType === 1 && node.tagName !== "BODY"){
      if (isImageish(node)) return node;
      if (node.children.length === 0 && (node.textContent || "").trim().length > 0) return node;
      if (isClickable(node)) return node;
      node = node.parentElement;
    }
    return null;
  }
  function kindOf(el){ return isImageish(el) ? "image" : (el.children.length === 0 && (el.textContent||"").trim() ? "text" : "link"); }
  function valueOf(el, kind){
    if (kind === "image") {
      if (el.tagName === "IMG") return el.getAttribute("src") || "";
      var bg = getComputedStyle(el).backgroundImage;
      var m = bg && bg.match(/url\\(["']?(.*?)["']?\\)/);
      return m ? m[1] : "";
    }
    if (kind === "link") return el.getAttribute("href") || "";
    return el.textContent || "";
  }
  function describe(el){
    var kind = kindOf(el);
    var r = el.getBoundingClientRect();
    var natural = el.tagName === "IMG" && el.naturalWidth ? { w: el.naturalWidth, h: el.naturalHeight } : null;
    var broken = el.tagName === "IMG" && (!el.complete || el.naturalWidth === 0);
    var label = kind === "text"
      ? (el.textContent || "").trim().slice(0, 40)
      : (el.getAttribute("alt") || el.getAttribute("aria-label") || el.getAttribute("class") || el.tagName).toString().slice(0, 40);
    return {
      selector: selectorFor(el), kind: kind, label: label || el.tagName.toLowerCase(),
      value: valueOf(el, kind), width: Math.round(r.width), height: Math.round(r.height),
      natural: natural, broken: broken
    };
  }
  function inventory(){
    var out = [], seen = {};
    var all = document.querySelectorAll("img, picture, svg, a, button, [role=button], [role=tab], div, span, i, figure, h1, h2, h3, h4, p, li");
    Array.prototype.forEach.call(all, function(el){
      var ok = isImageish(el) || isClickable(el) || (el.children.length === 0 && (el.textContent||"").trim().length > 1);
      if (!ok) return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0 && el.tagName !== "IMG") return;
      var d = describe(el);
      if (seen[d.kind + d.selector]) return;
      seen[d.kind + d.selector] = 1;
      out.push(d);
      });
    parent.postMessage({ source: "pixelift-editor", type: "inventory", items: out.slice(0, 400) }, "*");
  }
  var style = document.createElement("style");
  style.textContent = "[data-px-hover]{outline:2px dashed #f59e0b !important;outline-offset:2px;cursor:pointer}[data-px-active]{outline:2px solid #22d3ee !important;outline-offset:2px}";
  document.head.appendChild(style);
  var last = null;
  document.addEventListener("mouseover", function(e){
    var el = MODE === "logo" ? e.target : editable(e.target);
    if (last && last !== el) last.removeAttribute("data-px-hover");
    if (el && el.setAttribute){ el.setAttribute("data-px-hover",""); last = el; }
  }, true);
  document.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    if (MODE === "logo"){
      var host = e.target.nodeType === 1 ? e.target : document.body;
      var rect = host.getBoundingClientRect();
      parent.postMessage({ source: "pixelift-editor", type: "logo-drop",
        selector: selectorFor(host),
        x: Math.round(((e.clientX - rect.left) / Math.max(rect.width,1)) * 1000) / 10,
        y: Math.round(((e.clientY - rect.top) / Math.max(rect.height,1)) * 1000) / 10 }, "*");
      MODE = "select";
      return;
    }
    var el = editable(e.target);
    if (!el) return;
    document.querySelectorAll("[data-px-active]").forEach(function(n){ n.removeAttribute("data-px-active"); });
    el.setAttribute("data-px-active","");
    parent.postMessage(Object.assign({ source: "pixelift-editor", type: "select" }, describe(el)), "*");
  }, true);
  window.addEventListener("message", function(e){
    var d = e.data || {};
    if (d.source !== "pixelift-host") return;
    if (d.type === "mode") MODE = d.mode;
    if (d.type === "inventory") inventory();
    if (d.type === "highlight"){
      document.querySelectorAll("[data-px-active]").forEach(function(n){ n.removeAttribute("data-px-active"); });
      var t = null; try { t = document.querySelector(d.selector); } catch(err){}
      if (t){ t.setAttribute("data-px-active",""); t.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
  });
  setTimeout(inventory, 400);
})();`;
