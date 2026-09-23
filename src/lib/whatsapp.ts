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
  return [
    `مرحباً ${fullName} 👋`,
    `تم إنشاء حسابك في منصة متابعة السكن.`,
    ``,
    `اسم المستخدم (البريد الإلكتروني): ${email}`,
    `كلمة المرور: ${password}`,
    `رابط الدخول: ${loginUrl}`,
    ``,
    `يُفضّل تغيير كلمة المرور بعد أول تسجيل دخول من صفحة "الملف الشخصي".`,
  ].join("\n");
}
