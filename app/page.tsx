// src/app/page.tsx

import React from "react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="items-center justify-items-center h-full p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <Image src="/s.png" alt="logo" width={800} height={500} />
    </div>
  );
}
