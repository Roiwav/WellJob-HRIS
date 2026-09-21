"use strict";

const nodemailer = require("nodemailer");

/*
 * WELLJOB HRIS
 * Recovery Email Service
 *
 * Recovery links are generated using the configured
 * frontend URL, never an incoming request header.
 */

function requiredConfig(name) {
  const value = String(process.env[name] ?? "").trim();

  if (!value) {
    throw new Error(
      "Recovery email configuration missing: " + name
    );
  }

  return value;
}

function publicFrontendOrigin() {
  const url = new URL(
    requiredConfig("PUBLIC_FRONTEND_URL")
  );

  const local = [
    "localhost",
    "127.0.0.1",
  ].includes(url.hostname);

  if (
    (url.protocol !== "https:" &&
      !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "PUBLIC_FRONTEND_URL must be HTTPS " +
        "(HTTP only on localhost) without credentials, " +
        "query or fragment."
    );
  }

  return url.origin;
}

function getMailerConfig() {
  const port = Number(
    requiredConfig("SMTP_PORT")
  );

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("Invalid SMTP_PORT.");
  }

  const from = requiredConfig("SMTP_FROM");

  if (/[\r\n]/.test(from)) {
    throw new Error("Invalid SMTP_FROM.");
  }

  return {
    host: requiredConfig("SMTP_HOST"),
    port,
    secure: port === 465,

    auth: {
      user: requiredConfig("SMTP_USER"),
      pass: requiredConfig("SMTP_PASSWORD"),
    },

    from,
    frontendOrigin: publicFrontendOrigin(),
  };
}

function buildRecoveryEmail({ type, link }) {
  if (type === "verify") {
    return {
      subject: "Verify your WELLJOB recovery email",

      text: [
        "Hello,",
        "",
        "Use the following link to verify your WELLJOB recovery email:",
        "",
        link,
        "",
        "This link expires in 24 hours.",
        "",
        "If you did not request this verification, you may ignore this email.",
        "Never share this link with anyone.",
        "",
        "WELLJOB HRIS Support",
      ].join("\n"),
    };
  }

  return {
    subject: "WELLJOB HRIS - Password Reset Request",

    text: [
      "Hello,",
      "",
      "A password reset was requested for your WELLJOB HRIS account.",
      "",
      "Your request has been approved.",
      "Use the secure link below to create a new password:",
      "",
      link,
      "",
      "This link expires in 30 minutes and can be used only once.",
      "",
      "IMPORTANT SECURITY NOTICE",
      "",
      "If you did not request a password reset, do not click the link.",
      "Please contact WELLJOB IT Support immediately so the request can be investigated.",
      "",
      "Do not share your password or password-reset link with anyone.",
      "",
      "WELLJOB HRIS Support",
    ].join("\n"),
  };
}

async function sendRecoveryLink({
  to,
  token,
  type,
}) {
  if (!["verify", "reset"].includes(type)) {
    throw new Error(
      "Unsupported recovery link type."
    );
  }

  const config = getMailerConfig();

  const targetPath =
    type === "verify"
      ? "/verify-email"
      : "/reset-password";

  const url = new URL(
    targetPath,
    config.frontendOrigin
  );

  url.searchParams.set("token", token);

  const message = buildRecoveryEmail({
    type,
    link: url.toString(),
  });

  const transporter =
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: config.auth,
      tls: {
        minVersion: "TLSv1.2",
      },
    });

  await transporter.sendMail({
    from: config.from,
    to,
    subject: message.subject,
    text: message.text,
  });
}

module.exports = {
  sendRecoveryLink,
  publicFrontendOrigin,
};