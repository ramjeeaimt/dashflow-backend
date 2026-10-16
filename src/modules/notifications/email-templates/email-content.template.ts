

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

// ─── Finance Update ───────────────────────────────────────────────────────────

export function getFinanceUpdateContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    const isCredit = (metadata.financeType || '').toLowerCase() === 'credit' || (metadata.financeType || '').toLowerCase() === 'income';
    const isApproved = metadata.financeStatus?.toLowerCase() === 'approved';
    const statusColor = isApproved ? '#10b981' : '#f59e0b';
    const statusText = isApproved ? 'Approved / Done' : (metadata.financeStatus?.toUpperCase() || 'PENDING');
    const currency = metadata.currency || 'INR';
    const currencySymbol = currency === 'INR' ? '₹' : (currency === 'USD' ? '$' : currency);
    const amountVal = Number(metadata.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isUpdate = metadata.action === 'updated';

    let breakdownHtml = '';

    if (metadata.entryType === 'Payroll') {
        breakdownHtml = `
            <div style="margin: 25px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #fff;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">Employee</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 10px 0; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${metadata.employeeName || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">Period</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 10px 0; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${metadata.month}/${metadata.year}</td>
                    </tr>
                    ${metadata.description ? `
                    <tr>
                        <td colspan="2" style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <div style="color: #64748b; font-size: 13px; margin-bottom: 4px;">Notes</div>
                            <div style="color: #0f172a; font-size: 14px; line-height: 1.6; text-align: left; font-weight: 400;">${metadata.description}</div>
                        </td>
                    </tr>` : ''}
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">Status</td>
                        <td style="color: ${statusColor}; font-size: 14px; padding: 10px 0; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${statusText}</td>
                    </tr>
                    <tr>
                        <td style="color: #0f172a; font-size: 15px; padding: 14px 0 4px 0; font-weight: 800;">Net Amount</td>
                        <td style="color: #0f172a; font-size: 20px; padding: 14px 0 4px 0; text-align: right; font-weight: 900;">${currencySymbol}${amountVal}</td>
                    </tr>
                </table>
            </div>
        `;
    } else {
        // Normal Financial Entry (Income / Expense)
        const typeBg = isCredit ? '#f0fdf4' : '#fef2f2';
        const typeBorder = isCredit ? '#bbf7d0' : '#fecaca';
        const typeColor = isCredit ? '#15803d' : '#b91c1c';
        const typeBadgeBg = isCredit ? '#dcfce7' : '#fee2e2';
        const typeLabel = isCredit ? 'CREDIT (INCOME / INFLOW)' : 'DEBIT (EXPENSE / OUTFLOW)';
        const amountPrefix = isCredit ? '+' : '-';

        breakdownHtml = `
            <!-- Highlight Card -->
            <div style="margin: 20px 0; padding: 22px; border-radius: 12px; border: 1px solid ${typeBorder}; background-color: ${typeBg};">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="left">
                            <span style="display: inline-block; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; background-color: ${typeBadgeBg}; color: ${typeColor};">
                                ${typeLabel}
                            </span>
                        </td>
                        <td align="right">
                            <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${isUpdate ? 'Updated' : 'Recorded'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding-top: 14px;">
                            <div style="font-size: 30px; font-weight: 900; color: ${typeColor}; line-height: 1.2;">
                                ${amountPrefix}${currencySymbol}${amountVal}
                            </div>
                            <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                                ${metadata.title || 'Untitled Transaction'}
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Transaction Details Table -->
            <div style="margin: 20px 0; padding: 18px 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #fff;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Category</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${metadata.category || 'Operating'}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Date</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${metadata.entryDate || metadata.date || 'Today'}</td>
                    </tr>
                    ${metadata.employeeName ? `
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Recorded By</td>
                        <td style="color: #0f172a; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${metadata.employeeName}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">Status</td>
                        <td style="color: ${statusColor}; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 700; border-bottom: 1px solid #f1f5f9;">${statusText}</td>
                    </tr>
                    ${metadata.description ? `
                    <tr>
                        <td colspan="2" style="padding-top: 12px;">
                            <div style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Description / Notes</div>
                            <div style="color: #334155; font-size: 14px; line-height: 1.6; background-color: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #f1f5f9;">${metadata.description}</div>
                        </td>
                    </tr>` : ''}
                </table>
            </div>
        `;
    }

    return `
        <div style="border-left: 4px solid #000; padding: 18px 20px; background-color: #f8fafc; margin: 15px 0 20px 0; border-radius: 4px;">
            <h3 style="color: #000; margin: 0 0 6px 0; font-size: 18px; font-weight: 800;">Corporate Financial Alert</h3>
            <p style="color: #475569; font-size: 15px; margin: 0; line-height: 1.5;">${message}</p>
        </div>
        ${breakdownHtml}
        <div style="margin-top: 26px;">
            <a href="${appUrl}/finance"
               style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
                Open DashFlow Finance &rarr;
            </a>
        </div>
    `;
}

// ─── Project Created ──────────────────────────────────────────────────────────────

export function getProjectCreatedContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    let detailsHtml = '';

    if (metadata.project) {
        const ignoredKeys = ['id', 'companyId', 'createdAt', 'updatedAt', 'clientId', 'company', 'client', 'budget'];
        const keys = Object.keys(metadata.project).filter(k => !ignoredKeys.includes(k));

        let rows = keys.map(key => {
            return `
                <tr>
                    <td style="color: #64748b; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                        ${key}
                    </td>
                    <td style="color: #334155; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9;">
                        ${typeof metadata.project[key] === 'object' && metadata.project[key] !== null ? JSON.stringify(metadata.project[key]) : (metadata.project[key] || '<em>none</em>')}
                    </td>
                </tr>
            `;
        }).join('');

        detailsHtml = `
            <div style="margin: 25px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #fff;">
                <h4 style="margin-top: 0; margin-bottom: 15px; color: #0f172a; font-size: 16px;">Project Details</h4>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <thead>
                        <tr>
                            <th align="left" style="color: #0f172a; font-size: 14px; padding: 8px; border-bottom: 2px solid #e2e8f0; width: 35%;">Field</th>
                            <th align="left" style="color: #0f172a; font-size: 14px; padding: 8px; border-bottom: 2px solid #e2e8f0;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    return `
        <div style="border-left: 4px solid #3b82f6; padding: 20px; background-color: #eff6ff; margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-top: 0; font-size: 20px;">New Project Created</h3>
            <p style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 10px 0;">${metadata.projectName || title}</p>
            <p style="color: #334155; font-size: 16px; margin-bottom: 0;">${message}</p>
        </div>
        ${detailsHtml}
        <div style="margin-top: 30px;">
            <a href="${appUrl}/projects"
               style="background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                View Project
            </a>
        </div>
    `;
}

// ─── Project Updated ────────────────────────────────────────────────────────────

export function getProjectUpdatedContent(
    title: string,
    message: string,
    metadata: any,
    appUrl: string,
): string {
    let updatesHtml = '';

    if (metadata.project) {
        const ignoredKeys = ['id', 'companyId', 'createdAt', 'updatedAt', 'clientId', 'company', 'client', 'budget'];
        const keys = Object.keys(metadata.project).filter(k => !ignoredKeys.includes(k));

        let rows = keys.map(key => {
            const updatedField = metadata.updatedFields?.find((u: any) => u.field === key);

            if (updatedField) {
                return `
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                            ${key} <span style="color: #ef4444; font-weight: bold;">*</span>
                        </td>
                        <td style="color: #0f172a; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9;">
                            <span style="color: #ef4444; text-decoration: line-through;">${updatedField.oldValue || '<em>none</em>'}</span>
                            <span style="margin: 0 8px; color: #94a3b8;">&rarr;</span>
                            <span style="color: #10b981; font-weight: bold;">${updatedField.newValue || '<em>none</em>'}</span>
                        </td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td style="color: #64748b; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">
                            ${key}
                        </td>
                        <td style="color: #334155; font-size: 14px; padding: 10px 8px; border-bottom: 1px solid #f1f5f9;">
                            ${typeof metadata.project[key] === 'object' && metadata.project[key] !== null ? JSON.stringify(metadata.project[key]) : (metadata.project[key] || '<em>none</em>')}
                        </td>
                    </tr>
                `;
            }
        }).join('');

        updatesHtml = `
            <div style="margin: 25px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #fff;">
                <h4 style="margin-top: 0; margin-bottom: 5px; color: #0f172a; font-size: 16px;">Project Details</h4>
                <p style="margin-top: 0; margin-bottom: 15px; color: #64748b; font-size: 12px; font-style: italic;">
                    <span style="color: #ef4444; font-weight: bold;">*</span> means updated value
                </p>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <thead>
                        <tr>
                            <th align="left" style="color: #0f172a; font-size: 14px; padding: 8px; border-bottom: 2px solid #e2e8f0; width: 35%;">Field</th>
                            <th align="left" style="color: #0f172a; font-size: 14px; padding: 8px; border-bottom: 2px solid #e2e8f0;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    return `
        <div style="border-left: 4px solid #f59e0b; padding: 20px; background-color: #f8fafc; margin: 20px 0;">
            <h3 style="color: #f59e0b; margin-top: 0; font-size: 20px;">Project Updated</h3>
            <p style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 10px 0;">${metadata.projectName || title}</p>
            <p style="color: #334155; font-size: 16px; margin-bottom: 0;">${message}</p>
        </div>
        ${updatesHtml}
        <div style="margin-top: 30px;">
            <a href="${appUrl}/projects"
               style="background-color: #0f172a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                View Project
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
    try {
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

            case 'PROJECT_CREATED':
                return getProjectCreatedContent(title, message, metadata, appUrl);

            case 'PROJECT_UPDATED':
                return getProjectUpdatedContent(title, message, metadata, appUrl);

            case 'FINANCE_UPDATE':
                return getFinanceUpdateContent(title, message, metadata, appUrl);

            default:
                return getDefaultContent(message);
        }
    } catch (e) {
        console.error(`[email-content.template] getSpecializedContent failed for ${type}:`, e);
        return getDefaultContent(message);
    }
}
