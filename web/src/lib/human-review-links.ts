/** Honest link-outs for sources Offerly does not scan automatically. */
export type HumanReviewLink = { id: string; label: string; href: string; note: string };

export function humanReviewLinks(roles: string[], location = "New Jersey"): HumanReviewLink[] {
  const query = roles.slice(0, 6).join(" OR ") || "Product Manager OR Operations Manager OR Program Manager";
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(location);
  const google = (site: string, extra = "") => `https://www.google.com/search?q=${encodeURIComponent(`site:${site} (${query}) ${location} ${extra}`)}`;
  return [
    { id: "indeed", label: "Indeed", href: `https://www.indeed.com/jobs?q=${q}&l=${l}`, note: "Opens Indeed; you review results." },
    { id: "linkedin", label: "LinkedIn Jobs", href: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}`, note: "Opens LinkedIn; you review results." },
    { id: "glassdoor", label: "Glassdoor", href: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}`, note: "Opens Glassdoor; you review results." },
    { id: "facebook", label: "Facebook groups", href: `https://www.facebook.com/search/groups/?q=${q}`, note: "Facebook Jobs is discontinued; search relevant groups manually." },
    { id: "nj-courts", label: "NJ Courts", href: google("njcourts.gov", "jobs"), note: "Opens a targeted web search; you review results." },
    { id: "morris", label: "Morris County", href: google("morriscountynj.gov", "jobs"), note: "Opens a targeted web search; you review results." },
    { id: "townships", label: "Township roles", href: google("governmentjobs.com", "Jefferson Mount Olive Westampton Mansfield"), note: "Opens a targeted web search; you review results." },
  ];
}
