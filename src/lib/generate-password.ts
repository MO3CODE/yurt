// أحرف بدون رموز متشابهة بصرياً (0/O، 1/I/l) لتسهيل كتابتها يدوياً لو احتاج الطالب
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return password;
}
