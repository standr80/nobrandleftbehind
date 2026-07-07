/**
 * Scout Alerts — daily urgent check between weekly briefings
 *
 * Checks for:
 * - Competitor pricing changes (already created as alerts by the competitor pipeline)
 * - Any unactioned urgent alerts that need emailing
 *
 * Called by /api/scout/alerts/check (Vercel Cron, daily at 07:00 UTC)
 */

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

// Lazy so a missing RESEND_API_KEY doesn't throw at module load (which breaks
// `next build` page-data collection). Only constructed when actually sending.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export interface AlertCheckResult {
  tenantsChecked: number
  urgentAlertsEmailed: number
  errors: string[]
}

export async function runDailyAlertCheck(): Promise<AlertCheckResult> {
  const db = createAdminClient()
  const errors: string[] = []
  let urgentAlertsEmailed = 0

  // Get all tenants with Scout enabled
  const { data: configs, error: configError } = await db
    .from('scout_config')
    .select('tenant_id, tenants(name)')
    .eq('enabled', true)

  if (configError) {
    return { tenantsChecked: 0, urgentAlertsEmailed: 0, errors: [configError.message] }
  }

  const tenantConfigs = configs ?? []

  for (const config of tenantConfigs) {
    try {
      const tenant = Array.isArray(config.tenants) ? config.tenants[0] : config.tenants
      const tenantName = (tenant as { name?: string })?.name ?? 'your workspace'

      // Find unactioned urgent alerts created in the last 24h
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: urgentAlerts } = await db
        .from('scout_alerts')
        .select('id, alert_type, title, detail')
        .eq('tenant_id', config.tenant_id)
        .eq('severity', 'urgent')
        .eq('actioned', false)
        .gte('created_at', cutoff)

      if (!urgentAlerts?.length) continue

      // Get admin emails
      const { data: admins } = await db
        .from('tenant_members')
        .select('email, name')
        .eq('tenant_id', config.tenant_id)
        .eq('role', 'admin')

      const recipients = (admins ?? []).filter((a): a is { email: string; name: string | null } => !!a.email)
      if (!recipients.length) continue

      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nobrandleftbehind.com'}/dashboard/scout`

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Scout Alert — ${tenantName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
  <div style="border-left:4px solid #dc2626;padding-left:16px;margin-bottom:24px">
    <h1 style="font-size:18px;margin:0 0 4px;color:#dc2626">🔴 Scout Alert</h1>
    <div style="color:#6b7280;font-size:13px">${tenantName} &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
  </div>
  ${urgentAlerts
    .map(
      (alert) => `
  <div style="border:1px solid #fca5a5;background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:12px">
    <div style="font-weight:600;margin-bottom:6px">${alert.title}</div>
    ${alert.detail ? `<div style="color:#374151;font-size:14px">${alert.detail}</div>` : ''}
  </div>`,
    )
    .join('')}
  <div style="margin-top:24px;text-align:center">
    <a href="${dashboardUrl}" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View in Scout dashboard →</a>
  </div>
</body>
</html>`

      for (const recipient of recipients) {
        await getResend().emails.send({
          from: 'Scout <scout@nobrandleftbehind.com>',
          to: recipient.email,
          subject: `🔴 Scout Alert — ${urgentAlerts.length} urgent item${urgentAlerts.length !== 1 ? 's' : ''} — ${tenantName}`,
          html,
        })
      }

      // Mark as actioned
      await db
        .from('scout_alerts')
        .update({ actioned: true, actioned_at: new Date().toISOString() })
        .in(
          'id',
          urgentAlerts.map((a) => a.id),
        )

      urgentAlertsEmailed += urgentAlerts.length
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Tenant ${config.tenant_id}: ${message}`)
    }
  }

  return {
    tenantsChecked: tenantConfigs.length,
    urgentAlertsEmailed,
    errors,
  }
}
