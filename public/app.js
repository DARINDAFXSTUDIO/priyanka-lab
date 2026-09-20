const $ = (s) => document.querySelector(s);

const photo = $("#photo");
const logo = $("#logo");
const go = $("#go");
const preview = $("#previewBox");

const fileName = $("#fileName");
const state = $("#state");
const progress = $("#progress");
const bar = $("#bar");
const result = $("#result");

const connectCard = $("#connectCard");
const apiKey = $("#apiKey");
const connectBtn = $("#connectBtn");
const connectStatus = $("#connectStatus");
const connectionDot = $("#connectionDot");
const disconnectBtn = $("#disconnectBtn");

let pFile = null;
let lFile = null;
let last = [];

let sessionToken =
  sessionStorage.getItem("priyanka_lab_session") || "";

const VARIANTS = [
  "hero",
  "detail",
  "aesthetic",
  "editorial"
];

/* =========================================================
   CONNECTION UI
========================================================= */

function setConnected(connected) {
  connectionDot.classList.toggle(
    "connected",
    connected
  );

  connectStatus.textContent = connected
    ? "AI CONNECTED"
    : "AI NOT CONNECTED";

  connectCard.classList.toggle(
    "connectedCard",
    connected
  );

  connectBtn.textContent = connected
    ? "AI Connected ✓"
    : "Verify & Connect";

  connectBtn.disabled = connected;
  apiKey.disabled = connected;

  disconnectBtn.classList.toggle(
    "hidden",
    !connected
  );

  go.disabled = !pFile || !connected;
}

/* =========================================================
   PROCESSING STEPS
========================================================= */

function step(name, status) {
  const el = document.querySelector(
    `[data-step="${name}"]`
  );

  if (!el) return;

  el.classList.remove("active", "done");

  if (status) {
    el.classList.add(status);
  }

  const icon = el.querySelector("i");

  if (!icon) return;

  if (status === "done") {
    icon.textContent = "✓";
  } else if (status === "active") {
    icon.textContent = "●";
  } else {
    icon.textContent = "○";
  }
}

function pct(n) {
  bar.style.width = `${n}%`;

  const percent = $("#progressPercent");

  if (percent) {
    percent.textContent = `${n}%`;
  }
}

/* =========================================================
   FORM DATA
========================================================= */

/*
  IMPORTANT:

  /api/analyze accepts ONLY:
      photo

  /api/generate/:variant accepts:
      photo
      logo

  Therefore we keep two separate FormData builders.
*/

function makePhotoForm() {
  const fd = new FormData();

  if (!pFile) {
    throw new Error("Please select a photo first.");
  }

  fd.append("photo", pFile);

  return fd;
}

function makeGenerationForm() {
  const fd = new FormData();

  if (!pFile) {
    throw new Error("Please select a photo first.");
  }

  fd.append("photo", pFile);

  if (lFile) {
    fd.append("logo", lFile);
  }

  return fd;
}

/* =========================================================
   API REQUEST HELPER
========================================================= */

async function jsonFetch(url, options = {}) {
  const headers = new Headers(
    options.headers || {}
  );

  if (sessionToken) {
    headers.set(
      "X-Priyanka-Session",
      sessionToken
    );
  }

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkError) {
    throw new Error(
      "Could not connect to PRIYANKA LAB server. Please try again."
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  let data = {};

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => "");
    data = {
      error: text || "Server returned an unexpected response."
    };
  }

  if (response.status === 401) {
    sessionToken = "";

    sessionStorage.removeItem(
      "priyanka_lab_session"
    );

    setConnected(false);

    throw new Error(
      data.error ||
      "Your AI connection expired. Please reconnect your OpenAI API key."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Server request failed (${response.status}).`
    );
  }

  return data;
}

/* =========================================================
   VERIFY EXISTING SESSION
========================================================= */

async function verifySavedSession() {
  if (!sessionToken) {
    setConnected(false);
    return;
  }

  try {
    const response = await fetch(
      "/api/auth/status",
      {
        headers: {
          "X-Priyanka-Session": sessionToken
        }
      }
    );

    if (!response.ok) {
      throw new Error();
    }

    const data = await response.json();

    if (!data.connected) {
      throw new Error();
    }

    setConnected(true);
  } catch {
    sessionToken = "";

    sessionStorage.removeItem(
      "priyanka_lab_session"
    );

    setConnected(false);
  }
}

/* =========================================================
   CONNECT OPENAI
========================================================= */

connectBtn.onclick = async () => {
  if (sessionToken) {
    return;
  }

  const key = apiKey.value.trim();

  if (!key) {
    alert(
      "Paste your OpenAI API key first."
    );
    return;
  }

  connectBtn.disabled = true;
  connectStatus.textContent = "VERIFYING…";

  try {
    const data = await jsonFetch(
      "/api/auth/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: key
        })
      }
    );

    sessionToken = data.session;

    sessionStorage.setItem(
      "priyanka_lab_session",
      sessionToken
    );

    /*
      Do not keep the actual API key in the browser.
      Clear the input immediately.
    */
    apiKey.value = "";

    setConnected(true);

  } catch (error) {
    setConnected(false);

    alert(
      error.message ||
      "Could not connect your OpenAI account."
    );
  }
};

/* =========================================================
   DISCONNECT
========================================================= */

disconnectBtn.onclick = async () => {
  try {
    await jsonFetch(
      "/api/auth/disconnect",
      {
        method: "POST"
      }
    );
  } catch {
    // Even if server disconnect fails,
    // remove the local session.
  }

  sessionToken = "";

  sessionStorage.removeItem(
    "priyanka_lab_session"
  );

  setConnected(false);

  apiKey.value = "";
};

/* =========================================================
   PHOTO SELECTION
========================================================= */

photo.onchange = () => {
  pFile = photo.files[0];

  if (!pFile) {
    return;
  }

  fileName.textContent = pFile.name;

  state.textContent = "Selected";

  const imageURL =
    URL.createObjectURL(pFile);

  preview.innerHTML = `
    <img
      src="${imageURL}"
      alt="Selected beauty work"
    >
  `;

  go.disabled = !sessionToken;
};

/* =========================================================
   LOGO SELECTION
========================================================= */

logo.onchange = () => {
  lFile = logo.files[0] || null;
};

/* =========================================================
   MAIN GENERATION FLOW
========================================================= */

go.onclick = async () => {
  if (!sessionToken) {
    alert(
      "Connect your OpenAI API key first."
    );
    return;
  }

  if (!pFile) {
    alert(
      "Please upload your Mehndi or Nail photo first."
    );
    return;
  }

  go.disabled = true;

  progress.classList.remove("hidden");
  result.classList.add("hidden");

  [
    "analysis",
    "quality",
    "hero",
    "detail",
    "aesthetic",
    "editorial",
    "logo",
    "copy"
  ].forEach((name) => {
    step(name, "");
  });

  last = [];

  try {

    /* =====================================================
       STEP 1 — ANALYZE PHOTO

       IMPORTANT:
       Only photo is sent here.

       Logo is NOT sent to /api/analyze.
    ===================================================== */

    step("analysis", "active");
    pct(5);

    const analysisForm =
      makePhotoForm();

    const analysis =
      await jsonFetch(
        "/api/analyze",
        {
          method: "POST",
          body: analysisForm
        }
      );

    step("analysis", "done");

    /* =====================================================
       QUALITY CHECK
    ===================================================== */

    step("quality", "active");
    pct(15);

    if (
      analysis.quality === "BAD"
    ) {
      step("quality", "done");

      throw new Error(
        "This photo is too unclear to preserve the actual work. Please upload a clearer photo."
      );
    }

    step("quality", "done");

    /* =====================================================
       PREPARE RESULT AREA
    ===================================================== */

    const imagesBox = $("#images");

    if (imagesBox) {
      imagesBox.innerHTML = "";
    }

    /* =====================================================
       GENERATE 4 VARIANTS

       Photo + optional logo are sent here.
    ===================================================== */

    for (
      let i = 0;
      i < VARIANTS.length;
      i++
    ) {

      const variant =
        VARIANTS[i];

      step(
        variant,
        "active"
      );

      pct(
        20 + i * 18
      );

      const generationForm =
        makeGenerationForm();

      const generated =
        await jsonFetch(
          `/api/generate/${variant}`,
          {
            method: "POST",
            body: generationForm
          }
        );

      last.push(generated);

      if (imagesBox) {
        const card =
          document.createElement("div");

        card.className =
          "imageCard";

        card.innerHTML = `
          <img
            src="${generated.data}"
            alt="${generated.label}"
          >
          <p>${generated.label}</p>
        `;

        imagesBox.appendChild(card);
      }

      step(
        variant,
        "done"
      );

      if (
        i ===
        VARIANTS.length - 1
      ) {
        step(
          "logo",
          "done"
        );

        pct(92);
      }
    }

    /* =====================================================
       TITLE / CAPTION / HASHTAGS
    ===================================================== */

    step("copy", "active");

    const title =
      $("#title");

    const caption =
      $("#caption");

    const hashtags =
      $("#hashtags");

    if (title) {
      title.textContent =
        analysis.title ||
        "Beauty Work";
    }

    if (caption) {
      caption.textContent =
        analysis.caption || "";
    }

    if (hashtags) {
      hashtags.textContent =
        Array.isArray(
          analysis.hashtags
        )
          ? analysis.hashtags.join(" ")
          : "";
    }

    step("copy", "done");

    pct(100);

    result.classList.remove(
      "hidden"
    );

    result.scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {

    console.error(
      "PRIYANKA LAB generation error:",
      error
    );

    alert(
      error.message ||
      "Server request failed."
    );

  } finally {

    progress.classList.add(
      "hidden"
    );

    go.disabled =
      !pFile ||
      !sessionToken;
  }
};

/* =========================================================
   COPY BUTTONS
========================================================= */

document
  .querySelectorAll(".copy")
  .forEach((button) => {

    button.onclick = async () => {

      const target =
        $("#" + button.dataset.id);

      if (!target) {
        return;
      }

      try {

        await navigator.clipboard.writeText(
          target.textContent
        );

        button.textContent =
          "Copied ✓";

        setTimeout(() => {

          button.textContent =
            button.dataset.id ===
            "caption"
              ? "Copy Caption"
              : "Copy Hashtags";

        }, 1200);

      } catch {
        alert(
          "Could not copy. Please select the text manually."
        );
      }
    };

  });

/* =========================================================
   DOWNLOAD GENERATED IMAGES
========================================================= */

$("#download").onclick = () => {

  if (!last.length) {
    alert(
      "There are no generated images to download."
    );
    return;
  }

  last.forEach((item) => {

    const a =
      document.createElement("a");

    a.href = item.data;

    a.download =
      `priyanka-lab-${item.name}.png`;

    document.body.appendChild(a);

    a.click();

    a.remove();

  });
};

/* =========================================================
   INITIAL SESSION CHECK
========================================================= */

verifySavedSession();
