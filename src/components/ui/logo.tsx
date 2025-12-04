'use client'

import React from 'react';
import { getCloudinaryUrl } from '@/lib/cloudinary';

const Logo = () => {
  return (
    <div className="mt-4 flex flex-col items-center">
      <img
        src={getCloudinaryUrl('logo/new-logo-ready-set')}
        alt="Company logo"
        className="mb-2 h-auto w-24"
      />
      <div className="rounded-lg bg-black px-4 py-0 text-white">
        <p className="text-sm tracking-wider">READY SET GROUP, LLC</p>
      </div>
    </div>
  );
};

export default Logo;