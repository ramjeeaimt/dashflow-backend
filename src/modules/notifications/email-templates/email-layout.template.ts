/**
 * email-layout.template.ts
 *
 * DIFMO corporate email shell — wraps any body content with the standard
 * header, signature, social icons, legal disclaimer and anti-clipping spacer.
 *
 * Usage:
 *   import { getEmailLayout } from './email-templates/email-layout.template';
 *   const html = getEmailLayout('Subject Title', bodyContentHtml);
 */

export function getEmailLayout(title: string, content: string): string {
    const year = new Date().getFullYear();
    const bannerUrl =
        'https://res.cloudinary.com/dxju8ikk4/image/upload/v1777468072/difmo_banner_final.png';

    const contactRow = (letter: string, children: string) => `
        <tr>
            <td width="32" valign="top" style="padding-bottom: 14px;">
                <div style="width: 24px; height: 24px; background: #000; border-radius: 50%; text-align: center; line-height: 24px;">
                    <span style="color: #fff; font-size: 11px; font-weight: 800;">${letter}</span>
                </div>
            </td>
            <td style="padding-bottom: 14px; font-size: 14px; font-weight: 600; color: #000; line-height: 1.5;">${children}</td>
        </tr>`;

    const socialIcon = (href: string, src: string) =>
        `<a href="${href}" style="display: inline-block; margin-right: 14px;">
            <img src="${src}" width="22" style="opacity: 0.75; vertical-align: middle;">
        </a>`;

    return `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #1e293b; margin: 0; padding: 0;">
            <div style="max-width: 700px; margin: 0;">

                <!-- Header Branding -->

                <!-- Body -->
                <div style="font-size: 16px; line-height: 1.6; color: #334155;">
                    ${content}
                </div>

                <!-- Signature -->
                <div style="margin-top: 48px; padding-top: 28px; border-top: 1px solid #f1f5f9;">
                    <img src="https://res.cloudinary.com/dxju8ikk4/image/upload/v1777469595/difmo_vector_icon.png"
                         width="100" height="100"
                         style="border-radius: 50%; object-fit: cover; display: block; margin-bottom: 20px;">

                    <div style="border-top: 1px solid #1e293b; padding-top: 22px; max-width: 650px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <!-- Left: Identity -->
                                <td width="55%" valign="top">
                                    <p style="margin: 0 0 2px; font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.4px;">Team DIFMO</p>
                                    <p style="margin: 0 0 1px; font-size: 15px; color: #1e293b; font-weight: 500;">Corporate Support</p>
                                    <p style="margin: 0 0 12px; font-size: 14px; color: #475569; font-style: italic;">Communications &amp; Experience</p>
                                    <p style="margin: 0 0 14px; font-size: 15px; font-weight: 800; color: #000;">DIFMO Pvt Ltd</p>
                                    <a href="https://www.difmo.com/contact" style="color: #d03f13ff; font-size: 14px; font-weight: 700; text-decoration: none;">
                                        Let's meet
                                    </a>
                                </td>

                                <!-- Right: Contact -->
                                <td width="45%" valign="top">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                        ${contactRow('E', '<a href="mailto:info@difmo.com" style="color: #000; text-decoration: none;">info@difmo.com</a>')}
                                        ${contactRow('A', '4/37 Vibhav Khand, Gomtinagr Lucknow, Uttar Pradesh 226016, India')}
                                        ${contactRow('W', '<a href="https://www.difmo.com" style="color: #d03f13ff; text-decoration: none;">difmo.com</a>')}
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="border-top: 1px solid #1e293b; margin-top: 22px; max-width: 650px;"></div>
                </div>

                <!-- Banner -->
                <div style="margin-top: 36px; border-radius: 10px; overflow: hidden; line-height: 0;">
                    <img src="${bannerUrl}" alt="Our Services" style="width: 100%; height: auto; display: block;">
                </div>

                <!-- Social Links -->
                <div style="margin-top: 28px;">
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145807.png')}
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145802.png')}
                    ${socialIcon('#', 'https://cdn-icons-png.flaticon.com/512/145/145812.png')}
                </div>

                <!-- Legal -->
                <div style="margin-top: 36px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin: 0;">
This email, along with any attachments, documents, project files, source code, designs, business strategies, client information, and other transmitted materials, contains confidential and proprietary information belonging to <b>DIFMO</b>. It is intended solely for the use of the individual, organization, or entity to whom it is addressed.

Any unauthorized access, review, copying, disclosure, distribution, modification, or use of this information is strictly prohibited and may be unlawful.

If you have received this communication in error, please notify us immediately by replying to this email or contacting our support team at <b>info@difmo.com, mailto:info@difmo.com</b>, and permanently delete all copies of this message and its attachments from your system.

Difmo Private Limited is committed to protecting client data, intellectual property, and business confidentiality across all services including AI solutions, web development, mobile applications, cloud services, cybersecurity, and smart technology solutions.

<b>© 2026 Difmo Private Limited. All rights reserved.</b>
</p>
                    <p style="margin: 8px 0 0;">&copy; ${year} DIFMO PRIVATE LIMITED. ALL RIGHTS RESERVED.</p>
                </div>

                <!-- Anti-clipping spacer (Gmail) -->
                <div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">
                    ${'&nbsp;'.repeat(20)} ${Date.now()} ${Math.random().toString(36).substring(7)}
                </div>

            </div>
        </div>`;
}
