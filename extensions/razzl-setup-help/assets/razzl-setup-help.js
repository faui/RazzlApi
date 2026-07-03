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
