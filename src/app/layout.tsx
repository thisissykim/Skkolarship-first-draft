import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skkolarship",
  description: "성균관대학교 학생을 위한 AI 장학금 매칭 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
