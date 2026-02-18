"use server";

import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";

const DEFAULT_EMAIL_FROM_PLACEHOLDER = "noreply@example.com";
let email_from_override: string | undefined;

export function setEmailFromAddress(value?: string) {
	email_from_override = value?.trim() || undefined;
}

function getFromAddress(): string {
	const from = email_from_override ?? env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM_PLACEHOLDER;
	const normalized = from.trim();

	if (!normalized || normalized.toLowerCase() === DEFAULT_EMAIL_FROM_PLACEHOLDER) {
		throw new Error(
			"EMAIL_FROM is not configured. Set EMAIL_FROM in your environment bindings or pass createLytxApp({ env: { EMAIL_FROM: \"noreply@yourdomain.com\" } }).",
		);
	}

	return normalized;
}

interface SendEmailOptions {
	from: string;
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	bcc?: string | string[];
	cc?: string | string[];
	reply_to?: string | string[];
	headers?: Record<string, string>;
	tags?: Array<{ name: string; value: string }>;
}

function normalizeRecipients(value: string | string[]): string[] {
	return Array.isArray(value) ? value : [value];
}

function redactRecipient(value: string): string {
	const [local, domain] = value.split("@");
	if (!domain) return "invalid-recipient";
	const local_prefix = local?.slice(0, 2) ?? "";
	return `${local_prefix}***@${domain}`;
}

function logEmailDebug(event: string, details: Record<string, unknown>) {
	if (!IS_DEV) return;
	console.log("[email][dev]", event, details);
}

async function sendEmail(options: SendEmailOptions) {
	logEmailDebug("attempt", {
		from: options.from,
		to: normalizeRecipients(options.to).map(redactRecipient),
		subject: options.subject,
		hasResendApiKey: Boolean(env.RESEND_API_KEY),
	});

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(options),
	});

	if (!response.ok) {
		const error = await response.text();
		logEmailDebug("failed", {
			status: response.status,
			error,
		});
		throw new Error(`Resend API error: ${response.status} - ${error}`);
	}

	const data = await response.json();
	logEmailDebug("sent", {
		status: response.status,
		response: data,
	});

	return data;
}

interface EmailTemplateOptions {
	title: string;
	message: string;
	buttonLabel: string;
	buttonUrl: string;
	footerNote: string;
}

function buildEmailTemplate({
	title,
	message,
	buttonLabel,
	buttonUrl,
	footerNote,
}: EmailTemplateOptions) {
	return `
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>${title}</title>
				<style>
					@media only screen and (max-width: 600px) {
						.email-card {
							border-radius: 10px !important;
						}
						.email-pad {
							padding-left: 20px !important;
							padding-right: 20px !important;
						}
						.email-title {
							font-size: 22px !important;
						}
						.email-body {
							font-size: 16px !important;
						}
						.email-button {
							font-size: 15px !important;
							padding: 12px 18px !important;
						}
						.email-footnote {
							font-size: 13px !important;
						}
					}
				</style>
			</head>
			<body style="margin:0;padding:0;background-color:#3c3c3c;">
				<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#3c3c3c;">
					<tr>
						<td align="center" style="padding:32px 16px;">
							<table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width:560px;width:100%;background-color:#484743;border:1px solid #575353;border-radius:12px;overflow:hidden;">
								<tr>
									<td class="email-pad" style="padding:20px 28px 0 28px;">
										<div style="font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#d1d5db;">LYTX</div>
									</td>
								</tr>
								<tr>
									<td class="email-pad" style="padding:8px 28px 8px 28px;">
										<h1 class="email-title" style="margin:0;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:24px;line-height:1.3;color:#ffffff;">${title}</h1>
									</td>
								</tr>
								<tr>
									<td class="email-pad" style="padding:0 28px 20px 28px;">
										<p class="email-body" style="margin:0;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:16px;line-height:1.6;color:#e5e7eb;">${message}</p>
									</td>
								</tr>
								<tr>
									<td class="email-pad" align="left" style="padding:0 28px 24px 28px;">
										<a href="${buttonUrl}" class="email-button" style="display:inline-block;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:15px;letter-spacing:0.02em;text-decoration:none;background-color:#6b7280;color:#ffffff;padding:12px 20px;border-radius:8px;">${buttonLabel}</a>
									</td>
								</tr>
								<tr>
									<td class="email-pad" style="padding:0 28px 20px 28px;">
										<p class="email-footnote" style="margin:0;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:13px;line-height:1.6;color:#9ca3af;">${footerNote}</p>
									</td>
								</tr>
								<tr>
									<td class="email-pad" style="padding:0 28px 28px 28px;">
										<p class="email-footnote" style="margin:0;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:13px;line-height:1.6;color:#9ca3af;">If the button does not work, paste this link into your browser:</p>
										<p class="email-footnote" style="margin:6px 0 0 0;font-family:'Space Grotesk','Avenir Next','Trebuchet MS',sans-serif;font-size:13px;line-height:1.6;color:#e5e7eb;word-break:break-word;overflow-wrap:anywhere;">${buttonUrl}</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
		</html>
	`;
}

function buildEmailText({
	title,
	message,
	buttonLabel,
	buttonUrl,
	footerNote,
}: EmailTemplateOptions) {
	return [
		title,
		"",
		message,
		"",
		`${buttonLabel}: ${buttonUrl}`,
		"",
		footerNote,
	].join("\n");
}

export async function sendTeamInviteEmail(email: string, link: string) {
	const template = {
		title: "Join your Lytx team",
		message: "You have been invited to join a Lytx team. Accept the invite to access shared dashboards and insights.",
		buttonLabel: "Accept invitation",
		buttonUrl: link,
		footerNote: "If you were not expecting this invitation, you can safely ignore this email.",
	};

	return sendEmail({
		from: getFromAddress(),
		to: email,
		subject: "You've been invited to join a Lytx team",
		html: buildEmailTemplate(template),
		text: buildEmailText(template),
	});
}

export async function newAccountInviteEmail(email: string, link: string) {
	const template = {
		title: "Create your Lytx account",
		message: "You have been invited to join a Lytx team. Create your account to get started with your new workspace.",
		buttonLabel: "Create account",
		buttonUrl: link,
		footerNote: "If you were not expecting this invitation, you can safely ignore this email.",
	};

	return sendEmail({
		from: getFromAddress(),
		to: email,
		subject: "You've been invited to join a Lytx team",
		html: buildEmailTemplate(template),
		text: buildEmailText(template),
	});
}

export async function sendVerificationEmail(email: string, link: string) {
	const template = {
		title: "Verify your email",
		message: "Welcome to Lytx. Confirm your email to finish setting up your account and access your dashboard.",
		buttonLabel: "Verify email",
		buttonUrl: link,
		footerNote: "If you did not create a Lytx account, you can ignore this email.",
	};

	return sendEmail({
		from: getFromAddress(),
		to: email,
		subject: "Verify your Lytx account",
		html: buildEmailTemplate(template),
		text: buildEmailText(template),
	});
}
