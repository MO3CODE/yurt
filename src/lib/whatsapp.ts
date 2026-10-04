import { displayLogin, LOGIN_DOMAIN } from "@/lib/student-import";

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildCredentialsMessage(params: {
  fullName: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  const { fullName, email, password, loginUrl } = params;
  const byPhone = email.endsWith(`@${LOGIN_DOMAIN}`);
  return [
    `مرحباً ${fullName} 👋`,
    `تم إنشاء حسابك في منصة متابعة السكن.`,
    ``,
    `${byPhone ? "اسم المستخدم (رقم هاتفك)" : "اسم المستخدم (البريد الإلكتروني)"}: ${displayLogin(email)}`,
    `كلمة المرور: ${password}`,
    `رابط الدخول: ${loginUrl}`,
    ``,
    `يُفضّل تغيير كلمة المرور بعد أول تسجيل دخول من صفحة "الملف الشخصي".`,
  ].join("\n");
}
