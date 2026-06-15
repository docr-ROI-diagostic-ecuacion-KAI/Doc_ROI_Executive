(function () {
  const analyticsBaseUrl = window.DocROIAnalyticsBaseUrl || "https://bsc-doc-roi.vercel.app";
  const leadEndpoint = `${analyticsBaseUrl}/api/lead`;

  function storage(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key) || ""; }
    catch { return ""; }
  }

  function getUtm() {
    const params = new URLSearchParams(location.search);
    const fromUrl = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || ""
    };
    if (Object.values(fromUrl).some(Boolean)) return fromUrl;
    try { return JSON.parse(localStorage.getItem("docroi_analytics_utm") || "{}"); }
    catch { return fromUrl; }
  }

  const modelByKind = {
    trainers: "BM_FORMADOR",
    team: "BM_INCOMPANY",
    trainerTraining: "BM_FORMADOR_FORMADORES"
  };

  function scoreLead(kind, data) {
    let score = 35;
    if (data.priority_contact === "on") score += 25;
    if (kind === "team") score += 15;
    if (kind === "trainerTraining") score += 10;
    if (data.phone) score += 8;
    if (data.desired_calendar || data.approximate_date_or_urgency) score += 7;
    return Math.min(score, 100);
  }

  function urgency(data) {
    return data.priority_contact === "on" ? "HIGH" : "MEDIUM";
  }

  function contactName(kind, data) {
    return data.trainer_full_name || data.team_full_name || data.trainer_training_full_name || data.full_name || "";
  }

  function role(kind, data) {
    return data.trainer_role || data.team_role || data.trainer_training_role || "";
  }

  function company(data) {
    return data.company || data.institution_or_company || data.organization || "";
  }

  function needSummary(kind, data) {
    const parts = [
      data.discipline_subject_module,
      data.program_master_course,
      data.main_need,
      data.interest_format,
      data.topic_to_land,
      data.support_type,
      data.target_audience
    ].filter(Boolean);
    return parts.join(" | ");
  }

  async function sendLead(form) {
    const kind = form.dataset.formKind || "unknown";
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      source_site: "Executive",
      business_model_id: modelByKind[kind] || "BM_FORMACION",
      stage_id: data.priority_contact === "on" ? "WARM" : "COLD",
      urgency_id: urgency(data),
      contact_name: contactName(kind, data),
      company: company(data),
      email: data.email || "",
      phone: data.phone || "",
      role: role(kind, data),
      need_summary: needSummary(kind, data),
      expected_date: data.desired_calendar || data.approximate_date_or_urgency || "",
      next_action: data.priority_contact === "on" ? "Contacto prioritario" : "Cualificar lead",
      lead_score: String(scoreLead(kind, data)),
      browser_id: storage("docroi_analytics_browser_id"),
      session_id: storage("docroi_analytics_session_id"),
      consent: data.legal_notice_acceptance === "on" ? "Si" : "No",
      notes: JSON.stringify({ form_kind: kind, raw: data }),
      ...getUtm()
    };

    if (window.DocROITrack) {
      window.DocROITrack("form_submit", { keyword: "Executive", keyword_id: "KW_EXECUTIVE", area: kind });
    }

    try {
      await fetch(leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (error) {
      console.warn("Doc ROI lead bridge could not send lead", error);
    }
  }

  document.addEventListener("submit", function (event) {
    const form = event.target.closest("form[data-form-kind]");
    if (!form) return;
    sendLead(form);
  }, true);

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-open-form], [data-target], a[href]");
    if (!button || !window.DocROITrack) return;
    const keyword = button.matches("[data-open-form]") ? "Executive" : "Executive";
    window.DocROITrack("cta_click", {
      keyword,
      keyword_id: "KW_EXECUTIVE",
      area: button.dataset.openForm || button.dataset.target || "executive",
      link_text: (button.textContent || "").trim().slice(0, 180)
    });
  });
})();
