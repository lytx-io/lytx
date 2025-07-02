"use server";

import { env } from "cloudflare:workers";

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

async function sendEmail(options: SendEmailOptions) {
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
		throw new Error(`Resend API error: ${response.status} - ${error}`);
	}

	return response.json();
}

export async function sendVerificationEmail(email: string, link: string, from: string) {
	return sendEmail({
		from: from,
		to: email,
		subject: "Verify your Lytx account",
		html: `
			<h1>Verify your Lytx account</h1>
			<p>Please click the link below to verify your email address:</p>
			<p><a href="${link}">${link}</a></p>
			<p>If you did not request this email, please ignore it.</p>
		`,
	});
}
