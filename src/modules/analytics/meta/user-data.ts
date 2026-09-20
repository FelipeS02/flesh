import "server-only";
import { createHash } from "node:crypto";

type Buyer = { firstName: string; lastName: string; email: string };

export type MetaUserData = {
  em: [string];
  fn: [string];
  ln: [string];
  fbc?: string;
  fbp?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

type UserDataInput = {
  buyer: Buyer;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

/**
 * Meta normalises before hashing on their side as well, so this has to agree
 * with them exactly: a stray space or a capital letter produces a different
 * digest, and a digest they cannot match is a conversion nobody gets credit
 * for. The pinned vectors in the test exist to make a change here fail loudly.
 */
function hashed(value: string): [string] {
  return [
    createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest("hex"),
  ];
}

/**
 * Assembles Meta's `user_data`, with every personal field hashed and only the
 * identifiers Meta expects in the clear left as they are.
 *
 * Absent identifiers are omitted rather than sent empty: a blank field counts
 * against match quality instead of being ignored.
 *
 * This module is the boundary. Nothing downstream of it should ever see a raw
 * name or email, which is why the test asserts over the whole serialised
 * payload rather than field by field.
 */
export function buildUserData(input: UserDataInput): MetaUserData {
  const userData: MetaUserData = {
    em: hashed(input.buyer.email),
    fn: hashed(input.buyer.firstName),
    ln: hashed(input.buyer.lastName),
  };

  if (input.fbc) userData.fbc = input.fbc;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  return userData;
}
