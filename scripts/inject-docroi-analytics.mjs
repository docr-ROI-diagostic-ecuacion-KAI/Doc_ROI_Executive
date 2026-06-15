import { readFileSync, writeFileSync } from "node:fs";

const file = "index.html";
const analyticsBaseUrl = process.env.DOCROI_ANALYTICS_BASE_URL || "https://bsc-doc-roi-61qn.vercel.app";
const html = readFileSync(file, "utf8");

const start = "<!-- DOCROI_ANALYTICS_START -->";
const end = "<!-- DOCROI_ANALYTICS_END -->";

const snippet = `${start}
<script>
  window.DocROIAnalyticsBaseUrl = "${analyticsBaseUrl}";
  window.DocROIAnalytics = {
    sourceSite: "Executive",
    endpoint: "${analyticsBaseUrl}/api/collect"
  };
</script>
<script src="${analyticsBaseUrl}/tracker.js" defer></script>
<script src="./docroi-executive-analytics.js" defer></script>
${end}`;

const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
const next = pattern.test(html) ? html.replace(pattern, snippet) : html.replace("</body>", `${snippet}\n</body>`);

if (next === html) {
  console.log("Doc ROI Executive analytics snippet already up to date.");
} else {
  writeFileSync(file, next, "utf8");
  console.log("Doc ROI Executive analytics snippet injected.");
}
