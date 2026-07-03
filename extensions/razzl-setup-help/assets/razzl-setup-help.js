(function () {
  function styleClass(mode) {
    switch (mode) {
      case "link":
        return "razzl-setup-help__link";
      case "badge":
        return "razzl-setup-help__badge";
      case "button":
        return "razzl-setup-help__button";
      default:
        return "razzl-setup-help__inherit button button--secondary";
    }
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

        var link = document.createElement("a");
        link.href = data.launchUrl;
        link.textContent = data.label || "Setup help";
        link.className = styleClass(data.styleMode || "inherit_theme");
        link.setAttribute("aria-label", data.label || "Setup help");

        if (data.openMode === "new_tab") {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }

        link.addEventListener("click", function (event) {
          event.preventDefault();
          trackLaunchClick(apiBase, shop, productId);
          if (data.openMode === "new_tab") {
            window.open(data.launchUrl, "_blank", "noopener,noreferrer");
          } else {
            window.location.assign(data.launchUrl);
          }
        });

        root.appendChild(link);

        if (data.showPoweredByRazzl) {
          var powered = document.createElement("div");
          powered.className = "razzl-setup-help__powered";
          powered.textContent = "Powered by Razzl";
          root.appendChild(powered);
        }
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
