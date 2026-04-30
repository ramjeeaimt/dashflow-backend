

// ─── Welcome Email ────────────────────────────────────────────────────────────

export function getWelcomeContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    return `
        <div style="border-left: 4px solid #4f46e5; padding: 20px; background-color: #f8fafc; margin: 20px 0;">
            <h3 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Welcome to ${metadata.companyName || 'Difmo'}!</h3>
            <p style="color: #334155; font-size: 16px;">${message}</p>
            ${metadata.password ? `
            <div style="margin-top: 20px; background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #475569; font-size: 14px;">Your Temporary Password:</p>
                <p style="margin: 5px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700; letter-spacing: 1px;">${metadata.password}</p>
            </div>
            ` : ''}
        </div>
        <div style="margin-top: 30px;">
            <a href="${appUrl}/login"
               style="background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Log In to Portal
            </a>
        </div>
    `;
}

// ─── Leave Status ─────────────────────────────────────────────────────────────

export function getLeaveStatusContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    const leaveColor = metadata.status === 'APPROVED' ? '#10b981' : '#ef4444';
    return `
        <div style="border-left: 4px solid ${leaveColor}; padding: 20px; background-color: #f8fafc; margin: 20px 0;">
            <h3 style="color: ${leaveColor}; margin-top: 0; font-size: 20px;">Leave ${metadata.status}</h3>
            <p style="color: #334155; font-size: 16px;">${message}</p>
        </div>
        <div style="margin-top: 30px;">
            <a href="${appUrl}/employee/leaves"
               style="background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                View Leave History
            </a>
        </div>
    `;
}

// ─── Payroll Generated / Paid ─────────────────────────────────────────────────

export function getPayrollContent(
    type: 'PAYROLL_GENERATED' | 'PAYROLL_PAID',
    title: string,
    message: string,
    metadata: any,
): string {
    const isPaid = type === 'PAYROLL_PAID';
    const accentColor = isPaid ? '#059669' : '#0f172a';
    const empName = metadata.employeeName || 'Valued Employee';

    let breakdownHtml = '';
    if (metadata.basicSalary) {
        breakdownHtml = `
            <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Basic Salary</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">₹${Number(metadata.basicSalary).toFixed(2)}</td>
                    </tr>
                    ${metadata.allowances ? `
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Allowances</td>
                        <td style="color: #059669; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">+₹${Number(metadata.allowances).toFixed(2)}</td>
                    </tr>` : ''}
                    ${metadata.deductions ? `
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 5px 0;">Deductions</td>
                        <td style="color: #ef4444; font-size: 14px; padding: 5px 0; text-align: right; font-weight: 700;">-₹${Number(metadata.deductions).toFixed(2)}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="color: #0f172a; font-size: 16px; padding: 15px 0 5px 0; font-weight: 800;">Net Salary</td>
                        <td style="color: ${accentColor}; font-size: 20px; padding: 15px 0 5px 0; text-align: right; font-weight: 900;">₹${Number(metadata.netSalary).toFixed(2)}</td>
                    </tr>
                </table>
            </div>
        `;
    }

    return `
        <p style="margin-bottom: 25px; font-weight: 700; color: #0f172a;">Dear ${empName},</p>
        <p style="margin-bottom: 20px; color: #475569;">Good day! Your payroll for <strong>${metadata.month}/${metadata.year}</strong> has been successfully processed.</p>
        <p style="margin-bottom: 25px; color: #475569;">${isPaid
            ? 'The funds have been credited to your registered bank account.'
            : 'You can now review and download your payslip from the employee portal.'
        }</p>
        ${breakdownHtml}
    `;
}

// ─── Task Assigned ────────────────────────────────────────────────────────────

export function getTaskAssignedContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    return `
        <div style="border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; margin: 30px 0; background-color: #f8fafc;">
            <span style="background-color: #fee2e2; color: #ef4444; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase;">
                ${metadata.priority || 'NORMAL'} PRIORITY
            </span>
            <h3 style="margin: 20px 0 10px 0; color: #0f172a; font-size: 24px;">${title}</h3>
            <p style="color: #475569; font-size: 18px;">${message}</p>
        </div>
        <div style="margin-top: 30px;">
            <a href="${appUrl}/task-management"
               style="background-color: #0f172a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
                View Task Details
            </a>
        </div>
    `;
}

// ─── Project Assigned ─────────────────────────────────────────────────────────

export function getProjectAssignedContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    return `
        <div style="border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; margin: 30px 0; background-color: #f8fafc;">
            <h3 style="margin: 0; color: #6366f1; font-size: 14px; text-transform: uppercase;">New Project Assignment</h3>
            <p style="color: #0f172a; font-size: 28px; font-weight: 800; margin: 15px 0;">${metadata.projectName || title}</p>
            <p style="color: #475569; font-size: 16px;">${message}</p>
        </div>
        <div style="margin-top: 30px; text-align: center;">
            <a href="${appUrl}/projects"
               style="background-color: #4338ca; color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 800;">
                GO TO PROJECT
            </a>
        </div>
    `;
}

// ─── Default / Generic ────────────────────────────────────────────────────────

export function getDefaultContent(message: string): string {
    return `<p style="color: #334155; font-size: 18px; line-height: 1.8;">${message}</p>`;
}

export function getSpecializedContent(
    type: string,
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    switch (type) {
        case 'WELCOME':
            return getWelcomeContent(title, message, metadata, appUrl);

        case 'LEAVE_STATUS':
            return getLeaveStatusContent(title, message, metadata, appUrl);

        case 'PAYROLL_GENERATED':
        case 'PAYROLL_PAID':
            return getPayrollContent(type as 'PAYROLL_GENERATED' | 'PAYROLL_PAID', title, message, metadata);

        case 'TASK_ASSIGNED':
            return getTaskAssignedContent(title, message, metadata, appUrl);

        case 'PROJECT_ASSIGNED':
            return getProjectAssignedContent(title, message, metadata, appUrl);

        default:
            return getDefaultContent(message);
    }
}
