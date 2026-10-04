import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // التبويب الذي زاره الطالب قبل أقل من ٣٠ ثانية يظهر فوراً بلا تحميل.
    // الـ server actions (revalidatePath) والتحديث الحي (router.refresh) يلغيان هذا التخزين عند تغيّر البيانات.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
