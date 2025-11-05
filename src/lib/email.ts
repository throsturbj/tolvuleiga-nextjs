import nodemailer, { Transporter } from 'nodemailer'

type MailInput = {
	to: string | string[]
	subject: string
	text?: string
	html?: string
	attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

let cachedTransporter: Transporter | null = null

function getBooleanEnv(name: string, defaultValue: boolean): boolean {
	const raw = process.env[name]
	if (raw === undefined) return defaultValue
	return /^(1|true|yes)$/i.test(raw)
}

export function getMailer(): Transporter {
	if (cachedTransporter) return cachedTransporter

	const host = process.env.SMTP_HOST
	const portRaw = process.env.SMTP_PORT
	const user = process.env.SMTP_USER
	const pass = process.env.SMTP_PASS
	const secure = getBooleanEnv('SMTP_SECURE', true)

	if (!host || !portRaw || !user || !pass) {
		throw new Error('SMTP configuration missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
	}

	const port = parseInt(portRaw, 10)
	if (!Number.isFinite(port)) {
		throw new Error('SMTP_PORT must be a number')
	}

	cachedTransporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass },
		pool: true,
		maxConnections: 5,
		maxMessages: 100,
	})

	return cachedTransporter
}

export async function sendMail(input: MailInput): Promise<void> {
	const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com'
	const transporter = getMailer()
	await transporter.sendMail({
		from,
		to: input.to,
		subject: input.subject,
		text: input.text,
		html: input.html,
		attachments: input.attachments,
	})
}

export async function sendWelcomeEmail(to: string): Promise<void> {
	await sendMail({
		to,
		subject: 'Velkomin/n til Tölvuleigu',
		text: 'Takk fyrir að skrá þig! Við munum hafa samband fljótlega.',
	})
}

export async function sendContactEmail(
	message: { name: string; email: string; message: string },
): Promise<void> {
	const admin = process.env.CONTACT_TO || 'tolvuleiga@tolvuleiga.is'
	const body = `Ný skilaboð af samskiptasíðu:\n\nNafn: ${message.name}\nNetfang: ${message.email}\n\nSkilaboð:\n${message.message}`
	await sendMail({
		to: admin,
		subject: 'Ný skilaboð af vefsíðu',
		text: body,
	})
}

export async function sendOrderEmails(args: {
	userEmail: string
	adminEmail?: string
	orderTextForAdmin: string
	pdfAttachment?: { filename: string; content: Buffer }
}): Promise<void> {
	const admin = args.adminEmail || 'tolvuleiga@tolvuleiga.is'

	// To user with PDF
	await sendMail({
		to: args.userEmail,
		subject: 'Pöntunarstaðfesting',
		text: 'Takk fyrir pöntunina! Við höfum bætt PDF staðfestingu við í viðhengi.',
		attachments: args.pdfAttachment ? [
			{ filename: args.pdfAttachment.filename, content: args.pdfAttachment.content, contentType: 'application/pdf' },
		] : undefined,
	})

	// To admin plain text
	await sendMail({
		to: admin,
		subject: 'Ný pöntun á vefnum',
		text: args.orderTextForAdmin,
	})
}


