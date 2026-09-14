import type { BuyerProfilePort, BuyerProfileSummary } from "./port";
import { readBuyerProfile } from "./buyer-profile.action";

type ReadBuyerProfileAction = () => Promise<BuyerProfileSummary>;

export function createBuyerProfilePort(action: ReadBuyerProfileAction = readBuyerProfile): BuyerProfilePort {
  return { readSummary: () => action() };
}
