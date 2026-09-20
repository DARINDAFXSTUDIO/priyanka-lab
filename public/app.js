const $ = (s) => document.querySelector(s);
const photo = $("#photo"), logo = $("#logo"), go = $("#go"), preview = $("#previewBox");
const fileName = $("#fileName"), state = $("#state"), progress = $("#progress"), bar = $("#bar");
const result = $("#result");
let pFile, lFile, last = [];
const VARIANTS = ["hero","detail","aesthetic","editorial"];

function step(name, status) {
  const el = document.querySelector(`[data-step="${name}"]`);
  if (!el) return;
  el.classList.remove("active","done");
  el.classList.add(status);
  el.querySelector("i").textContent = status === "done" ? "✓" : status === "active" ? "●" : "○";
}
function pct(n) {
  bar.style.width = `${n}%`;
  $("#progressPercent").textContent = `${n}%`;
}
function makeForm() {
  const fd = new FormData();
  fd.append("photo", pFile);
  if (lFile) fd.append("logo", lFile);
  return fd;
}
async function jsonFetch(url, options) {
  const r = await fetch(url, options);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Server request failed.");
  return d;
}

photo.onchange = () => {
  pFile = photo.files[0];
  if (!pFile) return;
  fileName.textContent = pFile.name;
  preview.innerHTML = `<img src="${URL.createObjectURL(pFile)}">`;
  state.textContent = "Selected";
  go.disabled = false;
};
logo.onchange = () => { lFile = logo.files[0]; };

function step(name, status) {
  const el = document.querySelector(`[data-step="${name}"]`);
  if (!el) return;
  el.classList.remove("active","done");
  el.classList.add(status);
  el.querySelector("i").textContent = status === "done" ? "✓" : status === "active" ? "●" : "○";
}
function pct(n) { bar.style.width = `${n}%`; $("#progressPercent").textContent = `${n}%`; }

function makeForm() {
  const fd = new FormData();
  fd.append("photo", pFile);
  if (lFile) fd.append("logo", lFile);
  return fd;
}

async function jsonFetch(url, options) {
  const r = await fetch(url, options);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Server request failed.");
  return d;
}

go.onclick = async () => {
  go.disabled = true;
  progress.classList.remove("hidden");
  result.classList.add("hidden");
  ["analysis","quality","hero","detail","aesthetic","editorial","logo","copy"].forEach(x => step(x,""));
  last = [];
  try {
    step("analysis","active"); pct(5);
    const d = await jsonFetch(`${localStorage.getItem(SERVER_KEY)}/api/analyze`, {method:"POST", body:makeForm()});
    step("analysis","done"); step("quality","done"); pct(15);

    if (d.quality === "BAD") {
      throw new Error("This photo is too unclear to preserve the actual work. Please upload a clearer photo.");
    }

    const box = $("#images");
    box.innerHTML = "";

    for (let i=0; i<VARIANTS.length; i++) {
      const name = VARIANTS[i];
      step(name,"active");
      pct(20 + i*18);
      const x = await jsonFetch(`${localStorage.getItem(SERVER_KEY)}/api/generate/${name}`, {method:"POST", body:makeForm()});
      last.push(x);
      const c = document.createElement("div");
      c.className = "imageCard";
      c.innerHTML = `<img src="${x.data}" alt="${x.label}"><p>${x.label}</p>`;
      box.appendChild(c);
      step(name,"done");
      if (i === VARIANTS.length-1) { step("logo","done"); pct(92); }
    }

    step("copy","active");
    $("#title").textContent = d.title || "Beauty Work";
    $("#caption").textContent = d.caption || "";
    $("#hashtags").textContent = (d.hashtags || []).join(" ");
    step("copy","done"); pct(100);

    result.classList.remove("hidden");
    result.scrollIntoView({behavior:"smooth"});
  } catch (e) {
    alert(e.message);
  } finally {
    progress.classList.add("hidden");
    go.disabled = !pFile;
  }
};

document.querySelectorAll(".copy").forEach(b => b.onclick = async () => {
  await navigator.clipboard.writeText($("#"+b.dataset.id).textContent);
  b.textContent = "Copied ✓";
  setTimeout(() => b.textContent = b.dataset.id === "caption" ? "Copy Caption" : "Copy Hashtags", 1200);
});

$("#download").onclick = () => {
  last.forEach(x => {
    const a = document.createElement("a");
    a.href = x.data;
    a.download = `priyanka-lab-${x.name}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  });
};
