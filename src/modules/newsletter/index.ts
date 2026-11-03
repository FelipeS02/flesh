// SERVER crossing point into the newsletter module.
export { handleKeepAlive } from "./api/keep-alive";
export { createMailerFromEnvironment, MAX_BATCH_SIZE } from "./api/mailer";
export type { Mailer, MailMessage, MailResult } from "./api/mailer";
export { subscribeToNewsletter } from "./api/subscribe.action";
export { requestRestockNotice } from "./api/restock.action";
export type { RestockOutcome, SubscribeOutcome } from "./api/newsletter.service";
export { handleResubscribe, handleUnsubscribe } from "./api/token-routes";
