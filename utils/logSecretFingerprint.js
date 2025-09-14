const crypto = require("crypto");

function logSecretFingerprint(name, value) {
  if (!value) return;
  const h = crypto.createHash("sha256").update(value).digest("hex");
  console.log(`[${name}] sha256=${h.slice(0,8)} len=${value.length}`);
}

module.exports = { logSecretFingerprint };

