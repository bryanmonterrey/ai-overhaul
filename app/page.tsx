// src/app/page.tsx

import { Button } from "@/components/ui/button";
import { Link } from "next-view-transitions";
import React from "react";
import { Magnetic } from "./components/common/MagButton";

export default function Home() {
  const springOptions = { bounce: 0.1 };

  return (
    <div className="items-center justify-center flex w-screen h-full font-ia">  
    <div className="inline-block gap-4 space-y-4">
                {/* Spending Card - Full Width */}
                <Magnetic
                  intensity={0.2}
                  springOptions={springOptions}
                  actionArea='global'
                  range={200}
          
                >
               <div className="border-zinc-900 font-medium hover:cursor-pointer border-2 bg-[#0D0E15]   hover:bg-[#00FFA2] hover:border-[#00FFA2] hover:text-[#11111A] transition-colors ease-in-out duration-300 rounded-lg p-4 text-white flex flex-col items-center">
                <Link href="/chat">
                  <Button className="hover:bg-transparent text-inherit bg-transparent font-bold text-lg shadow-none rounded-lg p-4 pt-4 px-4 flex flex-col space-y-2">           
                    chat
                  </Button>
                  </Link>
                </div>
                </Magnetic>
                

                {/* Card 1 */}
                <Magnetic
                  intensity={0.2}
                  springOptions={springOptions}
                  actionArea='global'
                  range={200}
                  
                >
                <div className="border-zinc-900 font-medium hover:cursor-pointer bg-[#0D0E15] hover:bg-[#00FFA2] hover:border-[#00FFA2] hover:text-[#11111A] transition-colors ease-in-out duration-300 border-2 col-span-1 rounded-lg p-4 text-white flex flex-col items-center">
                  <Link href="/conversations">
                <Button className="hover:bg-transparent text-inherit bg-transparent font-bold text-lg shadow-none rounded-lg p-4 pt-4 px-4 flex flex-col space-y-2">
                    conversations
                  </Button>
                  </Link>
                </div>
                </Magnetic> 
                </div>
    </div>
  );
}
