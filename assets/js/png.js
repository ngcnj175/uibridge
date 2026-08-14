// UIBridge — PNG export of the preview pane using html2canvas (CDN, loaded on
// demand so the first page load stays lean).

const CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

let loaderPromise = null;
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CDN;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error("html2canvas の読み込みに失敗しました"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initPng() {
  const btn = document.getElementById("png-save");

  btn.addEventListener("click", async () => {
    const target = document.getElementById("preview");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "書き出し中…";
    try {
      const html2canvas = await loadHtml2Canvas();
      // Resolve --bg-color at capture time so the exported PNG matches
      // the preview even though the CSS var lives on <html>.
      const bg = getComputedStyle(target).backgroundColor
        || getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim()
        || "#ffffff";

      const canvas = await html2canvas(target, {
        backgroundColor: bg,
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });

      const filename = `uibridge_${timestamp()}.png`;
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) download(blob, filename);
          else fallbackDataUrl(canvas, filename);
        }, "image/png");
      } else {
        fallbackDataUrl(canvas, filename);
      }
    } catch (err) {
      alert(err.message || "PNG保存に失敗しました");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

function fallbackDataUrl(canvas, filename) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
