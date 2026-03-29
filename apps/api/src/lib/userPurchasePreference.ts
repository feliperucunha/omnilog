import { prisma } from "./prisma.js";

/** When a log is saved with a purchase amount, remember the currency for the next spend input. */
export async function persistUserDefaultPurchaseCurrency(
  userId: string,
  purchaseAmountMinor: number | null,
  purchaseCurrency: string | null
): Promise<void> {
  if (purchaseAmountMinor == null || purchaseCurrency == null || purchaseCurrency === "") return;
  const cur = purchaseCurrency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { defaultPurchaseCurrency: cur },
    });
  } catch (e) {
    console.error("persistUserDefaultPurchaseCurrency:", e);
  }
}
