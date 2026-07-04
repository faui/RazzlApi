(function () {
  var CHAT_ICON_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    "</svg>";

  function resolveButtonVariant(themeStyle, apiStyleMode) {
    if (apiStyleMode === "link") {
      return "link";
    }
    if (apiStyleMode === "badge") {
      return "badge";
    }
    if (apiStyleMode === "button") {
      return themeStyle === "outline" ? "outline" : "solid";
    }
    return themeStyle === "outline" ? "outline" : "solid";
  }

  function getVisitorId() {
    var key = "razzl_visitor_id";
    try {
      var existing = sessionStorage.getItem(key);
      if (existing) {
        return existing;
      }
      var id = "rv_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return null;
    }
  }

  function trackLaunchClick(apiBase, shop, productId) {
    var payload = {
      shop: shop,
      productId: productId,
      anonymousVisitorId: getVisitorId()
    };
    var body = JSON.stringify(payload);
    var trackUrl = apiBase + "/api/commerce/launch-events";

    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(trackUrl, blob);
      return;
    }

    fetch(trackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {
      /* fail silently — navigation must not be blocked */
    });
  }

  function createChatIcon() {
    var span = document.createElement("span");
    span.className = "razzl-btn-icon";
    span.innerHTML = CHAT_ICON_SVG;
    return span;
  }

  function buildCtaButton(root, data) {
    var themeStyle = root.dataset.buttonStyle || "solid";
    var variant = resolveButtonVariant(themeStyle, data.styleMode);
    var label = (data.label || root.dataset.buttonText || "Setup Copilot").trim();
    var bg = root.dataset.bg || "#0A0A0A";
    var text = root.dataset.text || "#FFFFFF";
    var border = root.dataset.border || bg;
    var radius = root.dataset.radius || "8";

    var wrapper = document.createElement("div");
    wrapper.className = "razzl-setup-wrapper";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "razzl-setup-btn razzl-setup-btn--" + variant;
    button.setAttribute("aria-label", label);
    button.style.setProperty("--razzl-bg", bg);
    button.style.setProperty("--razzl-text", text);
    button.style.setProperty("--razzl-border", border);
    button.style.setProperty("--razzl-radius", radius + "px");

    if (variant !== "link") {
      button.appendChild(createChatIcon());
    }

    var labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    button.appendChild(labelSpan);

    button.addEventListener("click", function () {
      trackLaunchClick(
        (root.dataset.apiBase || "https://api.razzl.com").replace(/\/$/, ""),
        root.dataset.shop,
        root.dataset.productId
      );
      if (data.openMode === "new_tab") {
        window.open(data.launchUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(data.launchUrl);
      }
    });

    wrapper.appendChild(button);

    if (data.showPoweredByRazzl) {
      var powered = document.createElement("p");
      powered.className = "razzl-powered-by";
      powered.innerHTML = 'Powered by <strong>Razzl</strong>';
      wrapper.appendChild(powered);
    }

    return wrapper;
  }

  function init(root) {
    if (!root || root.dataset.razzlInitialized === "1") {
      return;
    }
    root.dataset.razzlInitialized = "1";

    var shop = root.dataset.shop;
    var productId = root.dataset.productId;
    var apiBase = (root.dataset.apiBase || "https://api.razzl.com").replace(/\/$/, "");

    if (!shop || !productId) {
      return;
    }

    var url =
      apiBase +
      "/api/commerce/cta/resolve?shop=" +
      encodeURIComponent(shop) +
      "&productId=" +
      encodeURIComponent(productId);

    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.visible || !data.launchUrl) {
          return;
        }

        root.appendChild(buildCtaButton(root, data));
      })
      .catch(function () {
        /* fail closed */
      });
  }

  function boot() {
    document.querySelectorAll("[data-razzl-setup-help]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
