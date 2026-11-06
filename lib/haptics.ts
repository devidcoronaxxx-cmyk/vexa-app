

"use client";

export function initHaptics() {
  if (typeof document === "undefined") return;

  if (!document.getElementById("__hx_input")) {
    const s = document.createElement("input");
    s.type = "checkbox";
    s.id = "__hx_input";
    s.setAttribute("switch", "");
    s.style.cssText = "position:fixed;top:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(s);

    const l = document.createElement("label");
    l.htmlFor = "__hx_input";
    l.id = "__hx_label";
    l.style.cssText = "position:fixed;top:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(l);
  }
}

export function triggerErrorHaptic() {
  if (typeof window === "undefined") return;

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  } else {
    const hapticLabel = document.getElementById("__hx_label");
    if (hapticLabel) {
      hapticLabel.click();
      setTimeout(() => hapticLabel.click(), 150);
    }
  }
}
