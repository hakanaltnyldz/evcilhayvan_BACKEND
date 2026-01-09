import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendEmail(to, subject, html) {
  if (process.env.NODE_ENV === "test" || !process.env.SENDGRID_API_KEY || !process.env.SENDER_EMAIL) {
    console.log("[Mail] skipped sending (test or missing config)");
    return;
  }

  const msg = {
    to,
    from: process.env.SENDER_EMAIL,
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`[Mail] sent: ${to}`);
  } catch (error) {
    console.error("[Mail] send error:", error?.message || error);
    if (error?.response?.body) {
      console.error(error.response.body);
    }
  }
}
