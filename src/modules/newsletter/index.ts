// SERVER crossing point into the newsletter module.
export { handleKeepAlive } from "./api/keep-alive";
export { createMailerFromEnvironment, MAX_BATCH_SIZE } from "./api/mailer";
export type { Mailer, MailMessage, MailResult } from "./api/mailer";
