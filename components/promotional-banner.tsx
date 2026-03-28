"use client";

import { ExternalLink, Instagram, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import Image from "next/image";

export function PromotionalBanner() {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg bg-white">
            <Image
              src="https://scontent.fktw1-1.fna.fbcdn.net/v/t39.30808-6/633197112_25780169918311194_3295348389581314951_n.jpg?_nc_cat=104&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=zHeOuX3uZw0Q7kNvwFZ4fXV&_nc_oc=AdoElYekMeJ_WPakz8EI7k0N5xOaW5U6iKi37l9xYZIZznJ9UvcF3xzG1ZaJRMQuiQM&_nc_zt=23&_nc_ht=scontent.fktw1-1.fna&_nc_gid=5D6AmzY7gd-il62bIsQQKQ&_nc_ss=7a32e&oh=00_AfzgK4X1aKLzYBWFnMfd4n_V2YDfM63CfG8At9AQtWciAw&oe=69CE1B9F"
              alt="DriveCheck Performance Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              DriveCheck Performance
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Ekspert techniczny – sprawdzanie auta przed zakupem | Wrocław
            </p>
          </div>
        </div>
        <a
          href="https://www.instagram.com/drivecheckperformance"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all font-medium shadow-md hover:shadow-lg"
        >
          Zobacz na Instagram
          <Instagram className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
