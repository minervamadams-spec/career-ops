export type WizardCompany = { name: string; careersUrl: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Save wizard companies without treating a rejected request as success. */
export async function saveWizardCompanies(companies: WizardCompany[], request: FetchLike = fetch) {
  const saved: WizardCompany[] = [];
  const failed: WizardCompany[] = [];

  for (const company of companies) {
    try {
      const response = await request("/api/portals/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: company.name, careersUrl: company.careersUrl }),
      });
      if (response.ok) saved.push(company);
      else failed.push(company);
    } catch {
      failed.push(company);
    }
  }

  return { saved, failed };
}
