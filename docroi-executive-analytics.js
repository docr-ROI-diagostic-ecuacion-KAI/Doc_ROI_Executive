(function () {
  const analyticsBaseUrl = window.DocROIAnalyticsBaseUrl || "https://bsc-doc-roi-61qn.vercel.app";
  const leadEndpoint = `${analyticsBaseUrl}/api/form-submit`;

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
      utm_term: params.get("utm_term") || "",
      campaign_keyword: params.get("campaign_keyword") || params.get("keyword") || ""
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

  const formTypeByKind = {
    trainers: "trainers",
    team: "in_company",
    trainerTraining: "train_the_trainers"
  };

  function scoreLead(kind, data) {
    let score = 35;
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
    return [data.discipline_subject_module, data.program_master_course, data.main_need, data.interest_format, data.topic_to_land, data.support_type, data.target_audience].filter(Boolean).join(" | ");
  }

  function selectedKeywords() {
    try {
      const queue = JSON.parse(localStorage.getItem("docroi_analytics_queue") || "[]");
      return [...new Set(queue.map((event) => event.keyword || event.button_keyword || event.content_keyword).filter(Boolean))].slice(0, 20);
    } catch { return []; }
  }

  async function sendLead(form) {
    const kind = form.dataset.formKind || "unknown";
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      source_app: "executive",
      source_site: "Executive",
      form_id: form.id || kind,
      form_type: formTypeByKind[kind] || kind,
      business_model_id: modelByKind[kind] || "BM_FORMACION",
      stage_id: data.priority_contact === "on" ? "WARM" : "COLD",
      urgency_id: data.priority_contact === "on" ? "HIGH" : "MEDIUM",
      urgent: data.priority_contact === "on",
      contact_name: contactName(data),
      nombre_apellidos: contactName(data),
      company: company(data),
      institucion_empresa: company(data),
      email: data.email || "",
      phone: data.phone || "",
      telefono: data.phone || "",
      role: role(data),
      cargo: role(data),
      demand_summary: needSummary(data),
      need_summary: needSummary(data),
      expected_date: data.desired_calendar || data.approximate_date_or_urgency || "",
      next_action: data.priority_contact === "on" ? "Contacto prioritario" : "Cualificar lead",
      lead_score: String(scoreLead(kind, data)),
      browser_id: storage("docroi_analytics_browser_id"),
      session_id: storage("docroi_analytics_session_id"),
      visit_id: storage("docroi_analytics_visit_id"),
      consent: data.legal_notice_acceptance === "on" ? "Si" : "No",
      privacidad_aceptada: data.legal_notice_acceptance === "on",
      previous_keywords: selectedKeywords(),
      landing_page: location.href,
      current_page_path: location.pathname,
      page_url: location.href,
      notes: JSON.stringify({ form_kind: kind, raw: data }),
      ...getUtm()
    };

    if (window.DocROITrack) {
      window.DocROITrack("form_submit_success", { keyword: "Executive", keyword_id: "KW_EXECUTIVE", area: kind, form_type: payload.form_type });
    }

    try {
      await fetch(leadEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
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
    window.DocROITrack("cta_click", {
      keyword: "Executive",
      keyword_id: "KW_EXECUTIVE",
      area: button.dataset.openForm || button.dataset.target || "executive",
      link_text: (button.textContent || "").trim().slice(0, 180)
    });
  });
})();
