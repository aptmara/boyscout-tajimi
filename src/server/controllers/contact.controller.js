const db = require('../database.js');
const { sendMail } = require('../utils/mailer.js');
const { getClientIP } = require('../middleware/contact-protection.js');

const handleContactForm = async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  const trim = (value) => (typeof value === 'string' ? value.trim() : '');
  const trimmedName = trim(name);
  const trimmedEmail = trim(email);
  const trimmedPhone = trim(phone);
  const trimmedSubject = trim(subject);
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';

  const errors = {};
  if (!trimmedName) {
    errors.name = 'お名前を入力してください';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail) {
    errors.email = 'メールアドレスを入力してください';
  } else if (!emailPattern.test(trimmedEmail)) {
    errors.email = '有効なメールアドレスを入力してください';
  }

  if (!trimmedMessage) {
    errors.message = 'お問い合わせ内容を入力してください';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'validation_error',
      message: '入力内容を確認してください',
      details: errors,
    });
  }

  // Check SMTP Configuration BEFORE saving to DB
  if (!process.env.SMTP_HOST) {
    console.error('SMTP_HOST is not configured.');
    return res.status(500).json({
      error: 'smtp_not_configured',
      message: '送信システムの準備ができていません。恐れ入りますが、お電話にてお問い合わせください。',
    });
  }

  // Get client IP for logging
  const clientIP = getClientIP(req);

  // Save to Database
  try {
    const insertQuery = `
      INSERT INTO contacts (name, email, phone, subject, message, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    // Note: SQLite/Postgres compatibility handled by database.js wrapper
    await db.query(insertQuery, [
      trimmedName,
      trimmedEmail,
      trimmedPhone || '',
      trimmedSubject || '',
      typeof message === 'string' ? message.trim() : '',
      clientIP
    ]);
    console.log(`[Contact] 新規お問い合わせ: name="${trimmedName}", ip=${clientIP}`);
  } catch (dbErr) {
    console.error('Failed to save contact to database:', dbErr);
    // Continue process or return error? 
    // If DB fails, we should probably stop and return error.
    return res.status(500).json({
      error: 'db_error',
      message: 'サーバーエラーが発生しました',
    });
  }

  try {
    const { rows } = await db.query(
      'SELECT value FROM settings WHERE key = $1 LIMIT 1',
      ['contact_email']
    );

    const rawRecipients = rows[0]?.value || '';
    const sanitizeRecipient = (value) => value.replace(/[\r\n]+/g, ' ').trim();
    let recipients = rawRecipients
      .split(/[,;\n]+/)
      .map((item) => sanitizeRecipient(item))
      .filter(Boolean);

    if (recipients.length === 0 && process.env.DEFAULT_CONTACT_EMAIL) {
      recipients = process.env.DEFAULT_CONTACT_EMAIL
        .split(/[,;\n]+/)
        .map((item) => sanitizeRecipient(item))
        .filter(Boolean);
    }

    if (recipients.length === 0) {
      console.error('contact_email is not configured');
      return res.status(500).json({
        error: 'contact_email_not_configured',
        message: '送信先が設定されていないため、お問い合わせを送信できませんでした。恐れ入りますが、時間をおいて再度お試しください。',
      });
    }

    const fromAddress = (process.env.CONTACT_FORM_FROM || process.env.SMTP_FROM || '').trim();
    if (!fromAddress) {
      console.error('SMTP_FROM/CONTACT_FORM_FROM is not configured');
      return res.status(500).json({
        error: 'mailer_not_configured',
        message: '送信に失敗しました。時間をおいて再度お試しください。',
      });
    }

    const sanitizeSingleLine = (value) => value.replace(/[\r\n]+/g, ' ').trim();
    const safeName = sanitizeSingleLine(trimmedName).slice(0, 120);
    const safeEmail = sanitizeSingleLine(trimmedEmail);
    const safePhone = sanitizeSingleLine(trimmedPhone);
    const safeSubject = sanitizeSingleLine(trimmedSubject).slice(0, 120) || 'お問い合わせ';
    const safeMessage = (typeof message === 'string'
      ? message.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      : '').slice(0, 5000);

    const subjectLineParts = [`[お問い合わせ] ${safeSubject}`];
    if (safeName) subjectLineParts.push(`- ${safeName}`);
    const subjectLine = subjectLineParts.join(' ');

    const nowIso = new Date().toISOString();
    const textLines = [
      'ボーイスカウト多治見第一団のサイトから新しいお問い合わせを受信しました。',
      '',
      `お名前: ${safeName || '(未入力)'}`,
      `メールアドレス: ${safeEmail || '(未入力)'}`,
    ];

    if (safePhone) {
      textLines.push(`電話番号: ${safePhone}`);
    }

    textLines.push(`件名: ${safeSubject}`);
    textLines.push(`送信日時: ${nowIso}`);
    textLines.push('');
    textLines.push('----- お問い合わせ内容 -----');
    textLines.push(safeMessage || '(本文なし)');
    textLines.push('------------------------------');

    await sendMail({
      from: fromAddress,
      to: recipients,
      replyTo: safeEmail || undefined,
      subject: subjectLine,
      text: textLines.join('\n'),
    });

    return res.status(200).json({
      message: 'お問い合わせありがとうございます。担当者より改めてご連絡いたします。',
    });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    return res.status(500).json({
      error: 'failed_to_send',
      message: '送信に失敗しました。時間をおいて再度お試しください。',
    });
  }
};

module.exports = {
  handleContactForm,
};