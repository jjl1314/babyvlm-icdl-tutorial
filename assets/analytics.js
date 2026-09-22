/* ---------------------------------------------------------------------------
 * Private, cookie-free analytics for the BabyVLM tutorial site.
 *
 * Backend: GoatCounter (https://www.goatcounter.com) — no cookies, no
 * cross-site tracking, no persistent visitor IDs, dashboard private by default.
 *
 * Everything lives in this one file; the pages themselves only carry a single
 * <script defer> tag. Configuration is the CONFIG block immediately below.
 *
 * What is recorded
 *   pageviews                  automatic, one per page load
 *   slides-main-deck           opened ICDL Tutorial-2.pdf (header Slides button)
 *   slides-babyview-intro      opened the BabyView intro deck (schedule [slides])
 *   slides-<filename>          any other PDF, named automatically
 *   outbound-paper             clicked through to the project page
 *   outbound-github            clicked through to the code repository
 *   contact-email              clicked the footer address
 *   data-open-<section>        expanded a block in "Explore the data"
 *   engagement-scroll-50/90    reached that % of page height
 *
 * These count link *opens*, not confirmed downloads: static hosting exposes no
 * server logs, and the browser's PDF viewer cannot be observed from the page.
 *
 * Each event fires at most once per page load. Only hosts in COUNT_ONLY_ON are
 * counted, so localhost and preview proxies never reach the dashboard. Add
 * #analytics-debug to any URL to log events to the console instead.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  /* === CONFIG =============================================================
   * 1. Replace SITE_CODE with the GoatCounter code you registered, i.e. the
   *    "xxx" in https://xxx.goatcounter.com. Until you do, this file stays
   *    inert and logs a warning — it never sends anything anywhere.
   * ====================================================================== */
  var CONFIG = {
    SITE_CODE:    'babyvlm',
    // Only these hostnames are counted. Everything else -- localhost, the SCC
    // OnDemand proxy (scc-ondemand*.bu.edu/rnode/.../proxy/PORT), a fork's own
    // Pages site, someone's local checkout -- is ignored, so preview traffic can
    // never land in the real numbers. Add a hostname here if the site moves.
    COUNT_ONLY_ON: ['gong-bu-lab.github.io'],
    RESPECT_DNT:  true,       // honour Do Not Track / Global Privacy Control
    ALLOW_LOCAL:  false,      // true = count from anywhere, including previews
    SCROLL_DEPTH: [50, 90],   // % milestones to record; [] disables
    DEBUG:        false      // log every event to the console; also switched on
                             // per-visit by adding #analytics-debug to the URL
  };
  /* ====================================================================== */

  var DEBUG = CONFIG.DEBUG || (location.hash || '').indexOf('analytics-debug') > -1;
  var log = function (msg) {
    if (DEBUG && window.console && console.log) console.log('[analytics] ' + msg);
  };

  if (CONFIG.SITE_CODE === 'YOUR-GOATCOUNTER-CODE') {
    if (window.console && console.warn) {
      console.warn('[analytics] Not enabled: set CONFIG.SITE_CODE in assets/analytics.js.');
    }
    return;
  }

  // Preview environments must never reach the real dashboard: localhost, the SCC
  // OnDemand proxy, a fork's Pages site, a local checkout. Detection stays live
  // so #analytics-debug still shows what *would* be recorded -- only the
  // transport is switched off.
  var SENDING = true;

  if (!CONFIG.ALLOW_LOCAL && CONFIG.COUNT_ONLY_ON.length &&
      CONFIG.COUNT_ONLY_ON.indexOf(location.hostname) === -1) {
    SENDING = false;
    log('preview host "' + location.hostname + '" is not in COUNT_ONLY_ON, so nothing ' +
        'is sent. Events below show what would be recorded on the live site.');
  }

  // Honour browser-level opt-out signals.
  if (SENDING && CONFIG.RESPECT_DNT &&
      (navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
       navigator.msDoNotTrack === '1' || navigator.globalPrivacyControl === true)) {
    SENDING = false;
    log('disabled: this browser sends Do Not Track / Global Privacy Control');
  }

  // --- Event names ---------------------------------------------------------
  // Known files get stable, readable names so the dashboard stays legible when
  // filenames change. Anything unlisted falls back to a slug of its filename,
  // so a new deck is tracked automatically with no edit here.
  var DECKS = {
    'ICDL Tutorial-2.pdf':                       'slides-main-deck',
    'ICDL Tutorial.pdf':                         'slides-main-deck-v1',
    '2026-09-14 ICDL BabyView Tutorial[52].pdf': 'slides-babyview-intro'
  };

  var OUTBOUND = {
    'shawnking98.github.io': 'outbound-paper',
    'github.com':            'outbound-github'
  };

  var slug = function (s) {
    return s.toLowerCase()
            .replace(/\.[a-z0-9]+$/, '')      // drop extension
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
  };

  // --- Transport -----------------------------------------------------------
  // count.js is async, so events fired before it lands are queued, not lost.
  var queue = [], ready = false;

  var send = function (path, title) {
    if (!path) return;
    log('event  ' + path + '   (' + (title || '') + ')');
    if (!SENDING) return;
    if (ready && window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: path, title: title || path, event: true });
    } else if (queue.length < 50) {
      queue.push([path, title]);
    }
  };

  // Fire an event at most once per page load, so a double-click or a repeated
  // scroll past a milestone doesn't inflate the counts.
  var seen = {};
  var sendOnce = function (path, title) {
    if (seen[path]) return;
    seen[path] = true;
    send(path, title);
  };

  window.goatcounter = {
    endpoint:    'https://' + CONFIG.SITE_CODE + '.goatcounter.com/count',
    allow_local: CONFIG.ALLOW_LOCAL
  };

  if (!SENDING) {
    log('ready (preview mode -- no pageview recorded, no network request made)');
    bindListeners();
    return;
  }

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.onload = function () {
    ready = true;
    for (var i = 0; i < queue.length; i++) send(queue[i][0], queue[i][1]);
    queue = [];
  };
  // Blocked by an ad blocker or offline: drop the queue and stay silent.
  s.onerror = function () { queue = []; };
  document.head.appendChild(s);

  log('active for "' + CONFIG.SITE_CODE + '" on ' + location.hostname +
      '; this page load counts as ' + location.pathname);

  bindListeners();

  function bindListeners() {
  // --- Click tracking ------------------------------------------------------
  // One delegated listener, capture phase so it still runs if something else
  // stops propagation. Passive: it never calls preventDefault, so navigation
  // is untouched. sendBeacon inside count.js survives the page unloading.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href], [data-analytics-event]');
    if (!a) return;

    // Explicit override always wins, for anything the rules below can't infer.
    var override = a.getAttribute('data-analytics-event');
    if (override) {
      sendOnce(override, a.getAttribute('data-analytics-title') || a.textContent.trim());
      return;
    }

    var href = a.getAttribute('href');
    if (!href) return;

    if (href.indexOf('mailto:') === 0) {
      sendOnce('contact-email', 'Contact e-mail clicked');
      return;
    }

    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }

    // PDFs — the tutorial slide decks.
    if (/\.pdf$/i.test(url.pathname)) {
      var file = decodeURIComponent(url.pathname.split('/').pop());
      var name = DECKS[file] || ('slides-' + slug(file));
      var where = a.closest('section[id]');
      sendOnce(name, 'Slides opened: ' + file + (where ? ' (from #' + where.id + ')' : ' (from header)'));
      return;
    }

    // Anything leaving the site.
    if (url.origin !== location.origin && /^https?:$/.test(url.protocol)) {
      var host = url.hostname.replace(/^www\./, '');
      sendOnce(OUTBOUND[host] || ('outbound-' + slug(host)), 'Outbound: ' + url.hostname + url.pathname);
    }
  }, true);

  // --- Engagement: "Explore the data" sections -----------------------------
  // Fires when a collapsed <details> is opened, i.e. a deliberate expansion.
  // The Benchmark block ships open, so its initial state is not counted.
  var details = document.querySelectorAll('#data details');
  Array.prototype.forEach.call(details, function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var h = d.querySelector('summary h3');
      var label = h ? h.textContent.trim() : 'section';
      sendOnce('data-open-' + slug(label), 'Opened data section: ' + label);
    });
  });

  // --- Engagement: scroll depth -------------------------------------------
  if (CONFIG.SCROLL_DEPTH.length) {
    var ticking = false;
    var check = function () {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable < 400) return;  // too short for depth to mean anything
      var pct = ((window.scrollY || doc.scrollTop) / scrollable) * 100;
      CONFIG.SCROLL_DEPTH.forEach(function (mark) {
        if (pct >= mark) sendOnce('engagement-scroll-' + mark, 'Scrolled ' + mark + '% of the page');
      });
    };
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    }, { passive: true });
  }
  }
})();
