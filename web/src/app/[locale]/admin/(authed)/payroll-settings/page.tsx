import { getPrisma } from "@/server/db/prisma";
import { requireAdmin } from "@/server/auth/requireAdmin";
import PayrollSettingsForm from "./ui/PayrollSettingsForm";
export default async function Page() {
  await requireAdmin();
  const rows = await getPrisma().appSetting.findMany({ where: { key: { in: ["payroll.employerName", "payroll.employerTaxId", "payroll.employerAddress"] } } });
  const map = new Map(rows.map(row => [row.key, row.value]));
  return <PayrollSettingsForm initial={{ employerName: map.get("payroll.employerName") || "", employerTaxId: map.get("payroll.employerTaxId") || "", employerAddress: map.get("payroll.employerAddress") || "" }} />;
}
