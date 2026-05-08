import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'clem@nobrandleftbehind.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendDraftReadyEmail({
  to,
  postTitle,
  postId,
  tenantName,
}: {
  to: string
  postTitle: string
  postId: string
  tenantName: string
}) {
  const reviewUrl = `${APP_URL}/author/${postId}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Clem] New draft ready for review — "${postTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <p>Hi,</p>
        <p>Clem has written a new blog post draft for <strong>${tenantName}</strong>:</p>
        <h2 style="font-size:1.25rem">${postTitle}</h2>
        <p>
          <a href="${reviewUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">
            Review draft →
          </a>
        </p>
        <p style="color:#666;font-size:0.875rem">
          You can edit the post, select a hero image, and approve or request changes from the review page.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:0.75rem">Sent by Clem — nobrandleftbehind.com</p>
      </div>
    `,
  })
}

export async function sendWorkspaceInvite({
  to,
  inviterName,
  workspaceName,
  workspaceDomain,
  role,
  token,
}: {
  to: string
  inviterName: string
  workspaceName: string
  workspaceDomain: string
  role: string
  token: string
}) {
  const inviteUrl = `${APP_URL}/invite/${token}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been invited to join ${workspaceName} on Clem`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <p>Hi,</p>
        <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>${workspaceName}</strong> (${workspaceDomain}) as a <strong>${role}</strong>.</p>
        <p>
          <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">
            Accept invite →
          </a>
        </p>
        <p style="color:#666;font-size:0.875rem">
          If you don't have a Clem account yet, you'll be asked to create one first.
          This invite expires in 7 days.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:0.75rem">
          If you weren't expecting this invitation, you can safely ignore it.
          Sent by Clem — nobrandleftbehind.com
        </p>
      </div>
    `,
  })
}

export async function sendPublishedEmail({
  to,
  postTitle,
  prUrl,
  tenantName,
}: {
  to: string
  postTitle: string
  prUrl: string
  tenantName: string
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `[Clem] Post published — "${postTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <p>Hi,</p>
        <p>Clem has opened a GitHub PR to publish <strong>"${postTitle}"</strong> for ${tenantName}.</p>
        <p>
          <a href="${prUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">
            View pull request →
          </a>
        </p>
        <p style="color:#666;font-size:0.875rem">Merge the PR to publish the post live on your site.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:0.75rem">Sent by Clem — nobrandleftbehind.com</p>
      </div>
    `,
  })
}
