// src/components/AddressManager/AddressFormSection.tsx

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface AddressFormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Reusable section wrapper for address forms
 * Provides consistent styling and structure across form sections
 */
const AddressFormSection: React.FC<AddressFormSectionProps> = ({
  title,
  description,
  children,
  icon,
}) => {
  return (
    <Card className="border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
};

export default AddressFormSection;
