// VietQR (NAPAS EMVCo) payload for a bank transfer to an account, without a fixed amount.
// Any Vietnamese banking app can scan it; the payer chooses the amount.

function tlv(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}

// CRC-16/CCITT-FALSE, as required by EMVCo field 63
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function vietQrPayload({ bankBin, accountNumber, note }) {
  const merchant =
    tlv("00", "A000000727") +
    tlv("01", tlv("00", bankBin) + tlv("01", accountNumber)) +
    tlv("02", "QRIBFTTA");
  const payload =
    tlv("00", "01") +
    tlv("01", "11") + // static QR
    tlv("38", merchant) +
    tlv("53", "704") + // VND
    tlv("58", "VN") +
    (note ? tlv("62", tlv("08", note)) : "") +
    "6304";
  return payload + crc16(payload);
}
