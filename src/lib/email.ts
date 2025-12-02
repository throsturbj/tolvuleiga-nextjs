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
		text: `Góðan dag,

Takk kærlega fyrir að skrá þig!

Við erum mjög spennt að hafa þig með okkur og vonum að þjónustan okkar muni koma þér að góðum notum. 
Ef þú hefur einhverjar spurningar eða þarft aðstoð er þér alltaf velkomið að hafa samband.

Kærar kveðjur,
Tölvuleiga.is`,
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
    text: buildUserOrderConfirmationText(),
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

export function buildUserOrderConfirmationText(): string {
  return `Góðan dag,

Takk fyrir að velja tolvuleiga.is.

Vinsamlegast athugið að áætlaður afhendingartími er 7 virkir dagar. Leigutímabil byrjar daginn sem afhending er.
Reikningur verður sendur í heimabankann þinn á næstu dögum. Greiðsla reiknings þarf að berast áður en hafist er handa við samsetningu og undirbúning tölvunnar, 
þar sem ferlið hefst ekki fyrr en greiðsla hefur verið staðfest.

Ef einhverjar spurningar vakna varðandi pöntunina, þjónustuna eða aðra þætti, hvetjum við þig eindregið til að hafa samband við okkur. Þú getur náð í okkur á netfanginu tolvuleiga@tolvuleiga.is,
og við munum leitast við að svara eins fljótt og kostur er.

Við þökkum traustið og hlökkum til að afgreiða pöntunina þína.

Kærar kveðjur,
Tölvuleiga.is`
}

export async function sendOrderReminderEmail(args: {
	to: string
	timabilTilDateString: string
	dashboardUrl: string
}): Promise<void> {
	const { to, timabilTilDateString, dashboardUrl } = args
	const subject = 'Minning: Pöntun er að klárast'
	const text = `Kæri viðskiptavinur,

Við viljum minna þig á að pöntun þín er að enda (${timabilTilDateString}).

Þú getur framlengt ef þú vilt á síðunni okkar á Pantanir: ${dashboardUrl}

Ef þú ætlar ekki að framlengja þá höfum við samband þegar tímabilinu er lokið og við sækjum pakkann þinn.

Kær kveðja,
Tölvuleiga`

	const html = `
<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111">
  <p>Kæri viðskiptavinur,</p>
  <p>Við viljum minna þig á að pöntun þín er að enda (<strong>${timabilTilDateString}</strong>).</p>
  <p>Þú getur framlengt ef þú vilt á síðunni okkar á Pantanir.</p>
  <p style="margin:24px 0">
    <a href="${dashboardUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
      Pantanir
    </a>
  </p>
  <p>Ef þú ætlar ekki að framlengja þá höfum við samband þegar tímabilinu er lokið og við sækjum pakkann þinn.</p>
  <p style="margin-top:24px">Kær kveðja,<br/>Tölvuleiga</p>
</div>`

	await sendMail({ to, subject, text, html })
}

export async function sendPasswordResetEmail(args: { to: string; resetLink: string }): Promise<void> {
	const { to, resetLink } = args
	const subject = 'Gleymt lykilorð - Tölvuleiga'
	const text = `Kæri viðskiptavinur,

Það virðist sem að það sé verið að reyna að undursitja lykilorðið á netfang: ${to}

Vinsamlegast smelltu á eftirfarandi tengil til að setja nýtt lykilorð:
${resetLink}

Kær kveðja,
Tölvuleiga`

	const html = `
<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111">
  <p>Kæri viðskiptavinur,</p>
  <p>Það virðist sem að það sé verið að reyna að undursitja lykilorðið á netfang: <strong>${to}</strong></p>
  <p>Smelltu á hlekkinn hér fyrir neðan til að setja nýtt lykilorð:</p>
  <p style="margin:24px 0">
    <a href="${resetLink}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
      Endursetja lykilorð
    </a>
  </p>
  <p style="margin-top:24px">Kær kveðja,<br/>Tölvuleiga</p>
</div>`

	await sendMail({ to, subject, text, html })
}


