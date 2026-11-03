import { handleResubscribe } from "@/modules/newsletter";

export function POST(request: Request): Promise<Response> {
  return handleResubscribe(request);
}
