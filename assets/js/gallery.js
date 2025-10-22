/* global window, document, navigator */

/* =======================
   Helpers & Constants
   ======================= */
const BASE = "https://gallery.projectpartyproductions.com";
const API_REAL = {
  send: "https://cp.projectpartyproductions.com/sendlink.php",
};

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

let LB_INDEX = 0;
let LB_CURRENT = { url:null, type:null };

/* Normalize any src to an absolute URL on the gallery domain */
function toAbsolute(src){
  try {
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    src = src.replace(/^\.\.?\//g, "");
    if (!src.startsWith("/")) src = "/" + src;
    return BASE.replace(/\/$/, "") + src;
  } catch { return src; }
}

/* Toast */
function toast(msg){
  const t = $(".toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 1800);
}

/* Small utils */
function downloadFile(url){
  const a = document.createElement("a");
  a.href = url; a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function shareFile(url){
  if (navigator.share) navigator.share({ url });
  else { navigator.clipboard.writeText(url); toast("Link copied"); }
}
async function api(url, method="GET", data){
  const opt = { method, headers: { "Content-Type":"application/json" } };
  if (method !== "GET" && data) opt.body = JSON.stringify(data);
  const q = (method === "GET" && data) ? ("?" + new URLSearchParams(data)) : "";
  const r = await fetch(url + q, opt);
  let json = {}; try { json = await r.json(); } catch {}
  return { ok:r.ok, json };
}

/* =======================
   Grid
   ======================= */
function buildTile(item){
  const url = toAbsolute(item.src);
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.src = url;
  tile.dataset.type = item.type;

  let media;
  if (item.type === "img"){
    media = document.createElement("img");
    media.setAttribute("data-src", url);
    media.alt = "";
  } else {
    media = document.createElement("video");
    media.setAttribute("preload","metadata");
    media.setAttribute("data-src", url);
    media.playsInline = true;
    media.muted = true;
    media.controls = false;
  }
  tile.appendChild(media);

  const actions = document.createElement("div");
  actions.className = "overlay-actions";
  actions.innerHTML = `
    <button class="act-dl"  title="Download">⬇</button>
    <button class="act-share" title="Share">↗</button>`;
  tile.appendChild(actions);

  actions.querySelector(".act-dl").addEventListener("click", (e)=>{ e.stopPropagation(); openDownloadModal(url); });
  actions.querySelector(".act-share").addEventListener("click", (e)=>{ e.stopPropagation(); shareFile(url); });
  tile.addEventListener("click", ()=> openLightbox(url, item.type));

  return tile;
}
function buildGrid(){
  const g = $("#gallery");
  if (!g || !window.GAL || !Array.isArray(window.GAL.items)) return;
  g.innerHTML = "";
  for (const it of window.GAL.items) g.appendChild(buildTile(it));
  console.log(`✅ Gallery built: ${window.GAL.items.length} items`);
}

/* =======================
   Download Flow (two-step)
   ======================= */
let pendingDownloadURL = null;

function openDownloadModal(url){
  pendingDownloadURL = toAbsolute(url);
  // reset radios each open
  const sizeHigh = $('#dl-size-high');
  const destDevice = $('#dl-dest-device');
  if (sizeHigh) sizeHigh.checked = true;
  if (destDevice) destDevice.checked = true;

  $(".dl-modal")?.style.setProperty("display","flex");
}
function closeDownloadModal(){
  $(".dl-modal")?.style.setProperty("display","none");
}
function openEmailModal(){
  $("#dl2-email") && ($("#dl2-email").value = "");
  $(".dl-email-modal")?.style.setProperty("display","flex");
}
function closeEmailModal(){
  $(".dl-email-modal")?.style.setProperty("display","none");
}

$("#dl-cancel")?.addEventListener("click", closeDownloadModal);
$("#dl-go")?.addEventListener("click", async ()=>{
  const size = $('input[name="dl-size"]:checked')?.value || "high";
  const dest = $('input[name="dl-dest"]:checked')?.value || "device";
  const url  = pendingDownloadURL;
  if (!url) return;

  if (dest === "device"){
    // direct download
    if (!/iPhone|iPad|Android/i.test(navigator.userAgent)) downloadFile(url);
    else {
      // iOS/Android hint
      window.open(url, "_blank");
      alert("A new window will open.\nLong-press the photo to save.");
    }
    closeDownloadModal();
    return;
  }

  // email flow: go to step 2 modal
  closeDownloadModal();
  openEmailModal();

  // ensure one-time handler
  const btn = $("#dl2-go");
  const handler = async () => {
    const email = $("#dl2-email")?.value.trim() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Enter a valid email"); return; }
    const { ok } = await api(API_REAL.send, "POST", { email, link:url, category:window.GAL?.slug || "", size });
    toast(ok ? "Email sent with download link" : "Email failed");
    closeEmailModal();
  };
  btn?.removeEventListener("click", handler); // harmless (no-op first time)
  btn?.addEventListener("click", handler, { once:true });
});
$("#dl2-cancel")?.addEventListener("click", closeEmailModal);

/* =======================
   Lightbox
   ======================= */
function openLightbox(url, type){
  const lb = $(".lb"); if (!lb) return;
  lb.classList.add("open");
  renderLB(url, type);
  const arr = $$(".tile");
  LB_INDEX = Math.max(0, arr.findIndex(t => t.dataset.src === toAbsolute(url)));
}
function renderLB(url, type){
  url = toAbsolute(url);
  LB_CURRENT = { url, type };

  const img = $("#lb-img");
  const vid = $("#lb-vid"); if (!img || !vid) return;

  img.style.display = "none";
  vid.style.display = "none";
  vid.pause();

  if (type === "img"){
    img.src = url;
    img.style.display = "block";
  } else {
    vid.src = url;
    vid.style.display = "block";
    vid.controls = true;
    vid.removeAttribute("muted");
    vid.playsInline = true;
    vid.setAttribute("playsinline", "true");
    vid.setAttribute("webkit-playsinline", "true");
    vid.currentTime = 0;
    /* NEW: ensure media pipeline resets and click-to-play is reliable */
    vid.load();                        // <-- add this
    // (optional) tap-to-toggle fallback:
    vid.onclick = () => { if (vid.paused) vid.play().catch(()=>{}); else vid.pause(); };
    // do not autoplay; allow user to press play; but ensure play() works when clicked
    // no-op here; clicking play will work with the properties set above
  }
}
function closeLightbox(){
  const lb = $(".lb"); if (!lb) return;
  lb.classList.remove("open");
  const vid = $("#lb-vid"); if (vid && !vid.paused) vid.pause();
}

/* Lightbox controls */
$("#lb-close")?.addEventListener("click", (e)=>{
  e.preventDefault();
  e.stopPropagation();
  closeLightbox();
});
$("#lb-prev") ?.addEventListener("click", ()=> navLB(-1));
$("#lb-next") ?.addEventListener("click", ()=> navLB(+1));
$("#lb-dl")   ?.addEventListener("click", ()=>{ if (LB_CURRENT.url) openDownloadModal(LB_CURRENT.url); });
$("#lb-share")?.addEventListener("click", ()=>{ if (LB_CURRENT.url) shareFile(LB_CURRENT.url); });

/* Close by clicking overlay (but not when clicking inner/top/nav) */
const lbEl = $(".lb");
if (lbEl){
  const overlayClose = (e) => {
    if (!e.target.closest(".lb-inner") && !e.target.closest(".lb-top") && !e.target.closest(".lb-nav")) closeLightbox();
  };
  lbEl.addEventListener("click", overlayClose);
  lbEl.addEventListener("touchend", overlayClose, { passive:true });
  $(".lb-inner")?.addEventListener("click", (e)=> e.stopPropagation());
  $(".lb-top")?.addEventListener("click", (e)=> e.stopPropagation());
  $(".lb-nav")?.addEventListener("click", (e)=> e.stopPropagation());
}

function navLB(step){
  const arr = $$(".tile");
  if (!arr.length) return;
  LB_INDEX = (LB_INDEX + step + arr.length) % arr.length;
  const n = arr[LB_INDEX];
  renderLB(n.dataset.src, n.dataset.type);
}

/* ESC closes any modal + lightbox */
document.addEventListener("keydown", (e)=>{
  if (e.key !== "Escape") return;
  closeDownloadModal();
  closeEmailModal();
  closeLightbox();
});

/* Boot */
(function boot(){
  const tryInit = () => {
    if (window.GAL && Array.isArray(window.GAL.items)){
      if (!document.body.dataset.galleryBuilt){
        document.body.dataset.galleryBuilt = "1";
        // normalize to absolute once
        window.GAL.items = window.GAL.items.map(it => ({ ...it, src: toAbsolute(it.src) }));
        buildGrid();
      }
    } else { setTimeout(tryInit, 60); }
  };
  (document.readyState === "loading")
    ? document.addEventListener("DOMContentLoaded", tryInit)
    : tryInit();
})();



// Safety: ensure close button always works, even if listener lost
window.addEventListener("load", () => {
  const btn = document.getElementById("lb-close");
  if (btn && !btn.hasAttribute("data-fixed")) {
    btn.setAttribute("data-fixed", "1");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelector(".lb")?.classList.remove("open");
      const vid = document.getElementById("lb-vid");
      if (vid && !vid.paused) vid.pause();
    });
  }
});
