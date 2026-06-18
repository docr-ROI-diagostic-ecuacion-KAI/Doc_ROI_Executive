(function () {
  var COLLECTOR_URL = "https://script.google.com/macros/s/AKfycbzioIpdbYIpKpdRxYkeRM_w51NGvjArWjISvhxKZeBzdRackyKIImJ_Wp4p9Niojkw6rw/exec";
  var APP_NAME = "executive";

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  }

  function safeStorage(storage, key, fallback) {
    try {
      var current = storage.getItem(key);
      if (current) return current;
      storage.setItem(key, fallback);
      return fallback;
    } catch (error) {
      return fallback;
    }
  }

  var browserId = safeStorage(localStorage, "docroi_browser_id", uid("browser"));
  var sessionId = safeStorage(sessionStorage, "docroi_session_id", uid("session"));
  var visitId = uid("visit");
  var maxScroll = 0;
  var activeSeconds = 0;

  function getUtm() {
    var params = new URLSearchParams(location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      campaign_keyword: params.get("campaign_keyword") || params.get("keyword") || ""
    };
  }

  function keywordId(keyword) {
    return "KW_" + String(keyword || "SIN_KEYWORD")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  }

  function baseEvent(eventType) {
    var now = new Date().toISOString();
    return Object.assign({
      event_id: uid("evt"),
      timestamp: now,
      event_date: now.slice(0, 10),
      app_name: APP_NAME,
      event_type: eventType,
      browser_id: browserId,
      session_id: sessionId,
      visit_id: visitId,
      page_url: location.href,
      page_path: location.pathname,
      page_title: document.title,
      referrer: document.referrer || "",
      keyword: "Executive",
      keyword_id: "KW_EXECUTIVE",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen_width: window.screen ? window.screen.width : "",
      screen_height: window.screen ? window.screen.height : "",
      active_seconds: activeSeconds,
      total_active_seconds: activeSeconds,
      depth_percent: maxScroll
    }, getUtm());
  }

  function post(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "text/plain;charset=utf-8" });
        navigator.sendBeacon(COLLECTOR_URL, blob);
        return;
      }
    } catch (error) {}

    try {
      fetch(COLLECTOR_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body,
        keepalive: true
      });
    } catch (error) {}
  }

  function sendEvent(event) {
    post({ type: "analytics_event", event: event });
  }

  function scoreLead(kind, data) {
    var score = 35;
    if (data.priority_contact === "on") score += 30;
    if (kind === "team") score += 15;
    if (kind === "trainerTraining") score += 10;
    if (data.phone) score += 5;
    if (data.desired_calendar || data.approximate_date_or_urgency) score += 10;
    if (Number(data.approx_people_to_train || 0) > 10) score += 10;
    return Math.min(score, 100);
  }

  function contactName(data) {
    return data.trainer_full_name || data.team_full_name || data.trainer_training_full_name || data.full_name || "";
  }

  function role(data) {
    return data.trainer_role || data.team_role || data.trainer_training_role || "";
  }

  function company(data) {
    return data.company || data.institution_or_company || data.organization || "";
  }

  function needSummary(data) {
    return [
      data.discipline_subject_module,
      data.program_master_course,
      data.main_need,
      data.interest_format,
      data.topic_to_land,
      data.support_type,
      data.target_audience
    ].filter(Boolean).join(" | ");
  }

  var modelByKind = {
    trainers: "BM_FORMADOR",
    team: "BM_INCOMPANY",
    trainerTraining: "BM_FORMADOR_FORMADORES"
  };

  var formTypeByKind = {
    trainers: "trainers",
    team: "in_company",
    trainerTraining: "train_the_trainers"
  };

  function sendLead(form) {
    var kind = form.dataset.formKind || "unknown";
    var data = Object.fromEntries(new FormData(form).entries());
    var now = new Date().toISOString();
    var lead = Object.assign({
      submission_id: uid("lead"),
      timestamp: now,
      event_date: now.slice(0, 10),
      source_app: APP_NAME,
      form_id: form.id || kind,
      form_type: formTypeByKind[kind] || kind,
      business_model_id: modelByKind[kind] || "BM_FORMACION",
      stage_id: data.priority_contact === "on" ? "WARM" : "COLD",
      lead_status: "new",
      urgency_id: data.priority_contact === "on" ? "HIGH" : "MEDIUM",
      urgent: data.priority_contact === "on",
      priority: data.priority_contact === "on" ? "alta" : "media",
      lead_score: scoreLead(kind, data),
      browser_id: browserId,
      session_id: sessionId,
      visit_id: visitId,
      contact_name: contactName(data),
      role: role(data),
      company: company(data),
      email: data.email || "",
      phone: data.phone || "",
      demand_summary: needSummary(data),
      need_summary: needSummary(data),
      expected_date: data.desired_calendar || data.approximate_date_or_urgency || "",
      recommended_next_action: data.priority_contact === "on" ? "Contacto prioritario" : "Cualificar lead",
      landing_page: location.href,
      current_page_path: location.pathname,
      previous_keywords: ["Executive", formTypeByKind[kind] || kind],
      consent_privacy_checked: data.legal_notice_acceptance === "on",
      notes: JSON.stringify({ form_kind: kind, raw: data })
    }, getUtm());

    post({ type: "crm_lead", lead: lead });

    var event = baseEvent("form_submit_success");
    event.keyword = "Executive";
    event.keyword_id = "KW_EXECUTIVE";
    event.form_id = lead.form_id;
    event.form_type = lead.form_type;
    event.lead_score = lead.lead_score;
    sendEvent(event);
  }

  function trackClick(target) {
    var text = String(target.textContent || "").trim();
    var keyword = "Executive";
    var event = baseEvent("cta_click");
    event.keyword = keyword;
    event.keyword_id = keywordId(keyword);
    event.button_text = text.slice(0, 180);
    event.button_id = target.dataset.openForm || target.dataset.target || target.id || "executive_cta";
    event.section_id = target.dataset.openForm || target.dataset.target || "executive";
    if (target.href) {
      event.destination_url = target.href;
      event.destination_domain = new URL(target.href, location.href).hostname;
      event.destination_type = event.destination_domain === location.hostname ? "internal" : "external";
    }
    sendEvent(event);
  }

  function updateScrollDepth() {
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop || 0;
    var height = Math.max(1, doc.scrollHeight - window.innerHeight);
    maxScroll = Math.max(maxScroll, Math.round((scrollTop / height) * 100));
  }

  setInterval(function () { activeSeconds += 5; }, 5000);
  window.addEventListener("scroll", updateScrollDepth, { passive: true });
  window.addEventListener("beforeunload", function () {
    var event = baseEvent("session_summary");
    event.depth_percent = maxScroll;
    event.active_seconds = activeSeconds;
    event.total_active_seconds = activeSeconds;
    sendEvent(event);
  });

  document.addEventListener("submit", function (event) {
    var form = event.target.closest && event.target.closest("form[data-form-kind]");
    if (form) sendLead(form);
  }, true);

  document.addEventListener("click", function (event) {
    var target = event.target.closest && event.target.closest("[data-open-form], [data-target], a[href], button");
    if (target) trackClick(target);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      sendEvent(baseEvent("page_view"));
    });
  } else {
    sendEvent(baseEvent("page_view"));
  }
})();