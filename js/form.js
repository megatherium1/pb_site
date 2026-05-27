/* =============================================================
   ProjBox marketing site — form.js
   - Reads ?code, ?access, ?invite query params (priority in that order)
   - Prefills the access-code input
   - Shows an "invited" note when a code is detected
   - Soft-gating only. NOT real security. The whitelist lives wherever
     the form provider (Tally) sends notifications, not in this code.
   - When TALLY_FORM_URL is set, redirects with the user's data so Tally
     can prefill its own fields.
   - When TALLY_FORM_URL is empty, shows a friendly inline message and a
     mailto: fallback so user data is never silently dropped.
   ============================================================= */

(function () {
  "use strict";

  // -----------------------------------------------------------
  // CONFIG — paste real values here when available.
  // -----------------------------------------------------------
  // Tally early-access form. Redirect sends name, email, university,
  // access_code, and source as query params for Tally field prefill.
  var TALLY_FORM_URL = "https://tally.so/r/QKOlbG";

  // Where Tally should send users after a successful submission.
  // (Configured in the Tally dashboard, not in this file. Listed here
  // for documentation only.)
  var DOWNLOAD_URL = "download.html";

  // Contact fallback used when TALLY_FORM_URL is empty.
  var SUPPORT_EMAIL = "matt@projbox.com";

  // Query param names we accept, in priority order.
  var PARAM_NAMES = ["code", "access", "invite"];

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function readAccessCodeFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < PARAM_NAMES.length; i++) {
        var v = params.get(PARAM_NAMES[i]);
        if (v && v.trim()) return v.trim();
      }
    } catch (err) { /* ignore */ }
    return "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // Build a mailto: URL prefilled with whatever the user entered so we
  // never silently drop their information when Tally is not configured.
  function buildMailto(values) {
    var subject = "ProjBox early access request";
    var lines = [
      "Name: "         + (values.name || ""),
      "Email: "        + (values.email || ""),
      "Organization: " + (values.organization || ""),
      "Access code: "  + (values.access_code || ""),
      "",
      "Message:",
      values.message || ""
    ];
    return "mailto:" + SUPPORT_EMAIL +
           "?subject=" + encodeURIComponent(subject) +
           "&body="    + encodeURIComponent(lines.join("\n"));
  }

  // -----------------------------------------------------------
  // Wire the access form
  // -----------------------------------------------------------
  function initAccessForm() {
    var form = document.querySelector("[data-access-form]");
    if (!form) return;

    var codeInput   = form.querySelector('[name="access_code"]');
    var nameInput   = form.querySelector('[name="name"]');
    var emailInput  = form.querySelector('[name="email"]');
    var orgInput    = form.querySelector('[name="organization"]');
    var msgInput    = form.querySelector('[name="message"]');
    var note        = document.querySelector("[data-access-note]");
    var status      = document.querySelector("[data-access-status]");

    // 1. Prefill from query params
    var detected = readAccessCodeFromUrl();
    if (detected && codeInput) {
      codeInput.value = detected;
      if (note) {
        note.innerHTML =
          'Access code detected: <code>' + escapeHtml(detected) + '</code>';
        note.classList.add("is-visible");
      }
    }

    // 2. Submit handling
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var values = {
        name:         nameInput  ? nameInput.value.trim()  : "",
        email:        emailInput ? emailInput.value.trim() : "",
        organization: orgInput   ? orgInput.value.trim()   : "",
        access_code:  codeInput  ? codeInput.value.trim()  : "",
        message:      msgInput   ? msgInput.value.trim()   : ""
      };

      // Minimal client-side guard — keep gentle, this is a marketing form.
      if (!values.email) {
        if (status) {
          status.innerHTML = "Please enter an email address so we can follow up.";
          status.classList.add("is-visible");
        }
        if (emailInput) emailInput.focus();
        return;
      }

      if (TALLY_FORM_URL) {
        // Real Tally URL is configured. Redirect with the user's
        // values as query params so Tally can prefill its hidden /
        // visible fields (configure matching field keys in Tally).
        try {
          var url = new URL(TALLY_FORM_URL);
          if (values.name)         url.searchParams.set("name", values.name);
          if (values.email)        url.searchParams.set("email", values.email);
          if (values.organization) url.searchParams.set("university", values.organization);
          if (values.access_code)  url.searchParams.set("access_code", values.access_code);
          url.searchParams.set("source", "projbox-home");
          window.location.href = url.toString();
        } catch (err) {
          // If the URL ever ends up malformed, fall through to the
          // mailto fallback rather than silently dropping the data.
          showMailtoFallback(values);
        }
        return;
      }

      // No Tally URL configured yet — never fake a submission.
      showMailtoFallback(values);
    });

    function showMailtoFallback(values) {
      if (!status) return;
      var href = buildMailto(values);
      status.innerHTML =
        '<strong>Early access form integration is being finalized.</strong> ' +
        'For now, please email <a href="' + href + '">' + escapeHtml(SUPPORT_EMAIL) + '</a> ' +
        'and we will get back to you. ' +
        '(Clicking the link will open your email client with your details prefilled.)';
      status.classList.add("is-visible");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccessForm);
  } else {
    initAccessForm();
  }
})();
